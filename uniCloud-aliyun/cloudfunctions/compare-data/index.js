'use strict'

/**
 * 用户对比草稿：按 openid 存 calc_user_compare，供换机后恢复。
 * 需在 HBuilderX 上传部署；数据库控制台创建集合 calc_user_compare（或上传 schema 后同步）。
 */
const db = uniCloud.database()
const COL = 'calc_user_compare'

exports.main = async (event) => {
	const { action, openid } = event
	if (action === 'health') {
		return {
			errCode: 0,
			service: 'compare-data',
			ok: true,
			serverTime: Date.now()
		}
	}

	if (!openid || String(openid).length < 8) {
		return { errCode: 'INVALID_PARAM', errMsg: 'invalid openid' }
	}

	const coll = db.collection(COL)

	if (action === 'save') {
		const { siteA, siteB } = event
		if (!siteA || !siteB) {
			return { errCode: 'INVALID_PARAM', errMsg: 'missing siteA/siteB' }
		}
		const updated_at = Date.now()
		try {
			await coll.doc(openid).set({
				openid,
				siteA,
				siteB,
				updated_at
			})
		} catch (e) {
			return { errCode: 'DB_ERROR', errMsg: e.message || 'save failed' }
		}
		return { errCode: 0, updated_at }
	}

	if (action === 'load') {
		let doc = null
		try {
			const got = await coll.doc(openid).get()
			if (got.data) {
				doc = Array.isArray(got.data) ? got.data[0] : got.data
			}
		} catch (e) {
			return { errCode: 'DB_ERROR', errMsg: e.message || 'load failed' }
		}
		if (!doc || !doc.siteA || !doc.siteB) {
			return { errCode: 0, data: null }
		}
		return {
			errCode: 0,
			data: {
				siteA: doc.siteA,
				siteB: doc.siteB,
				updated_at: doc.updated_at
			}
		}
	}

	if (action === 'clear') {
		try {
			await coll.doc(openid).remove()
		} catch (e) {
			// 文档不存在等忽略
		}
		return { errCode: 0 }
	}

	return { errCode: 'UNKNOWN', errMsg: 'unknown action' }
}
