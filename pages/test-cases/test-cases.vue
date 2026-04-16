<template>
	<view class="page">
		<view class="status-bar" :style="{ height: statusBarH + 'px' }" />

		<scroll-view class="scroll" scroll-y :show-scrollbar="false">
			<view class="hero-shell">
				<view class="hero-card">
					<text class="hero-card__title">测试案例库</text>
					<text class="hero-card__desc">按复杂度快速挑选并复制，覆盖 30 个标准案例。</text>
					<view class="hero-card__meta">
						<text class="hero-card__meta-item">效率优先</text>
						<text class="hero-card__meta-dot">·</text>
						<text class="hero-card__meta-item">即选即用</text>
					</view>
				</view>
			</view>

			<view class="content">
				<view class="switch-row">
					<view
						v-for="chip in categoryChips"
						:key="chip.key"
						class="chip"
						:class="{ 'chip--active': activeCategory === chip.key }"
						@click="activeCategory = chip.key"
					>
						{{ chip.label }}
					</view>
				</view>

				<view v-if="!filteredSections.length" class="empty-state">
					<text class="empty-state__title">还没有收藏案例</text>
					<text class="empty-state__desc">点击卡片右上角星标，把常用案例收进这里。</text>
				</view>

				<view v-for="section in filteredSections" :key="section.key" class="section">
					<view class="section__head">
						<view class="section__title-wrap">
							<view class="section__line" />
							<text class="section__title">{{ section.title }}</text>
						</view>
						<text class="section__hint">{{ section.hint }}</text>
					</view>
					<view
						v-for="(item, idx) in section.items"
						:key="item.title"
						class="case-card"
						hover-class="case-card--hover"
					>
						<view class="case-card__top">
							<view class="case-card__title-wrap">
								<text class="case-card__title">{{ item.title }}</text>
								<view class="case-card__tags">
									<text class="case-card__badge">{{ item.badge }}</text>
									<text class="case-card__meta">{{ item.meta }}</text>
								</view>
							</view>
							<view
								class="case-card__fav"
								:class="{ 'case-card__fav--on': isFavorite(section.key, idx) }"
								@click="toggleFavorite(section.key, idx)"
							>
								<uni-icons
									:type="isFavorite(section.key, idx) ? 'star-filled' : 'star'"
									size="24rpx"
									:color="isFavorite(section.key, idx) ? '#ffffff' : '#6b7482'"
								/>
							</view>
						</view>
						<view class="case-card__prompt-wrap">
							<text class="case-card__prompt">{{ item.desc }}</text>
						</view>
						<view class="case-card__foot">
							<text class="case-card__id">ID:{{ buildCaseId(section.key, idx) }}</text>
							<view class="case-card__actions">
								<view class="case-card__link" @click="copyCase(item, section.key, idx)">
									<uni-icons type="paperplane" size="22rpx" color="#1a4a9e" />
									<text class="case-card__link-text">复制案例</text>
								</view>
							</view>
						</view>
					</view>
				</view>
			</view>
			<view class="bottom-pad" />
		</scroll-view>

		<app-tab-bar current="testCases" :show-calc-plus="false" />
	</view>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppTabBar from '@/components/app-tab-bar/app-tab-bar.vue'
import { ensureLoggedInOrPrompt, getStoredOpenid } from '@/common/auth.js'
import { listCaseFavoriteIds, setCaseFavorite } from '@/common/case-favorites.js'

const statusBarH = ref(20)
const activeCategory = ref('all')
const favoriteMap = ref({})

const categoryChips = [
	{ key: 'all', label: '全部' },
	{ key: 'light', label: '轻度' },
	{ key: 'medium', label: '中度' },
	{ key: 'heavy', label: '重度' },
	{ key: 'favorites', label: '仅收藏' }
]

const sections = [
	{
		key: 'light',
		title: '轻度测试',
		hint: '简单指令',
		items: [
			{ title: '摘要生成', badge: '文本任务', desc: '将一段 300 字文本压缩到 120 字内，保留事实与结论。', meta: '50-120 Token' },
			{ title: '多语言翻译', badge: '翻译任务', desc: '把中文通知翻译为英文，并给出更自然的商务语气版本。', meta: '80-160 Token' },
			{ title: '标题润色', badge: '写作任务', desc: '将 5 个普通标题优化为更清晰、可读且不过度营销的表达。', meta: '60-140 Token' },
			{ title: '术语解释', badge: '问答任务', desc: '用通俗语言解释 3 个技术术语，并各给一个生活化示例。', meta: '80-180 Token' },
			{ title: '错别字纠正', badge: '校对任务', desc: '纠正一段公告中的错别字和标点问题，不改变原意。', meta: '40-120 Token' },
			{ title: '短句改写', badge: '改写任务', desc: '将 6 条生硬文案改写为简洁自然的客服回复风格。', meta: '70-150 Token' },
			{ title: '关键词提取', badge: '分析任务', desc: '从一段产品介绍中提取 8 个关键词，并按重要性排序。', meta: '60-130 Token' },
			{ title: '情绪判断', badge: '分类任务', desc: '判断 10 条评论的情绪倾向并给出一句理由。', meta: '90-180 Token' },
			{ title: '日期标准化', badge: '格式任务', desc: '将混乱日期格式统一为“YYYY-MM-DD”并标注异常值。', meta: '50-110 Token' },
			{ title: '会议纪要整理', badge: '整理任务', desc: '从口语化记录中提炼待办项，按负责人和截止时间输出。', meta: '100-200 Token' }
		]
	},
	{
		key: 'medium',
		title: '中度测试',
		hint: '结构化输出',
		items: [
			{ title: '脚本补全', badge: '代码任务', desc: '补全脚本：统计 CSV 每列缺失率、异常值并输出结构化摘要。', meta: '300-800 Token' },
			{ title: '逻辑矛盾分析', badge: '分析任务', desc: '识别一段论证中的 3 处关键逻辑漏洞并给修复建议。', meta: '500-900 Token' },
			{ title: '需求拆解', badge: '规划任务', desc: '把模糊需求拆成可执行任务清单，并定义验收标准。', meta: '400-900 Token' },
			{ title: '接口文档生成', badge: '文档任务', desc: '根据接口样例生成接口说明，包含参数、错误码与示例。', meta: '500-1000 Token' },
			{ title: 'SQL 优化建议', badge: '数据库任务', desc: '分析给定查询语句，提出索引与改写建议并解释原因。', meta: '450-900 Token' },
			{ title: '异常日志归因', badge: '排障任务', desc: '阅读多条日志，归纳问题根因并输出排查优先级。', meta: '500-1000 Token' },
			{ title: '多轮客服回复', badge: '对话任务', desc: '在 4 轮对话内完成安抚、定位问题和给出处理方案。', meta: '400-850 Token' },
			{ title: '对比评测报告', badge: '评测任务', desc: '对两个方案从成本、性能、风险三维进行量化比较。', meta: '500-950 Token' },
			{ title: '代码审查建议', badge: '审查任务', desc: '阅读函数片段，指出潜在缺陷、边界问题和测试缺口。', meta: '450-900 Token' },
			{ title: '规则抽取', badge: '建模任务', desc: '从政策文本中提炼判定规则并输出可执行伪代码。', meta: '500-1000 Token' }
		]
	},
	{
		key: 'heavy',
		title: '重度测试',
		hint: '复杂推理',
		items: [
			{ title: '跨系统排障推理', badge: '复杂任务', desc: '基于订单、支付、库存、消息队列日志构建完整故障链并给止损方案。', meta: '1500+ Token' },
			{ title: '多角色流程设计', badge: '架构任务', desc: '设计含管理员、运营、审核员的审批流，覆盖权限冲突与回滚。', meta: '1600+ Token' },
			{ title: '高并发压测方案', badge: '性能任务', desc: '制定从压测数据采集到瓶颈定位再到优化复测的全流程方案。', meta: '1700+ Token' },
			{ title: '风控策略博弈', badge: '策略任务', desc: '在误杀率和漏判率之间做权衡，输出可上线的分层策略。', meta: '1500+ Token' },
			{ title: '复杂代码重构', badge: '工程任务', desc: '对千行模块进行分层重构，保证行为一致并给迁移计划。', meta: '1800+ Token' },
			{ title: '故障应急预案', badge: '应急任务', desc: '面对核心服务雪崩，给出分钟级处置步骤与恢复验证清单。', meta: '1500+ Token' },
			{ title: '长文档一致性审校', badge: '审校任务', desc: '审校 3 份规范文档的一致性，定位冲突条款并给统一建议。', meta: '1600+ Token' },
			{ title: '多目标排期优化', badge: '决策任务', desc: '在人力有限、需求激增条件下制定 8 周交付排期与风险预案。', meta: '1700+ Token' },
			{ title: '数据质量治理方案', badge: '治理任务', desc: '围绕采集、清洗、口径、监控构建端到端数据质量治理体系。', meta: '1600+ Token' },
			{ title: '系统迁移评估', badge: '迁移任务', desc: '评估旧系统迁移到新架构的成本、收益、风险与回退路径。', meta: '1500+ Token' }
		]
	}
]

const filteredSections = computed(() => {
	if (activeCategory.value === 'all') return sections
	if (activeCategory.value === 'favorites') {
		return sections
			.map((section) => ({
				...section,
				items: section.items.filter((_, idx) => isFavorite(section.key, idx))
			}))
			.filter((section) => section.items.length)
	}
	return sections.filter((section) => section.key === activeCategory.value)
})

onMounted(() => {
	const sys = uni.getSystemInfoSync()
	statusBarH.value = sys.statusBarHeight || 20
})

onShow(async () => {
	if (!getStoredOpenid()) {
		favoriteMap.value = {}
		return
	}
	const ids = await listCaseFavoriteIds()
	const map = {}
	for (const id of ids) map[id] = true
	favoriteMap.value = map
})

function buildPromptText(item) {
	return `【${item.title}】\n任务类型：${item.badge}\n建议规模：${item.meta}\n任务说明：${item.desc}`
}

function buildCaseId(level, idx) {
	const map = { light: 'LW', medium: 'MD', heavy: 'HV' }
	const prefix = map[level] || 'CS'
	const n = String(idx + 1).padStart(3, '0')
	return `${prefix}-${n}`
}

function caseStorageKey(level, idx) {
	return buildCaseId(level, idx)
}

function isFavorite(level, idx) {
	return !!favoriteMap.value[caseStorageKey(level, idx)]
}

async function toggleFavorite(level, idx) {
	if (!(await ensureLoggedInOrPrompt({ content: '收藏案例需要先登录。' }))) return
	const id = caseStorageKey(level, idx)
	const on = !isFavorite(level, idx)
	uni.showLoading({ title: on ? '收藏中' : '取消中', mask: true })
	let ok = false
	let ids = []
	try {
		const res = await setCaseFavorite(id, on)
		ok = !!res.ok
		ids = res.ids || []
	} finally {
		uni.hideLoading()
	}
	if (!ok) {
		uni.showToast({ title: '操作失败，请重试', icon: 'none' })
		return
	}
	const map = {}
	for (const x of ids) map[x] = true
	favoriteMap.value = map
	uni.showToast({ title: on ? '已收藏' : '已取消收藏', icon: 'none' })
}

function copyCase(item, level, idx) {
	const id = buildCaseId(level, idx)
	const text = `${buildPromptText(item)}\n案例编号：${id}`
	uni.setClipboardData({
		data: text,
		success: () => {
			uni.showToast({ title: '复制成功', icon: 'success' })
		},
		fail: () => {
			uni.showToast({ title: '复制失败，请重试', icon: 'none' })
		}
	})
}
</script>

<style scoped lang="scss">
.page {
	min-height: 100vh;
	background: #eef1f6;
}

.status-bar {
	width: 100%;
}

.scroll {
	height: calc(100vh - env(safe-area-inset-bottom));
	padding: 0 18rpx;
	box-sizing: border-box;
}

.hero-shell {
	background: #ffffff;
	border: 4rpx solid #ffffff;
	border-radius: 26rpx;
	padding: 8rpx;
	margin-bottom: 14rpx;
	box-shadow:
		0 0 0 2rpx rgba(255, 255, 255, 0.95),
		0 10rpx 22rpx rgba(18, 28, 45, 0.1);
}

.hero-card {
	background: linear-gradient(135deg, #1246a3 0%, #2f67d9 100%);
	border-radius: 20rpx;
	padding: 18rpx 20rpx 20rpx;
}

.hero-card__title {
	display: block;
	font-size: 44rpx;
	line-height: 1.15;
	font-weight: 700;
	color: #ffffff;
}

.hero-card__desc {
	display: block;
	margin-top: 8rpx;
	font-size: 24rpx;
	line-height: 1.45;
	color: rgba(255, 255, 255, 0.86);
}

.hero-card__meta {
	display: flex;
	align-items: center;
	margin-top: 12rpx;
}

.hero-card__meta-item,
.hero-card__meta-dot {
	font-size: 20rpx;
	color: rgba(255, 255, 255, 0.72);
}

.hero-card__meta-dot {
	margin: 0 8rpx;
}

.content {
	background: #f8f9fc;
	border-radius: 24rpx;
	padding: 18rpx 14rpx 8rpx;
	box-shadow: 0 8rpx 20rpx rgba(20, 31, 58, 0.06);
}

.switch-row {
	display: flex;
	gap: 12rpx;
	margin: 0 0 14rpx;
	overflow-x: auto;
	white-space: nowrap;
}

.chip {
	padding: 14rpx 26rpx;
	border-radius: 999rpx;
	font-size: 24rpx;
	font-weight: 600;
	background: #e5e7ed;
	color: #6f7683;
	border: none;
	flex-shrink: 0;
}

.chip--active {
	background: #1a4a9e;
	color: #ffffff;
	box-shadow: 0 6rpx 14rpx rgba(26, 74, 158, 0.3);
}

.section {
	margin-top: 10rpx;
}

.section__head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 12rpx;
	padding: 6rpx 2rpx;
}

.section__title-wrap {
	display: flex;
	align-items: center;
}

.section__line {
	width: 6rpx;
	height: 28rpx;
	background: #1a4a9e;
	border-radius: 3rpx;
	margin-right: 10rpx;
}

.section__title {
	font-size: 38rpx;
	font-weight: 700;
	color: #1f2433;
}

.section__hint {
	font-size: 22rpx;
	color: #8b92a0;
	font-weight: 600;
}

.case-card {
	background: #ffffff;
	border-radius: 20rpx;
	padding: 18rpx 18rpx 18rpx;
	box-shadow: 0 2rpx 8rpx rgba(18, 28, 45, 0.04);
	margin-bottom: 14rpx;
}

.case-card--hover {
	opacity: 0.92;
}

.case-card__top {
	display: flex;
	justify-content: space-between;
	align-items: flex-start;
}

.case-card__title-wrap {
	flex: 1;
	min-width: 0;
	padding-right: 16rpx;
}

.case-card__title {
	font-size: 34rpx;
	line-height: 1.3;
	font-weight: 700;
	color: #131823;
}

.case-card__tags {
	display: flex;
	flex-wrap: wrap;
	gap: 10rpx;
	margin-top: 10rpx;
}

.case-card__badge,
.case-card__meta {
	font-size: 20rpx;
	font-weight: 600;
	border-radius: 999rpx;
	padding: 6rpx 16rpx;
}

.case-card__badge {
	color: #1a4a9e;
	background: #eaf0fb;
}

.case-card__meta {
	color: #6b7482;
	background: #f1f3f7;
}

.case-card__prompt-wrap {
	margin-top: 14rpx;
	background: #f6f8fb;
	border-radius: 12rpx;
	padding: 14rpx 16rpx;
}

.case-card__prompt {
	font-size: 24rpx;
	line-height: 1.6;
	color: #4d5562;
	display: -webkit-box;
	-webkit-box-orient: vertical;
	-webkit-line-clamp: 2;
	overflow: hidden;
}

.case-card__foot {
	margin-top: 14rpx;
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.case-card__id {
	font-size: 18rpx;
	color: #9da4b0;
	font-weight: 600;
}

.case-card__actions {
	display: flex;
	align-items: center;
}

.case-card__fav {
	display: flex;
	justify-content: center;
	align-items: center;
	width: 64rpx;
	height: 64rpx;
	background: #f5f7fb;
	border-radius: 16rpx;
	flex-shrink: 0;
}

.case-card__fav--on {
	background: #1a4a9e;
}

.case-card__link {
	display: flex;
	align-items: center;
	justify-content: center;
	background: #eaf0fb;
	padding: 0 22rpx;
	height: 64rpx;
	border-radius: 16rpx;
}

.case-card__link-text {
	font-size: 24rpx;
	font-weight: 600;
	color: #1a4a9e;
	margin-left: 6rpx;
}

.empty-state {
	background: #ffffff;
	border-radius: 20rpx;
	padding: 36rpx 28rpx;
	text-align: center;
	box-shadow: 0 2rpx 8rpx rgba(18, 28, 45, 0.04);
	margin-top: 14rpx;
}

.empty-state__title {
	display: block;
	font-size: 30rpx;
	font-weight: 700;
	color: #1f2433;
}

.empty-state__desc {
	display: block;
	margin-top: 10rpx;
	font-size: 22rpx;
	line-height: 1.6;
	color: #7a8290;
}

.bottom-pad {
	height: calc(170rpx + env(safe-area-inset-bottom));
}
</style>
