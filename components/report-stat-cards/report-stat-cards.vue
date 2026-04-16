<template>
	<view class="row">
		<view v-for="(item, index) in items" :key="index" class="card">
			<text class="card__label">{{ item.label }}</text>
			<text class="card__value">{{ item.value }}</text>
		</view>
	</view>
</template>

<script setup>
defineProps({
	items: {
		type: Array,
		required: true
	}
})
</script>

<style scoped lang="scss">
.row {
	display: flex;
	flex-direction: row;
	margin-top: 24rpx;
}

.card {
	flex: 1;
	background: #ffffff;
	border-radius: 20rpx;
	padding: 28rpx 20rpx;
	box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
	min-width: 0;
}

.card:first-child {
	margin-right: 20rpx;
}

.card__label {
	display: block;
	font-size: 24rpx;
	color: #8a8f99;
	margin-bottom: 12rpx;
}

.card__value {
	display: block;
	font-size: 30rpx;
	font-weight: 700;
	color: #1a4a9e;
	line-height: 1.3;
	word-break: break-all;
}
</style>
