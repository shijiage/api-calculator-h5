<template>
	<view class="tab-bar" :style="{ paddingBottom: safeBottom + 'px' }">
		<view
			v-for="item in tabs"
			:key="item.key"
			class="tab-bar__item"
			:class="{ 'tab-bar__item--active': current === item.key }"
			@click="switchTab(item.path)"
		>
			<view class="tab-bar__icon-wrap">
				<uni-icons :type="item.icon" size="52rpx" :color="current === item.key ? '#1a4a9e' : '#9aa0ab'" />
				<view v-if="item.key === 'calc' && current === item.key && showCalcPlus" class="tab-bar__plus">
					<uni-icons type="plusempty" size="22rpx" color="#1a4a9e" />
				</view>
			</view>
			<text class="tab-bar__label" :class="{ 'tab-bar__label--active': current === item.key }">{{ item.label }}</text>
		</view>
	</view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getStoredOpenid, ensureLoggedInOrPrompt } from '@/common/auth.js'

defineProps({
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

const tabs = [
	{ key: 'calc', label: '计算', path: 'pages/index/index', icon: 'list' },
	{ key: 'testCases', label: '案例', path: 'pages/test-cases/test-cases', icon: 'compose' },
	{ key: 'records', label: '记录', path: 'pages/records/records', icon: 'bars' },
	{ key: 'mine', label: '我的', path: 'pages/mine/mine', icon: 'person' }
]

onMounted(() => {
	const sys = uni.getSystemInfoSync()
	const bottom = sys.safeAreaInsets?.bottom ?? 0
	safeBottom.value = bottom > 0 ? bottom : 12
})

async function switchTab(url) {
	const pages = getCurrentPages()
	const cur = pages[pages.length - 1]?.route || ''
	if (cur === url) return
	if (url === 'pages/mine/mine' && !getStoredOpenid()) {
		const ok = await ensureLoggedInOrPrompt({
			content: '使用个人中心请先完成微信登录。',
			returnUrl: '/' + url
		})
		if (!ok) return
	}
	if (url === 'pages/index/index' && !getStoredOpenid()) {
		const ok = await ensureLoggedInOrPrompt({
			content: '进入计算对比页并使用相关功能前，请先完成微信登录。',
			returnUrl: '/' + url
		})
		if (!ok) return
	}
	uni.redirectTo({ url: '/' + url })
}
</script>

<style scoped lang="scss">
.tab-bar {
	position: fixed;
	left: 0;
	right: 0;
	bottom: 0;
	background: #ffffff;
	border-top: 1rpx solid #eef0f4;
	box-shadow: 0 -4rpx 24rpx rgba(0, 0, 0, 0.06);
	border-radius: 24rpx 24rpx 0 0;
	display: flex;
	flex-direction: row;
	align-items: flex-end;
	justify-content: space-around;
	padding-top: 12rpx;
	padding-left: 24rpx;
	padding-right: 24rpx;
	min-height: 112rpx;
	box-sizing: border-box;
	z-index: 100;
}

.tab-bar__item {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: flex-end;
	padding-bottom: 8rpx;
}

.tab-bar__item--active {
	background: #e8f1ff;
	border-radius: 20rpx;
	margin: 0 8rpx;
	padding-top: 12rpx;
}

.tab-bar__icon-wrap {
	position: relative;
	display: flex;
	align-items: center;
	justify-content: center;
	height: 48rpx;
	width: 48rpx;
}

.tab-bar__plus {
	position: absolute;
	right: -4rpx;
	top: -2rpx;
}

.tab-bar__label {
	margin-top: 6rpx;
	font-size: 22rpx;
	color: #9aa0ab;
}

.tab-bar__label--active {
	color: #1a4a9e;
	font-weight: 600;
}
</style>
