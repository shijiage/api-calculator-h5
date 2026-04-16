'use strict'

/**
 * 用户报告历史：集合 calc_report_records
 * 需在 HBuilderX 上传部署；控制台创建集合或上传 schema。
 */
const db = uniCloud.database()
const COL = 'calc_report_records'
const MAX = 30

function validSite(s) {
	return s && typeof s === 'object' && Array.isArray(s.rows)
}

exports.main = async (event) => {
	const { action, openid } = event
	if (action === 'health') {
		return {
			errCode: 0,
			service: 'report-records',
			ok: true,
			serverTime: Date.now()
		}
	}

	if (!openid || String(openid).length < 8) {
		return { errCode: 'INVALID_PARAM', errMsg: 'invalid openid' }
	}

	const coll = db.collection(COL)

	if (action === 'add') {
		const { report_id, title, ts, saving_cny, payload, site_a, site_b } = event
		if (!report_id || !payload || typeof payload !== 'object') {
			return { errCode: 'INVALID_PARAM', errMsg: 'missing report_id or payload' }
		}
		const t = typeof ts === 'number' ? ts : Date.now()
		const doc = {
			openid,
			report_id: String(report_id),
			title: String(title || '性价比报告'),
			ts: t,
			payload
		}
		if (typeof saving_cny === 'number' && saving_cny > 0) {
			doc.saving_cny = Math.round(saving_cny * 100) / 100
		}
		if (validSite(site_a)) doc.site_a = site_a
		if (validSite(site_b)) doc.site_b = site_b
		try {
			try {
				await coll.where({ openid, report_id: doc.report_id }).remove()
			} catch (e) {
				// ignore
			}
			await coll.add(doc)
			const all = await coll.where({ openid }).get()
			const arr = (all.data || []).sort((a, b) => (b.ts || 0) - (a.ts || 0))
			for (let i = MAX; i < arr.length; i++) {
				try {
					await coll.doc(arr[i]._id).remove()
				} catch (e) {
					// ignore
				}
			}
		} catch (e) {
			return { errCode: 'DB_ERROR', errMsg: e.message || 'add failed' }
		}
		return { errCode: 0 }
	}

	if (action === 'list') {
		let arr = []
		try {
			const got = await coll.where({ openid }).get()
			arr = (got.data || []).sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, MAX)
		} catch (e) {
			return { errCode: 'DB_ERROR', errMsg: e.message || 'list failed' }
		}
		const list = arr.map((d) => {
			const item = {
				id: d.report_id,
				title: d.title,
				ts: d.ts
			}
			if (typeof d.saving_cny === 'number' && d.saving_cny > 0) {
				item.savingCny = d.saving_cny
			}
			if (validSite(d.site_a)) item.siteA = d.site_a
			if (validSite(d.site_b)) item.siteB = d.site_b
			return item
		})
		return { errCode: 0, list }
	}

	if (action === 'get') {
		const report_id = event.report_id
		if (!report_id) {
			return { errCode: 'INVALID_PARAM', errMsg: 'missing report_id' }
		}
		let row = null
		try {
			const got = await coll.where({ openid, report_id: String(report_id) }).limit(1).get()
			row = got.data && got.data[0]
		} catch (e) {
			return { errCode: 'DB_ERROR', errMsg: e.message || 'get failed' }
		}
		if (!row || !row.payload) {
			return { errCode: 0, payload: null, site_a: null, site_b: null }
		}
		return {
			errCode: 0,
			payload: row.payload,
			site_a: validSite(row.site_a) ? row.site_a : null,
			site_b: validSite(row.site_b) ? row.site_b : null
		}
	}

	if (action === 'delete') {
		const report_id = event.report_id
		if (!report_id) {
			return { errCode: 'INVALID_PARAM', errMsg: 'missing report_id' }
		}
		try {
			await coll.where({ openid, report_id: String(report_id) }).remove()
		} catch (e) {
			return { errCode: 'DB_ERROR', errMsg: e.message || 'delete failed' }
		}
		return { errCode: 0 }
	}

	return { errCode: 'UNKNOWN', errMsg: 'unknown action' }
}
