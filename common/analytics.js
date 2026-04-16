const STORAGE = {
	firstSeenAt: 'calc_ana_first_seen_at',
	lastSeenAt: 'calc_ana_last_seen_at',
	visitCount: 'calc_ana_visit_count',
	loginCount: 'calc_ana_login_count',
	reportCount: 'calc_ana_report_count',
	firstRecordFilledAt: 'calc_ana_first_record_filled_at',
	reportGeneratedDays: 'calc_ana_report_generated_days',
	funnelCounters: 'calc_ana_funnel_counters'
}

const FUNNEL_EVENTS = new Set([
	'enter_calc',
	'fill_first_record',
	'generate_report',
	'view_records',
	'restore_compare'
])

function read(key, fallback) {
	try {
		const v = uni.getStorageSync(key)
		return v === '' || v === undefined || v === null ? fallback : v
	} catch {
		return fallback
	}
}

function write(key, value) {
	try {
		uni.setStorageSync(key, value)
	} catch {}
}

function inc(key, delta = 1) {
	const n = Number(read(key, 0)) || 0
	const next = n + delta
	write(key, next)
	return next
}

function todayKey(ts = Date.now()) {
	const d = new Date(ts)
	const pad = (n) => (n < 10 ? '0' + n : '' + n)
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function keepRecentDays(days, keep = 30) {
	const arr = Array.isArray(days) ? days.slice() : []
	const uniq = [...new Set(arr)].sort()
	return uniq.slice(Math.max(0, uniq.length - keep))
}

function readFunnelCounters() {
	const obj = read(STORAGE.funnelCounters, {})
	return obj && typeof obj === 'object' ? obj : {}
}

function writeFunnelCounters(obj) {
	write(STORAGE.funnelCounters, obj)
}

export function markAppVisit() {
	const now = Date.now()
	if (!read(STORAGE.firstSeenAt, 0)) write(STORAGE.firstSeenAt, now)
	write(STORAGE.lastSeenAt, now)
	inc(STORAGE.visitCount, 1)
}

export function markLoginSuccess() {
	inc(STORAGE.loginCount, 1)
}

export function markReportGenerated() {
	inc(STORAGE.reportCount, 1)
	const days = read(STORAGE.reportGeneratedDays, [])
	const next = keepRecentDays([...(Array.isArray(days) ? days : []), todayKey()], 45)
	write(STORAGE.reportGeneratedDays, next)
}

export function markFirstRecordFilledIfNeeded() {
	if (read(STORAGE.firstRecordFilledAt, 0)) return false
	write(STORAGE.firstRecordFilledAt, Date.now())
	return true
}

export function trackFunnelEvent(name) {
	if (!FUNNEL_EVENTS.has(name)) return
	const c = readFunnelCounters()
	c[name] = (Number(c[name]) || 0) + 1
	writeFunnelCounters(c)
}

function hasOpenidLocal() {
	const id = read('calc_openid', '')
	return !!String(id || '').trim()
}

export function getUserSegment() {
	const visitCount = Number(read(STORAGE.visitCount, 0)) || 0
	const reportCount = Number(read(STORAGE.reportCount, 0)) || 0
	const hasOpenid = hasOpenidLocal()
	if (visitCount >= 2) return '复访用户'
	if (reportCount > 0) return '生成报告用户'
	if (hasOpenid) return '登录用户'
	return '浏览用户'
}

export function getGrowthSnapshot() {
	const days = read(STORAGE.reportGeneratedDays, [])
	const arr = Array.isArray(days) ? days : []
	const today = new Date()
	const pass = []
	for (let i = 0; i < 7; i++) {
		const d = new Date(today)
		d.setDate(today.getDate() - i)
		pass.push(todayKey(d.getTime()))
	}
	const activeDays = arr.filter((x) => pass.includes(x))
	return {
		northStarWeeklyReportUserLocal: activeDays.length > 0 ? 1 : 0,
		weeklyReportActiveDays: activeDays.length,
		funnelCounters: readFunnelCounters()
	}
}
