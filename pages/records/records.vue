<template>
	<view class="page">
		<view class="status-bar" :style="{ height: statusBarH + 'px' }" />
		<view class="head">
			<text class="head__title">记录</text>
			<text class="head__sub">含当时 A/B 站点配置；登录后云端保存，本机同步（最多 {{ max }} 条）</text>
		</view>

		<view class="filters" v-if="list.length > 0">
			<picker class="picker" :range="timeFilterOptions" range-key="label" :value="timeFilterOptions.findIndex(x => x.key === timeFilter)" @change="timeFilter = timeFilterOptions[$event.detail.value].key">
				<view class="picker__inner">时间：{{ timeFilterOptions.find(x => x.key === timeFilter)?.label }}</view>
			</picker>
			<picker class="picker" :range="winnerFilterOptions" range-key="label" :value="winnerFilterOptions.findIndex(x => x.key === winnerFilter)" @change="winnerFilter = winnerFilterOptions[$event.detail.value].key">
				<view class="picker__inner">结果：{{ winnerFilterOptions.find(x => x.key === winnerFilter)?.label }}</view>
			</picker>
			<picker class="picker" :range="savingFilterOptions" range-key="label" :value="savingFilterOptions.findIndex(x => x.key === savingFilter)" @change="savingFilter = savingFilterOptions[$event.detail.value].key">
				<view class="picker__inner">节省：{{ savingFilterOptions.find(x => x.key === savingFilter)?.label }}</view>
			</picker>
			<view class="sort" @click="sortBy = sortBy === 'latest' ? 'saving' : 'latest'">
				排序：{{ sortBy === 'latest' ? '最新优先' : '节省优先' }}
			</view>
		</view>

		<view v-if="displayList.length === 0" class="empty">
			<text class="hint">暂无报告记录</text>
			<text class="hint hint--2">可调整筛选条件，或在对比页生成新报告</text>
			<view class="link" hover-class="link--hover" @click="goCalc">
				<text class="link__text">去对比</text>
				<uni-icons type="forward" size="28rpx" color="#1a4a9e" />
			</view>
		</view>

		<view v-else class="list">
			<view v-for="item in displayList" :key="item.id" class="card">
				<view class="card__top" hover-class="card__top--hover" @click="openHistory(item.id)">
					<view class="card__main">
						<text class="card__title">{{ item.title }}</text>
						<text class="card__time">{{ formatTime(item.ts) }}</text>
						<text class="card__meta">{{ formatSiteSummaryLine('A', item.siteA) }}</text>
						<text class="card__meta">{{ formatSiteSummaryLine('B', item.siteB) }}</text>
					</view>
					<uni-icons type="forward" size="28rpx" color="#c5cad6" />
				</view>
				<view
					class="card__restore"
					hover-class="card__restore--hover"
					@click.stop="onRestoreCompare(item)"
				>
					<uni-icons type="loop" size="28rpx" color="#1a4a9e" />
					<text class="card__restore-text">恢复对比配置并继续计算</text>
				</view>
				<view class="card__delete" hover-class="card__delete--hover" @click.stop="onDelete(item)">
					<uni-icons type="closeempty" size="28rpx" color="#d04a4a" />
					<text class="card__delete-text">删除记录</text>
				</view>
			</view>
		</view>

		<app-tab-bar current="records" :show-calc-plus="false" />
	</view>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppTabBar from '@/components/app-tab-bar/app-tab-bar.vue'
import { ensureLoggedInOrPrompt, getStoredOpenid } from '@/common/auth.js'
import {
	getReportHistoryList,
	syncReportHistoryFromCloud,
	formatSiteSummaryLine,
	setPendingRestoreSites,
	getReportSitesByIdAsync,
	reportRecordHasSites,
	deleteReportHistoryById,
	retryDeleteReportCloudById
} from '@/common/report-history.js'
import { REPORT_HISTORY_MAX_ITEMS } from '@/common/data.js'
import { trackFunnelEvent } from '@/common/analytics.js'

const statusBarH = ref(20)
const list = ref([])
const max = REPORT_HISTORY_MAX_ITEMS
const timeFilter = ref('all')
const winnerFilter = ref('all')
const savingFilter = ref('all')
const sortBy = ref('latest')

const timeFilterOptions = [
	{ key: 'all', label: '全部时间' },
	{ key: '7d', label: '近7天' },
	{ key: '30d', label: '近30天' }
]
const winnerFilterOptions = [
	{ key: 'all', label: '全部结果' },
	{ key: 'a', label: 'A胜' },
	{ key: 'b', label: 'B胜' }
]
const savingFilterOptions = [
	{ key: 'all', label: '全部金额' },
	{ key: '0-100', label: '¥0-100' },
	{ key: '100-500', label: '¥100-500' },
	{ key: '500+', label: '¥500+' }
]

function showLoading(title) {
	uni.showLoading({ title: title || '加载中', mask: true })
}

function hideLoading() {
	uni.hideLoading()
}

function getWinnerByItem(item) {
	const t = String((item && item.title) || '')
	if (t.includes('站点 A')) return 'a'
	if (t.includes('站点 B')) return 'b'
	return 'unknown'
}

function passTimeFilter(item) {
	if (timeFilter.value === 'all') return true
	const ts = Number(item.ts || 0)
	if (!ts) return false
	const now = Date.now()
	const days = timeFilter.value === '7d' ? 7 : 30
	return now - ts <= days * 24 * 60 * 60 * 1000
}

function passWinnerFilter(item) {
	if (winnerFilter.value === 'all') return true
	return getWinnerByItem(item) === winnerFilter.value
}

function passSavingFilter(item) {
	if (savingFilter.value === 'all') return true
	const v = Number(item.savingCny || 0)
	if (savingFilter.value === '0-100') return v >= 0 && v < 100
	if (savingFilter.value === '100-500') return v >= 100 && v < 500
	if (savingFilter.value === '500+') return v >= 500
	return true
}

const displayList = computed(() => {
	const arr = list.value
		.filter((it) => passTimeFilter(it) && passWinnerFilter(it) && passSavingFilter(it))
		.slice()
	if (sortBy.value === 'saving') {
		arr.sort((a, b) => Number(b.savingCny || 0) - Number(a.savingCny || 0))
	} else {
		arr.sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0))
	}
	return arr
})

onMounted(() => {
	const sys = uni.getSystemInfoSync()
	statusBarH.value = sys.statusBarHeight || 20
})

onShow(async () => {
	if (getStoredOpenid()) {
		showLoading('同步记录')
		try {
			await syncReportHistoryFromCloud()
		} finally {
			hideLoading()
		}
	}
	list.value = getReportHistoryList()
	trackFunnelEvent('view_records')
})

function formatTime(ts) {
	if (!ts) return ''
	const d = new Date(ts)
	const pad = (n) => (n < 10 ? '0' + n : '' + n)
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function openHistory(id) {
	uni.navigateTo({
		url: '/pages/report/report?id=' + encodeURIComponent(id)
	})
}

async function onRestoreCompare(item) {
	let siteA = item.siteA
	let siteB = item.siteB
	if (!reportRecordHasSites(item)) {
		if (!(await ensureLoggedInOrPrompt({ content: '从云端拉取当时的站点配置需先登录。' }))) return
		showLoading('恢复配置')
		try {
			const got = await getReportSitesByIdAsync(item.id)
			siteA = got && got.siteA
			siteB = got && got.siteB
		} finally {
			hideLoading()
		}
	}
	if (!siteA || !siteB) {
		uni.showModal({
			title: '恢复失败',
			content: '未能取回该记录的站点配置。可能云端未同步或网络异常，可重试。',
			confirmText: '重试',
			cancelText: '取消',
			success: (res) => {
				if (res.confirm) void onRestoreCompare(item)
			}
		})
		return
	}
	try {
		setPendingRestoreSites(siteA, siteB)
	} catch (e) {
		uni.showToast({ title: '写入失败', icon: 'none' })
		return
	}
	trackFunnelEvent('restore_compare')
	uni.redirectTo({ url: '/pages/index/index' })
}

async function goCalc() {
	if (!(await ensureLoggedInOrPrompt({ content: '使用对比功能请先完成微信登录。' }))) return
	uni.redirectTo({ url: '/pages/index/index' })
}

function onDelete(item) {
	uni.showModal({
		title: '删除记录',
		content: '删除后不可恢复，是否继续？',
		success: async (res) => {
			if (!res.confirm) return
			showLoading('删除中')
			let result = { localDeleted: false, cloudDeleted: false }
			try {
				result = await deleteReportHistoryById(item.id)
			} finally {
				hideLoading()
			}
			if (!result.localDeleted) {
				uni.showToast({ title: '删除失败', icon: 'none' })
				return
			}
			list.value = getReportHistoryList()
			if (!result.cloudDeleted && getStoredOpenid()) {
				uni.showModal({
					title: '本地已删除',
					content: '云端删除失败，记录可能仍存在于云端。是否立即重试？',
					confirmText: '重试',
					cancelText: '稍后',
					success: async (r2) => {
						if (!r2.confirm) return
						showLoading('重试中')
						let ok2 = false
						try {
							ok2 = await retryDeleteReportCloudById(item.id)
						} finally {
							hideLoading()
						}
						uni.showToast({ title: ok2 ? '云端删除成功' : '重试失败', icon: 'none' })
					}
				})
				return
			}
			uni.showToast({ title: '已删除', icon: 'none' })
		}
	})
}
</script>

<style scoped lang="scss">
.page {
	min-height: 100vh;
	background: #f7f8fa;
	padding-bottom: calc(140rpx + env(safe-area-inset-bottom));
}

.status-bar {
	width: 100%;
}

.head {
	padding: 24rpx 32rpx 16rpx;
}

.head__title {
	display: block;
	font-size: 40rpx;
	font-weight: 700;
	color: #1a1d24;
}

.head__sub {
	display: block;
	margin-top: 8rpx;
	font-size: 22rpx;
	color: #9aa0ab;
	line-height: 1.45;
}

.filters {
	display: flex;
	flex-wrap: wrap;
	gap: 12rpx;
	padding: 0 28rpx 12rpx;
}

.picker {
	flex: 1;
	min-width: 210rpx;
}

.picker__inner,
.sort {
	height: 64rpx;
	border-radius: 12rpx;
	background: #ffffff;
	border: 1rpx solid #e8ebf1;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 22rpx;
	color: #5c6370;
	padding: 0 10rpx;
	box-sizing: border-box;
}

.sort {
	min-width: 210rpx;
}

.empty {
	padding: 80rpx 32rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
}

.hint {
	font-size: 28rpx;
	color: #8a8f99;
	text-align: center;
}

.hint--2 {
	margin-top: 16rpx;
	font-size: 24rpx;
}

.link {
	margin-top: 48rpx;
	display: flex;
	flex-direction: row;
	align-items: center;
	padding: 20rpx 28rpx;
	background: #ffffff;
	border-radius: 16rpx;
	box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.05);
}

.link--hover {
	opacity: 0.9;
}

.link__text {
	font-size: 28rpx;
	font-weight: 600;
	color: #1a4a9e;
	margin-right: 8rpx;
}

.list {
	padding: 0 28rpx 24rpx;
}

.card {
	background: #ffffff;
	border-radius: 16rpx;
	margin-bottom: 20rpx;
	box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
	overflow: hidden;
}

.card__top {
	display: flex;
	flex-direction: row;
	align-items: center;
	padding: 24rpx 24rpx 16rpx;
}

.card__top--hover {
	opacity: 0.92;
}

.card__main {
	flex: 1;
	min-width: 0;
}

.card__title {
	display: block;
	font-size: 30rpx;
	font-weight: 600;
	color: #1a1d24;
	margin-bottom: 8rpx;
}

.card__time {
	display: block;
	font-size: 24rpx;
	color: #9aa0ab;
	margin-bottom: 12rpx;
}

.card__meta {
	display: block;
	font-size: 22rpx;
	color: #6b7288;
	line-height: 1.45;
	margin-top: 4rpx;
}

.card__restore {
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: center;
	padding: 20rpx 16rpx;
	border-top: 1rpx solid #eef0f4;
	background: #f8fafc;
}

.card__restore--hover {
	opacity: 0.88;
}

.card__restore-text {
	margin-left: 10rpx;
	font-size: 26rpx;
	font-weight: 600;
	color: #1a4a9e;
}

.card__delete {
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: center;
	padding: 18rpx 16rpx 20rpx;
	border-top: 1rpx solid #eef0f4;
	background: #fff5f5;
}

.card__delete--hover {
	opacity: 0.88;
}

.card__delete-text {
	margin-left: 10rpx;
	font-size: 25rpx;
	font-weight: 600;
	color: #d04a4a;
}
</style>
