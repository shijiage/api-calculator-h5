<template>
	<view class="tab-bar" :style="{ paddingBottom: safeBottom + 'px' }">
		<view
			v-for="item in tabs"
			:key="item.key"
			class="tab-bar__item"
			:class="{ 'tab-bar__item--active': currentKey === item.key }"
			@click="switchTab(item)"
		>
			<view class="tab-bar__icon-wrap">
				<uni-icons :type="item.icon" size="50rpx" :color="currentKey === item.key ? ACTIVE_COLOR : INACTIVE_COLOR" />
				<view v-if="item.key === 'calc' && currentKey === item.key && showCalcPlus" class="tab-bar__plus">
					<uni-icons type="plusempty" size="22rpx" :color="ACTIVE_COLOR" />
				</view>
			</view>
			<text class="tab-bar__label" :class="{ 'tab-bar__label--active': currentKey === item.key }">{{ item.label }}</text>
		</view>
	</view>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'
import { getStoredOpenid, ensureLoggedInOrPrompt } from '@/common/auth.js'

const ACTIVE_COLOR = '#1a4a9e'
const INACTIVE_COLOR = '#9aa0ab'
const MINE_LOGIN_PROMPT = '\u4f7f\u7528\u4e2a\u4eba\u4e2d\u5fc3\u8bf7\u5148\u5b8c\u6210\u5fae\u4fe1\u767b\u5f55\u3002'

const props = defineProps({
	current: {
		type: String,
		required: true
	},
	showCalcPlus: {
		type: Boolean,
		default: true
	}
})

const safeBottom = ref(0)

const currentKey = computed(() => {
	if (props.current === 'discover') return 'community'
	if (props.current === 'testCases') return 'recommend'
	return props.current
})

const tabs = [
	{ key: 'calc', label: '\u8ba1\u7b97', path: 'pages/index/index', icon: 'home-filled' },
	{ key: 'recommend', label: '\u53d1\u73b0', path: 'pages/recommend/recommend', icon: 'star-filled' },
	{ key: 'community', label: '\u793e\u533a', path: 'pages/discover/discover', icon: 'chatboxes-filled' },
	{ key: 'records', label: '\u8bb0\u5f55', path: 'pages/records/records', icon: 'bars' },
	{ key: 'mine', label: '\u6211\u7684', path: 'pages/mine/mine', icon: 'person-filled' }
]

onMounted(() => {
	const sys = uni.getSystemInfoSync()
	const bottom = sys.safeAreaInsets?.bottom ?? 0
	safeBottom.value = bottom > 0 ? bottom : 12
})

async function switchTab(item) {
	const pages = getCurrentPages()
	const currentRoute = pages[pages.length - 1]?.route || ''
	if (currentRoute === item.path) return

	if (item.key === 'mine' && !getStoredOpenid()) {
		const ok = await ensureLoggedInOrPrompt({
			content: MINE_LOGIN_PROMPT,
			returnUrl: '/' + item.path
		})
		if (!ok) return
	}

	uni.redirectTo({ url: '/' + item.path })
}
</script>

<style scoped lang="scss">
.tab-bar {
	position: fixed;
	left: 0;
	right: 0;
	bottom: 0;
	display: flex;
	align-items: flex-end;
	justify-content: space-around;
	padding: 14rpx 24rpx 0;
	min-height: 112rpx;
	box-sizing: border-box;
	background: #ffffff;
	border-top: 1rpx solid #eef0f4;
	border-radius: 24rpx 24rpx 0 0;
	box-shadow: 0 -4rpx 24rpx rgba(0, 0, 0, 0.06);
	z-index: 100;
}

.tab-bar__item {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: flex-end;
	padding: 12rpx 4rpx 10rpx;
	box-sizing: border-box;
}

.tab-bar__item--active {
	margin: 0 6rpx;
	background: #e8f1ff;
	border-radius: 20rpx;
}

.tab-bar__icon-wrap {
	position: relative;
	display: flex;
	align-items: center;
	justify-content: center;
	width: 52rpx;
	height: 52rpx;
}

.tab-bar__plus {
	position: absolute;
	right: -4rpx;
	top: -2rpx;
}

.tab-bar__label {
	margin-top: 6rpx;
	font-size: 20rpx;
	line-height: 1.2;
	color: #9aa0ab;
}

.tab-bar__label--active {
	color: #1a4a9e;
	font-weight: 600;
}
</style>
