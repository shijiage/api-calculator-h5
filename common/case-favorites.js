import { CLOUD_CALL_TIMEOUT_MS } from '@/common/data.js'
import { getStoredOpenid } from '@/common/auth.js'

async function callCaseFavorites(action, extra = {}) {
	const openid = getStoredOpenid()
	if (!openid) return { ok: false, err: 'NO_OPENID', result: null }
	try {
		const res = await uniCloud.callFunction({
			name: 'case-favorites',
			data: { action, openid, ...extra },
			timeout: CLOUD_CALL_TIMEOUT_MS
		})
		const payload = res && res.result ? res.result : null
		if (!payload || payload.errCode !== 0) {
			return { ok: false, err: (payload && payload.errMsg) || 'CALL_FAILED', result: payload }
		}
		return { ok: true, err: '', result: payload }
	} catch (e) {
		return { ok: false, err: e?.errMsg || e?.message || 'NETWORK', result: null }
	}
}

export async function listCaseFavoriteIds() {
	const r = await callCaseFavorites('list')
	if (!r.ok) return []
	return Array.isArray(r.result.ids) ? r.result.ids.map((x) => String(x)) : []
}

export async function setCaseFavorite(caseId, favorited) {
	if (!caseId) return { ok: false }
	const r = await callCaseFavorites('set', { case_id: String(caseId), favorited: !!favorited })
	if (!r.ok) return { ok: false }
	return {
		ok: true,
		favorited: !!r.result.favorited,
		ids: Array.isArray(r.result.ids) ? r.result.ids.map((x) => String(x)) : [],
		total: Number(r.result.total || 0)
	}
}

export async function getCaseFavoriteCount() {
	const r = await callCaseFavorites('count')
	if (!r.ok) return 0
	return Number(r.result.total || 0)
}
