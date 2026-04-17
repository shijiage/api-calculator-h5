<template>
	<view class="page">
		<view class="status-bar" :style="{ height: statusBarH + 'px' }" />
		<view class="nav">
			<view class="nav__side" @click="goBack">
				<uni-icons type="left" size="40rpx" color="#1a4a9e" />
			</view>
			<text class="nav__title">{{ reportRef.navTitle }}</text>
			<!-- #ifdef MP-WEIXIN -->
			<button class="share-btn" open-type="share" @click="onTapShare">
				<uni-icons type="redo" size="34rpx" color="#1a4a9e" />
			</button>
			<!-- #endif -->
			<!-- #ifndef MP-WEIXIN -->
			<view class="nav__side nav__side--right" />
			<!-- #endif -->
		</view>

		<view class="body">
			<report-hero :data="reportRef.hero" />
			<report-stat-cards :items="reportRef.statCards" />
			<report-unit-price :section="unitPriceSection" />
			<report-recharge-summary :data="reportRef.recharge" />
			<report-ratings :block="reportRef.ratings" />
			<!-- #ifdef MP-WEIXIN -->
			<button class="share-cta" open-type="share" @click="onTapShare">
				<uni-icons type="redo" size="34rpx" color="#ffffff" />
				<text class="share-cta__text">分享报告</text>
			</button>
			<!-- #endif -->
			<view class="pad" />
		</view>

		<app-tab-bar current="records" :show-calc-plus="false" />
	</view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onShow, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import ReportHero from '@/components/report-hero/report-hero.vue'
import ReportStatCards from '@/components/report-stat-cards/report-stat-cards.vue'
import ReportUnitPrice from '@/components/report-unit-price/report-unit-price.vue'
import ReportRechargeSummary from '@/components/report-recharge-summary/report-recharge-summary.vue'
import ReportRatings from '@/components/report-ratings/report-ratings.vue'
import AppTabBar from '@/components/app-tab-bar/app-tab-bar.vue'
import { reportPageData } from '@/common/data.js'
import { REPORT_STORAGE_KEY } from '@/common/calculator.js'
import { getReportSnapshotById, getReportSnapshotByIdAsync } from '@/common/report-history.js'
	import { trackFunnelEvent } from '@/common/analytics.js'

const statusBarH = ref(20)

const reportId = ref('')

function cloneReportDefaults() {
	return JSON.parse(JSON.stringify(reportPageData))
}

const reportRef = ref(cloneReportDefaults())

function showLoading(title) {
	uni.showLoading({ title: title || '加载中', mask: true })
}

function hideLoading() {
	uni.hideLoading()
}

function readReportSnapshot() {
	try {
		let snap = uni.getStorageSync(REPORT_STORAGE_KEY)
		if (snap == null || snap === '') return null
		if (typeof snap === 'string') {
			try {
				snap = JSON.parse(snap)
			} catch {
				return null
			}
		}
		if (snap && snap.hero && snap.unitPrice) return snap
	} catch {
		return null
	}
	return null
}

function loadReport() {
	const snap = readReportSnapshot()
	if (snap) {
		reportRef.value = snap
	} else {
		reportRef.value = cloneReportDefaults()
	}
}

/** 从「记录」带 id 进入时，优先打开对应历史快照（本地无则拉云端） */
async function loadReportFromPageOptions() {
	const pages = getCurrentPages()
	const cur = pages[pages.length - 1]
	const id = cur && cur.options && cur.options.id ? String(cur.options.id) : ''
	if (!id) return false
	reportId.value = id
	let snap = getReportSnapshotById(id)
	if (!snap) snap = await getReportSnapshotByIdAsync(id)
	if (!snap) return false
	reportRef.value = snap
	try {
		uni.setStorageSync(REPORT_STORAGE_KEY, snap)
	} catch (e) {}
	return true
}

const unitPriceSection = computed(() => ({
	title: reportRef.value.unitPrice.sectionTitle,
	rows: reportRef.value.unitPrice.rows
}))

onMounted(() => {
	const sys = uni.getSystemInfoSync()
	statusBarH.value = sys.statusBarHeight || 20
})

onShow(async () => {
	showLoading('加载报告')
	try {
		if (await loadReportFromPageOptions()) return
		loadReport()
	} finally {
		hideLoading()
	}
})

function goBack() {
	const pages = getCurrentPages()
	if (pages.length > 1) {
		uni.navigateBack()
	} else {
		uni.redirectTo({ url: '/pages/index/index' })
	}
}

function buildSharePayload() {
	const title = reportRef.value?.hero?.title
		? `${reportRef.value.hero.title}｜性价比助手`
		: '我做了一份 API 性价比对比报告，来看看'
	const id = reportId.value ? String(reportId.value) : ''
	if (id) {
		return {
			title,
			path: '/pages/report/report?id=' + encodeURIComponent(id)
		}
	}
	return {
		title,
		path: '/pages/index/index?from=share_report'
	}
}

function onTapShare() {
	trackFunnelEvent('tap_share_report')
}

onShareAppMessage(() => buildSharePayload())
onShareTimeline(() => buildSharePayload())
</script>

<style scoped lang="scss">
.page {
	min-height: 100vh;
	background: #f7f8fa;
	padding-bottom: calc(160rpx + env(safe-area-inset-bottom));
	box-sizing: border-box;
}

.status-bar {
	width: 100%;
}

.nav {
	display: flex;
	flex-direction: row;
	align-items: center;
	padding: 8rpx 12rpx 20rpx 8rpx;
}

.nav__side {
	width: 80rpx;
	height: 64rpx;
	display: flex;
	align-items: center;
	justify-content: flex-start;
	padding-left: 8rpx;
	box-sizing: border-box;
}

.nav__side--right {
	pointer-events: none;
}

.share-btn {
	width: 80rpx;
	height: 64rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	margin: 0;
	padding: 0;
	background: transparent;
	border: none;
}

.share-btn::after {
	border: none;
}

.nav__title {
	flex: 1;
	text-align: center;
	font-size: 34rpx;
	font-weight: 700;
	color: #1a1d24;
}

.body {
	padding: 0 28rpx;
}

.share-cta {
	margin-top: 24rpx;
	width: 100%;
	height: 88rpx;
	border-radius: 16rpx;
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: center;
	background: #1a4a9e;
	box-shadow: 0 8rpx 20rpx rgba(26, 74, 158, 0.24);
}

.share-cta::after {
	border: none;
}

.share-cta__text {
	margin-left: 12rpx;
	font-size: 30rpx;
	font-weight: 700;
	color: #ffffff;
}

.pad {
	height: 24rpx;
}
</style>
