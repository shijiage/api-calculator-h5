'use strict'

const db = uniCloud.database()
const COL = 'calc_case_favorites'

async function listIds(openid) {
	const got = await db.collection(COL).where({ openid }).get()
	const arr = Array.isArray(got.data) ? got.data : []
	return arr.map((x) => String(x.case_id || '')).filter(Boolean).sort()
}

exports.main = async (event) => {
	const { action, openid } = event || {}

	if (action === 'health') {
		return { errCode: 0, service: 'case-favorites', ok: true, serverTime: Date.now() }
	}

	if (!openid || String(openid).length < 8) {
		return { errCode: 'INVALID_PARAM', errMsg: 'invalid openid' }
	}

	if (action === 'list') {
		try {
			const ids = await listIds(openid)
			return { errCode: 0, ids, total: ids.length }
		} catch (e) {
			return { errCode: 'DB_ERROR', errMsg: e.message || 'list failed' }
		}
	}

	if (action === 'count') {
		try {
			const c = await db.collection(COL).where({ openid }).count()
			return { errCode: 0, total: Number(c.total || 0) }
		} catch (e) {
			return { errCode: 'DB_ERROR', errMsg: e.message || 'count failed' }
		}
	}

	if (action === 'set') {
		const caseId = String(event.case_id || '').trim()
		const favorited = !!event.favorited
		if (!caseId) return { errCode: 'INVALID_PARAM', errMsg: 'missing case_id' }
		const docId = `${openid}__${caseId}`
		try {
			if (favorited) {
				await db.collection(COL).doc(docId).set({
					openid,
					case_id: caseId,
					updated_at: Date.now()
				})
			} else {
				try {
					await db.collection(COL).doc(docId).remove()
				} catch (e) {
					// ignore
				}
			}
			const ids = await listIds(openid)
			return { errCode: 0, favorited, ids, total: ids.length }
		} catch (e) {
			return { errCode: 'DB_ERROR', errMsg: e.message || 'set failed' }
		}
	}

	return { errCode: 'UNKNOWN', errMsg: 'unknown action' }
}
