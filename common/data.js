/** 计算页 A/B 站点对比草稿（本地 + 云端同步用） */
export const COMPARE_DRAFT_STORAGE_KEY = 'calc_compare_draft'

/** 个人中心：微信「选择头像」返回的本地临时路径（仅微信小程序） */
export const MINE_WX_AVATAR_STORAGE_KEY = 'calc_wx_avatar_path'

/** 个人中心：展示昵称（与微信 nickname 输入框写入同一键） */
export const MINE_DISPLAY_NICKNAME_STORAGE_KEY = 'calc_display_nickname'

/** 云数据库集合名：用户生成的性价比报告历史（需在 uniCloud 控制台建表或上传 schema） */
export const CLOUD_REPORT_RECORDS_COLLECTION = 'calc_report_records'

/** 报告历史条数上限（与云函数、本地缓存一致） */
export const REPORT_HISTORY_MAX_ITEMS = 30

/** uniCloud.callFunction 客户端超时（毫秒），减轻云函数未部署/网络异常时的长时间挂起 */
export const CLOUD_CALL_TIMEOUT_MS = 20000

/** 从记录页「恢复对比」写入，计算页 onShow 读取后应用并清除 */
export const PENDING_RESTORE_SITES_KEY = 'calc_pending_restore_sites'

/** 计算页首次引导仅展示一次 */
export const FIRST_CALC_GUIDE_SHOWN_KEY = 'calc_first_guide_shown'

/** 计算页：用量越多结论越准确的说明（展示在生成报告按钮上方） */
export const COMPARE_USAGE_ACCURACY_HINT =
	'使用记录越多、填写越完整，对比与报告通常越准确。请至少在各站点添加一条「消耗额度($)」大于 0 的用量。'

/** 生成报告前校验未通过时的说明（与 getEffectiveRows 规则一致：消耗额度须 > 0） */
export const reportValidateMessages = {
	both: '请先在站点 A 与站点 B 的「使用记录」中，各至少填写一行，并将「消耗额度($)」填写为大于 0，再生成对比报告。',
	siteA: '站点 A 暂无有效使用记录：请至少添加一行，并将「消耗额度($)」填写为大于 0。',
	siteB: '站点 B 暂无有效使用记录：请至少添加一行，并将「消耗额度($)」填写为大于 0。'
}

export function initialSiteA() {
	return {
		rechargeCny: '',
		quotaUsd: '',
		rows: [{ inputTokens: '', outputTokens: '', costUsd: '' }]
	}
}

export function initialSiteB() {
	return {
		rechargeCny: '',
		quotaUsd: '',
		rows: [{ inputTokens: '', outputTokens: '', costUsd: '' }]
	}
}

/** 性价比报告页：无快照时的占位结构（无示例数值） */
export const reportPageData = {
	hero: {
		tag: '性价比报告',
		title: '请从计算页生成对比报告',
		savingsPercent: '—',
		savingsSub: '填写双站数据并生成报告后将展示结论',
		savingHint: ''
	},
	statCards: [
		{ label: '平均成本 / 1K', value: '—' },
		{ label: '平均吞吐量', value: '—' }
	],
	unitPrice: {
		sectionTitle: '单价对比 (每 1K Tokens)',
		rows: [
			{ name: '站点 A', price: '—', fillPercent: 0, variant: 'high' },
			{ name: '站点 B', price: '—', fillPercent: 0, variant: 'low' }
		]
	},
	recharge: {
		title: '充值与消耗汇总',
		ratioLabel: '充值比例',
		ratioValue: '—',
		ratioUnit: 'CNY / $',
		monthLabel: '月度总额',
		monthValue: '—',
		monthSub: '合计支出',
		tokensLabel: '总 Tokens 消耗',
		tokensSub: '—',
		tokensValue: '—'
	},
	ratings: {
		title: '数据可信度评分',
		items: [
			{ label: '样本量', score: '—', filled: 0, explain: '样本量=两站有效记录条数总和' },
			{ label: '覆盖量', score: '—', filled: 0, explain: '覆盖量=两站总 Tokens 消耗' },
			{ label: '均衡度', score: '—', filled: 0, explain: '均衡度=min(A条数,B条数)/max(A条数,B条数)' },
			{ label: '差异度', score: '—', filled: 0, explain: '差异度=两站每1K成本差异百分比' }
		]
	},
	navTitle: '性价比报告'
}

/** 个人中心：未设置昵称/无统计时的占位（无示例业务数据） */
export const minePageDefaults = {
	nickname: '用户',
	levelBadge: 'MEMBER',
	historyTrendTag: ''
}

export const mineStatLabels = {
	history: '计算历史',
	favorites: '收藏案例',
	favoritesSub: '',
	saved: '已省金额',
	savedSub: ''
}

export const mineMenuGroups = [
	{
		items: [
			{ key: 'records', label: '我的记录', icon: 'loop' },
			{ key: 'reports', label: '计算报告', icon: 'bars' },
			{ key: 'testCases', label: '测试案例', icon: 'list' },
			{ key: 'guide', label: '算法指南', icon: 'compose' }
		]
	},
	{
		items: [
			{ key: 'feedback', label: '意见反馈', icon: 'chatbubble' },
			{ key: 'envCheck', label: '环境自检', icon: 'gear' },
			{ key: 'about', label: '关于我们', icon: 'info' }
		]
	}
]
