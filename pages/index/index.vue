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

			<view v-if="metricsA.recordCount === 0" class="inline-validate">
				<text class="inline-validate__text">{{ reportValidateMessages.siteA }}</text>
			</view>

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

			<view v-if="metricsB.recordCount === 0" class="inline-validate">
				<text class="inline-validate__text">{{ reportValidateMessages.siteB }}</text>
			</view>

			<view class="accuracy-tip">
				<uni-icons type="info" size="30rpx" color="#5c6370" />
				<text class="accuracy-tip__text">{{ COMPARE_USAGE_ACCURACY_HINT }}</text>
			</view>

			<view v-if="cloudSyncStatus === 'ok'" class="sync-saved">
				<text class="sync-saved__text">草稿已自动保存</text>
			</view>

			<view v-if="cloudSyncStatus === 'failed'" class="sync-fail">
				<uni-icons type="alert-filled" size="28rpx" color="#d04a4a" />
				<text class="sync-fail__text">云端同步失败，可重试</text>
				<view class="sync-fail__cta" @click="retryCloudPersist">
					<text class="sync-fail__cta-text">重试</text>
				</view>
			</view>

			<view v-if="!canGenerateReport" class="report-validate">
				<uni-icons type="info" size="26rpx" color="#5c6370" />
				<text class="report-validate__text">{{ reportValidateMessage }}</text>
			</view>

			<view class="cta-wrap">
				<view class="cta" :class="{ 'cta--disabled': !canGenerateReport }" hover-class="cta--hover" @click="onReport">
					<uni-icons type="bars" size="44rpx" color="#ffffff" />
					<text class="cta__text">{{ canGenerateReport ? '生成性价比对比报告' : '完善后生成报告' }}</text>
				</view>
			</view>

			<view class="scroll-pad" />
		</view>

		<app-tab-bar current="calc" />
	</view>
</template>

<script setup>
import { ref, reactive, onMounted, watch, computed } from 'vue'
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

const cloudSyncStatus = ref('idle') // idle | syncing | ok | failed
const cloudSyncLastError = ref('')
let cloudSyncFailedToastShown = false

function setCloudSyncFailed(errMsg) {
	cloudSyncStatus.value = 'failed'
	cloudSyncLastError.value = String(errMsg || '') || 'sync_failed'
	if (!cloudSyncFailedToastShown) {
		cloudSyncFailedToastShown = true
		uni.showToast({ title: '云端同步失败，已继续本地模式', icon: 'none' })
	}
}

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

function getReportValidationMessage() {
	const ma = computeStationMetrics(siteA)
	const mb = computeStationMetrics(siteB)
	if (ma.recordCount > 0 && mb.recordCount === 0) return reportValidateMessages.siteB
	if (ma.recordCount === 0 && mb.recordCount > 0) return reportValidateMessages.siteA
	if (ma.recordCount === 0 && mb.recordCount === 0) return reportValidateMessages.both
	// 理论上两边都有记录时不会触达这里，但兜底返回
	return reportValidateMessages.both
}

const canGenerateReport = ref(false)
const reportValidateMessage = ref(reportValidateMessages.both)

const metricsA = computed(() => computeStationMetrics(siteA))
const metricsB = computed(() => computeStationMetrics(siteB))

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

	cloudSyncStatus.value = 'syncing'
	const cloud = await loadCompareDraftFromCloud(oid)
	if (!cloud) return

	const lTs = local?.updatedAt ?? 0
	const cTs = cloud.updatedAt
	if (cTs > lTs) {
		applySites(cloud.siteA, cloud.siteB)
		saveCompareDraftLocal(siteA, siteB, cTs)
	}
	cloudSyncStatus.value = 'ok'
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

	cloudSyncStatus.value = 'syncing'
	const serverTs = await saveCompareDraftToCloud(oid, siteA, siteB)
	if (serverTs != null && serverTs !== ts) {
		saveCompareDraftLocal(siteA, siteB, serverTs)
	}
	if (serverTs == null) {
		setCloudSyncFailed('persist_failed')
		return
	}
	cloudSyncStatus.value = 'ok'
}

watch([siteA, siteB], () => schedulePersist(), { deep: true })

watch([siteA, siteB], () => {
	const ma = computeStationMetrics(siteA)
	const mb = computeStationMetrics(siteB)
	const ok = ma.recordCount > 0 && mb.recordCount > 0
	canGenerateReport.value = ok
	reportValidateMessage.value = getReportValidationMessage()
}, { deep: true, immediate: true })

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
			cloudSyncStatus.value = 'syncing'
			try {
				await withTimeout(
					saveCompareDraftToCloud(oid, siteA, siteB),
					12000,
					'restore_timeout'
				)
				cloudSyncStatus.value = 'ok'
			} catch (e) {
				setCloudSyncFailed(e?.message || 'restore_failed')
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
		cloudSyncStatus.value = 'failed'
		setCloudSyncFailed(e?.message || 'hydrate_failed')
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
	uni.showModal({
		title: '清空站点 A',
		content: '确定清空站点 A 的配置与使用记录？该操作会同步影响本地对比草稿。',
		success: (res) => {
			if (!res.confirm) return
			suppressPersist = true
			Object.assign(siteA, initialSiteA())
			suppressPersist = false
			schedulePersist()
			uni.showToast({ title: '已清空站点 A', icon: 'none' })
		}
	})
}

function onClearB() {
	uni.showModal({
		title: '清空站点 B',
		content: '确定清空站点 B 的配置与使用记录？该操作会同步影响本地对比草稿。',
		success: (res) => {
			if (!res.confirm) return
			suppressPersist = true
			Object.assign(siteB, initialSiteB())
			suppressPersist = false
			schedulePersist()
			uni.showToast({ title: '已清空站点 B', icon: 'none' })
		}
	})
}

function onRefresh() {
	uni.showModal({
		title: '重置对比配置',
		content: '确定要重置为初始状态？本地草稿会被清空，并尝试清除云端草稿。',
		success: (res) => {
			if (!res.confirm) return
			suppressPersist = true
			Object.assign(siteA, initialSiteA())
			Object.assign(siteB, initialSiteB())
			suppressPersist = false
			clearCompareDraft()
			void clearCompareDraftCloud(getStoredOpenid())
			uni.showToast({ title: '已重置', icon: 'none' })
		}
	})
}

async function onReport() {
	if (!(await ensureLoggedInOrPrompt())) return
	if (!canGenerateReport.value) {
		uni.showToast({ title: '请先完善 A/B 使用记录', icon: 'none' })
		return
	}
	const ma = computeStationMetrics(siteA)
	const mb = computeStationMetrics(siteB)
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
	if (saved && saved.id) {
		uni.navigateTo({ url: '/pages/report/report?id=' + encodeURIComponent(saved.id) })
	} else {
		uni.navigateTo({ url: '/pages/report/report' })
	}
}

async function retryCloudPersist() {
	const oid = getStoredOpenid()
	if (!oid) {
		cloudSyncStatus.value = 'idle'
		uni.showToast({ title: '请先登录后再同步', icon: 'none' })
		return
	}
	showLoading('重试同步中')
	cloudSyncStatus.value = 'syncing'
	try {
		const serverTs = await saveCompareDraftToCloud(oid, siteA, siteB)
		if (serverTs == null) {
			setCloudSyncFailed('persist_failed')
			return
		}
		cloudSyncStatus.value = 'ok'
		uni.showToast({ title: '同步成功', icon: 'none' })
	} finally {
		hideLoading()
	}
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

.cta--disabled {
	opacity: 0.6;
	filter: grayscale(0.2);
	pointer-events: none;
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

.sync-fail {
	margin: 12rpx 4rpx 0;
	padding: 16rpx 18rpx;
	background: #fff5f5;
	border-radius: 14rpx;
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: flex-start;
	gap: 10rpx;
}

.sync-fail__text {
	flex: 1;
	font-size: 24rpx;
	color: #8a1f1f;
	font-weight: 600;
}

.sync-fail__cta {
	padding: 10rpx 16rpx;
	background: #d04a4a;
	border-radius: 999rpx;
}

.sync-fail__cta-text {
	font-size: 22rpx;
	font-weight: 800;
	color: #ffffff;
}

.sync-saved {
	margin: 12rpx 4rpx 0;
	padding: 14rpx 18rpx;
	background: rgba(238, 242, 248, 0.75);
	border-radius: 14rpx;
}

.sync-saved__text {
	font-size: 22rpx;
	color: #7a8190;
	font-weight: 500;
}

.report-validate {
	margin: 12rpx 4rpx 0;
	padding: 16rpx 18rpx;
	background: #eef2f8;
	border-radius: 14rpx;
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: flex-start;
	gap: 10rpx;
}

.report-validate__text {
	flex: 1;
	font-size: 24rpx;
	color: #5c6370;
	font-weight: 600;
}

.inline-validate {
	margin: -10rpx 4rpx 10rpx;
	padding: 10rpx 12rpx;
	background: #fff;
	border-radius: 14rpx;
	border: 1rpx dashed #e8ebf1;
}

.inline-validate__text {
	font-size: 22rpx;
	color: #8a8f99;
	line-height: 1.4;
	font-weight: 600;
}
</style>
