import { getStoredOpenid } from '@/common/auth.js'
import {
	REPORT_HISTORY_MAX_ITEMS,
	CLOUD_CALL_TIMEOUT_MS,
	PENDING_RESTORE_SITES_KEY
} from '@/common/data.js'

const LIST_KEY = 'calc_report_history'
const SNAPSHOT_PREFIX = 'calc_report_snap_'
const MAX_ITEMS = REPORT_HISTORY_MAX_ITEMS

function clone(obj) {
	return JSON.parse(JSON.stringify(obj))
}

export function validSite(s) {
	return s && typeof s === 'object' && Array.isArray(s.rows)
}

export function reportRecordHasSites(item) {
	return !!(item && validSite(item.siteA) && validSite(item.siteB))
}

/**
 * 单行展示站点充值与记录条数（记录列表用）
 * @param {string} label 如 'A' / 'B'
 */
export function formatSiteSummaryLine(label, site) {
	if (!validSite(site)) return `站点 ${label}：—`
	const rc = String(site.rechargeCny || '').trim() || '—'
	const qu = String(site.quotaUsd || '').trim() || '—'
	const n = Array.isArray(site.rows) ? site.rows.length : 0
	return `站点 ${label}：¥${rc} / $${qu} · ${n} 条用量`
}

export function getReportHistoryList() {
	try {
		const raw = uni.getStorageSync(LIST_KEY)
		if (!raw) return []
		const list = typeof raw === 'string' ? JSON.parse(raw) : raw
		return Array.isArray(list) ? list : []
	} catch {
		return []
	}
}

/** 用合并后的候选列表覆盖列表键，并删除不再保留的快照 */
function replaceReportList(candidate) {
	const next = candidate.slice(0, MAX_ITEMS)
	const nextIds = new Set(next.map((x) => x.id))
	const old = getReportHistoryList()
	for (const o of old) {
		if (!nextIds.has(o.id)) {
			try {
				uni.removeStorageSync(SNAPSHOT_PREFIX + o.id)
			} catch (e) {}
		}
	}
	for (const o of candidate.slice(MAX_ITEMS)) {
		try {
			uni.removeStorageSync(SNAPSHOT_PREFIX + o.id)
		} catch (e) {}
	}
	try {
		uni.setStorageSync(LIST_KEY, JSON.stringify(next))
	} catch (e) {}
}

async function cloudReportRecords(action, extra) {
	const openid = getStoredOpenid()
	if (!openid) return { errCode: 'NO_OPENID', result: null }
	let res
	try {
		res = await uniCloud.callFunction({
			name: 'report-records',
			data: { action, openid, ...extra },
			timeout: CLOUD_CALL_TIMEOUT_MS
		})
	} catch (e) {
		return { errCode: 'NETWORK', result: null }
	}
	if (res.errMsg && res.errMsg !== 'cloud.callFunction:ok' && res.errMsg !== 'callFunction:ok') {
		return { errCode: 'CALL', result: null }
	}
	return { errCode: 0, result: res.result }
}

function buildCloudAddBodyByLocalId(id) {
	const list = getReportHistoryList()
	const item = list.find((x) => x.id === id)
	if (!item) return null
	const payload = getReportSnapshotById(id)
	if (!payload) return null
	const body = {
		report_id: id,
		title: item.title || '性价比报告',
		ts: item.ts || Date.now(),
		saving_cny: item.savingCny,
		payload: clone(payload)
	}
	if (validSite(item.siteA)) body.site_a = clone(item.siteA)
	if (validSite(item.siteB)) body.site_b = clone(item.siteB)
	return body
}

/**
 * 删除单条记录：先删本地，再尝试删云端
 * @param {string} id
 * @returns {Promise<boolean>} 本地删除是否成功
 */
export async function deleteReportHistoryById(id) {
	if (!id) return { localDeleted: false, cloudDeleted: false }
	let localOk = false
	try {
		const list = getReportHistoryList()
		const next = list.filter((x) => x.id !== id)
		if (next.length !== list.length) {
			replaceReportList(next)
		}
		try {
			uni.removeStorageSync(SNAPSHOT_PREFIX + id)
		} catch (e) {}
		localOk = true
	} catch (e) {
		localOk = false
	}

	let cloudDeleted = false
	const openid = getStoredOpenid()
	if (openid) {
		const { errCode, result } = await cloudReportRecords('delete', { report_id: id })
		cloudDeleted = errCode === 0 && result && result.errCode === 0
		if (!cloudDeleted) {
			console.warn('[report-history] cloud delete failed', result)
		}
	} else {
		cloudDeleted = false
	}
	return { localDeleted: localOk, cloudDeleted }
}

/**
 * 已登录时从云端拉取列表并写入本地 LIST_KEY（列表项可含 siteA/siteB）
 * @returns {Promise<boolean>} 是否拉取成功
 */
export async function syncReportHistoryFromCloud() {
	const { errCode, result } = await cloudReportRecords('list', {})
	if (errCode !== 0 || !result || result.errCode !== 0 || !Array.isArray(result.list)) {
		return false
	}
	try {
		const local = getReportHistoryList()
		const map = new Map()
		for (const it of local) map.set(it.id, { ...it })
		for (const it of result.list) {
			const prev = map.get(it.id) || {}
			map.set(it.id, {
				...prev,
				...it,
				siteA: it.siteA || prev.siteA,
				siteB: it.siteB || prev.siteB
			})
		}
		const merged = [...map.values()].sort((a, b) => b.ts - a.ts)
		replaceReportList(merged)
	} catch (e) {
		return false
	}
	return true
}

/**
 * @param {object} payload 与 REPORT_STORAGE_KEY 相同结构的报告对象
 * @param {string} [title] 列表标题
 * @param {number} [savingCny] 本次报告估算节省人民币（若有）
 * @param {object} siteA 生成时的站点 A
 * @param {object} siteB 生成时的站点 B
 * @returns {Promise<string>} report id
 */
export async function pushReportHistory(payload, title, savingCny, siteA, siteB) {
	const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
	const item = {
		id,
		title: title || (payload && payload.hero && payload.hero.title) || '性价比报告',
		ts: Date.now()
	}
	if (typeof savingCny === 'number' && savingCny > 0) {
		item.savingCny = Math.round(savingCny * 100) / 100
	}
	if (validSite(siteA)) item.siteA = clone(siteA)
	if (validSite(siteB)) item.siteB = clone(siteB)
	try {
		uni.setStorageSync(SNAPSHOT_PREFIX + id, payload)
		const list = getReportHistoryList()
		list.unshift(item)
		replaceReportList(list)
	} catch (e) {
		console.error('pushReportHistory local', e)
	}

	let cloudSynced = false
	const openid = getStoredOpenid()
	if (openid) {
		const body = {
			report_id: id,
			title: item.title,
			ts: item.ts,
			saving_cny: item.savingCny,
			payload: clone(payload)
		}
		if (item.siteA) body.site_a = item.siteA
		if (item.siteB) body.site_b = item.siteB
		const { errCode, result } = await cloudReportRecords('add', body)
		cloudSynced = errCode === 0 && result && result.errCode === 0
		if (!cloudSynced) {
			console.warn('[report-history] cloud add failed', result)
		}
	}
	return { id, cloudSynced: openid ? cloudSynced : true }
}

/** 关键动作失败后可重试：按本地快照重传指定记录到云端 */
export async function retryReportCloudSyncById(id) {
	const openid = getStoredOpenid()
	if (!openid) return false
	const body = buildCloudAddBodyByLocalId(id)
	if (!body) return false
	const { errCode, result } = await cloudReportRecords('add', body)
	return errCode === 0 && result && result.errCode === 0
}

/** 关键动作失败后可重试：仅重试云端删除 */
export async function retryDeleteReportCloudById(id) {
	const openid = getStoredOpenid()
	if (!openid || !id) return false
	const { errCode, result } = await cloudReportRecords('delete', { report_id: id })
	return errCode === 0 && result && result.errCode === 0
}

/** 仅读本地报告快照（payload） */
export function getReportSnapshotById(id) {
	if (!id) return null
	try {
		return uni.getStorageSync(SNAPSHOT_PREFIX + id) || null
	} catch {
		return null
	}
}

/**
 * 本地无快照时从云端拉取 payload（并写入本地缓存）
 * @returns {Promise<object|null>}
 */
export async function getReportSnapshotByIdAsync(id) {
	if (!id) return null
	const local = getReportSnapshotById(id)
	if (local) return local
	const openid = getStoredOpenid()
	if (!openid) return null
	const { errCode, result } = await cloudReportRecords('get', { report_id: id })
	if (errCode !== 0 || !result || result.errCode !== 0 || !result.payload) {
		return null
	}
	try {
		uni.setStorageSync(SNAPSHOT_PREFIX + id, result.payload)
	} catch (e) {}
	return result.payload
}

/**
 * 获取某条记录当时的 A/B 配置（先本地列表，再云端）
 * @returns {Promise<{ siteA: object, siteB: object } | null>}
 */
export async function getReportSitesByIdAsync(id) {
	if (!id) return null
	const list = getReportHistoryList()
	const hit = list.find((x) => x.id === id)
	if (hit && validSite(hit.siteA) && validSite(hit.siteB)) {
		return { siteA: clone(hit.siteA), siteB: clone(hit.siteB) }
	}
	const openid = getStoredOpenid()
	if (!openid) return null
	const { errCode, result } = await cloudReportRecords('get', { report_id: id })
	if (errCode !== 0 || !result || result.errCode !== 0) return null
	if (!validSite(result.site_a) || !validSite(result.site_b)) return null
	return { siteA: clone(result.site_a), siteB: clone(result.site_b) }
}

/** 写入待恢复配置，计算页读取后清除 */
export function setPendingRestoreSites(siteA, siteB) {
	try {
		uni.setStorageSync(
			PENDING_RESTORE_SITES_KEY,
			JSON.stringify({
				siteA: clone(siteA),
				siteB: clone(siteB)
			})
		)
	} catch (e) {
		throw e
	}
}

export function consumePendingRestoreSites() {
	try {
		const raw = uni.getStorageSync(PENDING_RESTORE_SITES_KEY)
		if (!raw) return null
		uni.removeStorageSync(PENDING_RESTORE_SITES_KEY)
		const obj = typeof raw === 'string' ? JSON.parse(raw) : raw
		if (!obj || !validSite(obj.siteA) || !validSite(obj.siteB)) return null
		return { siteA: obj.siteA, siteB: obj.siteB }
	} catch {
		try {
			uni.removeStorageSync(PENDING_RESTORE_SITES_KEY)
		} catch (e2) {}
		return null
	}
}
