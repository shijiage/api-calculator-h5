<template>
	<view class="page">
		<view class="status-bar" :style="{ height: statusBarH + 'px' }" />
		<mine-page-header title="个人中心" :show-settings="false" @back="onBack" @settings="onSettings" />

		<scroll-view class="scroll" scroll-y :show-scrollbar="false">
			<mine-user-profile
				:nickname="nicknameDisplay"
				:uid-display="uidDisplay"
				:avatar-url="avatarUrl"
				:enable-wx-avatar="enableWxAvatar"
				@avatar-change="onAvatarChange"
				@nickname-change="onNicknameChange"
			/>

			<mine-stats-cards
				:labels="mineStatLabels"
				:history-count="historyCount"
				:favorites-count="favoritesCount"
				:saved-display="savedDisplay"
				:trend-tag="historyTrendTag"
			/>

			<mine-menu-groups :groups="mineMenuGroups" @select="onMenu" />

			<view class="logout" hover-class="logout--hover" @click="onLogout">
				<uni-icons type="undo" size="32rpx" color="#6b7288" />
				<text class="logout__text">退出登录</text>
			</view>

			<view class="foot-pad" />
		</scroll-view>

		<app-tab-bar current="mine" :show-calc-plus="false" />
	</view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import MinePageHeader from '@/components/mine-page-header/mine-page-header.vue'
import MineUserProfile from '@/components/mine-user-profile/mine-user-profile.vue'
import MineStatsCards from '@/components/mine-stats-cards/mine-stats-cards.vue'
import MineMenuGroups from '@/components/mine-menu-groups/mine-menu-groups.vue'
import AppTabBar from '@/components/app-tab-bar/app-tab-bar.vue'
import { getStoredOpenid, getStoredUserCount, clearLogin } from '@/common/auth.js'
import { getReportHistoryList, syncReportHistoryFromCloud } from '@/common/report-history.js'
import { getCaseFavoriteCount } from '@/common/case-favorites.js'
import { runEnvSelfCheck, formatEnvSelfCheckText } from '@/common/env-health.js'
import { getUserSegment, getGrowthSnapshot } from '@/common/analytics.js'
import {
	minePageDefaults,
	mineMenuGroups,
	mineStatLabels,
	CLOUD_CALL_TIMEOUT_MS,
	MINE_WX_AVATAR_STORAGE_KEY,
	MINE_DISPLAY_NICKNAME_STORAGE_KEY
} from '@/common/data.js'

const statusBarH = ref(20)
const avatarUrl = ref('')
const nicknameDisplay = ref(minePageDefaults.nickname)
const userCount = ref(0)
const historyCount = ref(0)
const favoritesCount = ref(0)

function showLoading(title) {
	uni.showLoading({ title: title || '加载中', mask: true })
}

function hideLoading() {
	uni.hideLoading()
}

onMounted(() => {
	const sys = uni.getSystemInfoSync()
	statusBarH.value = sys.statusBarHeight || 20
})

function readNicknameFromStorage() {
	try {
		const n = uni.getStorageSync(MINE_DISPLAY_NICKNAME_STORAGE_KEY)
		if (n && String(n).trim()) {
			nicknameDisplay.value = String(n).trim()
			return
		}
	} catch (e) {}
	nicknameDisplay.value = minePageDefaults.nickname
}

onShow(async () => {
	userCount.value = getStoredUserCount()
	if (getStoredOpenid()) {
		showLoading('同步中')
		try {
			await syncReportHistoryFromCloud()
			favoritesCount.value = await getCaseFavoriteCount()
		} finally {
			hideLoading()
		}
	} else {
		favoritesCount.value = 0
	}
	historyCount.value = getReportHistoryList().length
	try {
		avatarUrl.value = String(uni.getStorageSync(MINE_WX_AVATAR_STORAGE_KEY) || '')
	} catch (e) {
		avatarUrl.value = ''
	}
	const openid = getStoredOpenid()
	// 若本地没有缓存头像，尝试从云端读取（换机后也可恢复）
	if (openid && !avatarUrl.value) {
		try {
			await loadAvatarFromCloud(openid)
		} catch (e) {}
	}
	readNicknameFromStorage()
})

const enableWxAvatar = computed(() => !!getStoredOpenid())

async function onAvatarChange(url) {
	if (!url) return
	// 先本地展示，提升交互速度
	try {
		uni.setStorageSync(MINE_WX_AVATAR_STORAGE_KEY, url)
	} catch (e) {}
	avatarUrl.value = url

	const openid = getStoredOpenid()
	if (!openid) return

	let loadingClosed = false
	showLoading('上传中')
	try {
		const guessExtFromUrl = (u) => {
			try {
				const m = String(u).match(/\.([a-zA-Z0-9]{1,5})(?:\?|#|$)/)
				if (!m || !m[1]) return 'jpg'
				const ext = String(m[1]).toLowerCase()
				if (ext === 'jpeg' || ext === 'jpg' || ext === 'png' || ext === 'webp' || ext === 'gif') return ext
			} catch (e) {}
			return 'jpg'
		}

		const ext = guessExtFromUrl(url)

		// 1) 下载 tmp 资源到客户端本地临时文件
		const tempFilePath = await new Promise((resolve, reject) => {
			uni.downloadFile({
				url,
				success: (res) => {
					if (res && res.tempFilePath) resolve(res.tempFilePath)
					else reject(new Error('downloadFile: missing tempFilePath'))
				},
				fail: (e) => reject(e || new Error('downloadFile failed'))
			})
		})

		// 2) 上传到 uniCloud 云存储
		const up = await uniCloud.uploadFile({
			filePath: tempFilePath,
			cloudPath: `avatars/${openid}.${ext}`
		})

		const fileID = up && up.fileID ? String(up.fileID) : ''
		if (!fileID) {
			uni.showToast({ title: '头像上传失败：缺少 fileID', icon: 'none' })
			return
		}

		// 3) 把 fileID 写回数据库（云函数只做写入）
		const res = await uniCloud.callFunction({
			name: 'user-profile',
			data: { action: 'set-avatar-fileid', openid, fileID },
			timeout: CLOUD_CALL_TIMEOUT_MS
		})
		const payload = res && res.result ? res.result : null
		if (!payload || payload.errCode !== 0) {
			uni.showToast({ title: `头像保存失败：${(payload && payload.errMsg) || '未知错误'}`, icon: 'none' })
			return
		}

		// 上传与写库已完成，先关闭 loading，避免临时 URL 转换较慢时一直转圈
		hideLoading()
		loadingClosed = true

		// 4) 拉取可展示的临时 URL（失败不影响上传结果）
		try {
			const tempUrl = await fileIDToTempURL(fileID)
			if (tempUrl) {
				avatarUrl.value = tempUrl
				try {
					uni.setStorageSync(MINE_WX_AVATAR_STORAGE_KEY, tempUrl)
				} catch (e) {}
			}
		} catch (e) {}

		uni.showToast({ title: '头像上传成功', icon: 'success' })
	} catch (e) {
		const msg = (e && (e.errMsg || e.message)) || '头像上传失败'
		uni.showToast({ title: msg, icon: 'none' })
	} finally {
		if (!loadingClosed) hideLoading()
	}
}

function onNicknameChange(name) {
	const t = String(name || '').trim()
	try {
		if (t) uni.setStorageSync(MINE_DISPLAY_NICKNAME_STORAGE_KEY, t)
		else uni.removeStorageSync(MINE_DISPLAY_NICKNAME_STORAGE_KEY)
	} catch (e) {}
	readNicknameFromStorage()
}

const uidDisplay = computed(() => {
	const id = getStoredOpenid()
	if (!id) return '—'
	const tail = id.length > 4 ? id.slice(-4) : id
	return `${id.slice(0, 4)}-****-${tail}`
})

async function fileIDToTempURL(fileID) {
	if (!fileID) return ''
	// 不同端/版本的 uniCloud 可能方法名不同，这里做兜底
	if (!uniCloud || typeof uniCloud.getTempFileURL !== 'function') return ''
	const r = await uniCloud.getTempFileURL({ fileList: [{ fileID }] })
	const url = r && r.fileList && r.fileList[0] ? r.fileList[0].tempFileURL : ''
	return url ? String(url) : ''
}

async function loadAvatarFromCloud(openid) {
	if (!openid) return
	const res = await uniCloud.callFunction({
		name: 'user-profile',
		data: { action: 'get-avatar', openid },
		timeout: CLOUD_CALL_TIMEOUT_MS
	})
	const payload = res && res.result ? res.result : null
	const fileID = payload && payload.errCode === 0 ? payload.fileID : ''
	if (!fileID) return
	const tempUrl = await fileIDToTempURL(fileID)
	if (!tempUrl) return
	avatarUrl.value = tempUrl
	try {
		uni.setStorageSync(MINE_WX_AVATAR_STORAGE_KEY, tempUrl)
	} catch (e) {}
}

const historyTrendTag = computed(() => {
	return historyCount.value > 0 ? minePageDefaults.historyTrendTag : ''
})

const savedDisplay = computed(() => {
	let sum = 0
	for (const it of getReportHistoryList()) {
		if (it && typeof it.savingCny === 'number') sum += it.savingCny
	}
	if (sum <= 0) return '¥0'
	if (sum >= 10000) {
		const k = sum / 10000
		const s = k >= 10 ? Math.round(k) + 'k' : k.toFixed(1).replace(/\.0$/, '') + 'k'
		return '¥' + s
	}
	return '¥' + Math.round(sum)
})

function onBack() {
	uni.redirectTo({ url: '/pages/index/index' })
}

function onSettings() {
	uni.showToast({ title: '设置即将上线', icon: 'none' })
}

async function onMenu(key) {
	switch (key) {
		case 'records':
			uni.redirectTo({ url: '/pages/records/records' })
			break
		case 'reports':
			uni.redirectTo({ url: '/pages/records/records' })
			break
		case 'testCases':
			uni.navigateTo({ url: '/pages/test-cases/test-cases' })
			break
		case 'guide':
			uni.showModal({
				title: '算法指南',
				content:
					'核心逻辑与 Web 版一致：\n① 充值比例 = 充值金额(¥)÷获得额度($)\n② 每条人民币 = 消耗额度($)×比例\n③ 每1K均价 = 总人民币÷总Tokens×1000\n④ 对比以每1K均价更低为优。',
				showCancel: false
			})
			break
		case 'feedback':
			uni.showToast({ title: '请通过小程序「意见反馈」入口联系我们', icon: 'none' })
			break
		case 'envCheck':
			showLoading('自检中')
			try {
				const res = await runEnvSelfCheck()
				uni.showModal({
					title: '环境自检结果',
					content: formatEnvSelfCheckText(res),
					showCancel: false
				})
			} finally {
				hideLoading()
			}
			break
		case 'about':
			{
				const seg = getUserSegment()
				const growth = getGrowthSnapshot()
			uni.showModal({
				title: '关于性价比助手',
				content: `本地计算双站 API 成本，已登录用户数（云端）：${userCount.value}\n当前分层：${seg}\n北极星（本机周活跃生成报告用户）：${growth.northStarWeeklyReportUserLocal}\n近7天有报告行为天数：${growth.weeklyReportActiveDays}`,
				showCancel: false
			})
			}
			break
		default:
			break
	}
}

function onLogout() {
	uni.showModal({
		title: '退出登录',
		content: '清除本地登录状态，下次进入需重新授权。',
		success(res) {
			if (!res.confirm) return
			clearLogin()
			try {
				uni.removeStorageSync(MINE_WX_AVATAR_STORAGE_KEY)
				uni.removeStorageSync(MINE_DISPLAY_NICKNAME_STORAGE_KEY)
			} catch (e) {}
			avatarUrl.value = ''
			nicknameDisplay.value = minePageDefaults.nickname
			uni.reLaunch({ url: '/pages/login/login' })
		}
	})
}
</script>

<style scoped lang="scss">
.page {
	min-height: 100vh;
	background: #f8f9fb;
	padding-bottom: calc(160rpx + env(safe-area-inset-bottom));
	box-sizing: border-box;
	display: flex;
	flex-direction: column;
}

.status-bar {
	width: 100%;
	flex-shrink: 0;
}

.scroll {
	flex: 1;
	height: 0;
	padding: 0 20rpx;
	box-sizing: border-box;
}

.logout {
	margin: 16rpx 8rpx 32rpx;
	height: 96rpx;
	border-radius: 20rpx;
	background: #eef0f4;
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: center;
}

.logout--hover {
	opacity: 0.9;
}

.logout__text {
	margin-left: 12rpx;
	font-size: 30rpx;
	font-weight: 600;
	color: #6b7288;
}

.foot-pad {
	height: 24rpx;
}
</style>
