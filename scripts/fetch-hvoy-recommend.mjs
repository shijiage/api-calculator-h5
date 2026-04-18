import fs from 'node:fs/promises'
import path from 'node:path'

const SOURCE_URL = 'https://hvoy.ai/__all-channels'
const ROOT = process.cwd()
const OUT_FILE = path.join(ROOT, 'docs', 'recommend-sites.hvoy.seed.json')

const MODEL_META = {
	'claude-opus-4-6': {
		section_key: 'opus-46',
		section_title: 'Opus 4.6 推荐',
		section_sort: 10,
		model_label: 'Opus 4.6'
	},
	'claude-opus-4-7': {
		section_key: 'opus-47',
		section_title: 'Opus 4.7 推荐',
		section_sort: 20,
		model_label: 'Opus 4.7'
	},
	'claude-sonnet-4-6': {
		section_key: 'sonnet-46',
		section_title: 'Sonnet 4.6 推荐',
		section_sort: 30,
		model_label: 'Sonnet 4.6'
	},
	'gpt-5.4': {
		section_key: 'gpt-54',
		section_title: 'GPT 5.4 推荐',
		section_sort: 40,
		model_label: 'GPT 5.4'
	}
}

function formatNumber(value, digits = 2) {
	if (typeof value !== 'number' || !Number.isFinite(value)) return ''
	return value.toFixed(digits).replace(/\.0+$|(\.\d*[1-9])0+$/, '$1')
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

function deriveBadge(channel) {
	const text = String(channel || '').trim()
	if (!text) return ''
	if (text.length <= 10 && /^[a-z0-9_\-\s]+$/i.test(text)) return text
	if (/^(default|cc|codex)$/i.test(text)) return text
	return ''
}

function statusMeta(lastResult) {
	if (lastResult === 'pass') return { status_text: '畅通', status_type: 'excellent' }
	if (lastResult === 'fail') return { status_text: '失败', status_type: 'normal' }
	return { status_text: '异常', status_type: 'normal' }
}

function transformRow(row, sourceUpdatedAt) {
	const modelMeta = MODEL_META[row.modelKey]
	if (!modelMeta || !row.site) return null

	const passRate = typeof row.passRate === 'number' ? row.passRate : null
	const onlineRate = typeof row.onlineRate === 'number' ? row.onlineRate : null
	const avgLatencyS = typeof row.avgLatencyS === 'number' ? row.avgLatencyS : null
	const latestInputPriceCny =
		typeof row.latestInputPriceCny === 'number' ? row.latestInputPriceCny : null
	const defaultRanking =
		typeof row.defaultRanking === 'number' && Number.isFinite(row.defaultRanking)
			? row.defaultRanking
			: null
	const channel = String(row.channel || '').trim() || 'default'
	const status = statusMeta(row.lastResult)
	const now = Date.now()

	return {
		enabled: defaultRanking != null,
		source: 'hvoy',
		...modelMeta,
		site_name: String(row.site || ''),
		model_key: String(row.modelKey || ''),
		site_domain: String(row.siteDomain || ''),
		site_url: String(row.siteUrl || ''),
		channel,
		badge: deriveBadge(channel),
		group: channel,
		price: formatPrice(latestInputPriceCny),
		latency: formatLatency(avgLatencyS),
		online_rate: formatPercent(onlineRate),
		mix_rate: formatPercent(passRate == null ? null : Math.max(0, 100 - passRate)),
		...status,
		sort: defaultRanking ?? 9999,
		default_ranking: defaultRanking,
		pass_rate: passRate,
		fail_rate: typeof row.failRate === 'number' ? row.failRate : null,
		online_rate_num: onlineRate,
		avg_latency_s: avgLatencyS,
		latest_input_price_cny: latestInputPriceCny,
		sample_count: typeof row.sampleCount === 'number' ? row.sampleCount : null,
		weighted_score: typeof row.weightedScore === 'number' ? row.weightedScore : null,
		last_result: String(row.lastResult || ''),
		source_updated_at: sourceUpdatedAt,
		updated_at: now
	}
}

const res = await fetch(SOURCE_URL)
if (!res.ok) {
	throw new Error(`Fetch failed: ${res.status} ${res.statusText}`)
}
const payload = await res.json()
const sourceUpdatedAt = Date.parse(String(payload.updatedAt || '')) || Date.now()

const docs = (payload.channels || [])
	.map((row) => transformRow(row, sourceUpdatedAt))
	.filter(Boolean)
	.sort((a, b) => {
		if (a.section_sort !== b.section_sort) return a.section_sort - b.section_sort
		if (a.sort !== b.sort) return a.sort - b.sort
		return a.site_name.localeCompare(b.site_name, 'zh-CN')
	})

await fs.mkdir(path.dirname(OUT_FILE), { recursive: true })
await fs.writeFile(OUT_FILE, JSON.stringify({
	source: SOURCE_URL,
	updatedAt: payload.updatedAt,
	total: docs.length,
	enabled: docs.filter((item) => item.enabled).length,
	items: docs
}, null, 2))

console.log(`Saved ${docs.length} rows to ${OUT_FILE}`)
