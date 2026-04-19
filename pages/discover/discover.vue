<template>
	<view class="page">
		<view class="page__bg page__bg--one" />
		<view class="page__bg page__bg--two" />

		<view class="header" :style="{ paddingTop: `${statusBarHeight + 12}px` }">
			<text class="header__title">{{ TEXT.discover }}</text>
		</view>

		<scroll-view class="page__scroll" scroll-y :show-scrollbar="false">
			<view class="section section--official">
				<view class="section__head">
					<text class="section__title">{{ TEXT.officialTitle }}</text>
					<view class="section__link" hover-class="section__link--hover" @click="toggleOfficialExpand">
						<text class="section__link-text">{{ officialExpanded ? TEXT.collapse : TEXT.viewAll }}</text>
						<uni-icons :type="officialExpanded ? 'top' : 'right'" size="26rpx" color="#1749bb" />
					</view>
				</view>

				<view v-if="officialLoading" class="state-card">
					<text class="state-card__text">{{ TEXT.officialLoading }}</text>
				</view>

				<view v-else-if="officialError" class="state-card state-card--error">
					<text class="state-card__text">{{ officialError }}</text>
					<view class="state-card__btn" hover-class="state-card__btn--hover" @click="loadOfficialCards">
						<text class="state-card__btn-text">{{ TEXT.retry }}</text>
					</view>
				</view>

				<scroll-view v-else class="official-scroll" scroll-x :show-scrollbar="false">
					<view class="official-scroll__row">
						<view
							v-for="card in displayedOfficialCards"
							:key="`${card.sectionKey}-${card.name}-${card.siteDomain}`"
							class="official-card"
						>
							<view class="official-card__line" />
							<view class="official-card__top">
								<view class="official-card__brand">
									<view class="official-card__badge">
										<uni-icons type="checkbox-filled" size="24rpx" color="#ffffff" />
									</view>
									<view class="official-card__title-wrap">
										<text class="official-card__title">{{ card.name }}</text>
										<text class="official-card__subtitle">{{ card.modelLabel || TEXT.officialPick }}</text>
									</view>
								</view>
								<text class="official-card__online">{{ card.onlineRate || TEXT.stable }}</text>
							</view>

							<view class="official-card__metric">
								<text class="official-card__metric-label">{{ TEXT.latency }}</text>
								<text class="official-card__metric-value">{{ card.latency || '--' }}</text>
							</view>
							<view class="official-card__metric">
								<text class="official-card__metric-label">{{ TEXT.priceMetric }}</text>
								<text class="official-card__metric-value official-card__metric-value--blue">{{ card.price || '--' }}</text>
							</view>

							<view class="official-card__btn" hover-class="official-card__btn--hover" @click="copyOfficialLink(card)">
								<text class="official-card__btn-text">{{ TEXT.viewDetail }}</text>
							</view>
						</view>
					</view>
				</scroll-view>
			</view>

			<view class="community-shell">
				<view class="section__head section__head--community">
					<text class="section__title">{{ TEXT.communityTitle }}</text>
					<view class="recommend-btn" hover-class="recommend-btn--hover" @click="onTapRecommend">
						<uni-icons type="plusempty" size="26rpx" color="#ffffff" />
						<text class="recommend-btn__text">{{ TEXT.recommendSite }}</text>
					</view>
				</view>

				<view class="sort-row">
					<view class="sort-chip" :class="{ 'sort-chip--active': sortBy === 'hot' }" @click="changeSort('hot')">
						<uni-icons type="fire-filled" size="24rpx" :color="sortBy === 'hot' ? '#1749bb' : '#6f7888'" />
						<text class="sort-chip__text">{{ TEXT.hottest }}</text>
					</view>
					<view class="sort-chip" :class="{ 'sort-chip--active': sortBy === 'latest' }" @click="changeSort('latest')">
						<text class="sort-chip__text">{{ TEXT.latest }}</text>
					</view>
				</view>

				<view v-if="communityLoading && !communityPosts.length" class="state-card">
					<text class="state-card__text">{{ TEXT.communityLoading }}</text>
				</view>

				<view v-else-if="communityError && !communityPosts.length" class="state-card state-card--error">
					<text class="state-card__text">{{ communityError }}</text>
					<view class="state-card__btn" hover-class="state-card__btn--hover" @click="reloadCommunity(true)">
						<text class="state-card__btn-text">{{ TEXT.retry }}</text>
					</view>
				</view>

				<template v-else>
					<view v-if="!communityPosts.length" class="empty-card">
						<text class="empty-card__title">{{ TEXT.emptyTitle }}</text>
						<text class="empty-card__desc">{{ TEXT.emptyDesc }}</text>
					</view>

					<view v-for="post in communityPosts" :key="post.id" class="post-card">
						<view class="post-card__top">
							<view class="avatar-chip">
								<image v-if="post.authorAvatarUrl" class="avatar-chip__image" :src="post.authorAvatarUrl" mode="aspectFill" />
								<text v-else class="avatar-chip__text">{{ post.authorAvatarText }}</text>
							</view>
							<view class="post-card__main">
								<text class="post-card__title">{{ post.siteName }}</text>
								<text class="post-card__meta">{{ `${post.timeText} | ${post.authorMasked}` }}</text>
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

						<view class="post-card__footer">
							<view class="post-card__actions">
								<view class="action-item" hover-class="action-item--hover" @click="copyPostLink(post)">
									<view class="action-item__copy" aria-hidden="true">
										<view class="action-item__copy-back" />
										<view class="action-item__copy-front" />
									</view>
									<text class="action-item__text">{{ post.copyCount || 0 }}</text>
								</view>
								<view class="action-item" hover-class="action-item--hover" @click="onToggleLike(post)">
									<uni-icons
										:type="post.likedByMe ? 'heart-filled' : 'heart'"
										class="action-item__icon"
										size="30rpx"
										:color="post.likedByMe ? '#1749bb' : '#3a4254'"
									/>
									<text class="action-item__text" :class="{ 'action-item__text--active': post.likedByMe }">
										{{ post.likeCount }}
									</text>
								</view>
								<view class="action-item" hover-class="action-item--hover" @click="toggleComments(post)">
									<uni-icons
										:type="expandedPostId === post.id ? 'chatbubble-filled' : 'chatbubble'"
										class="action-item__icon"
										size="30rpx"
										:color="expandedPostId === post.id ? '#1749bb' : '#3a4254'"
									/>
									<text class="action-item__text">{{ post.commentCount }}</text>
								</view>
							</view>
						</view>

						<view v-if="expandedPostId === post.id" class="comments-panel">
							<view v-if="commentLoadingMap[post.id]" class="comments-panel__loading">{{ TEXT.commentsLoading }}</view>
							<template v-else>
								<view v-if="(commentsMap[post.id] || []).length" class="comment-list">
									<view
										v-for="item in commentsMap[post.id]"
										:key="item.id"
										class="comment-item"
										:class="{ 'comment-item--removing': isRemovingComment(item.id) }"
									>
										<view class="comment-item__avatar">
											<image
												v-if="item.authorAvatarUrl"
												class="comment-item__avatar-image"
												:src="item.authorAvatarUrl"
												mode="aspectFill"
											/>
											<text v-else class="comment-item__avatar-text">{{ item.authorAvatarText }}</text>
										</view>
										<view class="comment-item__body">
											<view class="comment-item__head">
												<text class="comment-item__name">{{ item.authorMasked }}</text>
												<view class="comment-item__head-right">
													<text class="comment-item__time">{{ item.timeText }}</text>
													<view
														v-if="item.isMine"
														class="comment-item__delete"
														:class="{ 'comment-item__delete--disabled': isDeletingComment(item.id) || isRemovingComment(item.id) }"
														@click="confirmDeleteComment(post, item)"
													>
														<uni-icons
															type="trash"
															size="24rpx"
															:color="isDeletingComment(item.id) || isRemovingComment(item.id) ? '#ef9a9a' : '#d14343'"
														/>
													</view>
												</view>
											</view>
											<text class="comment-item__content">{{ item.content }}</text>
										</view>
									</view>
								</view>
								<view v-else class="comments-panel__empty">{{ TEXT.noComments }}</view>

								<view
									v-if="commentHasMoreMap[post.id]"
									class="comments-panel__more"
									:class="{ 'comments-panel__more--disabled': commentLoadingMoreMap[post.id] }"
									hover-class="comments-panel__more--hover"
									@click="loadMoreComments(post)"
								>
									<text class="comments-panel__more-text">
										{{ commentLoadingMoreMap[post.id] ? TEXT.loadingMoreComments : TEXT.moreComments }}
									</text>
								</view>

								<view v-if="isLoggedIn" class="comment-editor">
									<input
										v-model="commentDraftMap[post.id]"
										class="comment-editor__input"
										type="text"
										maxlength="100"
										:placeholder="TEXT.commentPlaceholder"
										placeholder-class="comment-editor__placeholder"
									/>
									<view
										class="comment-editor__send"
										:class="{ 'comment-editor__send--disabled': isSendingComment(post.id) }"
										hover-class="comment-editor__send--hover"
										@click="submitComment(post)"
									>
										<text class="comment-editor__send-text">{{ isSendingComment(post.id) ? TEXT.sending : TEXT.send }}</text>
									</view>
								</view>

								<view v-else class="comment-login-trigger" hover-class="comment-login-trigger--hover" @click="openLoginSheet(TEXT.loginCommentPrompt)">
									<text class="comment-login-trigger__text">{{ TEXT.loginToComment }}</text>
									<text class="comment-login-trigger__btn">{{ TEXT.loginNow }}</text>
								</view>
							</template>
						</view>
					</view>

					<view v-if="communityHasMore" class="load-more" hover-class="load-more--hover" @click="loadMorePosts">
						<text class="load-more__text">{{ communityLoadingMore ? TEXT.loadingMore : TEXT.morePosts }}</text>
					</view>
				</template>
			</view>

			<view class="bottom-space" />
		</scroll-view>

		<app-tab-bar current="community" :show-calc-plus="false" />

		<view v-if="showRecommendSheet" class="overlay">
			<view class="overlay__mask" @click="closeRecommendSheet" />
			<view class="sheet">
				<view class="sheet__grab" />
				<view class="sheet__head">
					<text class="sheet__title">{{ TEXT.recommendSite }}</text>
					<view class="sheet__close" hover-class="sheet__close--hover" @click="closeRecommendSheet">
						<uni-icons type="closeempty" size="34rpx" color="#3a4254" />
					</view>
				</view>

				<view class="sheet__field">
					<text class="sheet__label">{{ TEXT.siteNameLabel }}</text>
					<input
						v-model="form.siteName"
						class="sheet__input"
						type="text"
						maxlength="40"
						:placeholder="TEXT.siteNamePlaceholder"
						placeholder-class="sheet__placeholder"
					/>
				</view>

				<view class="sheet__field">
					<text class="sheet__label">{{ TEXT.siteUrlLabel }}</text>
					<input
						v-model="form.siteUrl"
						class="sheet__input"
						type="text"
						maxlength="200"
						placeholder="https://"
						placeholder-class="sheet__placeholder"
					/>
				</view>

				<view class="sheet__field">
					<view class="sheet__label-row">
						<text class="sheet__label">{{ TEXT.summaryLabel }}</text>
						<text class="sheet__counter">{{ summaryLength }}/50</text>
					</view>
					<textarea
						v-model="form.summary"
						class="sheet__textarea"
						maxlength="50"
						:placeholder="TEXT.summaryPlaceholder"
						placeholder-class="sheet__placeholder"
					/>
				</view>

				<text v-if="formError" class="sheet__error">{{ formError }}</text>

				<view class="sheet__submit" :class="{ 'sheet__submit--disabled': submitingPost }" hover-class="sheet__submit--hover" @click="submitRecommend">
					<text class="sheet__submit-text">{{ submitingPost ? TEXT.submitting : TEXT.submitNow }}</text>
				</view>
			</view>
		</view>

		<view v-if="showLoginPrompt" class="overlay">
			<view class="overlay__mask" @click="closeLoginSheet" />
			<view class="sheet login-sheet">
				<view class="sheet__grab" />
				<view class="login-sheet__icon">
					<uni-icons type="person-filled" size="54rpx" color="#1749bb" />
				</view>
				<text class="login-sheet__title">{{ TEXT.loginContinue }}</text>
				<text class="login-sheet__desc">{{ loginPromptText }}</text>
				<view class="login-sheet__primary" hover-class="login-sheet__primary--hover" @click="goLoginNow">
					<text class="login-sheet__primary-text">{{ TEXT.loginNow }}</text>
				</view>
				<view class="login-sheet__secondary" hover-class="login-sheet__secondary--hover" @click="closeLoginSheet">
					<text class="login-sheet__secondary-text">{{ TEXT.maybeLater }}</text>
				</view>
			</view>
		</view>
	</view>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppTabBar from '@/components/app-tab-bar/app-tab-bar.vue'
import { loadRecommendSections } from '@/common/recommend-data.js'
import {
	createCommunityComment,
	createCommunityPost,
	deleteCommunityComment,
	listCommunityComments,
	listCommunityPosts,
	recordCommunityCopy,
	toggleCommunityLike
} from '@/common/community-data.js'
import { hasStoredSession, navigateToLoginWithReturnUrl } from '@/common/auth.js'

const TEXT = {
	discover: '\u793e\u533a',
	officialTitle: '\u5b98\u65b9\u63a8\u8350',
	collapse: '\u6536\u8d77',
	viewAll: '\u67e5\u770b\u5168\u90e8',
	officialLoading: '\u5b98\u65b9\u63a8\u8350\u52a0\u8f7d\u4e2d...',
	retry: '\u91cd\u65b0\u52a0\u8f7d',
	officialPick: 'OFFICIAL PICK',
	stable: '\u7a33\u5b9a',
	latency: '\u5ef6\u8fdf',
	priceMetric: '\u4ef7\u683c (1M Tokens)',
	viewDetail: '\u590d\u5236\u94fe\u63a5',
	communityTitle: '\u5927\u5bb6\u7684\u63a8\u8350',
	recommendSite: '\u63a8\u8350\u7ad9\u70b9',
	hottest: '\u6700\u70ed',
	latest: '\u6700\u65b0',
	communityLoading: '\u793e\u533a\u63a8\u8350\u52a0\u8f7d\u4e2d...',
	emptyTitle: '\u8fd8\u6ca1\u6709\u4eba\u63a8\u8350\u7ad9\u70b9',
	emptyDesc: '\u6765\u5f53\u7b2c\u4e00\u4e2a\u5206\u4eab\u4f18\u8d28\u7ad9\u70b9\u7684\u4eba\u5427\u3002',
	commentsLoading: '\u8bc4\u8bba\u52a0\u8f7d\u4e2d...',
	loadingMoreComments: '\u66f4\u591a\u8bc4\u8bba\u52a0\u8f7d\u4e2d...',
	moreComments: '\u67e5\u770b\u66f4\u591a\u8bc4\u8bba',
	noComments: '\u8fd8\u6ca1\u6709\u8bc4\u8bba\uff0c\u6765\u8865\u5145\u7b2c\u4e00\u6761\u4f53\u9a8c\u5427\u3002',
	commentPlaceholder: '\u8bf4\u70b9\u4ec0\u4e48...',
	sending: '\u53d1\u9001\u4e2d',
	send: '\u53d1\u9001',
	loginCommentPrompt: '\u767b\u5f55\u540e\u5373\u53ef\u8bc4\u8bba\u548c\u70b9\u8d5e',
	loginToComment: '\u767b\u5f55\u540e\u53c2\u4e0e\u8bc4\u8bba',
	loginNow: '\u7acb\u5373\u767b\u5f55',
	loadingMore: '\u52a0\u8f7d\u4e2d...',
	morePosts: '\u67e5\u770b\u66f4\u591a\u63a8\u8350',
	siteNameLabel: '\u7ad9\u70b9\u540d\u79f0 *',
	siteNamePlaceholder: '\u8bf7\u8f93\u5165\u7ad9\u70b9\u540d\u79f0',
	siteUrlLabel: '\u7ad9\u70b9\u94fe\u63a5 *',
	summaryLabel: '\u4e00\u53e5\u8bdd\u70b9\u8bc4 *',
	summaryPlaceholder: '\u7b80\u5355\u4ecb\u7ecd\u4e00\u4e0b\u8fd9\u4e2a\u7ad9\u70b9...',
	submitting: '\u63d0\u4ea4\u4e2d...',
	submitNow: '\u7acb\u5373\u63d0\u4ea4',
	loginContinue: '\u767b\u5f55\u4ee5\u7ee7\u7eed',
	loginPrompt:
		'\u767b\u5f55\u540e\u5373\u53ef\u53c2\u4e0e\u793e\u533a\u4e92\u52a8\uff0c\u5305\u62ec\u70b9\u8d5e\u3001\u8bc4\u8bba\u548c\u63a8\u8350\u7ad9\u70b9\u3002',
	later: '\u7a0d\u540e\u518d\u8bf4',
	recommendPrompt: '\u767b\u5f55\u540e\u5373\u53ef\u63a8\u8350\u7ad9\u70b9\uff0c\u53d1\u5e03\u4f60\u7684\u771f\u5b9e\u4f7f\u7528\u4f53\u9a8c\u3002',
	noCopyLink: '\u6682\u65f6\u6ca1\u6709\u53ef\u590d\u5236\u7684\u94fe\u63a5',
	linkCopied: '\u94fe\u63a5\u5df2\u590d\u5236',
	copyFailed: '\u590d\u5236\u5931\u8d25',
	likeFailed: '\u70b9\u8d5e\u5931\u8d25',
	commentSuccess: '\u8bc4\u8bba\u6210\u529f',
	commentPending: '\u8bc4\u8bba\u5df2\u63d0\u4ea4\u5ba1\u6838',
	commentFailed: '\u8bc4\u8bba\u5931\u8d25',
	commentRequired: '\u8bf7\u8f93\u5165\u8bc4\u8bba\u5185\u5bb9',
	deleteComment: '\u5220\u9664',
	deletingComment: '\u5220\u9664\u4e2d',
	deleteCommentTitle: '\u5220\u9664\u8bc4\u8bba',
	deleteCommentContent: '\u786e\u8ba4\u5220\u9664\u8fd9\u6761\u8bc4\u8bba\u5417\uff1f',
	deleteCommentSuccess: '\u8bc4\u8bba\u5df2\u5220\u9664',
	deleteCommentFailed: '\u5220\u9664\u8bc4\u8bba\u5931\u8d25',
	recommendSuccess: '\u63a8\u8350\u6210\u529f',
	recommendPending: '\u63a8\u8350\u5df2\u63d0\u4ea4\u5ba1\u6838',
	recommendFailed: '\u63a8\u8350\u5931\u8d25',
	requiredSiteName: '\u8bf7\u586b\u5199\u7ad9\u70b9\u540d\u79f0',
	requiredSiteUrl: '\u8bf7\u8f93\u5165\u5b8c\u6574\u7ad9\u70b9\u94fe\u63a5',
	requiredSummary: '\u8bf7\u586b\u5199\u4e00\u53e5\u8bdd\u70b9\u8bc4',
	maybeLater: '\u7a0d\u540e\u518d\u8bf4',
	officialLoadFailed: '\u5b98\u65b9\u63a8\u8350\u52a0\u8f7d\u5931\u8d25',
	communityLoadFailed: '\u793e\u533a\u63a8\u8350\u52a0\u8f7d\u5931\u8d25',
	commentsLoadFailed: '\u8bc4\u8bba\u52a0\u8f7d\u5931\u8d25'
}

const statusBarHeight = ref(20)
const officialLoading = ref(false)
const officialError = ref('')
const officialCards = ref([])
const officialExpanded = ref(false)

const communityLoading = ref(false)
const communityLoadingMore = ref(false)
const communityError = ref('')
const communityPosts = ref([])
const communityPage = ref(1)
const communityHasMore = ref(false)
const sortBy = ref('hot')
const expandedPostId = ref('')

const commentsMap = reactive({})
const commentLoadingMap = reactive({})
const commentLoadingMoreMap = reactive({})
const commentHasMoreMap = reactive({})
const commentPageMap = reactive({})
const commentDraftMap = reactive({})
const commentRemovingMap = reactive({})
const sendingCommentPostId = ref('')
const deletingCommentId = ref('')

const showRecommendSheet = ref(false)
const showLoginPrompt = ref(false)
const loginPromptText = ref(TEXT.loginPrompt)
const submitingPost = ref(false)
const formError = ref('')
const form = reactive({
	siteName: '',
	siteUrl: '',
	summary: ''
})

const isLoggedIn = computed(() => hasStoredSession())
const summaryLength = computed(() => String(form.summary || '').trim().length)
const displayedOfficialCards = computed(() =>
	officialExpanded.value ? officialCards.value : officialCards.value.slice(0, 4)
)

async function resolveAvatarUrlMap(fileIDs = []) {
	const uniqueFileIDs = Array.from(
		new Set(
			(fileIDs || [])
				.map((item) => String(item || '').trim())
				.filter(Boolean)
		)
	)

	if (!uniqueFileIDs.length || !uniCloud || typeof uniCloud.getTempFileURL !== 'function') {
		return {}
	}

	try {
		const response = await uniCloud.getTempFileURL({ fileList: uniqueFileIDs })
		const fileList = Array.isArray(response?.fileList) ? response.fileList : []
		const urlMap = {}
		for (const item of fileList) {
			const fileID = String(item?.fileID || '').trim()
			const tempUrl = String(item?.tempFileURL || '').trim()
			if (fileID && tempUrl) urlMap[fileID] = tempUrl
		}
		return urlMap
	} catch (e) {
		return {}
	}
}

async function attachAvatarUrls(items = []) {
	const list = Array.isArray(items) ? items : []
	if (!list.length) return list

	const fileIDs = list.map((item) => item?.authorAvatarFileID)
	const avatarUrlMap = await resolveAvatarUrlMap(fileIDs)

	return list.map((item) => {
		const authorAvatarFileID = String(item?.authorAvatarFileID || '').trim()
		return {
			...item,
			authorAvatarUrl: authorAvatarFileID ? String(avatarUrlMap[authorAvatarFileID] || '') : '',
			isMine: item?.isMine === true
		}
	})
}

function isSendingComment(postId) {
	return sendingCommentPostId.value === postId
}

function isDeletingComment(commentId) {
	return deletingCommentId.value === commentId
}

function isRemovingComment(commentId) {
	return commentRemovingMap[commentId] === true
}

function resetRecommendForm() {
	form.siteName = ''
	form.siteUrl = ''
	form.summary = ''
	formError.value = ''
}

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

function openLoginSheet(text) {
	loginPromptText.value = text || TEXT.loginPrompt
	showLoginPrompt.value = true
}

function closeLoginSheet() {
	showLoginPrompt.value = false
}

function goLoginNow() {
	closeLoginSheet()
	navigateToLoginWithReturnUrl('/pages/discover/discover')
}

function ensureLogin(promptText) {
	if (isLoggedIn.value) return true
	openLoginSheet(promptText)
	return false
}

function handleAuthExpired(error, promptText = TEXT.loginPrompt) {
	if (error?.code !== 'AUTH_EXPIRED') return false
	openLoginSheet(promptText)
	return true
}

function resetCommentState() {
	expandedPostId.value = ''
	const targets = [
		commentsMap,
		commentLoadingMap,
		commentLoadingMoreMap,
		commentHasMoreMap,
		commentPageMap,
		commentDraftMap
	]
	for (const target of targets) {
		for (const key of Object.keys(target)) {
			delete target[key]
		}
	}
}

function onTapRecommend() {
	if (!ensureLogin(TEXT.recommendPrompt)) return
	resetRecommendForm()
	showRecommendSheet.value = true
}

function closeRecommendSheet() {
	showRecommendSheet.value = false
	formError.value = ''
}

function toggleOfficialExpand() {
	officialExpanded.value = !officialExpanded.value
}

function copyOfficialLink(card) {
	const text = String(card.siteUrl || '').trim()
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

function setClipboardText(text) {
	return new Promise((resolve, reject) => {
		uni.setClipboardData({
			data: text,
			success: resolve,
			fail: reject
		})
	})
}

async function copyPostLink(post) {
	const text = String(post?.siteUrl || '').trim()
	if (!text) {
		uni.showToast({ title: TEXT.noCopyLink, icon: 'none' })
		return
	}

	try {
		await setClipboardText(text)
		if (isLoggedIn.value && post?.id) {
			try {
				const payload = await recordCommunityCopy({
					postId: post.id
				})
				communityPosts.value = communityPosts.value.map((item) =>
					item.id === post.id
						? {
								...item,
								copyCount: Number(payload?.copyCount ?? item.copyCount ?? 0)
							}
						: item
				)
			} catch (e) {
				// Copy succeeds even if metrics reporting fails.
			}
		}
		uni.showToast({ title: TEXT.linkCopied, icon: 'success' })
	} catch (e) {
		uni.showToast({ title: TEXT.copyFailed, icon: 'none' })
	}
}

async function loadOfficialCards() {
	officialLoading.value = true
	officialError.value = ''
	try {
		const sections = await loadRecommendSections({ limitPerSection: 3 })
		const cards = []
		for (const section of sections || []) {
			for (const card of section.cards || []) {
				cards.push({
					...card,
					sectionKey: section.sectionKey || section.title,
					modelLabel: card.modelLabel || section.title
				})
			}
		}
		officialCards.value = cards.slice(0, 12)
	} catch (e) {
		officialCards.value = []
		officialError.value = e?.message || TEXT.officialLoadFailed
	} finally {
		officialLoading.value = false
	}
}

async function loadPosts(reset = false) {
	if (reset) {
		communityPage.value = 1
		communityPosts.value = []
		communityHasMore.value = false
		resetCommentState()
	}

	const page = reset ? 1 : communityPage.value
	if (reset) {
		communityLoading.value = true
		communityError.value = ''
	} else {
		communityLoadingMore.value = true
	}

	try {
		const payload = await listCommunityPosts({
			sortBy: sortBy.value,
			page,
			limit: 10
		})
		const items = await attachAvatarUrls(Array.isArray(payload?.items) ? payload.items : [])
		communityPosts.value = reset ? items : [...communityPosts.value, ...items]
		communityHasMore.value = !!payload?.hasMore
		communityPage.value = page + 1
	} catch (e) {
		communityError.value = e?.message || TEXT.communityLoadFailed
	} finally {
		communityLoading.value = false
		communityLoadingMore.value = false
	}
}

function changeSort(nextSort) {
	if (sortBy.value === nextSort) return
	sortBy.value = nextSort
	expandedPostId.value = ''
	void loadPosts(true)
}

async function loadMorePosts() {
	if (communityLoadingMore.value || !communityHasMore.value) return
	await loadPosts(false)
}

async function reloadCommunity(reset = false) {
	await loadPosts(reset)
}

async function fetchComments(postId, reset = false) {
	const nextPage = reset ? 1 : Number(commentPageMap[postId] || 1)
	if (reset) {
		commentLoadingMap[postId] = true
	} else {
		commentLoadingMoreMap[postId] = true
	}

	try {
		const payload = await listCommunityComments({ postId, page: nextPage, limit: 10 })
		const items = await attachAvatarUrls(Array.isArray(payload?.items) ? payload.items : [])
		const currentItems = reset ? [] : Array.isArray(commentsMap[postId]) ? commentsMap[postId] : []
		commentsMap[postId] = reset ? items : [...currentItems, ...items]
		commentHasMoreMap[postId] = !!payload?.hasMore
		commentPageMap[postId] = nextPage + 1
	} catch (e) {
		if (reset) commentsMap[postId] = []
		throw e
	} finally {
		commentLoadingMap[postId] = false
		commentLoadingMoreMap[postId] = false
	}
}

async function toggleComments(post) {
	if (!post?.id) return
	if (expandedPostId.value === post.id) {
		expandedPostId.value = ''
		return
	}
	expandedPostId.value = post.id
	if (commentsMap[post.id]) return
	try {
		await fetchComments(post.id, true)
	} catch (e) {
		uni.showToast({ title: e?.message || TEXT.commentsLoadFailed, icon: 'none' })
	}
}

async function loadMoreComments(post) {
	if (!post?.id) return
	if (commentLoadingMoreMap[post.id] || !commentHasMoreMap[post.id]) return
	try {
		await fetchComments(post.id, false)
	} catch (e) {
		uni.showToast({ title: e?.message || TEXT.commentsLoadFailed, icon: 'none' })
	}
}

function confirmDeleteComment(post, comment) {
	if (!post?.id || !comment?.id || deletingCommentId.value) return

	uni.showModal({
		title: TEXT.deleteCommentTitle,
		content: TEXT.deleteCommentContent,
		success: async (res) => {
			if (!res.confirm) return
			deletingCommentId.value = comment.id
			try {
				const payload = await deleteCommunityComment({ commentId: comment.id })
				commentRemovingMap[comment.id] = true
				await sleep(180)
				const currentList = Array.isArray(commentsMap[post.id]) ? commentsMap[post.id] : []
				commentsMap[post.id] = currentList.filter((item) => item.id !== comment.id)
				delete commentRemovingMap[comment.id]
				communityPosts.value = communityPosts.value.map((item) =>
					item.id === post.id
						? {
								...item,
								commentCount: Number(payload?.commentCount ?? Math.max(0, Number(item.commentCount || 0) - 1))
							}
						: item
				)
				uni.showToast({ title: TEXT.deleteCommentSuccess, icon: 'success' })
			} catch (e) {
				delete commentRemovingMap[comment.id]
				if (handleAuthExpired(e, TEXT.loginCommentPrompt)) return
				uni.showToast({ title: e?.message || TEXT.deleteCommentFailed, icon: 'none' })
			} finally {
				deletingCommentId.value = ''
			}
		}
	})
}

async function onToggleLike(post) {
	if (!ensureLogin(TEXT.loginPrompt)) return
	try {
		const payload = await toggleCommunityLike({
			postId: post.id
		})
		communityPosts.value = communityPosts.value.map((item) =>
			item.id === post.id
				? {
						...item,
						likedByMe: !!payload.liked,
						likeCount: Number(payload.likeCount || 0),
						commentCount: Number(payload.commentCount || item.commentCount || 0)
					}
				: item
		)
	} catch (e) {
		if (handleAuthExpired(e, TEXT.loginCommentPrompt)) return
		uni.showToast({ title: e?.message || TEXT.likeFailed, icon: 'none' })
	}
}

async function submitComment(post) {
	if (!ensureLogin(TEXT.loginCommentPrompt)) return
	if (isSendingComment(post.id)) return
	const content = String(commentDraftMap[post.id] || '').trim()
	if (!content) {
		uni.showToast({ title: TEXT.commentRequired, icon: 'none' })
		return
	}
	sendingCommentPostId.value = post.id
	try {
		const payload = await createCommunityComment({
			postId: post.id,
			content
		})
		if (payload?.auditStatus === 'pending') {
			commentDraftMap[post.id] = ''
			uni.showToast({ title: payload?.message || TEXT.commentPending, icon: 'none' })
			return
		}
		const nextComment = (await attachAvatarUrls(payload?.comment ? [payload.comment] : []))[0]
		const currentList = Array.isArray(commentsMap[post.id]) ? commentsMap[post.id] : []
		const mergedList = nextComment ? [nextComment, ...currentList.filter((item) => item.id !== nextComment.id)] : currentList
		const visibleList = mergedList.slice(0, 10)
		const nextCommentCount = Number(payload?.commentCount || visibleList.length)
		commentsMap[post.id] = visibleList
		commentHasMoreMap[post.id] = nextCommentCount > visibleList.length
		commentPageMap[post.id] = 2
		commentDraftMap[post.id] = ''
		communityPosts.value = communityPosts.value.map((item) =>
			item.id === post.id
				? {
						...item,
						commentCount: nextCommentCount
					}
				: item
		)
		uni.showToast({ title: TEXT.commentSuccess, icon: 'success' })
	} catch (e) {
		if (handleAuthExpired(e, TEXT.loginCommentPrompt)) return
		uni.showToast({ title: e?.message || TEXT.commentFailed, icon: 'none' })
	} finally {
		sendingCommentPostId.value = ''
	}
}

async function submitRecommend() {
	if (!ensureLogin(TEXT.recommendPrompt)) return
	if (submitingPost.value) return
	const siteName = String(form.siteName || '').trim()
	const siteUrl = String(form.siteUrl || '').trim()
	const summary = String(form.summary || '').trim()

	if (!siteName) {
		formError.value = TEXT.requiredSiteName
		return
	}
	if (!/^https?:\/\//i.test(siteUrl)) {
		formError.value = TEXT.requiredSiteUrl
		return
	}
	if (!summary) {
		formError.value = TEXT.requiredSummary
		return
	}

	submitingPost.value = true
	formError.value = ''
	try {
		const payload = await createCommunityPost({
			siteName,
			siteUrl,
			summary
		})
		closeRecommendSheet()
		resetRecommendForm()
		await loadPosts(true)
		const isPending = payload?.auditStatus === 'pending'
		uni.showToast({
			title: payload?.message || (isPending ? TEXT.recommendPending : TEXT.recommendSuccess),
			icon: isPending ? 'none' : 'success'
		})
	} catch (e) {
		if (handleAuthExpired(e, TEXT.recommendPrompt)) return
		formError.value = e?.message || TEXT.recommendFailed
	} finally {
		submitingPost.value = false
	}
}

async function refreshAll() {
	await Promise.all([loadOfficialCards(), loadPosts(true)])
}

onShow(() => {
	const systemInfo = uni.getSystemInfoSync()
	statusBarHeight.value = systemInfo.statusBarHeight || 20
	void refreshAll()
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
	justify-content: flex-start;
	padding-left: 28rpx;
	padding-right: 28rpx;
	padding-bottom: 18rpx;
	position: relative;
	z-index: 2;
}

.header__title {
	font-size: 42rpx;
	font-weight: 800;
	color: #131b2c;
	letter-spacing: 1rpx;
}

.page__scroll {
	height: calc(100vh - 120rpx);
	position: relative;
	z-index: 1;
}

.section {
	padding: 18rpx 30rpx 0;
}

.section--official {
	padding-top: 10rpx;
}

.section__head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 24rpx;
}

.section__head--community {
	margin-bottom: 28rpx;
}

.section__title {
	font-size: 56rpx;
	line-height: 1.12;
	font-weight: 800;
	color: #101827;
}

.section__link {
	display: flex;
	align-items: center;
	gap: 6rpx;
	padding: 8rpx 4rpx;
}

.section__link--hover {
	opacity: 0.88;
}

.section__link-text {
	font-size: 28rpx;
	font-weight: 600;
	color: #1749bb;
}

.official-scroll {
	white-space: nowrap;
}

.official-scroll__row {
	display: inline-flex;
	gap: 22rpx;
	padding-bottom: 6rpx;
}

.official-card {
	width: 512rpx;
	border-radius: 34rpx;
	background: rgba(255, 255, 255, 0.95);
	padding: 0 24rpx 28rpx;
	box-sizing: border-box;
	box-shadow: 0 18rpx 40rpx rgba(23, 36, 67, 0.08);
	position: relative;
	overflow: hidden;
}

.official-card__line {
	height: 10rpx;
	background: linear-gradient(90deg, #1749bb 0%, #3d78ff 100%);
	border-radius: 0 0 16rpx 16rpx;
	margin: 0 12rpx;
}

.official-card__top {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	padding-top: 28rpx;
	gap: 20rpx;
}

.official-card__brand {
	display: flex;
	align-items: flex-start;
	gap: 16rpx;
	min-width: 0;
}

.official-card__badge {
	width: 40rpx;
	height: 40rpx;
	border-radius: 999rpx;
	background: #1749bb;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	margin-top: 6rpx;
}

.official-card__title-wrap {
	min-width: 0;
}

.official-card__title {
	display: block;
	font-size: 28rpx;
	font-weight: 800;
	color: #111827;
	line-height: 1.2;
}

.official-card__subtitle {
	display: block;
	margin-top: 10rpx;
	font-size: 18rpx;
	letter-spacing: 2rpx;
	color: #667085;
	text-transform: uppercase;
}

.official-card__online {
	background: #eef4ff;
	color: #1749bb;
	font-size: 22rpx;
	padding: 10rpx 14rpx;
	border-radius: 12rpx;
	flex-shrink: 0;
}

.official-card__metric {
	margin-top: 22rpx;
	padding: 22rpx 18rpx;
	border-radius: 18rpx;
	background: #f5f7fb;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12rpx;
}

.official-card__metric-label {
	font-size: 22rpx;
	color: #3a4254;
}

.official-card__metric-value {
	font-size: 22rpx;
	font-weight: 700;
	color: #111827;
}

.official-card__metric-value--blue {
	color: #1749bb;
	font-size: 24rpx;
}

.official-card__btn {
	height: 72rpx;
	border-radius: 16rpx;
	background: #eceff4;
	display: flex;
	align-items: center;
	justify-content: center;
	margin-top: 24rpx;
}

.official-card__btn--hover {
	opacity: 0.9;
}

.official-card__btn-text {
	font-size: 26rpx;
	font-weight: 700;
	color: #1f2937;
}

.community-shell {
	margin-top: 38rpx;
	background: rgba(247, 248, 252, 0.88);
	border-radius: 44rpx 44rpx 0 0;
	padding: 42rpx 30rpx 0;
	box-shadow: inset 0 1rpx 0 rgba(255, 255, 255, 0.65);
}

.recommend-btn {
	height: 68rpx;
	padding: 0 28rpx;
	border-radius: 18rpx;
	background: linear-gradient(135deg, #1749bb 0%, #2458d3 100%);
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 8rpx;
	box-shadow: 0 16rpx 30rpx rgba(23, 73, 187, 0.24);
}

.recommend-btn--hover {
	opacity: 0.9;
}

.recommend-btn__text {
	font-size: 28rpx;
	font-weight: 700;
	color: #ffffff;
}

.sort-row {
	display: flex;
	align-items: center;
	gap: 18rpx;
	margin-bottom: 26rpx;
}

.sort-chip {
	height: 64rpx;
	padding: 0 24rpx;
	border-radius: 999rpx;
	background: #eef1f5;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 8rpx;
}

.sort-chip--active {
	background: #ffffff;
	border: 2rpx solid rgba(23, 73, 187, 0.22);
	box-shadow: 0 10rpx 24rpx rgba(26, 40, 72, 0.08);
}

.sort-chip__text {
	font-size: 26rpx;
	font-weight: 700;
	color: #1f2937;
}

.post-card {
	background: rgba(255, 255, 255, 0.96);
	border-radius: 28rpx;
	padding: 28rpx 24rpx 22rpx;
	box-sizing: border-box;
	box-shadow: 0 14rpx 32rpx rgba(20, 31, 58, 0.06);
	margin-bottom: 24rpx;
	border: 1rpx solid rgba(23, 73, 187, 0.08);
}

.post-card__top {
	display: flex;
	align-items: center;
	gap: 18rpx;
}

.avatar-chip {
	width: 68rpx;
	height: 68rpx;
	border-radius: 20rpx;
	background: linear-gradient(135deg, #ccdafd 0%, #a8bcff 100%);
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	overflow: hidden;
}

.avatar-chip__image {
	width: 100%;
	height: 100%;
}

.avatar-chip__text {
	font-size: 34rpx;
	font-weight: 800;
	color: #233363;
}

.post-card__main {
	min-width: 0;
	flex: 1;
}

.post-card__title {
	display: block;
	font-size: 28rpx;
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

.post-card__summary {
	display: block;
	margin-top: 24rpx;
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
	margin-top: 26rpx;
}

.link-box--hover {
	opacity: 0.9;
}

.link-box__text {
	font-size: 24rpx;
	color: #1749bb;
	max-width: 540rpx;
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

.post-card__footer {
	display: flex;
	align-items: center;
	justify-content: flex-start;
	margin-top: 22rpx;
	padding-top: 18rpx;
	border-top: 1rpx solid #eef2f7;
}

.post-card__actions {
	display: flex;
	align-items: center;
	gap: 28rpx;
}

.action-item {
	display: flex;
	align-items: center;
	gap: 8rpx;
}

.action-item__icon {
	width: 30rpx;
	text-align: center;
}

.action-item__copy {
	position: relative;
	width: 30rpx;
	height: 30rpx;
	flex-shrink: 0;
}

.action-item__copy-back,
.action-item__copy-front {
	position: absolute;
	border: 2rpx solid #3a4254;
	border-radius: 6rpx;
	background: transparent;
	box-sizing: border-box;
}

.action-item__copy-back {
	width: 18rpx;
	height: 18rpx;
	right: 2rpx;
	top: 2rpx;
}

.action-item__copy-front {
	width: 18rpx;
	height: 18rpx;
	left: 2rpx;
	bottom: 2rpx;
	background: #ffffff;
}

.action-item--hover {
	opacity: 0.84;
}

.action-item__text {
	font-size: 24rpx;
	color: #343b4a;
}

.action-item__text--active {
	color: #1749bb;
	font-weight: 700;
}

.comments-panel {
	margin-top: 18rpx;
	padding-top: 18rpx;
	border-top: 1rpx solid #edf0f5;
}

.comments-panel__loading,
.comments-panel__empty {
	font-size: 22rpx;
	color: #7b8394;
	line-height: 1.6;
	padding: 8rpx 0 18rpx;
}

.comments-panel__more {
	height: 68rpx;
	border-radius: 18rpx;
	background: #f4f6fb;
	display: flex;
	align-items: center;
	justify-content: center;
	margin-bottom: 18rpx;
}

.comments-panel__more--hover {
	opacity: 0.9;
}

.comments-panel__more--disabled {
	opacity: 0.7;
	pointer-events: none;
}

.comments-panel__more-text {
	font-size: 22rpx;
	font-weight: 700;
	color: #1749bb;
}

.comment-list {
	display: flex;
	flex-direction: column;
	gap: 18rpx;
}

.comment-item {
	display: flex;
	align-items: flex-start;
	gap: 14rpx;
	transition: opacity 0.18s ease, transform 0.18s ease;
	transform-origin: top center;
}

.comment-item--removing {
	opacity: 0;
	transform: translateY(-10rpx) scale(0.96);
	pointer-events: none;
}

.comment-item__avatar {
	width: 52rpx;
	height: 52rpx;
	border-radius: 999rpx;
	background: #eceff4;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	overflow: hidden;
}

.comment-item__avatar-image {
	width: 100%;
	height: 100%;
}

.comment-item__avatar-text {
	font-size: 24rpx;
	font-weight: 700;
	color: #3a4254;
}

.comment-item__body {
	flex: 1;
	min-width: 0;
}

.comment-item__head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12rpx;
}

.comment-item__head-right {
	display: flex;
	align-items: center;
	gap: 14rpx;
	flex-shrink: 0;
}

.comment-item__name {
	font-size: 22rpx;
	font-weight: 700;
	color: #111827;
}

.comment-item__time {
	font-size: 20rpx;
	color: #8c93a3;
	flex-shrink: 0;
}

.comment-item__delete {
	width: 28rpx;
	height: 28rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
}

.comment-item__delete--disabled {
	opacity: 0.7;
}

.comment-item__content {
	display: block;
	margin-top: 6rpx;
	font-size: 24rpx;
	line-height: 1.6;
	color: #354052;
}

.comment-editor {
	display: flex;
	align-items: center;
	gap: 14rpx;
	margin-top: 22rpx;
}

.comment-editor__input {
	flex: 1;
	height: 76rpx;
	border-radius: 20rpx;
	background: #f4f6fb;
	padding: 0 22rpx;
	font-size: 24rpx;
	color: #111827;
}

.comment-editor__placeholder {
	color: #a1a9b8;
	font-size: 24rpx;
}

.comment-editor__send {
	width: 110rpx;
	height: 76rpx;
	border-radius: 20rpx;
	background: linear-gradient(135deg, #1749bb 0%, #2458d3 100%);
	display: flex;
	align-items: center;
	justify-content: center;
}

.comment-editor__send--hover {
	opacity: 0.9;
}

.comment-editor__send--disabled {
	opacity: 0.7;
	pointer-events: none;
}

.comment-editor__send-text {
	font-size: 24rpx;
	font-weight: 700;
	color: #ffffff;
}

.comment-login-trigger {
	margin-top: 22rpx;
	height: 78rpx;
	border-radius: 20rpx;
	background: #f3f5f9;
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0 20rpx;
}

.comment-login-trigger--hover {
	opacity: 0.9;
}

.comment-login-trigger__text {
	font-size: 24rpx;
	color: #7c8597;
}

.comment-login-trigger__btn {
	font-size: 24rpx;
	font-weight: 700;
	color: #1749bb;
}

.state-card,
.empty-card {
	background: rgba(255, 255, 255, 0.92);
	border-radius: 24rpx;
	padding: 36rpx 28rpx;
	text-align: center;
	box-shadow: 0 12rpx 28rpx rgba(20, 31, 58, 0.05);
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
	border-radius: 22rpx;
	background: rgba(255, 255, 255, 0.95);
	display: flex;
	align-items: center;
	justify-content: center;
	box-shadow: 0 12rpx 26rpx rgba(20, 31, 58, 0.05);
	margin-bottom: 10rpx;
}

.load-more--hover {
	opacity: 0.9;
}

.load-more__text {
	font-size: 24rpx;
	font-weight: 700;
	color: #1749bb;
}

.bottom-space {
	height: calc(180rpx + env(safe-area-inset-bottom));
}

.overlay {
	position: fixed;
	inset: 0;
	z-index: 210;
}

.overlay__mask {
	position: absolute;
	inset: 0;
	background: rgba(10, 16, 28, 0.34);
	backdrop-filter: blur(8rpx);
}

.sheet {
	position: absolute;
	left: 0;
	right: 0;
	bottom: 0;
	background: #ffffff;
	border-radius: 38rpx 38rpx 0 0;
	padding: 18rpx 34rpx calc(40rpx + env(safe-area-inset-bottom));
	box-sizing: border-box;
}

.sheet__grab {
	width: 96rpx;
	height: 12rpx;
	border-radius: 999rpx;
	background: #e5e7eb;
	margin: 2rpx auto 26rpx;
}

.sheet__head {
	display: flex;
	align-items: center;
	justify-content: center;
	position: relative;
}

.sheet__title {
	font-size: 48rpx;
	font-weight: 800;
	color: #101827;
}

.sheet__close {
	position: absolute;
	right: 0;
	top: 0;
	width: 64rpx;
	height: 64rpx;
	border-radius: 16rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}

.sheet__close--hover {
	background: #f4f6fb;
}

.sheet__field {
	margin-top: 34rpx;
}

.sheet__label-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 14rpx;
}

.sheet__label {
	font-size: 30rpx;
	font-weight: 700;
	color: #111827;
	margin-bottom: 14rpx;
	display: block;
}

.sheet__counter {
	font-size: 24rpx;
	color: #6b7280;
}

.sheet__input,
.sheet__textarea {
	width: 100%;
	border-radius: 18rpx;
	background: #f1f3f7;
	padding: 0 22rpx;
	box-sizing: border-box;
	font-size: 28rpx;
	color: #111827;
}

.sheet__input {
	height: 96rpx;
	line-height: 96rpx;
}

.sheet__textarea {
	height: 190rpx;
	padding-top: 22rpx;
}

.sheet__placeholder {
	font-size: 28rpx;
	color: #9ca3af;
}

.sheet__error {
	display: block;
	margin-top: 18rpx;
	font-size: 24rpx;
	color: #b42318;
}

.sheet__submit {
	height: 96rpx;
	border-radius: 20rpx;
	background: linear-gradient(135deg, #1749bb 0%, #2458d3 100%);
	display: flex;
	align-items: center;
	justify-content: center;
	margin-top: 34rpx;
}

.sheet__submit--hover {
	opacity: 0.9;
}

.sheet__submit--disabled {
	opacity: 0.7;
	pointer-events: none;
}

.sheet__submit-text {
	font-size: 32rpx;
	font-weight: 800;
	color: #ffffff;
}

.login-sheet {
	padding-top: 10rpx;
	padding-bottom: calc(56rpx + env(safe-area-inset-bottom));
}

.login-sheet__icon {
	width: 112rpx;
	height: 112rpx;
	border-radius: 28rpx;
	background: linear-gradient(180deg, #edf2ff 0%, #dce6ff 100%);
	display: flex;
	align-items: center;
	justify-content: center;
	margin: 14rpx auto 26rpx;
}

.login-sheet__title {
	display: block;
	text-align: center;
	font-size: 52rpx;
	font-weight: 800;
	color: #111827;
}

.login-sheet__desc {
	display: block;
	margin: 26rpx auto 0;
	font-size: 28rpx;
	line-height: 1.75;
	color: #4b5565;
	text-align: center;
	max-width: 620rpx;
}

.login-sheet__primary,
.login-sheet__secondary {
	height: 96rpx;
	border-radius: 20rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	margin-top: 36rpx;
}

.login-sheet__primary {
	background: linear-gradient(135deg, #1749bb 0%, #2458d3 100%);
}

.login-sheet__primary--hover,
.login-sheet__secondary--hover {
	opacity: 0.9;
}

.login-sheet__primary-text {
	font-size: 32rpx;
	font-weight: 800;
	color: #ffffff;
}

.login-sheet__secondary {
	margin-top: 20rpx;
	background: transparent;
}

.login-sheet__secondary-text {
	font-size: 30rpx;
	font-weight: 700;
	color: #1749bb;
}
</style>
