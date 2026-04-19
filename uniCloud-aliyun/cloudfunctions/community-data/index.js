'use strict'

const crypto = require('crypto')
const { COMMUNITY_REVIEW_KEYWORDS, COMMUNITY_REJECT_KEYWORDS } = require('./sensitive-lexicon')

const db = uniCloud.database()
const dbCmd = db.command

const POSTS = 'calc_community_posts'
const COMMENTS = 'calc_community_comments'
const LIKES = 'calc_community_likes'
const COPIES = 'calc_community_copies'
const USERS = 'calc_users'

const MAX_LIST_LIMIT = 20
const MAX_COMMENT_LIMIT = 20
const IN_QUERY_BATCH_SIZE = 50

const AUDIT_STATUS = {
	PENDING: 'pending',
	APPROVED: 'approved',
	REJECTED: 'rejected',
	HIDDEN: 'hidden'
}

const AUTH_EXPIRED_ERROR = {
	errCode: 'AUTH_EXPIRED',
	errMsg: '登录状态已失效，请重新登录'
}

const REVIEW_KEYWORDS = COMMUNITY_REVIEW_KEYWORDS
const REJECT_KEYWORDS = COMMUNITY_REJECT_KEYWORDS

function unwrapDoc(data) {
	if (!data) return null
	return Array.isArray(data) ? data[0] || null : data
}

function normalizeOpenid(value) {
	return String(value || '').trim()
}

function isValidOpenid(openid) {
	return !!openid && openid.length >= 8
}

function normalizeSiteName(value) {
	return String(value || '').trim().slice(0, 40)
}

function normalizeUrl(value) {
	const text = String(value || '').trim()
	if (!text) return ''
	try {
		const url = new URL(text)
		if (!/^https?:$/i.test(url.protocol)) return ''
		return url.toString()
	} catch (e) {
		return ''
	}
}

function normalizeSummary(value) {
	return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 50)
}

function normalizeComment(value) {
	return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 100)
}

function normalizeNameKey(value) {
	return normalizeSiteName(value).toLowerCase()
}

function extractHost(url) {
	try {
		return new URL(String(url || '')).hostname || ''
	} catch (e) {
		return ''
	}
}

function hashSessionToken(token) {
	return crypto.createHash('sha256').update(String(token || '')).digest('hex')
}

function buildDailyPostId(openid, siteName, dayKey) {
	const source = `${normalizeOpenid(openid)}::${String(dayKey || '')}::${normalizeNameKey(siteName)}`
	return crypto.createHash('sha1').update(source).digest('hex')
}

function maskDisplayName(name, fallback) {
	const raw = String(name || fallback || '用户').trim()
	if (!raw) return '用户'
	if (raw.length <= 2) return `${raw.slice(0, 1)}*`
	if (/^[a-zA-Z0-9_]+$/.test(raw)) return `${raw.slice(0, 4)}***${raw.slice(-2)}`
	return `${raw.slice(0, 1)}***${raw.slice(-1)}`
}

function buildAvatarText(name) {
	const raw = String(name || '').trim()
	if (!raw) return 'U'
	const match = raw.match(/[a-zA-Z0-9]/)
	return String(match ? match[0] : raw[0]).toUpperCase()
}

function getAuditStatusText(status) {
	switch (String(status || '')) {
		case AUDIT_STATUS.APPROVED:
			return '已通过'
		case AUDIT_STATUS.REJECTED:
			return '未通过'
		case AUDIT_STATUS.HIDDEN:
			return '已隐藏'
		case AUDIT_STATUS.PENDING:
		default:
			return '审核中'
	}
}

function formatRelativeTime(ts) {
	const time = Number(ts || 0)
	if (!Number.isFinite(time) || time <= 0) return ''
	const diff = Date.now() - time
	if (diff < 60000) return '刚刚'
	if (diff < 3600000) return `${Math.max(1, Math.floor(diff / 60000))}分钟前`
	if (diff < 86400000) return `${Math.max(1, Math.floor(diff / 3600000))}小时前`
	if (diff < 7 * 86400000) return `${Math.max(1, Math.floor(diff / 86400000))}天前`
	try {
		return new Date(time).toLocaleDateString('zh-CN', {
			timeZone: 'Asia/Shanghai',
			month: 'numeric',
			day: 'numeric'
		})
	} catch (e) {
		return new Date(time).toISOString().slice(0, 10)
	}
}

function calcHotScore(post) {
	const likes = Number(post?.like_count || 0)
	const comments = Number(post?.comment_count || 0)
	return likes * 2 + comments * 3
}

function getChinaDayStart(ts = Date.now()) {
	const shifted = new Date(ts + 8 * 60 * 60 * 1000)
	return Date.UTC(
		shifted.getUTCFullYear(),
		shifted.getUTCMonth(),
		shifted.getUTCDate()
	) - 8 * 60 * 60 * 1000
}

function getChinaDayKey(ts = Date.now()) {
	const shifted = new Date(ts + 8 * 60 * 60 * 1000)
	const year = shifted.getUTCFullYear()
	const month = String(shifted.getUTCMonth() + 1).padStart(2, '0')
	const day = String(shifted.getUTCDate()).padStart(2, '0')
	return `${year}${month}${day}`
}

async function getUserByOpenid(openid) {
	const trimmed = normalizeOpenid(openid)
	if (!trimmed) return null
	const coll = db.collection(USERS)
	const direct = await coll.doc(trimmed).get()
	const doc = unwrapDoc(direct && direct.data)
	if (doc) return doc
	const byField = await coll.where({ openid: trimmed }).limit(1).get()
	return unwrapDoc(byField && byField.data)
}

async function resolveSessionUser(event, { required = true } = {}) {
	const openid = normalizeOpenid(event?.openid)
	const sessionToken = String(event?.sessionToken || '').trim()
	if (!isValidOpenid(openid) || !sessionToken) {
		return required ? { error: AUTH_EXPIRED_ERROR } : { valid: false, openid: '', user: null }
	}

	let user = null
	try {
		user = await getUserByOpenid(openid)
	} catch (e) {
		return required
			? { error: { errCode: 'DB_ERROR', errMsg: e.message || 'get user failed' } }
			: { valid: false, openid: '', user: null }
	}
	if (!user) {
		return required ? { error: AUTH_EXPIRED_ERROR } : { valid: false, openid: '', user: null }
	}

	const storedHash = String(user?.session_token_hash || '').trim()
	const storedExpiresAt = Number(user?.session_expires_at || 0)
	if (!storedHash || storedHash !== hashSessionToken(sessionToken) || (storedExpiresAt > 0 && storedExpiresAt <= Date.now())) {
		return required ? { error: AUTH_EXPIRED_ERROR } : { valid: false, openid: '', user: null }
	}

	return { valid: true, openid, user }
}

function ensureAdminUser(auth) {
	if (auth?.error) return auth.error
	if (!auth?.user?.isAdmin) {
		return { errCode: 'FORBIDDEN', errMsg: '仅管理员可执行该操作' }
	}
	return null
}

function splitIntoBatches(list, size = IN_QUERY_BATCH_SIZE) {
	const items = Array.isArray(list) ? list.filter(Boolean) : []
	const batches = []
	for (let i = 0; i < items.length; i += size) {
		batches.push(items.slice(i, i + size))
	}
	return batches
}

async function loadUsersByOpenids(openids) {
	const uniqueOpenids = Array.from(new Set((openids || []).map((item) => normalizeOpenid(item)).filter(Boolean)))
	const userMap = {}
	const users = await Promise.all(uniqueOpenids.map((openid) => getUserByOpenid(openid)))
	uniqueOpenids.forEach((openid, index) => {
		if (users[index]) userMap[openid] = users[index]
	})
	return userMap
}

function buildAuthorSnapshot(user, openid) {
	const nickname = String(user?.nickname || '').trim()
	const sourceName = nickname || openid
	const avatarFileID = String(user?.avatar_fileid || '').trim()
	return {
		author_nickname: nickname,
		author_masked: maskDisplayName(sourceName, openid),
		author_avatar_text: buildAvatarText(sourceName),
		author_avatar_fileid: avatarFileID
	}
}

function buildAvatarMapByUsers(userMap = {}) {
	const avatarMap = {}
	for (const user of Object.values(userMap || {})) {
		const fileID = String(user?.avatar_fileid || '').trim()
		if (!fileID) continue
		const openid = normalizeOpenid(user?.openid || user?._id || '')
		if (!openid) continue
		avatarMap[openid] = fileID
	}
	return avatarMap
}

async function loadLikedMapForPosts(openid, postIds = []) {
	const trimmedOpenid = normalizeOpenid(openid)
	const uniquePostIds = Array.from(new Set((postIds || []).map((item) => String(item || '').trim()).filter(Boolean)))
	const likedMap = {}

	if (!isValidOpenid(trimmedOpenid) || !uniquePostIds.length) return likedMap

	for (const batch of splitIntoBatches(uniquePostIds)) {
		const res = await db.collection(LIKES).where({
			openid: trimmedOpenid,
			post_id: dbCmd.in(batch)
		}).get()
		for (const item of Array.isArray(res?.data) ? res.data : []) {
			if (item?.post_id) likedMap[String(item.post_id)] = true
		}
	}

	return likedMap
}

async function loadPostsByIds(postIds = []) {
	const ids = Array.from(new Set((postIds || []).map((item) => String(item || '').trim()).filter(Boolean)))
	if (!ids.length) return {}
	const postMap = {}
	for (const batch of splitIntoBatches(ids)) {
		const res = await db.collection(POSTS).where({ _id: dbCmd.in(batch) }).get()
		for (const item of Array.isArray(res?.data) ? res.data : []) {
			if (item?._id) postMap[String(item._id)] = item
		}
	}
	return postMap
}

async function syncPostCounts(postId) {
	const likeTotal = await db.collection(LIKES).where({ post_id: postId }).count()
	const commentTotal = await db.collection(COMMENTS).where({
		post_id: postId,
		audit_status: AUDIT_STATUS.APPROVED
	}).count()
	const copyTotal = await db.collection(COPIES).where({ post_id: postId }).count()
	const likeCount = Number(likeTotal?.total || 0)
	const commentCount = Number(commentTotal?.total || 0)
	const copyCount = Number(copyTotal?.total || 0)
	const hotScore = likeCount * 2 + commentCount * 3
	await db.collection(POSTS).doc(postId).update({
		like_count: likeCount,
		comment_count: commentCount,
		copy_count: copyCount,
		hot_score: hotScore,
		updated_at: Date.now()
	})
	return { likeCount, commentCount, copyCount, hotScore }
}

function serializePost(post, likedMap, avatarMap = {}) {
	const authorMasked =
		String(post?.author_masked || '').trim() || maskDisplayName(post?.author_nickname, post?.openid)
	const authorAvatarText =
		String(post?.author_avatar_text || '').trim() || buildAvatarText(post?.author_nickname || post?.openid)
	const authorAvatarFileID =
		String(post?.author_avatar_fileid || '').trim() || String(avatarMap[normalizeOpenid(post?.openid || '')] || '').trim()
	const auditStatus = String(post?.audit_status || AUDIT_STATUS.PENDING)
	return {
		id: String(post?._id || ''),
		siteName: String(post?.site_name || ''),
		siteUrl: String(post?.site_url || ''),
		siteHost: extractHost(post?.site_url || ''),
		summary: String(post?.summary || ''),
		authorMasked,
		authorAvatarText,
		authorAvatarFileID,
		createdAt: Number(post?.created_at || 0),
		timeText: formatRelativeTime(post?.created_at),
		likeCount: Number(post?.like_count || 0),
		commentCount: Number(post?.comment_count || 0),
		copyCount: Number(post?.copy_count || 0),
		hotScore: calcHotScore(post),
		likedByMe: !!likedMap[String(post?._id || '')],
		auditStatus,
		auditStatusText: getAuditStatusText(auditStatus),
		reviewReason: String(post?.audit_reason || '').trim(),
		riskScore: Number(post?.risk_score || 0),
		riskTags: Array.isArray(post?.risk_tags) ? post.risk_tags.map((item) => String(item || '')) : []
	}
}

function serializeComment(comment, avatarMap = {}, postMap = {}, currentOpenid = '') {
	const authorMasked =
		String(comment?.author_masked || '').trim() || maskDisplayName(comment?.author_nickname, comment?.openid)
	const authorAvatarText =
		String(comment?.author_avatar_text || '').trim() || buildAvatarText(comment?.author_nickname || comment?.openid)
	const authorAvatarFileID =
		String(comment?.author_avatar_fileid || '').trim() || String(avatarMap[normalizeOpenid(comment?.openid || '')] || '').trim()
	const auditStatus = String(comment?.audit_status || AUDIT_STATUS.PENDING)
	const parentPost = postMap[String(comment?.post_id || '')] || {}
	return {
		id: String(comment?._id || ''),
		postId: String(comment?.post_id || ''),
		content: String(comment?.content || ''),
		authorMasked,
		authorAvatarText,
		authorAvatarFileID,
		createdAt: Number(comment?.created_at || 0),
		timeText: formatRelativeTime(comment?.created_at),
		auditStatus,
		auditStatusText: getAuditStatusText(auditStatus),
		reviewReason: String(comment?.audit_reason || '').trim(),
		riskScore: Number(comment?.risk_score || 0),
		riskTags: Array.isArray(comment?.risk_tags) ? comment.risk_tags.map((item) => String(item || '')) : [],
		siteName: String(parentPost?.site_name || ''),
		isMine: normalizeOpenid(comment?.openid) === normalizeOpenid(currentOpenid)
	}
}

function containsKeyword(text, keyword) {
	const rawText = String(text || '').toLowerCase()
	const rawKeyword = String(keyword || '').toLowerCase()
	if (!rawText || !rawKeyword) return false
	if (rawText.includes(rawKeyword)) return true

	const normalizedText = normalizeRiskText(rawText)
	const normalizedKeyword = normalizeRiskText(rawKeyword)
	if (!normalizedText || !normalizedKeyword) return false
	return normalizedText.includes(normalizedKeyword)
}

function normalizeRiskText(value) {
	return String(value || '')
		.toLowerCase()
		.trim()
		.replace(/[\s\u00a0`~!@#$%^&*()\-_=+\[\]{}\\|;:'",.<>/?，。！？；：、】【（）《》、·]/g, '')
		.replace(/微\s*信|薇\s*信|威\s*信/g, '微信')
		.replace(/扣\s*扣/g, 'qq')
		.replace(/q[qｑＱ]/g, 'qq')
		.replace(/v[xｘＸ]/g, 'vx')
		.replace(/t[gｇＧ]/g, 'tg')
		.replace(/电\s*报/g, '电报')
		.replace(/约(?:泡|啪|p)/g, '约炮')
		.replace(/黄(?:色|站)/g, (match) => {
			if (match === '黄色') return '色情'
			if (match === '黄站') return '黄网'
			return match
		})
}

function buildRiskResult(tags = [], score = 0, status = AUDIT_STATUS.APPROVED, reason = '') {
	return {
		tags,
		score,
		status,
		reason
	}
}

function evaluateCommentRisk(content) {
	const text = String(content || '').trim()
	let score = 0
	const tags = []

	for (const keyword of REJECT_KEYWORDS) {
		if (containsKeyword(text, keyword)) {
			tags.push(`reject:${keyword}`)
			score += 100
		}
	}
	for (const keyword of REVIEW_KEYWORDS) {
		if (containsKeyword(text, keyword)) {
			tags.push(`review:${keyword}`)
			score += 35
		}
	}
	if (/https?:\/\//i.test(text)) {
		tags.push('review:link')
		score += 35
	}
	if (/(?:^|\D)\d{6,}(?:\D|$)/.test(text)) {
		tags.push('review:number')
		score += 35
	}

	if (score >= 100) {
		return buildRiskResult(tags, score, AUDIT_STATUS.PENDING, '命中高风险内容，等待管理员审核')
	}
	if (score >= 35) {
		return buildRiskResult(tags, score, AUDIT_STATUS.PENDING, '评论包含疑似引流或联系方式，等待管理员审核')
	}
	return buildRiskResult(tags, score, AUDIT_STATUS.APPROVED, '')
}

function evaluatePostRisk(siteName, siteUrl, summary) {
	const text = [siteName, siteUrl, summary].join('\n')
	let score = 0
	const tags = []

	for (const keyword of REJECT_KEYWORDS) {
		if (containsKeyword(text, keyword)) {
			tags.push(`reject:${keyword}`)
			score += 100
		}
	}
	for (const keyword of REVIEW_KEYWORDS) {
		if (containsKeyword(text, keyword)) {
			tags.push(`review:${keyword}`)
			score += 20
		}
	}
	const host = extractHost(siteUrl)
	if (!host) {
		tags.push('review:invalid-host')
		score += 30
	}
	if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
		tags.push('review:ip-host')
		score += 30
	}
	if (host && ['bit.ly', 't.cn', 'url.cn'].includes(host.toLowerCase())) {
		tags.push('review:short-link')
		score += 30
	}

	return buildRiskResult(tags, score, AUDIT_STATUS.PENDING, '推荐已提交，等待管理员审核')
}

async function listAuditItemsByType(itemType, status, page, limit) {
	const collectionName = itemType === 'comment' ? COMMENTS : POSTS
	const offset = (page - 1) * limit
	const totalRes = await db.collection(collectionName).where({ audit_status: status }).count()
	const total = Number(totalRes?.total || 0)
	const res = await db.collection(collectionName)
		.where({ audit_status: status })
		.orderBy('created_at', 'desc')
		.skip(offset)
		.limit(limit)
		.get()
	const rows = Array.isArray(res?.data) ? res.data : []
	const userMap = await loadUsersByOpenids(rows.map((item) => item?.openid))
	const avatarMap = buildAvatarMapByUsers(userMap)
	if (itemType === 'comment') {
		const postMap = await loadPostsByIds(rows.map((item) => item?.post_id))
		return {
			items: rows.map((item) => serializeComment(item, avatarMap, postMap)),
			total
		}
	}
	return {
		items: rows.map((item) => serializePost(item, {}, avatarMap)),
		total
	}
}

exports.main = async (event) => {
	const { action } = event || {}

	if (action === 'health') {
		return { errCode: 0, service: 'community-data', ok: true, serverTime: Date.now() }
	}

	if (action === 'createPost') {
		const auth = await resolveSessionUser(event)
		if (auth.error) return auth.error

		const openid = auth.openid
		const siteName = normalizeSiteName(event?.siteName)
		const siteUrl = normalizeUrl(event?.siteUrl)
		const summary = normalizeSummary(event?.summary)
		if (!siteName) return { errCode: 'INVALID_PARAM', errMsg: '请填写站点名称' }
		if (!siteUrl) return { errCode: 'INVALID_PARAM', errMsg: '请输入完整站点链接' }
		if (!summary) return { errCode: 'INVALID_PARAM', errMsg: '请填写一句话点评' }

		try {
			const todayStart = getChinaDayStart()
			const todayEnd = todayStart + 24 * 60 * 60 * 1000
			const duplicatedRes = await db.collection(POSTS).where({
				openid,
				normalized_site_name: normalizeNameKey(siteName)
			}).limit(MAX_LIST_LIMIT).get()
			const duplicatedRows = Array.isArray(duplicatedRes?.data) ? duplicatedRes.data : []
			const duplicated = duplicatedRows.some(
				(item) => Number(item?.created_at || 0) >= todayStart && Number(item?.created_at || 0) < todayEnd
			)
			if (duplicated) return { errCode: 'DUPLICATED', errMsg: '同一站点今日已推荐过，请明天再试' }

			const now = Date.now()
			const dayKey = getChinaDayKey(now)
			const postId = buildDailyPostId(openid, siteName, dayKey)
			const existing = await db.collection(POSTS).doc(postId).get()
			if (unwrapDoc(existing?.data)) {
				return { errCode: 'DUPLICATED', errMsg: '同一站点今日已推荐过，请明天再试' }
			}

			const author = buildAuthorSnapshot(auth.user, openid)
			const risk = evaluatePostRisk(siteName, siteUrl, summary)
			await db.collection(POSTS).doc(postId).set({
				openid,
				site_name: siteName,
				site_url: siteUrl,
				site_domain: extractHost(siteUrl),
				summary,
				normalized_site_name: normalizeNameKey(siteName),
				like_count: 0,
				comment_count: 0,
				copy_count: 0,
				hot_score: 0,
				audit_status: risk.status,
				audit_source: risk.score > 0 ? 'auto' : 'manual',
				audit_reason: risk.reason,
				risk_score: risk.score,
				risk_tags: risk.tags,
				report_count: 0,
				reviewed_by: '',
				reviewed_at: 0,
				created_at: now,
				updated_at: now,
				...author
			})
			const saved = await db.collection(POSTS).doc(postId).get()
			return {
				errCode: 0,
				post: serializePost(unwrapDoc(saved?.data), {}),
				auditStatus: risk.status,
				message: risk.reason || '推荐已提交'
			}
		} catch (e) {
			return { errCode: 'DB_ERROR', errMsg: e.message || 'create post failed' }
		}
	}

	if (action === 'toggleLike') {
		const auth = await resolveSessionUser(event)
		if (auth.error) return auth.error

		const postId = String(event?.postId || '').trim()
		if (!postId) return { errCode: 'INVALID_PARAM', errMsg: 'missing postId' }

		try {
			const postRes = await db.collection(POSTS).doc(postId).get()
			const post = unwrapDoc(postRes?.data)
			if (!post || String(post?.audit_status || '') !== AUDIT_STATUS.APPROVED) {
				return { errCode: 'NOT_FOUND', errMsg: '推荐内容不存在或未通过审核' }
			}

			const docId = `${postId}__${auth.openid}`
			const likeColl = db.collection(LIKES)
			const exists = await likeColl.doc(docId).get()
			const liked = !!unwrapDoc(exists?.data)
			if (liked) {
				await likeColl.doc(docId).remove()
			} else {
				await likeColl.doc(docId).set({
					post_id: postId,
					openid: auth.openid,
					created_at: Date.now()
				})
			}

			const counts = await syncPostCounts(postId)
			return {
				errCode: 0,
				liked: !liked,
				likeCount: counts.likeCount,
				commentCount: counts.commentCount
			}
		} catch (e) {
			return { errCode: 'DB_ERROR', errMsg: e.message || 'toggle like failed' }
		}
	}

	if (action === 'recordCopy') {
		const postId = String(event?.postId || '').trim()
		if (!postId) return { errCode: 'INVALID_PARAM', errMsg: 'missing postId' }

		try {
			const postRes = await db.collection(POSTS).doc(postId).get()
			const post = unwrapDoc(postRes?.data)
			if (!post || String(post?.audit_status || '') !== AUDIT_STATUS.APPROVED) {
				return { errCode: 'NOT_FOUND', errMsg: '推荐内容不存在或未通过审核' }
			}

			const auth = await resolveSessionUser(event, { required: false })
			if (!auth.valid) {
				return {
					errCode: 0,
					counted: false,
					copyCount: Number(post?.copy_count || 0)
				}
			}

			const now = Date.now()
			const dayKey = getChinaDayKey(now)
			const dayStart = getChinaDayStart(now)
			const docId = `${postId}__${auth.openid}__${dayKey}`
			const copyColl = db.collection(COPIES)
			const exists = await copyColl.doc(docId).get()
			const copied = !!unwrapDoc(exists?.data)

			if (!copied) {
				await copyColl.doc(docId).set({
					post_id: postId,
					openid: auth.openid,
					day_key: dayKey,
					day_start: dayStart,
					created_at: now
				})
			}

			const copyCount = copied ? Number(post?.copy_count || 0) : Number((await syncPostCounts(postId))?.copyCount || 0)
			return {
				errCode: 0,
				counted: !copied,
				copyCount
			}
		} catch (e) {
			return { errCode: 'DB_ERROR', errMsg: e.message || 'record copy failed' }
		}
	}

	if (action === 'listComments') {
		const postId = String(event?.postId || '').trim()
		const page = Math.max(1, Number(event?.page || 1))
		const limit = Math.min(MAX_COMMENT_LIMIT, Math.max(1, Number(event?.limit || 10)))
		if (!postId) return { errCode: 'INVALID_PARAM', errMsg: 'missing postId' }

		try {
			const auth = await resolveSessionUser(event, { required: false })
			const postRes = await db.collection(POSTS).doc(postId).get()
			const post = unwrapDoc(postRes?.data)
			if (!post || String(post?.audit_status || '') !== AUDIT_STATUS.APPROVED) {
				return { errCode: 'NOT_FOUND', errMsg: '推荐内容不存在或未通过审核' }
			}

			const offset = (page - 1) * limit
			const commentsColl = db.collection(COMMENTS).where({
				post_id: postId,
				audit_status: AUDIT_STATUS.APPROVED
			})
			const totalRes = await commentsColl.count()
			const total = Number(totalRes?.total || 0)
			const res = await commentsColl.orderBy('created_at', 'desc').skip(offset).limit(limit).get()
			const rows = Array.isArray(res?.data) ? res.data : []
			const userMap = await loadUsersByOpenids(rows.map((item) => item?.openid))
			const avatarMap = buildAvatarMapByUsers(userMap)
			const items = rows.map((item) => serializeComment(item, avatarMap, {}, auth.valid ? auth.openid : ''))
			return {
				errCode: 0,
				items,
				total,
				page,
				limit,
				hasMore: offset + items.length < total
			}
		} catch (e) {
			return { errCode: 'DB_ERROR', errMsg: e.message || 'list comments failed' }
		}
	}

	if (action === 'createComment') {
		const auth = await resolveSessionUser(event)
		if (auth.error) return auth.error

		const postId = String(event?.postId || '').trim()
		const content = normalizeComment(event?.content)
		if (!postId) return { errCode: 'INVALID_PARAM', errMsg: 'missing postId' }
		if (!content) return { errCode: 'INVALID_PARAM', errMsg: '请输入评论内容' }

		try {
			const postRes = await db.collection(POSTS).doc(postId).get()
			const post = unwrapDoc(postRes?.data)
			if (!post || String(post?.audit_status || '') !== AUDIT_STATUS.APPROVED) {
				return { errCode: 'NOT_FOUND', errMsg: '推荐内容不存在或未通过审核' }
			}

			const now = Date.now()
			const author = buildAuthorSnapshot(auth.user, auth.openid)
			const risk = evaluateCommentRisk(content)
			const addRes = await db.collection(COMMENTS).add({
				post_id: postId,
				openid: auth.openid,
				content,
				audit_status: risk.status,
				audit_source: risk.score > 0 ? 'auto' : 'manual',
				audit_reason: risk.reason,
				risk_score: risk.score,
				risk_tags: risk.tags,
				reviewed_by: '',
				reviewed_at: 0,
				created_at: now,
				...author
			})
			const commentId = addRes?.id || addRes?._id
			if (risk.status === AUDIT_STATUS.APPROVED) {
				const counts = await syncPostCounts(postId)
				const saved = await db.collection(COMMENTS).doc(commentId).get()
				return {
					errCode: 0,
					comment: serializeComment(unwrapDoc(saved?.data), {}, {}, auth.openid),
					commentCount: counts.commentCount,
					auditStatus: risk.status,
					message: '评论成功'
				}
			}

			return {
				errCode: 0,
				comment: null,
				commentCount: Number(post?.comment_count || 0),
				auditStatus: risk.status,
				message: risk.reason || '评论已提交审核'
			}
		} catch (e) {
			return { errCode: 'DB_ERROR', errMsg: e.message || 'create comment failed' }
		}
	}

	if (action === 'deleteComment') {
		const auth = await resolveSessionUser(event)
		if (auth.error) return auth.error

		const commentId = String(event?.commentId || '').trim()
		if (!commentId) return { errCode: 'INVALID_PARAM', errMsg: 'missing commentId' }

		try {
			const commentRes = await db.collection(COMMENTS).doc(commentId).get()
			const comment = unwrapDoc(commentRes?.data)
			if (!comment) return { errCode: 'NOT_FOUND', errMsg: '评论不存在' }
			if (normalizeOpenid(comment?.openid) !== auth.openid) {
				return { errCode: 'FORBIDDEN', errMsg: '只能删除自己的评论' }
			}

			await db.collection(COMMENTS).doc(commentId).remove()
			const counts = await syncPostCounts(String(comment?.post_id || ''))
			return {
				errCode: 0,
				deleted: true,
				commentId,
				postId: String(comment?.post_id || ''),
				commentCount: Number(counts?.commentCount || 0)
			}
		} catch (e) {
			return { errCode: 'DB_ERROR', errMsg: e.message || 'delete comment failed' }
		}
	}

	if (action === 'listPosts') {
		const sortBy = String(event?.sortBy || 'hot').trim() === 'latest' ? 'latest' : 'hot'
		const page = Math.max(1, Number(event?.page || 1))
		const limit = Math.min(MAX_LIST_LIMIT, Math.max(1, Number(event?.limit || 10)))

		try {
			const auth = await resolveSessionUser(event, { required: false })
			const start = (page - 1) * limit
			let query = db.collection(POSTS).where({ audit_status: AUDIT_STATUS.APPROVED })
			const totalRes = await query.count()
			const total = Number(totalRes?.total || 0)
			if (sortBy === 'latest') {
				query = query.orderBy('created_at', 'desc')
			} else {
				query = query.orderBy('hot_score', 'desc').orderBy('created_at', 'desc')
			}
			const res = await query.skip(start).limit(limit).get()
			const rows = (Array.isArray(res?.data) ? res.data : []).filter((item) => item?._id && item?.site_name && item?.site_url)
			const userMap = await loadUsersByOpenids(rows.map((item) => item?.openid))
			const avatarMap = buildAvatarMapByUsers(userMap)
			const likedMap = await loadLikedMapForPosts(auth.valid ? auth.openid : '', rows.map((item) => item?._id))
			const items = rows.map((item) => serializePost(item, likedMap, avatarMap))
			return {
				errCode: 0,
				items,
				total,
				page,
				limit,
				hasMore: start + items.length < total
			}
		} catch (e) {
			return { errCode: 'DB_ERROR', errMsg: e.message || 'list posts failed' }
		}
	}

	if (action === 'listMinePosts') {
		const auth = await resolveSessionUser(event)
		if (auth.error) return auth.error

		const page = Math.max(1, Number(event?.page || 1))
		const limit = Math.min(MAX_LIST_LIMIT, Math.max(1, Number(event?.limit || 10)))

		try {
			const postsColl = db.collection(POSTS).where({ openid: auth.openid })
			const totalRes = await postsColl.count()
			const total = Number(totalRes?.total || 0)
			const start = (page - 1) * limit
			const res = await postsColl.orderBy('created_at', 'desc').skip(start).limit(limit).get()
			const rows = (Array.isArray(res?.data) ? res.data : []).filter((item) => item?._id && item?.site_name && item?.site_url)
			const userMap = await loadUsersByOpenids([auth.openid])
			const avatarMap = buildAvatarMapByUsers(userMap)
			const likedMap = await loadLikedMapForPosts(auth.openid, rows.map((item) => item?._id))
			const items = rows.map((item) => serializePost(item, likedMap, avatarMap))
			return {
				errCode: 0,
				items,
				total,
				page,
				limit,
				hasMore: start + items.length < total
			}
		} catch (e) {
			return { errCode: 'DB_ERROR', errMsg: e.message || 'list mine posts failed' }
		}
	}

	if (action === 'listAuditItems') {
		const auth = await resolveSessionUser(event)
		const adminError = ensureAdminUser(auth)
		if (adminError) return adminError

		const itemType = String(event?.itemType || 'post').trim() === 'comment' ? 'comment' : 'post'
		const statusRaw = String(event?.status || AUDIT_STATUS.PENDING).trim()
		const status = Object.values(AUDIT_STATUS).includes(statusRaw) ? statusRaw : AUDIT_STATUS.PENDING
		const page = Math.max(1, Number(event?.page || 1))
		const limit = Math.min(MAX_LIST_LIMIT, Math.max(1, Number(event?.limit || 10)))

		try {
			const payload = await listAuditItemsByType(itemType, status, page, limit)
			return {
				errCode: 0,
				items: payload.items,
				total: payload.total,
				page,
				limit,
				hasMore: page * limit < payload.total
			}
		} catch (e) {
			return { errCode: 'DB_ERROR', errMsg: e.message || 'list audit items failed' }
		}
	}

	if (action === 'reviewAuditItem') {
		const auth = await resolveSessionUser(event)
		const adminError = ensureAdminUser(auth)
		if (adminError) return adminError

		const itemType = String(event?.itemType || 'post').trim() === 'comment' ? 'comment' : 'post'
		const itemId = String(event?.itemId || '').trim()
		const decision = String(event?.decision || '').trim() === 'approve' ? 'approve' : 'reject'
		const reviewReason = String(event?.reason || '').trim().slice(0, 80)
		if (!itemId) return { errCode: 'INVALID_PARAM', errMsg: 'missing itemId' }

		const collectionName = itemType === 'comment' ? COMMENTS : POSTS

		try {
			const currentRes = await db.collection(collectionName).doc(itemId).get()
			const current = unwrapDoc(currentRes?.data)
			if (!current) return { errCode: 'NOT_FOUND', errMsg: '审核内容不存在' }

			const nextStatus = decision === 'approve' ? AUDIT_STATUS.APPROVED : AUDIT_STATUS.REJECTED
			await db.collection(collectionName).doc(itemId).update({
				audit_status: nextStatus,
				audit_source: 'manual',
				audit_reason: reviewReason || (decision === 'approve' ? '管理员审核通过' : '管理员审核未通过'),
				reviewed_by: auth.openid,
				reviewed_at: Date.now(),
				updated_at: Date.now()
			})

			if (itemType === 'comment') {
				await syncPostCounts(String(current?.post_id || ''))
			}

			const savedRes = await db.collection(collectionName).doc(itemId).get()
			const saved = unwrapDoc(savedRes?.data)
			if (itemType === 'comment') {
				const userMap = await loadUsersByOpenids([saved?.openid])
				const avatarMap = buildAvatarMapByUsers(userMap)
				const postMap = await loadPostsByIds([saved?.post_id])
				return {
					errCode: 0,
					item: serializeComment(saved, avatarMap, postMap),
					decision
				}
			}

			const userMap = await loadUsersByOpenids([saved?.openid])
			const avatarMap = buildAvatarMapByUsers(userMap)
			return {
				errCode: 0,
				item: serializePost(saved, {}, avatarMap),
				decision
			}
		} catch (e) {
			return { errCode: 'DB_ERROR', errMsg: e.message || 'review audit item failed' }
		}
	}

	if (action === 'deletePost') {
		const auth = await resolveSessionUser(event)
		if (auth.error) return auth.error

		const postId = String(event?.postId || '').trim()
		if (!postId) return { errCode: 'INVALID_PARAM', errMsg: 'missing postId' }

		try {
			const postRes = await db.collection(POSTS).doc(postId).get()
			const post = unwrapDoc(postRes?.data)
			if (!post) return { errCode: 'NOT_FOUND', errMsg: '推荐内容不存在' }
			if (normalizeOpenid(post?.openid) !== auth.openid) {
				return { errCode: 'FORBIDDEN', errMsg: '只能删除自己的推荐' }
			}

			await Promise.all([
				db.collection(COMMENTS).where({ post_id: postId }).remove(),
				db.collection(LIKES).where({ post_id: postId }).remove(),
				db.collection(COPIES).where({ post_id: postId }).remove(),
				db.collection(POSTS).doc(postId).remove()
			])

			return {
				errCode: 0,
				deleted: true,
				postId
			}
		} catch (e) {
			return { errCode: 'DB_ERROR', errMsg: e.message || 'delete post failed' }
		}
	}

	return { errCode: 'UNKNOWN', errMsg: 'unknown action' }
}
