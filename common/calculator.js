/**
 * 与 web 端 api-calculator.html 一致的核心算法：
 * ① 充值比例 (CNY/$) = 充值金额(¥) ÷ 获得额度($)，分母为 0 时按 1 处理（与 HTML 一致）
 * ② 每条记录人民币花费 = 消耗额度($) × 充值比例
 * ③ 总人民币花费 = 各记录人民币之和 (= 已消耗额度$之和 × 比例)
 * ④ 每 1K Tokens 均价(¥) = 总人民币花费 ÷ 总 Tokens × 1000
 * ⑤ 对比：以每 1K Tokens 均价更低者为优；节省金额按 HTML 公式
 */

function parseNum(v, fallback = 0) {
	if (v === '' || v === null || v === undefined) return fallback
	const n = parseFloat(String(v).replace(/,/g, ''))
	return Number.isFinite(n) ? n : fallback
}

function parseIntSafe(v) {
	const n = parseInt(String(v || '').replace(/,/g, ''), 10)
	return Number.isFinite(n) ? n : 0
}

/** 仅统计「消耗额度($) > 0」的行，与 web 端 addRecord 校验一致 */
export function getEffectiveRows(rows) {
	if (!Array.isArray(rows)) return []
	return rows.filter((r) => parseNum(r.costUsd) > 0)
}

/**
 * @param {{ rechargeCny: string, quotaUsd: string, rows: Array<{ inputTokens?: string, outputTokens?: string, costUsd?: string }> }} site
 */
export function computeStationMetrics(site) {
	const rechargeCny = parseNum(site.rechargeCny)
	const quotaUsdRaw = parseNum(site.quotaUsd)
	const quotaUsd = quotaUsdRaw === 0 ? 1 : quotaUsdRaw
	const rate = rechargeCny / quotaUsd

	const effective = getEffectiveRows(site.rows)
	let totalCostUsd = 0
	let totalTokens = 0
	for (const r of effective) {
		const cost = parseNum(r.costUsd)
		const inp = parseIntSafe(r.inputTokens)
		const out = parseIntSafe(r.outputTokens)
		totalCostUsd += cost
		totalTokens += inp + out
	}

	const totalCny = totalCostUsd * rate
	const per1kCny = totalTokens > 0 ? (totalCny / totalTokens) * 1000 : 0

	return {
		rechargeCny,
		quotaUsd: quotaUsdRaw,
		quotaUsdDivisor: quotaUsd,
		rate,
		recordCount: effective.length,
		totalCostUsd,
		totalTokens,
		totalCny,
		per1kCny
	}
}

const EPS = 1e-9

/**
 * @param {ReturnType<typeof computeStationMetrics>} a
 * @param {ReturnType<typeof computeStationMetrics>} b
 */
export function compareStations(a, b) {
	const hasA = a.recordCount > 0
	const hasB = b.recordCount > 0

	if (!hasA && !hasB) {
		return {
			state: 'empty',
			heroTitle: '请添加使用记录',
			savingsPercentStr: '—',
			savingsSub: '两站均填写充值与消耗额度后再对比',
			savingsTagline: '两站均填写充值与消耗额度后再对比',
			totalSavingCny: 0,
			winner: null,
			pctDiff: 0
		}
	}

	if (!hasA || !hasB) {
		return {
			state: 'partial',
			heroTitle: hasA ? '请完善站点 B 数据' : '请完善站点 A 数据',
			savingsPercentStr: '—',
			savingsSub: '两站都需要有消耗记录才能对比',
			savingsTagline: '两站都需要有消耗记录才能对比',
			totalSavingCny: 0,
			winner: null,
			pctDiff: 0
		}
	}

	if (Math.abs(a.per1kCny - b.per1kCny) < EPS) {
		return {
			state: 'tie',
			heroTitle: '两站成本相同',
			savingsPercentStr: '0%',
			savingsSub: '每 1K Tokens 人民币均价一致',
			savingsTagline: '每 1K Tokens 人民币均价一致',
			totalSavingCny: 0,
			winner: null,
			pctDiff: 0
		}
	}

	if (a.per1kCny < b.per1kCny) {
		const pct = b.per1kCny > EPS ? ((b.per1kCny - a.per1kCny) / b.per1kCny) * 100 : 0
		const savingPer1k = b.per1kCny - a.per1kCny
		const totalSavingCny = (savingPer1k / 1000) * b.totalTokens
		return {
			state: 'a_win',
			heroTitle: '站点 A 更具性价比',
			savingsPercentStr: `${pct.toFixed(1)}%`,
			savingsSub: `相比站点 B，每 1K Tokens 便宜；若 B 站 ${formatTokens(b.totalTokens)} Tokens 改用 A 站约可省`,
			savingsTagline: '相比站点 B 节省费用',
			totalSavingCny,
			winner: 'A',
			pctDiff: pct
		}
	}

	const pct = a.per1kCny > EPS ? ((a.per1kCny - b.per1kCny) / a.per1kCny) * 100 : 0
	const savingPer1k = a.per1kCny - b.per1kCny
	const totalSavingCny = (savingPer1k / 1000) * a.totalTokens
	return {
		state: 'b_win',
		heroTitle: '站点 B 更具性价比',
		savingsPercentStr: `${pct.toFixed(1)}%`,
		savingsSub: `相比站点 A，每 1K Tokens 便宜；若 A 站 ${formatTokens(a.totalTokens)} Tokens 改用 B 站约可省`,
		savingsTagline: '相比站点 A 节省费用',
		totalSavingCny,
		winner: 'B',
		pctDiff: pct
	}
}

export function formatTokens(n) {
	if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
	if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
	return `${n}`
}

export function formatCny(n, decimals = 2) {
	return `¥${n.toFixed(decimals)}`
}

export function formatCnyPlain(n, decimals = 4) {
	return `¥${n.toFixed(decimals)}`
}

export function formatUsd(n, decimals = 4) {
	return `$${n.toFixed(decimals)}`
}

export function formatRate(rate) {
	return rate.toFixed(2)
}

/**
 * 生成报告页所需数据结构（由首页写入 storage 后报告页读取）
 */
export function buildReportPayload(metricsA, metricsB, cmp) {
	const maxPer1k = Math.max(metricsA.per1kCny, metricsB.per1kCny, 1e-12)

	const unitRows = [
		{
			name: '站点 A',
			price: formatCnyPlain(metricsA.per1kCny),
			fillPercent: Math.min(100, Math.round((metricsA.per1kCny / maxPer1k) * 1000) / 10),
			variant: metricsA.per1kCny <= metricsB.per1kCny ? 'low' : 'high'
		},
		{
			name: '站点 B',
			price: formatCnyPlain(metricsB.per1kCny),
			fillPercent: Math.min(100, Math.round((metricsB.per1kCny / maxPer1k) * 1000) / 10),
			variant: metricsB.per1kCny <= metricsA.per1kCny ? 'low' : 'high'
		}
	]

	const totalCnyBoth = metricsA.totalCny + metricsB.totalCny
	const tokensBoth = metricsA.totalTokens + metricsB.totalTokens

	const sampleCount = metricsA.recordCount + metricsB.recordCount
	const sampleFilled =
		sampleCount >= 20 ? 5 : sampleCount >= 10 ? 4 : sampleCount >= 6 ? 3 : sampleCount >= 2 ? 2 : 1

	const tokenCoverageFilled =
		tokensBoth >= 200000 ? 5 : tokensBoth >= 50000 ? 4 : tokensBoth >= 10000 ? 3 : tokensBoth >= 2000 ? 2 : 1

	const maxRecordCount = Math.max(metricsA.recordCount, metricsB.recordCount, 1)
	const balanceRatio = Math.min(metricsA.recordCount, metricsB.recordCount) / maxRecordCount
	const balanceFilled =
		balanceRatio >= 0.9 ? 5 : balanceRatio >= 0.7 ? 4 : balanceRatio >= 0.5 ? 3 : balanceRatio >= 0.3 ? 2 : 1

	const costDiffFilled = (() => {
		if (cmp.state === 'empty' || cmp.state === 'partial') return 1
		const p = Math.abs(cmp.pctDiff || 0)
		if (p >= 20) return 5
		if (p >= 10) return 4
		if (p >= 5) return 3
		if (p >= 2) return 2
		return 1
	})()

	const heroSavingsPercent =
		cmp.state === 'empty' || cmp.state === 'partial' ? '—' : cmp.state === 'tie' ? '0%' : cmp.savingsPercentStr

	const heroSavingHint =
		cmp.state === 'a_win' || cmp.state === 'b_win'
			? `等价约省 ${formatCny(cmp.totalSavingCny, 2)}（按较贵站 Token 量换算）`
			: ''

	return {
		navTitle: '性价比报告',
		hero: {
			tag: '最佳性价比推荐',
			title: cmp.heroTitle,
			savingsPercent: heroSavingsPercent,
			savingsSub: cmp.savingsTagline || cmp.savingsSub,
			savingHint: heroSavingHint
		},
		statCards: [
			{ label: 'A站 每1K Tokens (¥)', value: formatCnyPlain(metricsA.per1kCny) },
			{ label: 'B站 每1K Tokens (¥)', value: formatCnyPlain(metricsB.per1kCny) }
		],
		unitPrice: {
			sectionTitle: '单价对比 (每 1K Tokens)',
			rows: unitRows
		},
		recharge: {
			title: '充值与消耗汇总',
			ratioLabel: '充值比例 (CNY/$)',
			ratioValue: `A ${formatRate(metricsA.rate)} · B ${formatRate(metricsB.rate)}`,
			ratioUnit: '按各站充值换算',
			monthLabel: '两站实际花费合计',
			monthValue: formatCny(totalCnyBoth, 2),
			monthSub: 'Σ(消耗$ × 各站比例)',
			tokensLabel: '总 Tokens 消耗',
			tokensSub: 'A 站与 B 站有效记录合计',
			tokensValue: `${formatTokens(metricsA.totalTokens)} / ${formatTokens(metricsB.totalTokens)}`
		},
		ratings: {
			title: '数据可信度评分',
			items: [
				{
					label: '样本量',
					score: `${sampleFilled}.0`,
					filled: sampleFilled,
					explain: `样本量 = A(${metricsA.recordCount}) + B(${metricsB.recordCount}) 条有效记录`
				},
				{
					label: '覆盖量',
					score: `${tokenCoverageFilled}.0`,
					filled: tokenCoverageFilled,
					explain: `覆盖量 = A(${formatTokens(metricsA.totalTokens)}) + B(${formatTokens(metricsB.totalTokens)}) Tokens`
				},
				{
					label: '均衡度',
					score: `${balanceFilled}.0`,
					filled: balanceFilled,
					explain: `均衡度 = min(${metricsA.recordCount}, ${metricsB.recordCount}) / max(${metricsA.recordCount}, ${metricsB.recordCount})`
				},
				{
					label: '差异度',
					score: `${costDiffFilled}.0`,
					filled: costDiffFilled,
					explain: `差异度 = 两站每1K成本差异 ${Math.abs(cmp.pctDiff || 0).toFixed(1)}%`
				}
			]
		}
	}
}

export const REPORT_STORAGE_KEY = 'API_CALC_REPORT_SNAPSHOT'
