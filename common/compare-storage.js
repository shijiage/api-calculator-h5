import { COMPARE_DRAFT_STORAGE_KEY, CLOUD_CALL_TIMEOUT_MS } from '@/common/data.js'

function clone(obj) {
	return JSON.parse(JSON.stringify(obj))
}

function isValidSite(s) {
	return s && typeof s === 'object' && Array.isArray(s.rows)
}

/**
 * @returns {{ siteA: object, siteB: object, updatedAt: number } | null}
 */
export function loadCompareDraft() {
	try {
		const raw = uni.getStorageSync(COMPARE_DRAFT_STORAGE_KEY)
		if (!raw) return null
		const obj = typeof raw === 'string' ? JSON.parse(raw) : raw
		if (!obj || !isValidSite(obj.siteA) || !isValidSite(obj.siteB)) return null
		return {
			siteA: obj.siteA,
			siteB: obj.siteB,
			updatedAt: typeof obj.updatedAt === 'number' ? obj.updatedAt : 0
		}
	} catch {
		return null
	}
}

/**
 * @param {number} [updatedAtOverride] 与云端合并时写入云端时间戳，避免本地比云端新却被覆盖
 * @returns {number} 写入的 updatedAt
 */
export function saveCompareDraftLocal(siteA, siteB, updatedAtOverride) {
	const updatedAt =
		typeof updatedAtOverride === 'number' ? updatedAtOverride : Date.now()
	try {
		uni.setStorageSync(COMPARE_DRAFT_STORAGE_KEY, {
			siteA: clone(siteA),
			siteB: clone(siteB),
			updatedAt
		})
	} catch {
		// ignore
	}
	return updatedAt
}

export function clearCompareDraft() {
	try {
		uni.removeStorageSync(COMPARE_DRAFT_STORAGE_KEY)
	} catch {
		// ignore
	}
}

/**
 * @returns {Promise<{ siteA: object, siteB: object, updatedAt: number } | null>}
 */
export async function loadCompareDraftFromCloud(openid) {
	if (!openid) return null
	let res
	try {
		res = await uniCloud.callFunction({
			name: 'compare-data',
			data: { action: 'load', openid },
			timeout: CLOUD_CALL_TIMEOUT_MS
		})
	} catch {
		return null
	}
	if (res.errMsg && res.errMsg !== 'cloud.callFunction:ok' && res.errMsg !== 'callFunction:ok') {
		return null
	}
	const payload = res.result
	if (!payload || payload.errCode !== 0 || !payload.data) return null
	const d = payload.data
	if (!isValidSite(d.siteA) || !isValidSite(d.siteB)) return null
	return {
		siteA: d.siteA,
		siteB: d.siteB,
		updatedAt: typeof d.updated_at === 'number' ? d.updated_at : 0
	}
}

/**
 * @returns {Promise<number | null>} 服务端 updated_at，失败为 null
 */
export async function saveCompareDraftToCloud(openid, siteA, siteB) {
	if (!openid) return null
	let res
	try {
		res = await uniCloud.callFunction({
			name: 'compare-data',
			data: {
				action: 'save',
				openid,
				siteA: clone(siteA),
				siteB: clone(siteB)
			},
			timeout: CLOUD_CALL_TIMEOUT_MS
		})
	} catch {
		return null
	}
	if (res.errMsg && res.errMsg !== 'cloud.callFunction:ok' && res.errMsg !== 'callFunction:ok') {
		return null
	}
	const payload = res.result
	if (!payload || payload.errCode !== 0) return null
	return typeof payload.updated_at === 'number' ? payload.updated_at : null
}

export function clearCompareDraftCloud(openid) {
	if (!openid) return Promise.resolve()
	return uniCloud
		.callFunction({
			name: 'compare-data',
			data: { action: 'clear', openid },
			timeout: CLOUD_CALL_TIMEOUT_MS
		})
		.catch(() => {})
}
