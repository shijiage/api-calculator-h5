import { CLOUD_CALL_TIMEOUT_MS } from '@/common/data.js'
import { getStoredOpenid, getStoredSessionToken, hasStoredSession } from '@/common/auth.js'

const COMMUNITY_CALL_FAILED = '\u793e\u533a\u670d\u52a1\u8c03\u7528\u5931\u8d25'

function createCommunityError(message, code = 'COMMUNITY_ERROR') {
	const error = new Error(message)
	error.code = code
	return error
}

function isOkErrMsg(errMsg) {
	return !errMsg || errMsg === 'cloud.callFunction:ok' || errMsg === 'callFunction:ok'
}

function getCommunityAuthPayload(options = {}) {
	const useStoredSession = hasStoredSession()
	return {
		openid: String(options?.openid || (useStoredSession ? getStoredOpenid() : '') || ''),
		sessionToken: String(options?.sessionToken || (useStoredSession ? getStoredSessionToken() : '') || '')
	}
}

async function callCommunity(action, data = {}) {
	let res
	try {
		res = await uniCloud.callFunction({
			name: 'community-data',
			data: {
				action,
				...data
			},
			timeout: CLOUD_CALL_TIMEOUT_MS
		})
	} catch (e) {
		throw createCommunityError(e?.errMsg || e?.message || COMMUNITY_CALL_FAILED)
	}

	if (!isOkErrMsg(res?.errMsg)) {
		throw createCommunityError(res?.errMsg || COMMUNITY_CALL_FAILED)
	}

	const payload = res?.result
	if (!payload || payload.errCode !== 0) {
		throw createCommunityError(payload?.errMsg || COMMUNITY_CALL_FAILED, payload?.errCode || 'COMMUNITY_ERROR')
	}

	return payload
}

export function listCommunityPosts(options = {}) {
	const { sortBy = 'hot', page = 1, limit = 10 } = options || {}
	return callCommunity('listPosts', {
		sortBy,
		page,
		limit,
		...getCommunityAuthPayload(options)
	})
}

export function createCommunityPost(options = {}) {
	const { siteName = '', siteUrl = '', summary = '' } = options || {}
	return callCommunity('createPost', {
		...getCommunityAuthPayload(options),
		siteName: String(siteName || ''),
		siteUrl: String(siteUrl || ''),
		summary: String(summary || '')
	})
}

export function toggleCommunityLike(options = {}) {
	const { postId = '' } = options || {}
	return callCommunity('toggleLike', {
		...getCommunityAuthPayload(options),
		postId: String(postId || '')
	})
}

export function listCommunityComments(options = {}) {
	const { postId = '', page = 1, limit = 10 } = options || {}
	return callCommunity('listComments', {
		...getCommunityAuthPayload(options),
		postId: String(postId || ''),
		page,
		limit
	})
}

export function createCommunityComment(options = {}) {
	const { postId = '', content = '' } = options || {}
	return callCommunity('createComment', {
		...getCommunityAuthPayload(options),
		postId: String(postId || ''),
		content: String(content || '')
	})
}

export function deleteCommunityComment(options = {}) {
	const { commentId = '' } = options || {}
	return callCommunity('deleteComment', {
		...getCommunityAuthPayload(options),
		commentId: String(commentId || '')
	})
}

export function recordCommunityCopy(options = {}) {
	const { postId = '' } = options || {}
	return callCommunity('recordCopy', {
		...getCommunityAuthPayload(options),
		postId: String(postId || '')
	})
}

export function listMyCommunityPosts(options = {}) {
	const { page = 1, limit = 10 } = options || {}
	return callCommunity('listMinePosts', {
		...getCommunityAuthPayload(options),
		page,
		limit
	})
}

export function deleteMyCommunityPost(options = {}) {
	const { postId = '' } = options || {}
	return callCommunity('deletePost', {
		...getCommunityAuthPayload(options),
		postId: String(postId || '')
	})
}

export function listCommunityAuditItems(options = {}) {
	const { itemType = 'post', status = 'pending', page = 1, limit = 10 } = options || {}
	return callCommunity('listAuditItems', {
		...getCommunityAuthPayload(options),
		itemType: String(itemType || 'post'),
		status: String(status || 'pending'),
		page,
		limit
	})
}

export function reviewCommunityAuditItem(options = {}) {
	const { itemType = 'post', itemId = '', decision = 'reject', reason = '' } = options || {}
	return callCommunity('reviewAuditItem', {
		...getCommunityAuthPayload(options),
		itemType: String(itemType || 'post'),
		itemId: String(itemId || ''),
		decision: String(decision || 'reject'),
		reason: String(reason || '')
	})
}

export function getCommunitySensitiveWordStats(options = {}) {
	return callCommunity('getSensitiveWordStats', {
		...getCommunityAuthPayload(options)
	})
}

export function syncCommunitySensitiveWords(options = {}) {
	return callCommunity('syncSensitiveWords', {
		...getCommunityAuthPayload(options)
	})
}
