<template>
	<view class="card">
		<text class="card__title">{{ data.title }}</text>
		<view class="card__top">
			<view class="card__half">
				<text class="card__label">{{ data.ratioLabel }}</text>
				<text class="card__strong">{{ data.ratioValue }}</text>
				<text class="card__unit">{{ data.ratioUnit }}</text>
			</view>
			<view class="card__divider" />
			<view class="card__half card__half--right">
				<text class="card__label">{{ data.monthLabel }}</text>
				<text class="card__strong">{{ data.monthValue }}</text>
				<text class="card__sub">{{ data.monthSub }}</text>
			</view>
		</view>
		<view class="card__tokens">
			<view class="card__moon" aria-hidden="true">
				<text class="card__moon-char">☽</text>
			</view>
			<view class="card__tokens-mid">
				<text class="card__tokens-title">{{ data.tokensLabel }}</text>
				<text class="card__tokens-sub">{{ data.tokensSub }}</text>
			</view>
			<text class="card__tokens-val">{{ data.tokensValue }}</text>
		</view>
	</view>
</template>

<script setup>
defineProps({
	data: {
		type: Object,
		required: true
	}
})
</script>

<style scoped lang="scss">
.card {
	margin-top: 24rpx;
	background: #ffffff;
	border-radius: 24rpx;
	padding: 28rpx 24rpx 24rpx;
	box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.05);
}

.card__title {
	display: block;
	font-size: 32rpx;
	font-weight: 700;
	color: #1a1d24;
	margin-bottom: 28rpx;
}

.card__top {
	display: flex;
	flex-direction: row;
	align-items: stretch;
	margin-bottom: 24rpx;
}

.card__half {
	flex: 1;
	display: flex;
	flex-direction: column;
	min-width: 0;
}

.card__half--right {
	align-items: flex-end;
	text-align: right;
}

.card__divider {
	width: 1rpx;
	background: #e2e5eb;
	margin: 0 20rpx;
	flex-shrink: 0;
}

.card__label {
	font-size: 24rpx;
	color: #8a8f99;
	margin-bottom: 8rpx;
}

.card__strong {
	font-size: 34rpx;
	font-weight: 700;
	color: #1a1d24;
	line-height: 1.2;
}

.card__unit {
	margin-top: 6rpx;
	font-size: 22rpx;
	color: #a0a5b0;
}

.card__sub {
	margin-top: 6rpx;
	font-size: 22rpx;
	color: #a0a5b0;
}

.card__tokens {
	display: flex;
	flex-direction: row;
	align-items: center;
	background: #e8f1ff;
	border-radius: 20rpx;
	padding: 24rpx 24rpx;
}

.card__moon {
	width: 72rpx;
	height: 72rpx;
	border-radius: 50%;
	background: #1a4a9e;
	flex-shrink: 0;
	display: flex;
	align-items: center;
	justify-content: center;
}

.card__moon-char {
	font-size: 36rpx;
	color: #ffffff;
	line-height: 1;
}

.card__tokens-mid {
	flex: 1;
	margin-left: 20rpx;
	min-width: 0;
}

.card__tokens-title {
	display: block;
	font-size: 28rpx;
	font-weight: 700;
	color: #1a1d24;
}

.card__tokens-sub {
	display: block;
	margin-top: 6rpx;
	font-size: 22rpx;
	color: #8a8f99;
}

.card__tokens-val {
	font-size: 40rpx;
	font-weight: 800;
	color: #1a4a9e;
	flex-shrink: 0;
}
</style>
