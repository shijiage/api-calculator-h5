<template>
	<view class="page">
		<view class="page__bg page__bg--one" />
		<view class="page__bg page__bg--two" />

		<view class="header" :style="{ paddingTop: `${statusBarHeight + 12}px` }">
			<view class="header__back" hover-class="header__back--hover" @click="goBack">
				<uni-icons type="left" size="34rpx" color="#1749bb" />
			</view>
			<text class="header__title">{{ TEXT.title }}</text>
		</view>

		<scroll-view class="page__scroll" scroll-y :show-scrollbar="false">
			<view class="filter-row">
				<view
					v-for="item in typeOptions"
					:key="item.value"
					class="filter-chip"
					:class="{ 'filter-chip--active': currentType === item.value }"
					@click="changeType(item.value)"
				>
					<text class="filter-chip__text">{{ item.label }}</text>
				</view>
			</view>

			<view class="filter-row filter-row--secondary">
				<view
					v-for="item in statusOptions"
					:key="item.value"
					class="filter-chip filter-chip--small"
					:class="{ 'filter-chip--active': currentStatus === item.value }"
					@click="changeStatus(item.value)"
				>
					<text class="filter-chip__text">{{ item.label }}</text>
				</view>
			</view>

			<view v-if="loading && !items.length" class="state-card">
				<text class="state-card__text">{{ TEXT.loading }}</text>
			</view>

			<view v-else-if="loadError && !items.length" class="state-card state-card--error">
				<text class="state-card__text">{{ loadError }}</text>
				<view class="state-card__btn" hover-class="state-card__btn--hover" @click="refreshList">
					<text class="state-card__btn-text">{{ TEXT.retry }}</text>
				</view>
			</view>

			<template v-else>
				<view v-if="!items.length" class="empty-card">
					<text class="empty-card__title">{{ TEXT.emptyTitle }}</text>
					<text class="empty-card__desc">{{ TEXT.emptyDesc }}</text>
				</view>

				<view v-for="item in items" :key="item.id" class="audit-card">
					<view class="audit-card__head">
						<view class="audit-card__main">
							<text class="audit-card__title">{{ currentType === 'post' ? item.siteName : item.siteName || TEXT.commentOnly }}</text>
							<text class="audit-card__meta">{{ `${item.timeText} | ${item.authorMasked}` }}</text>
						</view>
						<view class="audit-card__status" :class="`audit-card__status--${item.auditStatus}`">
							<text class="audit-card__status-text">{{ item.auditStatusText }}</text>
						</view>
					</view>

					<text v-if="currentType === 'post'" class="audit-card__summary">{{ item.summary }}</text>
					<text v-else class="audit-card__summary">{{ item.content }}</text>

					<text v-if="currentType === 'post'" class="audit-card__link">{{ item.siteHost || item.siteUrl }}</text>

					<view v-if="item.riskTags && item.riskTags.length" class="risk-row">
						<view v-for="tag in item.riskTags" :key="tag" class="risk-tag">
							<text class="risk-tag__text">{{ tag }}</text>
						</view>
					</view>

					<text v-if="item.reviewReason" class="audit-card__reason">{{ item.reviewReason }}</text>

					<view v-if="currentStatus === 'pending'" class="audit-card__actions">
						<view
							class="audit-btn audit-btn--approve"
							:class="{ 'audit-btn--disabled': actioningId === item.id }"
							hover-class="audit-btn--hover"
							@click="reviewItem(item, 'approve')"
						>
							<text class="audit-btn__text">{{ actioningId === item.id ? TEXT.processing : TEXT.approve }}</text>
						</view>
						<view
							class="audit-btn audit-btn--reject"
							:class="{ 'audit-btn--disabled': actioningId === item.id }"
							hover-class="audit-btn--hover"
							@click="reviewItem(item, 'reject')"
						>
							<text class="audit-btn__text">{{ actioningId === item.id ? TEXT.processing : TEXT.reject }}</text>
						</view>
					</view>
				</view>

				<view
					v-if="hasMore"
					class="load-more"
					:class="{ 'load-more--disabled': loadingMore }"
					hover-class="load-more--hover"
					@click="loadMore"
				>
					<text class="load-more__text">{{ loadingMore ? TEXT.loadingMore : TEXT.more }}</text>
				</view>
			</template>

			<view class="bottom-space" />
		</scroll-view>
	</view>
</template>

<script setup>
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { listCommunityAuditItems, reviewCommunityAuditItem } from '@/common/community-data.js'
import { getStoredIsAdmin, hasStoredSession, navigateToLoginWithReturnUrl } from '@/common/auth.js'

const TEXT = {
	title: '社区审核',
	loading: '审核列表加载中...',
	retry: '重新加载',
	emptyTitle: '当前没有待处理内容',
	emptyDesc: '这里会显示待审核的推荐和评论。',
	more: '查看更多',
	loadingMore: '加载中...',
	approve: '通过',
	reject: '驳回',
	processing: '处理中',
	approveSuccess: '已审核通过',
	rejectSuccess: '已驳回',
	loadFailed: '审核列表加载失败',
	commentOnly: '评论内容',
	loginNeeded: '请先登录管理员账号',
	adminNeeded: '仅管理员可进入审核页'
}

const typeOptions = [
	{ value: 'post', label: '推荐' },
	{ value: 'comment', label: '评论' }
]

const statusOptions = [
	{ value: 'pending', label: '待审核' },
	{ value: 'approved', label: '已通过' },
	{ value: 'rejected', label: '已驳回' }
]

const statusBarHeight = ref(20)
const currentType = ref('post')
const currentStatus = ref('pending')
const loading = ref(false)
const loadingMore = ref(false)
const loadError = ref('')
const items = ref([])
const page = ref(1)
const hasMore = ref(false)
const actioningId = ref('')

function ensureAdmin() {
	if (!hasStoredSession()) {
		uni.showToast({ title: TEXT.loginNeeded, icon: 'none' })
		navigateToLoginWithReturnUrl('/pages/community-audit/community-audit')
		return false
	}
	if (!getStoredIsAdmin()) {
		uni.showToast({ title: TEXT.adminNeeded, icon: 'none' })
		setTimeout(() => {
			uni.navigateBack({
				fail: () => uni.redirectTo({ url: '/pages/mine/mine' })
			})
		}, 300)
		return false
	}
	return true
}

function goBack() {
	uni.navigateBack({
		fail() {
			uni.redirectTo({ url: '/pages/mine/mine' })
		}
	})
}

async function loadList(reset = false) {
	if (!ensureAdmin()) return
	const nextPage = reset ? 1 : page.value
	if (reset) {
		loading.value = true
		loadError.value = ''
		items.value = []
		hasMore.value = false
	} else {
		loadingMore.value = true
	}

	try {
		const payload = await listCommunityAuditItems({
			itemType: currentType.value,
			status: currentStatus.value,
			page: nextPage,
			limit: 10
		})
		const list = Array.isArray(payload?.items) ? payload.items : []
		items.value = reset ? list : [...items.value, ...list]
		hasMore.value = !!payload?.hasMore
		page.value = nextPage + 1
	} catch (e) {
		if (e?.code === 'AUTH_EXPIRED') {
			navigateToLoginWithReturnUrl('/pages/community-audit/community-audit')
			return
		}
		loadError.value = e?.message || TEXT.loadFailed
	} finally {
		loading.value = false
		loadingMore.value = false
	}
}

async function refreshList() {
	await loadList(true)
}

async function loadMore() {
	if (loadingMore.value || !hasMore.value) return
	await loadList(false)
}

function changeType(nextType) {
	if (currentType.value === nextType) return
	currentType.value = nextType
	void refreshList()
}

function changeStatus(nextStatus) {
	if (currentStatus.value === nextStatus) return
	currentStatus.value = nextStatus
	void refreshList()
}

async function reviewItem(item, decision) {
	if (!item?.id || actioningId.value) return
	actioningId.value = item.id
	try {
		await reviewCommunityAuditItem({
			itemType: currentType.value,
			itemId: item.id,
			decision,
			reason: decision === 'approve' ? '管理员审核通过' : '管理员审核未通过'
		})
		items.value = items.value.filter((entry) => entry.id !== item.id)
		uni.showToast({
			title: decision === 'approve' ? TEXT.approveSuccess : TEXT.rejectSuccess,
			icon: 'success'
		})
	} catch (e) {
		if (e?.code === 'AUTH_EXPIRED') {
			navigateToLoginWithReturnUrl('/pages/community-audit/community-audit')
			return
		}
		uni.showToast({ title: e?.message || TEXT.loadFailed, icon: 'none' })
	} finally {
		actioningId.value = ''
	}
}

onShow(() => {
	const systemInfo = uni.getSystemInfoSync()
	statusBarHeight.value = systemInfo.statusBarHeight || 20
	void refreshList()
})
</script>

<style scoped lang="scss">
.page {
	min-height: 100vh;
	background: linear-gradient(180deg, #f7f8fc 0%, #eef2f8 100%);
	position: relative;
	overflow: hidden;
}

.page__bg {
	position: absolute;
	border-radius: 999rpx;
	filter: blur(18rpx);
	opacity: 0.5;
}

.page__bg--one {
	width: 340rpx;
	height: 340rpx;
	right: -120rpx;
	top: 160rpx;
	background: radial-gradient(circle, rgba(23, 73, 187, 0.18) 0%, rgba(23, 73, 187, 0) 70%);
}

.page__bg--two {
	width: 280rpx;
	height: 280rpx;
	left: -120rpx;
	bottom: 260rpx;
	background: radial-gradient(circle, rgba(107, 153, 255, 0.16) 0%, rgba(107, 153, 255, 0) 70%);
}

.header {
	display: flex;
	align-items: center;
	gap: 16rpx;
	padding-left: 28rpx;
	padding-right: 28rpx;
	padding-bottom: 18rpx;
	position: relative;
	z-index: 2;
}

.header__back {
	width: 64rpx;
	height: 64rpx;
	border-radius: 20rpx;
	background: rgba(255, 255, 255, 0.82);
	display: flex;
	align-items: center;
	justify-content: center;
	box-shadow: 0 12rpx 30rpx rgba(20, 40, 84, 0.08);
}

.header__back--hover {
	opacity: 0.88;
}

.header__title {
	font-size: 42rpx;
	font-weight: 800;
	color: #131b2c;
	letter-spacing: 1rpx;
}

.page__scroll {
	height: calc(100vh - 120rpx);
	padding: 18rpx 30rpx 0;
	box-sizing: border-box;
	position: relative;
	z-index: 1;
}

.filter-row {
	display: flex;
	flex-wrap: wrap;
	gap: 16rpx;
	margin-bottom: 20rpx;
}

.filter-row--secondary {
	margin-bottom: 26rpx;
}

.filter-chip {
	height: 68rpx;
	padding: 0 26rpx;
	border-radius: 999rpx;
	background: rgba(255, 255, 255, 0.9);
	display: inline-flex;
	align-items: center;
	justify-content: center;
	box-shadow: 0 12rpx 30rpx rgba(20, 31, 58, 0.05);
}

.filter-chip--small {
	height: 58rpx;
}

.filter-chip--active {
	background: #1749bb;
}

.filter-chip__text {
	font-size: 24rpx;
	font-weight: 700;
	color: #1c2840;
}

.filter-chip--active .filter-chip__text {
	color: #ffffff;
}

.audit-card,
.state-card,
.empty-card,
.load-more {
	background: rgba(255, 255, 255, 0.96);
	border-radius: 28rpx;
	box-shadow: 0 14rpx 32rpx rgba(20, 31, 58, 0.06);
}

.audit-card {
	padding: 26rpx 24rpx;
	margin-bottom: 22rpx;
	border: 1rpx solid rgba(23, 73, 187, 0.08);
}

.audit-card__head {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 16rpx;
}

.audit-card__main {
	flex: 1;
	min-width: 0;
}

.audit-card__title {
	display: block;
	font-size: 30rpx;
	font-weight: 800;
	color: #111827;
	line-height: 1.25;
}

.audit-card__meta {
	display: block;
	margin-top: 10rpx;
	font-size: 22rpx;
	color: #6b7280;
}

.audit-card__status {
	height: 46rpx;
	padding: 0 18rpx;
	border-radius: 999rpx;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
}

.audit-card__status--pending {
	background: #fff4db;
}

.audit-card__status--approved {
	background: #e7f7ee;
}

.audit-card__status--rejected,
.audit-card__status--hidden {
	background: #ffe8e8;
}

.audit-card__status-text {
	font-size: 22rpx;
	font-weight: 700;
	color: #8a5a00;
}

.audit-card__status--approved .audit-card__status-text {
	color: #177245;
}

.audit-card__status--rejected .audit-card__status-text,
.audit-card__status--hidden .audit-card__status-text {
	color: #c03b3b;
}

.audit-card__summary {
	display: block;
	margin-top: 22rpx;
	font-size: 24rpx;
	line-height: 1.7;
	color: #1f2937;
}

.audit-card__link,
.audit-card__reason {
	display: block;
	margin-top: 14rpx;
	font-size: 22rpx;
	line-height: 1.6;
	color: #667085;
}

.risk-row {
	display: flex;
	flex-wrap: wrap;
	gap: 12rpx;
	margin-top: 18rpx;
}

.risk-tag {
	padding: 8rpx 14rpx;
	border-radius: 999rpx;
	background: #f2f4f7;
}

.risk-tag__text {
	font-size: 20rpx;
	font-weight: 600;
	color: #475467;
}

.audit-card__actions {
	display: flex;
	gap: 16rpx;
	margin-top: 22rpx;
}

.audit-btn {
	flex: 1;
	height: 74rpx;
	border-radius: 18rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}

.audit-btn--approve {
	background: linear-gradient(135deg, #1749bb 0%, #2458d3 100%);
}

.audit-btn--reject {
	background: #fdecec;
}

.audit-btn--hover {
	opacity: 0.9;
}

.audit-btn--disabled {
	opacity: 0.7;
	pointer-events: none;
}

.audit-btn__text {
	font-size: 26rpx;
	font-weight: 700;
	color: #ffffff;
}

.audit-btn--reject .audit-btn__text {
	color: #c03b3b;
}

.state-card,
.empty-card {
	padding: 36rpx 28rpx;
	text-align: center;
}

.state-card__text,
.empty-card__desc {
	font-size: 24rpx;
	line-height: 1.7;
	color: #6b7280;
}

.empty-card__title {
	display: block;
	font-size: 28rpx;
	font-weight: 800;
	color: #111827;
	margin-bottom: 8rpx;
}

.state-card--error .state-card__text {
	color: #b42318;
}

.state-card__btn {
	width: 188rpx;
	height: 64rpx;
	margin: 22rpx auto 0;
	border-radius: 999rpx;
	background: #1749bb;
	display: flex;
	align-items: center;
	justify-content: center;
}

.state-card__btn--hover {
	opacity: 0.9;
}

.state-card__btn-text {
	font-size: 24rpx;
	font-weight: 700;
	color: #ffffff;
}

.load-more {
	height: 82rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	margin-bottom: 10rpx;
}

.load-more--hover {
	opacity: 0.9;
}

.load-more--disabled {
	opacity: 0.7;
	pointer-events: none;
}

.load-more__text {
	font-size: 24rpx;
	font-weight: 700;
	color: #1749bb;
}

.bottom-space {
	height: calc(48rpx + env(safe-area-inset-bottom));
}
</style>
