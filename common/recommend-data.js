import { CLOUD_CALL_TIMEOUT_MS } from '@/common/data.js'

const RECOMMEND_SYNC_TIMEOUT_MS = 65000

function isOkErrMsg(errMsg) {
	return !errMsg || errMsg === 'cloud.callFunction:ok' || errMsg === 'callFunction:ok'
}

/**
 * 拉取服务器维护的推荐站点列表。
 * @returns {Promise<Array<{ title: string, cards: Array<object> }>>}
 */
export async function loadRecommendSections(options = {}) {
	const { keyword = '', limitPerSection = 0 } = options || {}
	let res
	try {
		res = await uniCloud.callFunction({
			name: 'recommend-data',
			data: {
				action: 'list',
				keyword: String(keyword || ''),
				limitPerSection: Number(limitPerSection || 0)
			},
			timeout: CLOUD_CALL_TIMEOUT_MS
		})
	} catch (e) {
		throw new Error(
			e?.errMsg ||
				e?.message ||
				'云函数调用失败：请确认已上传 recommend-data 云函数并关联 uniCloud-aliyun'
		)
	}

	if (!isOkErrMsg(res?.errMsg)) {
		throw new Error(res.errMsg || '推荐数据请求失败')
	}

	const payload = res?.result
	if (!payload || payload.errCode !== 0) {
		throw new Error(payload?.errMsg || '推荐数据获取失败')
	}

	return Array.isArray(payload.sections) ? payload.sections : []
}

export async function loadRecommendSectionPage(options = {}) {
	const { sectionKey = '', offset = 0, limit = 10, keyword = '' } = options || {}
	let res
	try {
		res = await uniCloud.callFunction({
			name: 'recommend-data',
			data: {
				action: 'listSectionPage',
				sectionKey: String(sectionKey || ''),
				offset: Number(offset || 0),
				limit: Number(limit || 10),
				keyword: String(keyword || '')
			},
			timeout: CLOUD_CALL_TIMEOUT_MS
		})
	} catch (e) {
		throw new Error(
			e?.errMsg ||
				e?.message ||
				'云函数调用失败：请确认已上传 recommend-data 云函数并关联 uniCloud-aliyun'
		)
	}

	if (!isOkErrMsg(res?.errMsg)) {
		throw new Error(res.errMsg || '推荐分页请求失败')
	}

	const payload = res?.result
	if (!payload || payload.errCode !== 0) {
		throw new Error(payload?.errMsg || '推荐分页获取失败')
	}

	return payload.section || null
}

export async function syncRecommendFromHvoy(openid) {
	let res
	try {
		res = await uniCloud.callFunction({
			name: 'recommend-data',
			data: {
				action: 'syncFromHvoy',
				openid: String(openid || '')
			},
			timeout: Math.max(CLOUD_CALL_TIMEOUT_MS, RECOMMEND_SYNC_TIMEOUT_MS)
		})
	} catch (e) {
		throw new Error(e?.errMsg || e?.message || '后台同步失败')
	}

	if (!isOkErrMsg(res?.errMsg)) {
		throw new Error(res.errMsg || '后台同步失败')
	}

	const payload = res?.result
	if (!payload || payload.errCode !== 0) {
		throw new Error(payload?.errMsg || '后台同步失败')
	}

	return payload
}

export async function dedupeRecommendData(openid) {
	let res
	try {
		res = await uniCloud.callFunction({
			name: 'recommend-data',
			data: {
				action: 'dedupeExisting',
				openid: String(openid || ''),
				source: 'hvoy'
			},
			timeout: Math.max(CLOUD_CALL_TIMEOUT_MS, RECOMMEND_SYNC_TIMEOUT_MS)
		})
	} catch (e) {
		throw new Error(e?.errMsg || e?.message || '数据库去重失败')
	}

	if (!isOkErrMsg(res?.errMsg)) {
		throw new Error(res.errMsg || '数据库去重失败')
	}

	const payload = res?.result
	if (!payload || payload.errCode !== 0) {
		throw new Error(payload?.errMsg || '数据库去重失败')
	}

	return payload
}
