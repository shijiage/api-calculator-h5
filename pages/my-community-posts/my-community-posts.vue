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
			<view v-if="loading && !posts.length" class="state-card">
				<text class="state-card__text">{{ TEXT.loading }}</text>
			</view>

			<view v-else-if="loadError && !posts.length" class="state-card state-card--error">
				<text class="state-card__text">{{ loadError }}</text>
				<view class="state-card__btn" hover-class="state-card__btn--hover" @click="refreshList">
					<text class="state-card__btn-text">{{ TEXT.retry }}</text>
				</view>
			</view>

			<template v-else>
				<view v-if="!posts.length" class="empty-card">
					<text class="empty-card__title">{{ TEXT.emptyTitle }}</text>
					<text class="empty-card__desc">{{ TEXT.emptyDesc }}</text>
				</view>

				<view v-for="post in posts" :key="post.id" class="post-card">
					<view class="post-card__top">
						<view class="post-card__main">
							<text class="post-card__title">{{ post.siteName }}</text>
							<text class="post-card__meta">
								{{ `${post.timeText} | ${TEXT.copies}${post.copyCount || 0} | ${TEXT.likes}${post.likeCount} | ${TEXT.comments}${post.commentCount}` }}
							</text>
							<view class="post-card__status-row">
								<view class="post-card__status" :class="`post-card__status--${post.auditStatus || 'pending'}`">
									<text class="post-card__status-text">{{ post.auditStatusText || TEXT.pending }}</text>
								</view>
								<text v-if="post.reviewReason" class="post-card__reason">{{ post.reviewReason }}</text>
							</view>
						</view>
						<view
							class="post-card__delete"
							:class="{ 'post-card__delete--disabled': deletingPostId === post.id }"
							hover-class="post-card__delete--hover"
							@click="confirmDelete(post)"
						>
							<uni-icons type="trash" size="28rpx" color="#d14343" />
							<text class="post-card__delete-text">{{ deletingPostId === post.id ? TEXT.deleting : TEXT.delete }}</text>
						</view>
					</view>

					<text class="post-card__summary">{{ post.summary }}</text>

					<view class="link-box" hover-class="link-box--hover" @click="copyPostLink(post)">
						<text class="link-box__text">{{ post.siteHost || post.siteUrl }}</text>
						<view class="link-box__copy" aria-hidden="true">
							<view class="link-box__copy-back" />
							<view class="link-box__copy-front" />
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

		<app-tab-bar current="mine" :show-calc-plus="false" />
	</view>
</template>

<script setup>
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppTabBar from '@/components/app-tab-bar/app-tab-bar.vue'
import { deleteMyCommunityPost, listMyCommunityPosts } from '@/common/community-data.js'
import { hasStoredSession, navigateToLoginWithReturnUrl } from '@/common/auth.js'

const TEXT = {
	title: '\u6211\u7684\u63a8\u8350',
	loading: '\u63a8\u8350\u5217\u8868\u52a0\u8f7d\u4e2d...',
	retry: '\u91cd\u65b0\u52a0\u8f7d',
	emptyTitle: '\u4f60\u8fd8\u6ca1\u6709\u53d1\u5e03\u63a8\u8350',
	emptyDesc: '\u53bb\u793e\u533a\u9875\u5206\u4eab\u4f60\u6b63\u5728\u4f7f\u7528\u7684\u4f18\u8d28\u7ad9\u70b9\u5427\u3002',
	copies: '\u590d\u5236 ',
	likes: '\u70b9\u8d5e ',
	comments: '\u8bc4\u8bba ',
	delete: '\u5220\u9664',
	deleting: '\u5220\u9664\u4e2d',
	deleteTitle: '\u5220\u9664\u63a8\u8350',
	deleteContent: '\u5220\u9664\u540e\u8fd9\u6761\u63a8\u8350\u3001\u70b9\u8d5e\u548c\u8bc4\u8bba\u90fd\u4f1a\u4e00\u8d77\u79fb\u9664\uff0c\u786e\u8ba4\u7ee7\u7eed\u5417\uff1f',
	deleteSuccess: '\u5df2\u5220\u9664\u63a8\u8350',
	deleteFailed: '\u5220\u9664\u5931\u8d25',
	loadFailed: '\u63a8\u8350\u5217\u8868\u52a0\u8f7d\u5931\u8d25',
	noCopyLink: '\u6682\u65e0\u53ef\u590d\u5236\u7684\u94fe\u63a5',
	linkCopied: '\u94fe\u63a5\u5df2\u590d\u5236',
	copyFailed: '\u590d\u5236\u5931\u8d25',
	loadingMore: '\u52a0\u8f7d\u4e2d...',
	more: '\u67e5\u770b\u66f4\u591a',
	loginNeeded: '\u8bf7\u5148\u767b\u5f55\u540e\u518d\u67e5\u770b',
	pending: '\u5ba1\u6838\u4e2d'
}

const statusBarHeight = ref(20)
const loading = ref(false)
const loadingMore = ref(false)
const loadError = ref('')
const posts = ref([])
const page = ref(1)
const hasMore = ref(false)
const deletingPostId = ref('')

function ensureLogin() {
	if (hasStoredSession()) return true
	uni.showToast({ title: TEXT.loginNeeded, icon: 'none' })
	navigateToLoginWithReturnUrl('/pages/my-community-posts/my-community-posts')
	return false
}

function goBack() {
	uni.navigateBack({
		fail() {
			uni.redirectTo({ url: '/pages/mine/mine' })
		}
	})
}

function copyPostLink(post) {
	const text = String(post?.siteUrl || '').trim()
	if (!text) {
		uni.showToast({ title: TEXT.noCopyLink, icon: 'none' })
		return
	}
	uni.setClipboardData({
		data: text,
		success: () => uni.showToast({ title: TEXT.linkCopied, icon: 'success' }),
		fail: () => uni.showToast({ title: TEXT.copyFailed, icon: 'none' })
	})
}

async function loadPosts(reset = false) {
	if (!ensureLogin()) return

	const nextPage = reset ? 1 : page.value
	if (reset) {
		loading.value = true
		loadError.value = ''
	} else {
		loadingMore.value = true
	}

	try {
		const payload = await listMyCommunityPosts({
			page: nextPage,
			limit: 10
		})
		const items = Array.isArray(payload?.items) ? payload.items : []
		posts.value = reset ? items : [...posts.value, ...items]
		hasMore.value = !!payload?.hasMore
		page.value = nextPage + 1
	} catch (e) {
		if (e?.code === 'AUTH_EXPIRED') {
			loadError.value = TEXT.loginNeeded
			navigateToLoginWithReturnUrl('/pages/my-community-posts/my-community-posts')
			return
		}
		loadError.value = e?.message || TEXT.loadFailed
	} finally {
		loading.value = false
		loadingMore.value = false
	}
}

async function refreshList() {
	await loadPosts(true)
}

async function loadMore() {
	if (loadingMore.value || !hasMore.value) return
	await loadPosts(false)
}

function confirmDelete(post) {
	if (!post?.id || deletingPostId.value) return

	uni.showModal({
		title: TEXT.deleteTitle,
		content: TEXT.deleteContent,
		success: async (res) => {
			if (!res.confirm) return
			deletingPostId.value = post.id
			try {
				await deleteMyCommunityPost({
					postId: post.id
				})
				posts.value = posts.value.filter((item) => item.id !== post.id)
				uni.showToast({ title: TEXT.deleteSuccess, icon: 'success' })
				if (!posts.value.length) {
					await refreshList()
				}
			} catch (e) {
				if (e?.code === 'AUTH_EXPIRED') {
					navigateToLoginWithReturnUrl('/pages/my-community-posts/my-community-posts')
					return
				}
				uni.showToast({ title: e?.message || TEXT.deleteFailed, icon: 'none' })
			} finally {
				deletingPostId.value = ''
			}
		}
	})
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

.post-card,
.state-card,
.empty-card,
.load-more {
	background: rgba(255, 255, 255, 0.96);
	border-radius: 28rpx;
	box-shadow: 0 14rpx 32rpx rgba(20, 31, 58, 0.06);
}

.post-card {
	padding: 28rpx 24rpx 22rpx;
	margin-bottom: 24rpx;
	border: 1rpx solid rgba(23, 73, 187, 0.08);
}

.post-card__top {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 16rpx;
}

.post-card__main {
	flex: 1;
	min-width: 0;
}

.post-card__title {
	display: block;
	font-size: 30rpx;
	font-weight: 800;
	color: #111827;
	line-height: 1.2;
}

.post-card__meta {
	display: block;
	margin-top: 10rpx;
	font-size: 22rpx;
	color: #6b7280;
}

.post-card__status-row {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 12rpx;
	margin-top: 14rpx;
}

.post-card__status {
	height: 42rpx;
	padding: 0 16rpx;
	border-radius: 999rpx;
	display: inline-flex;
	align-items: center;
	justify-content: center;
}

.post-card__status--pending {
	background: #fff4db;
}

.post-card__status--approved {
	background: #e7f7ee;
}

.post-card__status--rejected,
.post-card__status--hidden {
	background: #ffe9e9;
}

.post-card__status-text {
	font-size: 22rpx;
	font-weight: 700;
	color: #8a5a00;
}

.post-card__status--approved .post-card__status-text {
	color: #177245;
}

.post-card__status--rejected .post-card__status-text,
.post-card__status--hidden .post-card__status-text {
	color: #c03b3b;
}

.post-card__reason {
	font-size: 22rpx;
	line-height: 1.5;
	color: #7b8393;
}

.post-card__delete {
	min-width: 132rpx;
	height: 64rpx;
	border-radius: 18rpx;
	background: #fff2f2;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 6rpx;
	flex-shrink: 0;
}

.post-card__delete--hover {
	opacity: 0.9;
}

.post-card__delete--disabled {
	opacity: 0.7;
	pointer-events: none;
}

.post-card__delete-text {
	font-size: 24rpx;
	font-weight: 700;
	color: #d14343;
}

.post-card__summary {
	display: block;
	margin-top: 20rpx;
	font-size: 24rpx;
	line-height: 1.7;
	color: #1f2937;
}

.link-box {
	height: 78rpx;
	border-radius: 16rpx;
	background: #f4f6fb;
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0 20rpx;
	margin-top: 24rpx;
}

.link-box--hover {
	opacity: 0.9;
}

.link-box__text {
	font-size: 24rpx;
	color: #1749bb;
	max-width: 520rpx;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.link-box__copy {
	position: relative;
	width: 28rpx;
	height: 28rpx;
	flex-shrink: 0;
}

.link-box__copy-back,
.link-box__copy-front {
	position: absolute;
	border: 2rpx solid #7b8698;
	border-radius: 6rpx;
	background: transparent;
	box-sizing: border-box;
}

.link-box__copy-back {
	width: 18rpx;
	height: 18rpx;
	right: 1rpx;
	top: 1rpx;
}

.link-box__copy-front {
	width: 18rpx;
	height: 18rpx;
	left: 1rpx;
	bottom: 1rpx;
	background: #f4f6fb;
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
	height: calc(180rpx + env(safe-area-inset-bottom));
}
</style>
