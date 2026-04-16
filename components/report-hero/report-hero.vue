<template>
	<view class="hero">
		<view class="hero__watermark" aria-hidden="true">
			<view class="hero__watermark-ring">
				<uni-icons type="checkmarkempty" size="120rpx" color="#ffffff" />
			</view>
		</view>
		<text class="hero__tag">{{ data.tag }}</text>
		<text class="hero__title">{{ data.title }}</text>
		<view class="hero__savings">
			<text class="hero__pct">{{ data.savingsPercent }}</text>
			<text class="hero__sub">{{ data.savingsSub }}</text>
		</view>
		<text v-if="data.savingHint" class="hero__hint">{{ data.savingHint }}</text>
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
.hero {
	position: relative;
	overflow: hidden;
	border-radius: 24rpx;
	padding: 36rpx 32rpx 40rpx;
	background: linear-gradient(145deg, #163a7a 0%, #1a4a9e 42%, #2a6fd4 100%);
	box-shadow: 0 12rpx 32rpx rgba(26, 74, 158, 0.28);
}

.hero__watermark {
	position: absolute;
	right: -24rpx;
	top: -32rpx;
	width: 220rpx;
	height: 220rpx;
	opacity: 0.14;
	pointer-events: none;
}

.hero__watermark-ring {
	width: 100%;
	height: 100%;
	border-radius: 50%;
	border: solid 6rpx rgba(255, 255, 255, 0.95);
	display: flex;
	align-items: center;
	justify-content: center;
}

.hero__tag {
	position: relative;
	z-index: 1;
	font-size: 24rpx;
	color: rgba(255, 255, 255, 0.88);
	font-weight: 500;
}

.hero__title {
	position: relative;
	z-index: 1;
	display: block;
	margin-top: 20rpx;
	font-size: 40rpx;
	font-weight: 700;
	color: #ffffff;
	line-height: 1.35;
}

.hero__savings {
	position: relative;
	z-index: 1;
	margin-top: 28rpx;
	display: flex;
	flex-direction: row;
	align-items: baseline;
	flex-wrap: wrap;
}

.hero__pct {
	font-size: 72rpx;
	font-weight: 800;
	color: #ffffff;
	line-height: 1;
	letter-spacing: -2rpx;
}

.hero__sub {
	margin-left: 16rpx;
	font-size: 26rpx;
	color: rgba(255, 255, 255, 0.92);
	font-weight: 500;
}

.hero__hint {
	position: relative;
	z-index: 1;
	display: block;
	margin-top: 16rpx;
	font-size: 22rpx;
	color: rgba(255, 255, 255, 0.78);
	line-height: 1.45;
}
</style>
