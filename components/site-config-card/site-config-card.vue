<template>
	<view class="site-card">
		<view class="site-card__head">
			<view class="site-card__indicator" />
			<text class="site-card__title">站点 {{ siteLabel }} 配置</text>
			<view class="site-card__clear" hover-class="site-card__clear--hover" @click="onClear">
				<uni-icons type="closeempty" size="24rpx" color="#1a4a9e" />
				<text class="site-card__clear-text">清空</text>
			</view>
		</view>

		<view class="site-card__body">
			<view class="site-card__row2">
				<view class="site-card__field">
					<text class="site-card__label">充值金额 (CNY)</text>
					<input
						class="site-card__input"
						type="digit"
						placeholder="0.00"
						:value="site.rechargeCny"
						@input="onField('rechargeCny', $event)"
					/>
				</view>
				<view class="site-card__field">
					<text class="site-card__label">获得额度 ($)</text>
					<input
						class="site-card__input"
						type="digit"
						placeholder="0.00"
						:value="site.quotaUsd"
						@input="onField('quotaUsd', $event)"
					/>
				</view>
			</view>

			<view class="site-card__usage-head">
				<uni-icons type="wallet" size="36rpx" color="#1a4a9e" />
				<text class="site-card__usage-title">使用记录</text>
				<view class="site-card__grow" />
				<text v-if="addStyle === 'link'" class="site-card__add-link" @click="addRow">+ 添加记录</text>
				<view v-else class="site-card__add-icon" @click="addRow">
					<uni-icons type="plusempty" size="40rpx" color="#1a4a9e" />
				</view>
			</view>

			<view class="site-card__table-head">
				<text class="site-card__th">输入 Tokens</text>
				<text class="site-card__th">输出 Tokens</text>
				<text class="site-card__th">消耗额度 ($)</text>
				<text class="site-card__th site-card__th--op">操作</text>
			</view>

			<view v-for="(row, index) in site.rows" :key="index" class="site-card__table-row">
				<input
					class="site-card__cell"
					type="number"
					placeholder="0"
					:value="row.inputTokens"
					@input="onRow(index, 'inputTokens', $event)"
				/>
				<input
					class="site-card__cell"
					type="number"
					placeholder="0"
					:value="row.outputTokens"
					@input="onRow(index, 'outputTokens', $event)"
				/>
				<input
					class="site-card__cell"
					type="digit"
					placeholder="0.00"
					:value="row.costUsd"
					@input="onRow(index, 'costUsd', $event)"
				/>
				<view class="site-card__del" @click="removeRow(index)">
					<uni-icons type="trash" size="26rpx" color="#8f97a6" />
				</view>
			</view>

			<view class="site-card__summary">
				<view class="site-card__summary-col">
					<text class="site-card__summary-label">总 TOKENS 消耗</text>
					<text class="site-card__summary-num">{{ formatInt(metrics.totalTokens) }}</text>
				</view>
				<view class="site-card__summary-col site-card__summary-col--right">
					<text class="site-card__summary-label">实际人民币花费</text>
					<text class="site-card__summary-num site-card__summary-num--cny">{{ formatCny(metrics.totalCny) }}</text>
				</view>
			</view>
			<view class="site-card__metrics">
				<text class="site-card__metrics-text">
					充值比例 {{ formatRate(metrics.rate) }} CNY/$ · 已消耗 {{ formatUsd(metrics.totalCostUsd) }} · 每1K
					{{ formatCnyPlain(metrics.per1kCny) }}
				</text>
			</view>
		</view>
	</view>
</template>

<script setup>
import { computed } from 'vue'
import {
	computeStationMetrics,
	formatCny,
	formatCnyPlain,
	formatUsd,
	formatRate
} from '@/common/calculator.js'

const props = defineProps({
	siteLabel: {
		type: String,
		required: true
	},
	addStyle: {
		type: String,
		default: 'link'
	},
	site: {
		type: Object,
		required: true
	}
})

const emit = defineEmits(['update:site', 'clear'])

const metrics = computed(() => computeStationMetrics(props.site))

function formatInt(n) {
	return n.toLocaleString('en-US')
}

function patchSite(partial) {
	emit('update:site', { ...props.site, ...partial })
}

function onField(key, e) {
	patchSite({ [key]: e.detail.value })
}

function onRow(index, key, e) {
	const rows = props.site.rows.map((r, i) =>
		i === index ? { ...r, [key]: e.detail.value } : r
	)
	patchSite({ rows })
}

function addRow() {
	patchSite({
		rows: [...props.site.rows, { inputTokens: '', outputTokens: '', costUsd: '' }]
	})
}

function onClear() {
	emit('clear')
}

function removeRow(index) {
	const list = Array.isArray(props.site.rows) ? props.site.rows.slice() : []
	if (list.length <= 1) {
		patchSite({ rows: [{ inputTokens: '', outputTokens: '', costUsd: '' }] })
		return
	}
	list.splice(index, 1)
	patchSite({ rows: list })
}
</script>

<style scoped lang="scss">
.site-card {
	background: #ffffff;
	border-radius: 24rpx;
	box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.05);
	padding: 28rpx 28rpx 32rpx;
	margin-bottom: 0;
}

.site-card__head {
	display: flex;
	flex-direction: row;
	align-items: center;
	margin-bottom: 28rpx;
}

.site-card__indicator {
	width: 8rpx;
	height: 36rpx;
	background: #1a4a9e;
	border-radius: 4rpx;
	margin-right: 16rpx;
	flex-shrink: 0;
}

.site-card__title {
	flex: 1;
	font-size: 32rpx;
	font-weight: 700;
	color: #1a1d24;
}

.site-card__clear {
	display: flex;
	flex-direction: row;
	align-items: center;
	padding: 4rpx 0;
}

.site-card__clear--hover {
	opacity: 0.85;
}

.site-card__clear-text {
	margin-left: 6rpx;
	font-size: 26rpx;
	color: #1a4a9e;
	font-weight: 600;
}

.site-card__body {
	display: flex;
	flex-direction: column;
}

.site-card__row2 {
	display: flex;
	flex-direction: row;
	margin-bottom: 32rpx;
}

.site-card__field {
	flex: 1;
	display: flex;
	flex-direction: column;
	min-width: 0;
}

.site-card__field:first-child {
	margin-right: 20rpx;
}

.site-card__label {
	font-size: 24rpx;
	color: #8a8f99;
	margin-bottom: 12rpx;
}

.site-card__input {
	height: 72rpx;
	background: #ebedf0;
	border-radius: 16rpx;
	padding: 0 20rpx;
	font-size: 28rpx;
	color: #1a1d24;
	box-sizing: border-box;
	min-width: 0;
}

.site-card__usage-head {
	display: flex;
	flex-direction: row;
	align-items: center;
	margin-bottom: 16rpx;
}

.site-card__usage-title {
	margin-left: 10rpx;
	font-size: 28rpx;
	font-weight: 600;
	color: #1a1d24;
}

.site-card__grow {
	flex: 1;
}

.site-card__add-link {
	font-size: 26rpx;
	font-weight: 600;
	color: #1a4a9e;
}

.site-card__add-icon {
	width: 56rpx;
	height: 56rpx;
	border-radius: 12rpx;
	background: #e8f1ff;
	display: flex;
	align-items: center;
	justify-content: center;
}

.site-card__table-head {
	display: flex;
	flex-direction: row;
	margin-bottom: 12rpx;
	padding: 0 4rpx;
}

.site-card__th {
	flex: 1;
	font-size: 22rpx;
	color: #a0a5b0;
	text-align: center;
}

.site-card__th--op {
	flex: 0 0 60rpx;
}

.site-card__table-row {
	display: flex;
	flex-direction: row;
	margin-bottom: 12rpx;
}

.site-card__table-row .site-card__cell:not(:last-child) {
	margin-right: 12rpx;
}

.site-card__cell {
	flex: 1;
	height: 64rpx;
	background: #ebedf0;
	border-radius: 12rpx;
	padding: 0 12rpx;
	font-size: 24rpx;
	color: #1a1d24;
	text-align: center;
	box-sizing: border-box;
	min-width: 0;
}

.site-card__del {
	flex: 0 0 60rpx;
	height: 64rpx;
	margin-left: 8rpx;
	border-radius: 12rpx;
	background: #f2f4f8;
	display: flex;
	align-items: center;
	justify-content: center;
}

.site-card__summary {
	margin-top: 16rpx;
	background: #e8f1ff;
	border-left: solid 8rpx #1a4a9e;
	border-radius: 12rpx;
	padding: 24rpx 28rpx;
	display: flex;
	flex-direction: row;
}

.site-card__summary-col {
	flex: 1;
	display: flex;
	flex-direction: column;
}

.site-card__summary-col--right {
	align-items: flex-end;
}

.site-card__summary-label {
	font-size: 22rpx;
	color: #5c6b8a;
	margin-bottom: 8rpx;
}

.site-card__summary-num {
	font-size: 44rpx;
	font-weight: 700;
	color: #1a4a9e;
	line-height: 1.2;
}

.site-card__summary-num--cny {
	font-size: 38rpx;
}

.site-card__metrics {
	margin-top: 16rpx;
	padding: 16rpx 20rpx;
	background: #f3f5f9;
	border-radius: 12rpx;
}

.site-card__metrics-text {
	font-size: 22rpx;
	color: #6b7288;
	line-height: 1.5;
}
</style>
