<template>
	<view class="page">
		<view class="status-bar" :style="{ height: statusBarH + 'px' }" />
		<view class="nav-bar">
			<view class="nav-bar__left">
				<text class="nav-bar__title">性价比助手</text>
			</view>
			<view class="nav-bar__right" @click="onRefresh">
			</view>
		</view>

		<view>
			<site-config-card
				site-label="A"
				add-style="link"
				:site="siteA"
				@update:site="onUpdateA"
				@clear="onClearA"
			/>

			<view class="compare">
				<uni-icons type="arrow-up" size="32rpx" color="#d5dae2" class="compare__i compare__i1" />
				<uni-icons type="arrow-down" size="32rpx" color="#d5dae2" class="compare__i compare__i2" />
			</view>

			<site-config-card
				site-label="B"
				add-style="link"
				:site="siteB"
				@update:site="onUpdateB"
				@clear="onClearB"
			/>

			<view class="accuracy-tip">
				<uni-icons type="info" size="30rpx" color="#5c6370" />
				<text class="accuracy-tip__text">{{ COMPARE_USAGE_ACCURACY_HINT }}</text>
			</view>

			<view class="cta-wrap">
				<view class="cta" hover-class="cta--hover" @click="onReport">
					<uni-icons type="bars" size="44rpx" color="#ffffff" />
					<text class="cta__text">生成性价比对比报告</text>
				</view>
			</view>

			<view class="scroll-pad" />
		</view>

		<app-tab-bar current="calc" />
	</view>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getStoredOpenid, ensureLoggedInOrPrompt } from '@/common/auth.js'
import SiteConfigCard from '@/components/site-config-card/site-config-card.vue'
import AppTabBar from '@/components/app-tab-bar/app-tab-bar.vue'
import {
	initialSiteA,
	initialSiteB,
	COMPARE_USAGE_ACCURACY_HINT,
	reportValidateMessages,
	FIRST_CALC_GUIDE_SHOWN_KEY
} from '@/common/data.js'
import {
	computeStationMetrics,
	compareStations,
	buildReportPayload,
	REPORT_STORAGE_KEY
} from '@/common/calculator.js'
import {
	pushReportHistory,
	consumePendingRestoreSites,
	retryReportCloudSyncById
} from '@/common/report-history.js'
import {
	markAppVisit,
	trackFunnelEvent,
	markFirstRecordFilledIfNeeded,
	markReportGenerated
} from '@/common/analytics.js'
import {
	loadCompareDraft,
	saveCompareDraftLocal,
	clearCompareDraft,
	loadCompareDraftFromCloud,
	saveCompareDraftToCloud,
	clearCompareDraftCloud
} from '@/common/compare-storage.js'

const statusBarH = ref(20)
const siteA = reactive(initialSiteA())
const siteB = reactive(initialSiteB())

/** 每个页面实例只做一次本地/云端合并，避免切 Tab 时用旧云端覆盖未落盘编辑 */
const initialHydrateDone = ref(false)

let suppressPersist = false
let debounceTimer = null
let loadingGuardTimer = null

function showLoading(title) {
	uni.showLoading({ title: title || '加载中', mask: true })
	// 兜底：避免极端情况下 Promise 挂起导致 loading 永不关闭
	if (loadingGuardTimer) clearTimeout(loadingGuardTimer)
	loadingGuardTimer = setTimeout(() => {
		uni.hideLoading()
		loadingGuardTimer = null
	}, 15000)
}

function hideLoading() {
	if (loadingGuardTimer) {
		clearTimeout(loadingGuardTimer)
		loadingGuardTimer = null
	}
	uni.hideLoading()
}

function withTimeout(task, ms, msg) {
	return Promise.race([
		task,
		new Promise((_, reject) =>
			setTimeout(() => reject(new Error(msg || 'timeout')), ms)
		)
	])
}

function showFirstCalcGuideIfNeeded() {
	try {
		const shown = uni.getStorageSync(FIRST_CALC_GUIDE_SHOWN_KEY)
		if (shown) return
		uni.setStorageSync(FIRST_CALC_GUIDE_SHOWN_KEY, 1)
	} catch (e) {}
	uni.showModal({
		title: '30秒上手',
		content:
			'① 填写站点 A/B 的充值金额与获得额度\n② 在使用记录里至少各添加一条「消耗额度($) > 0」\n③ 点击「生成性价比对比报告」查看结论',
		showCancel: false,
		confirmText: '知道了'
	})
}

function applySites(siteADraft, siteBDraft) {
	suppressPersist = true
	try {
		Object.assign(siteA, siteADraft)
		Object.assign(siteB, siteBDraft)
	} finally {
		suppressPersist = false
	}
}

async function hydrateCompareDraft() {
	const local = loadCompareDraft()
	if (local) {
		applySites(local.siteA, local.siteB)
	}

	const oid = getStoredOpenid()
	if (!oid) return

	const cloud = await loadCompareDraftFromCloud(oid)
	if (!cloud) return

	const lTs = local?.updatedAt ?? 0
	const cTs = cloud.updatedAt
	if (cTs > lTs) {
		applySites(cloud.siteA, cloud.siteB)
		saveCompareDraftLocal(siteA, siteB, cTs)
	}
}

function schedulePersist() {
	if (suppressPersist) return
	if (debounceTimer) clearTimeout(debounceTimer)
	debounceTimer = setTimeout(() => {
		debounceTimer = null
		void persistCompareDraft()
	}, 600)
}

async function persistCompareDraft() {
	const ts = saveCompareDraftLocal(siteA, siteB)
	const oid = getStoredOpenid()
	if (!oid) return
	const serverTs = await saveCompareDraftToCloud(oid, siteA, siteB)
	if (serverTs != null && serverTs !== ts) {
		saveCompareDraftLocal(siteA, siteB, serverTs)
	}
}

watch([siteA, siteB], () => schedulePersist(), { deep: true })

onMounted(() => {
	const sys = uni.getSystemInfoSync()
	statusBarH.value = sys.statusBarHeight || 20
})

onShow(async () => {
	markAppVisit()
	trackFunnelEvent('enter_calc')
	const pending = consumePendingRestoreSites()
	if (pending) {
		applySites(pending.siteA, pending.siteB)
		saveCompareDraftLocal(siteA, siteB)
		const oid = getStoredOpenid()
		if (oid) {
			showLoading('恢复中')
			try {
				await withTimeout(
					saveCompareDraftToCloud(oid, siteA, siteB),
					12000,
					'restore_timeout'
				)
			} finally {
				hideLoading()
			}
		}
		if (!initialHydrateDone.value) initialHydrateDone.value = true
		uni.showToast({ title: '已恢复对比配置', icon: 'none' })
		return
	}
	if (initialHydrateDone.value) return
	initialHydrateDone.value = true
	showLoading('同步中')
	try {
		await withTimeout(hydrateCompareDraft(), 12000, 'hydrate_timeout')
	} catch (e) {
		uni.showToast({ title: '云端同步超时，已继续本地模式', icon: 'none' })
	} finally {
		hideLoading()
	}
	showFirstCalcGuideIfNeeded()
})

function onUpdateA(next) {
	Object.assign(siteA, next)
	const m = computeStationMetrics(siteA)
	if (m.recordCount > 0 && markFirstRecordFilledIfNeeded()) {
		trackFunnelEvent('fill_first_record')
	}
}

function onUpdateB(next) {
	Object.assign(siteB, next)
	const m = computeStationMetrics(siteB)
	if (m.recordCount > 0 && markFirstRecordFilledIfNeeded()) {
		trackFunnelEvent('fill_first_record')
	}
}

function onClearA() {
	suppressPersist = true
	Object.assign(siteA, initialSiteA())
	suppressPersist = false
	schedulePersist()
	uni.showToast({ title: '已清空站点 A', icon: 'none' })
}

function onClearB() {
	suppressPersist = true
	Object.assign(siteB, initialSiteB())
	suppressPersist = false
	schedulePersist()
	uni.showToast({ title: '已清空站点 B', icon: 'none' })
}

function onRefresh() {
	suppressPersist = true
	Object.assign(siteA, initialSiteA())
	Object.assign(siteB, initialSiteB())
	suppressPersist = false
	clearCompareDraft()
	void clearCompareDraftCloud(getStoredOpenid())
	uni.showToast({ title: '已重置', icon: 'none' })
}

async function onReport() {
	if (!(await ensureLoggedInOrPrompt())) return
	const ma = computeStationMetrics(siteA)
	const mb = computeStationMetrics(siteB)
	if (ma.recordCount === 0 || mb.recordCount === 0) {
		let content = reportValidateMessages.both
		if (ma.recordCount > 0 && mb.recordCount === 0) content = reportValidateMessages.siteB
		if (ma.recordCount === 0 && mb.recordCount > 0) content = reportValidateMessages.siteA
		uni.showModal({ title: '暂无法生成报告', content, showCancel: false })
		return
	}
	const cmp = compareStations(ma, mb)
	const payload = buildReportPayload(ma, mb, cmp)
	let saved = { id: '', cloudSynced: true }
	showLoading('生成中')
	try {
		uni.setStorageSync(REPORT_STORAGE_KEY, payload)
		saved = await pushReportHistory(payload, undefined, cmp.totalSavingCny, siteA, siteB)
	} catch (e) {
		uni.showModal({
			title: '生成失败',
			content: '报告保存失败，请检查本地存储空间后重试。',
			showCancel: false
		})
		return
	} finally {
		hideLoading()
	}
	if (!saved.cloudSynced && saved.id) {
		uni.showModal({
			title: '已本地保存',
			content: '报告已保存在本机，但云端同步失败。你可以稍后重试同步。',
			confirmText: '重试同步',
			cancelText: '稍后',
			success: async (res) => {
				if (!res.confirm) return
				showLoading('重试中')
				let ok = false
				try {
					ok = await retryReportCloudSyncById(saved.id)
				} finally {
					hideLoading()
				}
				uni.showToast({ title: ok ? '云端同步成功' : '重试失败', icon: 'none' })
			}
		})
	}
	markReportGenerated()
	trackFunnelEvent('generate_report')
	uni.navigateTo({ url: '/pages/report/report' })
}
</script>

<style scoped lang="scss">
.page {
	min-height: 100vh;
	background: #f7f8fa;
	padding: 0 28rpx;
	padding-bottom: calc(160rpx + env(safe-area-inset-bottom));
	box-sizing: border-box;
}

.status-bar {
	width: 100%;
	flex-shrink: 0;
}

.nav-bar {
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: space-between;
	padding: 12rpx 4rpx 24rpx;
}

.nav-bar__left {
	display: flex;
	flex-direction: row;
	align-items: center;
}

.nav-bar__title {
	font-size: 40rpx;
	font-weight: 700;
	color: #1a4a9e;
}

.nav-bar__right {
	padding: 8rpx;
}

.nav-bar__refresh {
	font-size: 26rpx;
	color: #5c6370;
	font-weight: 600;
}

.compare {
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: center;
	padding: 20rpx 0 24rpx;
	opacity: 0.85;
}

.compare__i {
	opacity: 0.55;
}

.compare__i1 {
	transform: rotate(52deg);
	margin-right: -12rpx;
}

.compare__i2 {
	transform: rotate(-128deg);
	margin-left: -12rpx;
}

.accuracy-tip {
	margin: 8rpx 4rpx 0;
	padding: 20rpx 22rpx;
	background: #eef2f8;
	border-radius: 16rpx;
	border-left: solid 6rpx #1a4a9e;
	display: flex;
	flex-direction: row;
	align-items: flex-start;
}

.accuracy-tip__text {
	flex: 1;
	margin-left: 12rpx;
	font-size: 24rpx;
	line-height: 1.55;
	color: #5c6370;
}

.cta-wrap {
	padding: 24rpx 4rpx 24rpx;
}

.cta {
	height: 96rpx;
	background: #1a4a9e;
	border-radius: 16rpx;
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: center;
	box-shadow: 0 8rpx 20rpx rgba(26, 74, 158, 0.25);
}

.cta--hover {
	opacity: 0.92;
}

.cta__text {
	margin-left: 16rpx;
	font-size: 30rpx;
	font-weight: 700;
	color: #ffffff;
}

.scroll-pad {
	height: calc(140rpx + env(safe-area-inset-bottom));
}
</style>
