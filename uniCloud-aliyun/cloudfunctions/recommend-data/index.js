'use strict'

const fs = require('fs')
const path = require('path')

/**
 * 推荐站点列表：公开只读，供推荐页展示。
 * 需在 HBuilderX 上传部署；数据库控制台创建集合 calc_recommend_sites（或上传 schema 后同步）。
 */
const db = uniCloud.database()
const COL = 'calc_recommend_sites'
const USERS = 'calc_users'
const SOURCE_URL = 'https://hvoy.ai/__all-channels'
const SYNC_KEY = process.env.RECOMMEND_SYNC_KEY || ''
const LOCAL_SEED_PATHS = [
	path.resolve(__dirname, 'recommend-sites.hvoy.seed.json'),
	path.resolve(__dirname, '../../../docs/recommend-sites.hvoy.seed.json')
]
const DB_PAGE_SIZE = 200
const WRITE_CONCURRENCY = 8
const FEATURED_LIMIT_PER_SECTION = 5

const MODEL_META = {
	'claude-opus-4-7': {
		sectionKey: 'opus-47',
		sectionTitle: 'Opus 4.7 推荐',
		sectionSort: 10,
		modelLabel: 'Opus 4.7'
	},
	'claude-opus-4-6': {
		sectionKey: 'opus-46',
		sectionTitle: 'Opus 4.6 推荐',
		sectionSort: 20,
		modelLabel: 'Opus 4.6'
	},
	'claude-sonnet-4-6': {
		sectionKey: 'sonnet-46',
		sectionTitle: 'Sonnet 4.6 推荐',
		sectionSort: 30,
		modelLabel: 'Sonnet 4.6'
	},
	'gpt-5.4': {
		sectionKey: 'gpt-54',
		sectionTitle: 'GPT 5.4 推荐',
		sectionSort: 40,
		modelLabel: 'GPT 5.4'
	}
}

function formatNumber(value, digits) {
	if (typeof value !== 'number' || !Number.isFinite(value)) return ''
	const fixed = value.toFixed(typeof digits === 'number' ? digits : 2)
	return fixed.replace(/\.0+$|(\.\d*[1-9])0+$/, '$1')
}

function formatPercent(value) {
	if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
	return `${formatNumber(value, 1)}%`
}

function formatPrice(value) {
	if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
	return `¥ ${formatNumber(value, 4)}`
}

function formatLatency(value) {
	if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
	return `${formatNumber(value, 1)}s`
}

function normalizeSourceUpdatedAt(value) {
	const ts = Date.parse(String(value || ''))
	return Number.isFinite(ts) ? ts : Date.now()
}

function statusMeta(lastResult) {
	if (lastResult === 'pass') {
		return { statusText: '畅通', statusType: 'excellent' }
	}
	if (lastResult === 'fail') {
		return { statusText: '失败', statusType: 'normal' }
	}
	return { statusText: '异常', statusType: 'normal' }
}

function deriveBadge(channel) {
	const text = String(channel || '').trim()
	if (!text) return ''
	if (text.length <= 10 && /^[a-z0-9_\-\s]+$/i.test(text)) return text
	if (/^(default|cc|codex)$/i.test(text)) return text
	return ''
}

function normalizeSourceRow(row, sourceUpdatedAt) {
	const meta = MODEL_META[row.modelKey]
	if (!meta || !row.site) return null
	const passRate = typeof row.passRate === 'number' ? row.passRate : null
	const onlineRate = typeof row.onlineRate === 'number' ? row.onlineRate : null
	const avgLatencyS = typeof row.avgLatencyS === 'number' ? row.avgLatencyS : null
	const latestInputPriceCny =
		typeof row.latestInputPriceCny === 'number' ? row.latestInputPriceCny : null
	const mixRate = passRate == null ? null : Math.max(0, 100 - passRate)
	const status = statusMeta(row.lastResult)
	const defaultRanking =
		typeof row.defaultRanking === 'number' && Number.isFinite(row.defaultRanking)
			? row.defaultRanking
			: null
	const channel = String(row.channel || '').trim() || 'default'

	return {
		enabled: defaultRanking != null,
		section_key: meta.sectionKey,
		section_title: meta.sectionTitle,
		section_sort: meta.sectionSort,
		site_name: String(row.site || ''),
		model_label: meta.modelLabel,
		model_key: String(row.modelKey || ''),
		site_domain: String(row.siteDomain || ''),
		site_url: String(row.siteUrl || ''),
		channel,
		badge: deriveBadge(channel),
		group: channel,
		price: formatPrice(latestInputPriceCny),
		latency: formatLatency(avgLatencyS),
		online_rate: formatPercent(onlineRate),
		mix_rate: formatPercent(mixRate),
		status_text: status.statusText,
		status_type: status.statusType,
		sort: defaultRanking != null ? defaultRanking : 9999,
		default_ranking: defaultRanking,
		pass_rate: passRate,
		fail_rate: typeof row.failRate === 'number' ? row.failRate : null,
		online_rate_num: onlineRate,
		avg_latency_s: avgLatencyS,
		latest_input_price_cny: latestInputPriceCny,
		sample_count: typeof row.sampleCount === 'number' ? row.sampleCount : null,
		weighted_score: typeof row.weightedScore === 'number' ? row.weightedScore : null,
		last_result: String(row.lastResult || ''),
		source: 'hvoy',
		source_updated_at: sourceUpdatedAt,
		updated_at: Date.now()
	}
}

function normalizeKeyPart(value) {
	return String(value || '')
		.trim()
		.toLowerCase()
}

function extractHost(url) {
	const text = String(url || '').trim()
	if (!text) return ''
	try {
		return new URL(text).hostname || ''
	} catch (e) {}
	const match = text.match(/^https?:\/\/([^/?#]+)/i)
	return match && match[1] ? String(match[1]).toLowerCase() : ''
}

function buildRecordKey(doc) {
	const source = normalizeKeyPart(doc.source || 'hvoy')
	const modelKey = normalizeKeyPart(doc.model_key || doc.modelKey)
	const channel = normalizeKeyPart(doc.channel || 'default')
	const siteDomain = normalizeKeyPart(doc.site_domain || doc.siteDomain || extractHost(doc.site_url || doc.siteUrl))
	const siteName = normalizeKeyPart(doc.site_name || doc.siteName)
	return [source, modelKey, channel, siteDomain, siteName].join('::')
}

function toComparableDoc(doc) {
	return JSON.stringify({
		enabled: !!doc.enabled,
		source: String(doc.source || ''),
		section_key: String(doc.section_key || ''),
		section_title: String(doc.section_title || ''),
		section_sort: Number(doc.section_sort || 0),
		site_name: String(doc.site_name || ''),
		model_label: String(doc.model_label || ''),
		model_key: String(doc.model_key || ''),
		site_domain: String(doc.site_domain || ''),
		site_url: String(doc.site_url || ''),
		channel: String(doc.channel || ''),
		badge: String(doc.badge || ''),
		group: String(doc.group || ''),
		price: String(doc.price || ''),
		latency: String(doc.latency || ''),
		online_rate: String(doc.online_rate || ''),
		mix_rate: String(doc.mix_rate || ''),
		status_text: String(doc.status_text || ''),
		status_type: String(doc.status_type || ''),
		sort: Number(doc.sort || 0),
		default_ranking:
			typeof doc.default_ranking === 'number' && Number.isFinite(doc.default_ranking)
				? doc.default_ranking
				: null,
		pass_rate: typeof doc.pass_rate === 'number' ? doc.pass_rate : null,
		fail_rate: typeof doc.fail_rate === 'number' ? doc.fail_rate : null,
		online_rate_num: typeof doc.online_rate_num === 'number' ? doc.online_rate_num : null,
		avg_latency_s: typeof doc.avg_latency_s === 'number' ? doc.avg_latency_s : null,
		latest_input_price_cny:
			typeof doc.latest_input_price_cny === 'number' ? doc.latest_input_price_cny : null,
		sample_count: typeof doc.sample_count === 'number' ? doc.sample_count : null,
		weighted_score: typeof doc.weighted_score === 'number' ? doc.weighted_score : null,
		last_result: String(doc.last_result || ''),
		source_updated_at:
			typeof doc.source_updated_at === 'number' ? Number(doc.source_updated_at) : null
	})
}

function enrichStoredDoc(doc, now, existing) {
	const current = existing || null
	return {
		...doc,
		record_key: buildRecordKey(doc),
		sync_state: doc.enabled ? 'active' : 'inactive',
		created_at:
			typeof current?.created_at === 'number' && Number.isFinite(current.created_at)
				? current.created_at
				: now,
		last_seen_at: now,
		updated_at: now,
		sync_count:
			typeof current?.sync_count === 'number' && Number.isFinite(current.sync_count)
				? current.sync_count + 1
				: 1
	}
}

function preferDoc(nextDoc, currentDoc) {
	if (!currentDoc) return true
	if (!!nextDoc.enabled !== !!currentDoc.enabled) return !!nextDoc.enabled
	const nextSort = typeof nextDoc.sort === 'number' ? nextDoc.sort : 9999
	const currentSort = typeof currentDoc.sort === 'number' ? currentDoc.sort : 9999
	if (nextSort !== currentSort) return nextSort < currentSort
	const nextLatency =
		typeof nextDoc.avg_latency_s === 'number' && Number.isFinite(nextDoc.avg_latency_s)
			? nextDoc.avg_latency_s
			: Number.POSITIVE_INFINITY
	const currentLatency =
		typeof currentDoc.avg_latency_s === 'number' && Number.isFinite(currentDoc.avg_latency_s)
			? currentDoc.avg_latency_s
			: Number.POSITIVE_INFINITY
	return nextLatency < currentLatency
}

function normalizeStatusType(type) {
	const raw = String(type || '').trim()
	if (raw === 'excellent' || raw === 'good' || raw === 'normal') return raw
	return 'normal'
}

function getDisplayStatusText(doc, statusType) {
	if (statusType === 'excellent') return '流畅'
	if (statusType === 'good') return '良好'
	return String(doc?.last_result || '').trim() === 'fail' ? '失败' : '异常'
}

function normalizeDoc(doc) {
	const modelLabel = String(doc.model_label || doc.modelLabel || '')
	const statusType = normalizeStatusType(doc.status_type)
	return {
		sectionKey: String(doc.section_key || ''),
		sectionTitle: modelLabel || String(doc.section_title || ''),
		sectionSort: Number(doc.section_sort || 0),
		sort: Number(doc.sort || 0),
		name: String(doc.site_name || ''),
		modelLabel,
		modelKey: String(doc.model_key || ''),
		siteUrl: String(doc.site_url || ''),
		siteDomain: String(doc.site_domain || ''),
		channel: String(doc.channel || ''),
		badge: String(doc.badge || ''),
		group: String(doc.group || ''),
		price: String(doc.price || ''),
		latency: String(doc.latency || ''),
		onlineRate: String(doc.online_rate || ''),
		mixRate: String(doc.mix_rate || ''),
		statusText: getDisplayStatusText(doc, statusType),
		statusType,
		defaultRanking:
			typeof doc.default_ranking === 'number' ? Number(doc.default_ranking) : null,
		sourceUpdatedAt:
			typeof doc.source_updated_at === 'number' ? Number(doc.source_updated_at) : null
	}
}

function compareDisplayDoc(a, b) {
	if (a.sectionSort !== b.sectionSort) return a.sectionSort - b.sectionSort
	if (a.sort !== b.sort) return a.sort - b.sort
	return String(a.name || '').localeCompare(String(b.name || ''), 'zh-CN')
}

function normalizeDisplayRows(rows) {
	return (Array.isArray(rows) ? rows : [])
		.map(normalizeDoc)
		.filter((item) => item.sectionTitle && item.name)
		.sort(compareDisplayDoc)
}

function buildFeaturedSeedRows(payload, limitPerSection = FEATURED_LIMIT_PER_SECTION) {
	const normalized = normalizeDisplayRows(
		payloadToDocs(payload).docs.filter((item) => item && item.enabled)
	)
	if (!normalized.length) return []

	const grouped = new Map()
	for (const item of normalized) {
		const key = String(item.modelKey || item.sectionKey || item.sectionTitle || '').trim()
		if (!key) continue
		if (!grouped.has(key)) grouped.set(key, [])
		const items = grouped.get(key)
		if (items.length >= limitPerSection) continue
		items.push(item)
	}

	return Array.from(grouped.values()).flat()
}

function loadBundledFeaturedRows() {
	const payload = readLocalSeedPayload()
	if (!payload) return []
	return buildFeaturedSeedRows(payload)
}

function matchesKeyword(sectionTitle, item, keyword) {
	const key = String(keyword || '').trim().toLowerCase()
	if (!key) return true
	const haystack = [
		sectionTitle,
		item.name,
		item.group,
		item.modelLabel || '',
		item.badge || '',
		item.channel || '',
		item.siteDomain || ''
	]
		.join(' ')
		.toLowerCase()
	return haystack.includes(key)
}

function toSectionCard(item) {
	return {
		name: item.name,
		modelLabel: item.modelLabel,
		modelKey: item.modelKey,
		siteUrl: item.siteUrl,
		siteDomain: item.siteDomain,
		channel: item.channel,
		badge: item.badge,
		group: item.group,
		price: item.price,
		latency: item.latency,
		onlineRate: item.onlineRate,
		mixRate: item.mixRate,
		statusText: item.statusText,
		statusType: item.statusType,
		defaultRanking: item.defaultRanking,
		sourceUpdatedAt: item.sourceUpdatedAt
	}
}

function buildSectionPayload(section, offset, limit) {
	const safeOffset = Math.max(0, Number(offset) || 0)
	const safeLimit = Math.max(0, Number(limit) || 0)
	const totalCount = section.cards.length
	const cards = safeLimit > 0 ? section.cards.slice(safeOffset, safeOffset + safeLimit) : section.cards.slice(safeOffset)
	const nextOffset = safeOffset + cards.length
	return {
		sectionKey: section.sectionKey,
		title: section.title,
		totalCount,
		offset: safeOffset,
		limit: safeLimit,
		hasMore: nextOffset < totalCount,
		nextOffset,
		cards
	}
}

function unwrapEvent(event) {
	if (event && typeof event === 'object' && event.param && typeof event.param === 'object') {
		return event.param
	}
	return event || {}
}

function unwrapDoc(data) {
	if (!data) return null
	return Array.isArray(data) ? data[0] || null : data
}

async function loadCollectionByWhere(where) {
	const coll = db.collection(COL)
	const rows = []
	let skip = 0
	while (true) {
		const res = await coll.where(where).skip(skip).limit(DB_PAGE_SIZE).get()
		const data = Array.isArray(res?.data) ? res.data : []
		rows.push(...data)
		if (data.length < DB_PAGE_SIZE) break
		skip += data.length
	}
	return rows
}

async function runBatched(tasks, concurrency) {
	const limit = Math.max(1, Number(concurrency) || 1)
	let index = 0
	const workers = new Array(Math.min(limit, tasks.length)).fill(0).map(async () => {
		while (index < tasks.length) {
			const current = index
			index += 1
			await tasks[current]()
		}
	})
	await Promise.all(workers)
}

async function getUserByOpenid(openid) {
	const trimmed = String(openid || '').trim()
	if (!trimmed) return null

	const coll = db.collection(USERS)
	const direct = await coll.doc(trimmed).get()
	const doc = unwrapDoc(direct && direct.data)
	if (doc) return doc

	const byField = await coll.where({ openid: trimmed }).limit(1).get()
	return unwrapDoc(byField && byField.data)
}

async function assertAdminPermission(openid, syncKey) {
	let isAllowed = false
	if (SYNC_KEY && syncKey && syncKey === SYNC_KEY) {
		isAllowed = true
	}
	if (!isAllowed && openid) {
		const user = await getUserByOpenid(openid)
		isAllowed = !!(user && user.isAdmin)
	}
	return isAllowed
}

function planExistingRowsDedup(rows, source) {
	const existingByKey = new Map()
	const duplicateRows = []
	const repairRows = []

	for (const row of rows) {
		if (!row?._id) continue
		const recordKey = String(row.record_key || buildRecordKey(row))
		if (!recordKey) continue
		const normalizedSource = String(row.source || source || '')
		const normalizedSyncState = row.enabled ? 'active' : 'inactive'
		const needsRepair =
			String(row.record_key || '') !== recordKey ||
			String(row.source || '') !== normalizedSource ||
			String(row.sync_state || '') !== normalizedSyncState

		const current = existingByKey.get(recordKey)
		if (!current) {
			existingByKey.set(recordKey, row)
			if (needsRepair) {
				repairRows.push({
					_id: row._id,
					record_key: recordKey,
					source: normalizedSource,
					sync_state: normalizedSyncState
				})
			}
			continue
		}

		if (preferDoc(row, current)) {
			duplicateRows.push(current)
			existingByKey.set(recordKey, row)
			if (needsRepair) {
				repairRows.push({
					_id: row._id,
					record_key: recordKey,
					source: normalizedSource,
					sync_state: normalizedSyncState
				})
			}
		} else {
			duplicateRows.push(row)
		}
	}

	return { existingByKey, duplicateRows, repairRows }
}

function readLocalSeedPayload() {
	for (const filePath of LOCAL_SEED_PATHS) {
		try {
			if (!fs.existsSync(filePath)) continue
			const text = fs.readFileSync(filePath, 'utf8')
			const payload = JSON.parse(text)
			if (payload && (Array.isArray(payload.channels) || Array.isArray(payload.items))) {
				return payload
			}
		} catch (e) {}
	}
	return null
}

function parseRemotePayload(remote) {
	const data = remote && remote.data !== undefined ? remote.data : remote
	if (!data) return null
	if (typeof data === 'string') {
		try {
			return JSON.parse(data)
		} catch (e) {
			return null
		}
	}
	return data
}

function payloadToDocs(payload) {
	if (!payload || typeof payload !== 'object') return { docs: [], sourceUpdatedAt: Date.now() }

	if (Array.isArray(payload.channels)) {
		const sourceUpdatedAt = normalizeSourceUpdatedAt(payload.updatedAt)
		return {
			sourceUpdatedAt,
			docs: payload.channels
				.map((row) => normalizeSourceRow(row, sourceUpdatedAt))
				.filter(Boolean)
		}
	}

	if (Array.isArray(payload.items)) {
		const sourceUpdatedAt = normalizeSourceUpdatedAt(payload.updatedAt)
		return {
			sourceUpdatedAt,
			docs: payload.items.map((item) => {
				const meta = MODEL_META[item?.model_key || item?.modelKey] || null
				return {
					...item,
					section_key: meta ? meta.sectionKey : item.section_key,
					section_title: meta ? meta.sectionTitle : item.section_title,
					section_sort:
						meta && typeof meta.sectionSort === 'number'
							? meta.sectionSort
							: item.section_sort,
					model_label: meta ? meta.modelLabel : item.model_label,
					source: 'hvoy',
					source_updated_at:
						typeof item?.source_updated_at === 'number' ? item.source_updated_at : sourceUpdatedAt,
					updated_at: Date.now()
				}
			})
		}
	}

	return { docs: [], sourceUpdatedAt: Date.now() }
}

async function fetchHvoyPayload() {
	let lastError = null
	try {
		const remote = await uniCloud.httpclient.request(SOURCE_URL, {
			method: 'GET',
			dataType: 'json',
			timeout: 20000,
			headers: {
				accept: 'application/json,text/plain,*/*',
				'referer': 'https://hvoy.ai/leaderboard',
				'user-agent': 'Mozilla/5.0'
			}
		})
		const parsed = parseRemotePayload(remote)
		if (parsed && (Array.isArray(parsed.channels) || Array.isArray(parsed.items))) {
			return {
				payload: parsed,
				usedFallback: false,
				fallbackReason: ''
			}
		}
		lastError = new Error('unexpected source payload')
	} catch (e) {
		lastError = e
	}

	const localSeed = readLocalSeedPayload()
	if (localSeed) {
		return {
			payload: localSeed,
			usedFallback: true,
			fallbackReason: lastError ? lastError.message || 'fetch source failed' : 'fetch source failed'
		}
	}

	throw lastError || new Error('fetch source failed')
}

exports.main = async (event) => {
	const payloadEvent = unwrapEvent(event)
	const { action } = payloadEvent
	if (action === 'health') {
		return {
			errCode: 0,
			service: 'recommend-data',
			ok: true,
			serverTime: Date.now()
		}
	}

	if (action !== 'list') {
		if (action !== 'syncFromHvoy' && action !== 'dedupeExisting' && action !== 'listSectionPage') {
			return { errCode: 'UNKNOWN', errMsg: 'unknown action' }
		}
	}

	if (action === 'dedupeExisting') {
		const openid = String(payloadEvent.openid || '').trim()
		const syncKey = String(payloadEvent.syncKey || '')
		const source = String(payloadEvent.source || 'hvoy').trim() || 'hvoy'
		let isAllowed = false
		try {
			isAllowed = await assertAdminPermission(openid, syncKey)
		} catch (e) {
			return { errCode: 'DB_ERROR', errMsg: e.message || 'check admin failed' }
		}
		if (!isAllowed) {
			return { errCode: 'FORBIDDEN', errMsg: '仅管理员可执行数据库去重' }
		}

		try {
			const coll = db.collection(COL)
			const rows = await loadCollectionByWhere({ source })
			const { existingByKey, duplicateRows, repairRows } = planExistingRowsDedup(rows, source)
			const repairTasks = repairRows.map((item) => async () => {
				await coll.doc(item._id).update({
					record_key: item.record_key,
					source: item.source,
					sync_state: item.sync_state
				})
			})
			const removeTasks = duplicateRows
				.filter((item) => item && item._id)
				.map((item) => async () => {
					await coll.doc(item._id).remove()
				})

			await runBatched(repairTasks, WRITE_CONCURRENCY)
			await runBatched(removeTasks, WRITE_CONCURRENCY)

			return {
				errCode: 0,
				source,
				total: rows.length,
				unique: existingByKey.size,
				removedDuplicates: duplicateRows.length,
				repaired: repairRows.length
			}
		} catch (e) {
			return { errCode: 'DB_ERROR', errMsg: e.message || 'dedupe failed' }
		}
	}

	if (action === 'syncFromHvoy') {
		const openid = String(payloadEvent.openid || '').trim()
		const syncKey = String(payloadEvent.syncKey || '')
		let isAllowed = false
		try {
			isAllowed = await assertAdminPermission(openid, syncKey)
		} catch (e) {
			return { errCode: 'DB_ERROR', errMsg: e.message || 'check admin failed' }
		}
		if (!isAllowed) {
			return { errCode: 'FORBIDDEN', errMsg: '仅管理员可执行后台同步' }
		}

		let fetched
		try {
			fetched = await fetchHvoyPayload()
		} catch (e) {
			return { errCode: 'HTTP_ERROR', errMsg: e.message || 'fetch source failed' }
		}

		const sourcePayload = fetched && fetched.payload ? fetched.payload : null
		const normalized = payloadToDocs(sourcePayload)
		const docs = normalized.docs
		const sourceUpdatedAt = normalized.sourceUpdatedAt
		if (!docs.length) {
			return { errCode: 'INVALID_SOURCE', errMsg: 'unexpected source payload' }
		}

		try {
			const now = Date.now()
			const coll = db.collection(COL)
			const oldRows = await loadCollectionByWhere({ source: 'hvoy' })
			const { existingByKey, duplicateRows: duplicateOldRows, repairRows } = planExistingRowsDedup(
				oldRows,
				'hvoy'
			)

			const incomingByKey = new Map()
			let incomingDuplicates = 0
			for (const doc of docs) {
				const enriched = enrichStoredDoc(doc, now)
				const key = enriched.record_key
				const current = incomingByKey.get(key)
				if (!current) {
					incomingByKey.set(key, enriched)
					continue
				}
				incomingDuplicates += 1
				if (preferDoc(enriched, current)) {
					incomingByKey.set(key, enriched)
				}
			}

			let inserted = 0
			let updated = 0
			let unchanged = 0
			let disabled = 0
			const insertTasks = []
			const updateTasks = []
			const disableTasks = []
			const removeTasks = repairRows.map((item) => async () => {
				await coll.doc(item._id).update({
					record_key: item.record_key,
					source: item.source,
					sync_state: item.sync_state
				})
			})

			for (const [key, doc] of incomingByKey.entries()) {
				const existing = existingByKey.get(key)
				const enriched = enrichStoredDoc(doc, now, existing)
				if (!existing) {
					insertTasks.push(async () => {
						await coll.add(enriched)
					})
					inserted += 1
					continue
				}

				const needsRepair =
					String(existing.record_key || '') !== enriched.record_key ||
					String(existing.sync_state || '') !== enriched.sync_state
				const changed = toComparableDoc(existing) !== toComparableDoc(enriched)
				if (!changed && !needsRepair) {
					unchanged += 1
					continue
				}

				updateTasks.push(async () => {
					await coll.doc(existing._id).update(enriched)
				})
				updated += 1
			}

			for (const [key, row] of existingByKey.entries()) {
				if (!row?._id || incomingByKey.has(key)) continue
				if (!row.enabled && String(row.sync_state || '') === 'inactive') continue
				disableTasks.push(async () => {
					await coll.doc(row._id).update({
						enabled: false,
						sync_state: 'inactive',
						updated_at: now
					})
				})
				disabled += 1
			}

			for (const row of duplicateOldRows) {
				if (!row?._id) continue
				removeTasks.push(async () => {
					await coll.doc(row._id).remove()
				})
			}

			await runBatched(insertTasks, WRITE_CONCURRENCY)
			await runBatched(updateTasks, WRITE_CONCURRENCY)
			await runBatched(disableTasks, WRITE_CONCURRENCY)
			await runBatched(removeTasks, WRITE_CONCURRENCY)

			return {
				errCode: 0,
				source: 'hvoy',
				sourceUrl: SOURCE_URL,
				sourceUpdatedAt,
				usedFallback: !!(fetched && fetched.usedFallback),
				fallbackReason: fetched && fetched.usedFallback ? fetched.fallbackReason || '' : '',
				synced: incomingByKey.size,
				enabled: Array.from(incomingByKey.values()).filter((item) => item.enabled).length,
				inserted,
				updated,
				unchanged,
				disabled,
				removedDuplicates: duplicateOldRows.length,
				skippedDuplicates: incomingDuplicates
			}
		} catch (e) {
			return { errCode: 'DB_ERROR', errMsg: e.message || 'sync failed' }
		}
	}

	let rows = []
	try {
		rows = await loadCollectionByWhere({ enabled: true })
	} catch (e) {
		return { errCode: 'DB_ERROR', errMsg: e.message || 'list failed' }
	}

	const keyword = String(payloadEvent.keyword || '').trim()
	const hvoyRows = rows.filter((item) => String(item?.source || '').trim() === 'hvoy')
	let bundledFeaturedRows = []
	if (hvoyRows.length < FEATURED_LIMIT_PER_SECTION * Object.keys(MODEL_META).length) {
		bundledFeaturedRows = loadBundledFeaturedRows()
		if (!bundledFeaturedRows.length) {
			try {
				const fetched = await fetchHvoyPayload()
				bundledFeaturedRows = buildFeaturedSeedRows(fetched?.payload)
			} catch (e) {}
		}
	}
	const sourceRows =
		hvoyRows.length >= FEATURED_LIMIT_PER_SECTION * Object.keys(MODEL_META).length
			? hvoyRows
			: bundledFeaturedRows.length
				? bundledFeaturedRows
				: rows
	const normalized = Array.isArray(sourceRows) && sourceRows.length && sourceRows[0]?.sectionTitle
		? sourceRows.filter((item) => item.sectionTitle && item.name).sort(compareDisplayDoc)
		: normalizeDisplayRows(sourceRows)

	const map = new Map()
	for (const item of normalized) {
		if (!matchesKeyword(item.sectionTitle, item, keyword)) continue
		const key = item.sectionKey || item.sectionTitle
		if (!map.has(key)) {
			map.set(key, {
				sectionKey: key,
				title: item.sectionTitle,
				sort: item.sectionSort,
				cards: []
			})
		}
		map.get(key).cards.push(toSectionCard(item))
	}

	const sections = Array.from(map.values()).sort((a, b) => a.sort - b.sort)

	if (action === 'listSectionPage') {
		const sectionKey = String(payloadEvent.sectionKey || '').trim()
		const offset = Number(payloadEvent.offset || 0)
		const limit = Number(payloadEvent.limit || 0)
		const section = sections.find((item) => item.sectionKey === sectionKey)
		if (!section) {
			return { errCode: 0, section: null }
		}
		return { errCode: 0, section: buildSectionPayload(section, offset, limit) }
	}

	const limitPerSection = Math.max(0, Number(payloadEvent.limitPerSection || 0))
	return {
		errCode: 0,
		sections: sections.map((section) =>
			limitPerSection > 0
				? buildSectionPayload(section, 0, limitPerSection)
				: buildSectionPayload(section, 0, section.cards.length)
		)
	}
}
