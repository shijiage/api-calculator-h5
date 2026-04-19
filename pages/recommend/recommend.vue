<template>
	<view class="page">
		<view class="top-panel" :style="{ paddingTop: statusBarH + 'px' }">
			<view class="header">
				<text class="header__title">站点推荐</text>
			</view>

			<view class="discover-tabs">
				<view class="discover-tab discover-tab--active">
					<text class="discover-tab__text discover-tab__text--active">站点推荐</text>
				</view>
				<view class="discover-tab" hover-class="discover-tab--hover" @click="goTestCasesPage">
					<text class="discover-tab__text">测试案例</text>
				</view>
			</view>

			<view class="search-bar">
				<uni-icons type="search" size="44rpx" color="#5d84cf" />
				<input
					v-model="keyword"
					class="search-bar__input"
					type="text"
					placeholder="搜索站点或模型..."
					placeholder-class="search-bar__placeholder"
					confirm-type="search"
				/>
			</view>

			<scroll-view
				v-if="sectionChips.length"
				class="section-chips"
				scroll-x
				:show-scrollbar="false"
			>
				<view class="section-chips__row">
					<view
						v-for="chip in sectionChips"
						:key="chip.sectionKey"
						class="section-chip"
						hover-class="section-chip--hover"
						@click="goToSection(chip)"
					>
						<text class="section-chip__text">{{ chip.title }}</text>
					</view>
				</view>
			</scroll-view>
		</view>

		<scroll-view
			class="scroll"
			:style="{ top: topPanelHeight + 'px' }"
			scroll-y
			:show-scrollbar="false"
			:scroll-into-view="scrollIntoView"
			scroll-with-animation
		>
			<view v-if="loading" class="page-state">
				<text class="page-state__text">推荐列表加载中...</text>
			</view>

			<view v-else-if="loadError" class="page-state page-state--error">
				<text class="page-state__text">{{ loadError }}</text>
				<view class="page-state__action" hover-class="page-state__action--hover" @click="fetchSections">
					<text class="page-state__action-text">重新加载</text>
				</view>
			</view>

			<template v-else>
				<view
					v-for="section in pagedSections"
					:key="section.title"
					class="section"
				>
					<view :id="sectionAnchorId(section)" class="section-anchor" />
					<text class="section__title">{{ section.title }}</text>

					<view v-for="card in section.cards" :key="card.name + card.group" class="card">
						<view class="card__head">
							<view class="card__name-wrap">
								<text class="card__name">{{ card.name }}</text>
							</view>
							<view class="card__copy-btn" hover-class="card__copy-btn--hover" @click="copyCard(card)">
								<view class="copy-icon">
									<view class="copy-icon__back" />
									<view class="copy-icon__front" />
								</view>
							</view>
						</view>

						<view class="card__divider" />

						<view class="metrics">
							<view class="metrics__item">
								<text class="metrics__label">站点分组</text>
								<text class="metrics__value metrics__value--strong">{{ card.group }}</text>
							</view>
							<view class="metrics__item">
								<text class="metrics__label">价格</text>
								<text class="metrics__value metrics__value--blue">{{ card.price }}</text>
							</view>
							<view class="metrics__item">
								<text class="metrics__label">延迟</text>
								<text class="metrics__value">{{ card.latency }}</text>
							</view>
							<view class="metrics__item">
								<text class="metrics__label">在线率</text>
								<view class="metrics__dot-line">
									<view class="metrics__dot" />
									<text class="metrics__value">{{ card.onlineRate }}</text>
								</view>
							</view>
							<view class="metrics__item">
								<text class="metrics__label">掺水率</text>
								<text class="metrics__value" :class="mixRateClass(card.mixRate)">{{ card.mixRate }}</text>
							</view>
							<view class="metrics__item">
								<text class="metrics__label">最新状态</text>
								<text class="status-pill" :class="statusClass(card.statusType)">{{ card.statusText }}</text>
							</view>
						</view>
					</view>

					<view
						v-if="section.hasMore"
						class="section-more"
						hover-class="section-more--hover"
						@click="showMore(section.title)"
					>
						<text class="section-more__text">{{ section.loadingMore ? '加载中...' : '查看更多' }}</text>
						<text class="section-more__count">已显示 {{ section.visibleCount }}/{{ section.totalCount }}</text>
					</view>
				</view>
			</template>

			<view v-if="!loading && !loadError && !pagedSections.length" class="empty">{{ emptyText }}</view>

			<view class="bottom-pad" />
		</scroll-view>

		<app-tab-bar current="recommend" :show-calc-plus="false" />
	</view>
</template>

<script setup>
import { ref, onMounted, computed, watch, nextTick, getCurrentInstance } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppTabBar from '@/components/app-tab-bar/app-tab-bar.vue'
import { loadRecommendSections, loadRecommendSectionPage } from '@/common/recommend-data.js'

const PAGE_SIZE = 10
const statusBarH = ref(20)
const topPanelHeight = ref(300)
const keyword = ref('')
const sections = ref([])
const loading = ref(false)
const loadError = ref('')
const scrollIntoView = ref('')
const instance = getCurrentInstance()
let searchTimer = null

const pagedSections = computed(() => sections.value)
const sectionChips = computed(() =>
	sections.value.map((section) => ({
		sectionKey: section.sectionKey,
		title: section.title
	}))
)

const emptyText = computed(() => {
	return keyword.value.trim() ? '未找到匹配站点' : '暂无推荐站点'
})

watch(
	keyword,
	() => {
		if (searchTimer) clearTimeout(searchTimer)
		searchTimer = setTimeout(() => {
			void fetchSections()
		}, 250)
	}
)

watch(
	() => sectionChips.value.length,
	() => {
		void scheduleMeasureTopPanel()
	}
)

onMounted(() => {
	const sys = uni.getSystemInfoSync()
	statusBarH.value = sys.statusBarHeight || 20
	void scheduleMeasureTopPanel()
})

onShow(() => {
	void fetchSections()
})

async function fetchSections() {
	loading.value = true
	loadError.value = ''
	try {
		const result = await loadRecommendSections({
			keyword: keyword.value.trim(),
			limitPerSection: PAGE_SIZE
		})
		sections.value = result.map((section) => ({
			...section,
			loadingMore: false,
			visibleCount: Array.isArray(section.cards) ? section.cards.length : 0
		}))
	} catch (e) {
		sections.value = []
		loadError.value = e?.message || '推荐列表加载失败，请稍后重试'
	} finally {
		loading.value = false
		void scheduleMeasureTopPanel()
	}
}

async function showMore(sectionTitle) {
	const index = sections.value.findIndex((section) => section.title === sectionTitle)
	if (index < 0) return
	const current = sections.value[index]
	if (!current || current.loadingMore || !current.hasMore) return

	sections.value = sections.value.map((section, sectionIndex) =>
		sectionIndex === index ? { ...section, loadingMore: true } : section
	)

	try {
		const nextPage = await loadRecommendSectionPage({
			sectionKey: current.sectionKey,
			offset: Array.isArray(current.cards) ? current.cards.length : 0,
			limit: PAGE_SIZE,
			keyword: keyword.value.trim()
		})
		if (!nextPage) {
			sections.value = sections.value.map((section, sectionIndex) =>
				sectionIndex === index ? { ...section, loadingMore: false, hasMore: false } : section
			)
			return
		}
		sections.value = sections.value.map((section, sectionIndex) =>
			sectionIndex === index
				? {
						...section,
						...nextPage,
						cards: [...(current.cards || []), ...(nextPage.cards || [])],
						visibleCount: (current.cards || []).length + (nextPage.cards || []).length,
						loadingMore: false
					}
				: section
		)
	} catch (e) {
		sections.value = sections.value.map((section, sectionIndex) =>
			sectionIndex === index ? { ...section, loadingMore: false } : section
		)
		uni.showToast({ title: e?.message || '加载更多失败', icon: 'none' })
	}
}

function statusClass(type) {
	return {
		'status-pill--excellent': type === 'excellent',
		'status-pill--good': type === 'good',
		'status-pill--normal': type === 'normal'
	}
}

function mixRateClass(rate) {
	return String(rate || '').trim() !== '0%' ? 'metrics__value--danger' : ''
}

function goTestCasesPage() {
	uni.redirectTo({ url: '/pages/test-cases/test-cases' })
}

function copyCard(card) {
	const fallbackText = [
		`站点：${card.name}`,
		`分组：${card.group}`,
		`价格：${card.price}`,
		`延迟：${card.latency}`,
		`在线率：${card.onlineRate}`,
		`掺水率：${card.mixRate}`,
		`状态：${card.statusText}`
	].join('\n')
	const text = String(card.siteUrl || '').trim() || fallbackText
	const successTitle = String(card.siteUrl || '').trim() ? '链接已复制' : '已复制'
	uni.setClipboardData({
		data: text,
		success: () => uni.showToast({ title: successTitle, icon: 'success' }),
		fail: () => uni.showToast({ title: '复制失败', icon: 'none' })
	})
}

function sectionAnchorId(section) {
	return `section-${String(section.sectionKey || section.title || '').replace(/[^a-zA-Z0-9_-]/g, '-')}`
}

async function goToSection(chip) {
	const target = sectionAnchorId(chip)
	if (!target) return

	if (typeof document !== 'undefined') {
		const targetNode = document.getElementById(target)
		if (targetNode && typeof targetNode.scrollIntoView === 'function') {
			targetNode.scrollIntoView({
				behavior: 'smooth',
				block: 'start',
				inline: 'nearest'
			})
			return
		}
	}

	scrollIntoView.value = ''
	await nextTick()
	scrollIntoView.value = target
}

async function scheduleMeasureTopPanel() {
	await nextTick()
	const query = uni.createSelectorQuery().in(instance?.proxy)
	query.select('.top-panel').boundingClientRect()
	query.exec((res) => {
		const rect = Array.isArray(res) ? res[0] : null
		if (!rect?.height) return
		topPanelHeight.value = rect.height
	})
}
</script>

<style scoped lang="scss">
.page {
	height: 100vh;
	background: #f7f8fb;
	position: relative;
	overflow: hidden;
}

.top-panel {
	padding: 0 26rpx 20rpx;
	box-sizing: border-box;
	background: rgba(247, 248, 251, 0.96);
	backdrop-filter: blur(14px);
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	z-index: 110;
	box-shadow: 0 10rpx 28rpx rgba(39, 53, 82, 0.05);
}

.scroll {
	position: absolute;
	left: 0;
	right: 0;
	bottom: 0;
	padding: 0 26rpx;
	box-sizing: border-box;
	z-index: 1;
}

.header {
	padding: 20rpx 14rpx 0;
	display: flex;
	align-items: center;
}

.header__title {
	font-size: 40rpx;
	line-height: 1.12;
	font-weight: 800;
	color: #151922;
	letter-spacing: -0.6rpx;
}

.discover-tabs {
	margin-top: 22rpx;
	display: inline-flex;
	align-items: center;
	gap: 10rpx;
	padding: 10rpx;
	border-radius: 999rpx;
	background: #eef2f8;
}

.discover-tab {
	min-width: 176rpx;
	height: 68rpx;
	padding: 0 24rpx;
	border-radius: 999rpx;
	display: inline-flex;
	align-items: center;
	justify-content: center;
}

.discover-tab--active {
	background: #1a4a9e;
	box-shadow: 0 10rpx 24rpx rgba(26, 74, 158, 0.22);
}

.discover-tab--hover {
	opacity: 0.88;
}

.discover-tab__text {
	font-size: 24rpx;
	font-weight: 700;
	color: #6e7787;
}

.discover-tab__text--active {
	color: #ffffff;
}

.search-bar {
	height: 100rpx;
	margin-top: 24rpx;
	background: #f1f2f5;
	border-radius: 24rpx;
	display: flex;
	align-items: center;
	padding: 0 26rpx;
	box-sizing: border-box;
}

.search-bar__input {
	flex: 1;
	height: 100rpx;
	font-size: 26rpx;
	color: #212734;
	margin-left: 18rpx;
}

.search-bar__placeholder {
	color: #a2a7b2;
	font-size: 26rpx;
}

.section-chips {
	margin-top: 22rpx;
	white-space: nowrap;
}

.section-chips__row {
	display: inline-flex;
	align-items: center;
	padding: 0 2rpx;
}

.section-chip {
	height: 64rpx;
	padding: 0 26rpx;
	border-radius: 999rpx;
	background: #ffffff;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	margin-right: 16rpx;
	box-shadow: 0 6rpx 18rpx rgba(39, 53, 82, 0.06);
}

.section-chip--hover {
	opacity: 0.88;
}

.section-chip__text {
	font-size: 24rpx;
	font-weight: 700;
	color: #1749bb;
	white-space: nowrap;
}

.section {
	margin-top: 74rpx;
}

.section-anchor {
	width: 100%;
	height: 2rpx;
	scroll-margin-top: 12rpx;
}

.page-state {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding: 120rpx 32rpx 50rpx;
}

.page-state__text {
	font-size: 26rpx;
	line-height: 1.6;
	color: #6f7686;
	text-align: center;
}

.page-state__action {
	margin-top: 28rpx;
	padding: 18rpx 32rpx;
	border-radius: 999rpx;
	background: #1448b8;
	transition: opacity 0.2s ease;
}

.page-state__action--hover {
	opacity: 0.88;
}

.page-state__action-text {
	font-size: 24rpx;
	font-weight: 700;
	color: #ffffff;
}

.section__title {
	display: block;
	padding: 0 14rpx;
	font-size: 48rpx;
	line-height: 1.16;
	font-weight: 800;
	color: #151922;
	letter-spacing: -0.8rpx;
	margin-bottom: 34rpx;
}

.section-more {
	height: 88rpx;
	border-radius: 24rpx;
	background: #eef3ff;
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0 28rpx;
	box-sizing: border-box;
	margin-top: 2rpx;
}

.section-more--hover {
	opacity: 0.9;
}

.section-more__text {
	font-size: 26rpx;
	font-weight: 700;
	color: #1448b8;
}

.section-more__count {
	font-size: 22rpx;
	color: #6f7a94;
}

.card {
	background: #ffffff;
	border-radius: 28rpx;
	padding: 36rpx 28rpx 30rpx;
	box-sizing: border-box;
	margin-bottom: 28rpx;
	box-shadow: 0 8rpx 30rpx rgba(39, 53, 82, 0.04);
}

.card__head {
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.card__name-wrap {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 16rpx;
	padding-right: 18rpx;
}

.card__name {
	font-size: 38rpx;
	line-height: 1.18;
	font-weight: 800;
	color: #151922;
	letter-spacing: -0.6rpx;
}

.card__copy-btn {
	width: 72rpx;
	height: 72rpx;
	border-radius: 12rpx;
	background: #eef0f4;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	transition: opacity 0.2s ease;
}

.card__copy-btn--hover {
	opacity: 0.88;
}

.copy-icon {
	position: relative;
	width: 28rpx;
	height: 28rpx;
}

.copy-icon__back,
.copy-icon__front {
	position: absolute;
	border: 3rpx solid #1448b8;
	border-radius: 4rpx;
	background: transparent;
}

.copy-icon__back {
	width: 18rpx;
	height: 18rpx;
	left: 8rpx;
	top: 1rpx;
	opacity: 0.94;
}

.copy-icon__front {
	width: 18rpx;
	height: 18rpx;
	left: 2rpx;
	top: 8rpx;
	background: #eef0f4;
}

.card__divider {
	height: 1rpx;
	background: #edf0f4;
	margin: 42rpx 0 28rpx;
}

.metrics {
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	column-gap: 20rpx;
	row-gap: 34rpx;
}

.metrics__item {
	min-width: 0;
}

.metrics__label {
	display: block;
	min-width: 0;
	font-size: 18rpx;
	line-height: 1.25;
	color: #7f8594;
	margin-bottom: 16rpx;
}

.metrics__value {
	display: block;
	min-width: 0;
	font-size: 28rpx;
	line-height: 1.2;
	color: #121722;
	font-weight: 700;
}

.metrics__value--strong {
	font-weight: 800;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.metrics__value--blue {
	color: #1346bf;
}

.metrics__value--danger {
	color: #a52815;
}

.metrics__dot-line {
	display: flex;
	align-items: center;
	min-width: 0;
}

.metrics__dot-line .metrics__value {
	flex: 1;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.metrics__dot {
	width: 12rpx;
	height: 12rpx;
	border-radius: 50%;
	background: #124dbc;
	margin-right: 12rpx;
	flex-shrink: 0;
}

.status-pill {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	padding: 0 12rpx;
	min-width: 66rpx;
	height: 40rpx;
	border-radius: 8rpx;
	font-size: 16rpx;
	font-weight: 700;
	box-sizing: border-box;
}

.empty {
	text-align: center;
	color: #8f97a6;
	font-size: 28rpx;
	padding: 70rpx 0 20rpx;
}

.status-pill--excellent {
	background: #d7f4df;
	color: #1f9a5f;
}

.status-pill--good {
	background: #dfeaff;
	color: #2c61d8;
}

.status-pill--normal {
	background: #eceff6;
	color: #667086;
}

.bottom-pad {
	height: calc(210rpx + env(safe-area-inset-bottom));
}
</style>
