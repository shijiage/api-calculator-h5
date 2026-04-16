<template>
	<view class="card">
		<text class="card__title">{{ block.title }}</text>
		<view v-for="(item, index) in block.items" :key="index" class="row">
			<view class="row__top">
				<text class="row__label">{{ item.label }}</text>
				<view class="row__right">
					<view class="row__segments">
						<view
							v-for="i in segments"
							:key="i"
							class="seg"
							:class="{ 'seg--on': i <= item.filled }"
						/>
					</view>
					<text class="row__score">{{ item.score }}</text>
				</view>
			</view>
			<text v-if="item.explain" class="row__explain">{{ item.explain }}</text>
		</view>
	</view>
</template>

<script setup>
defineProps({
	block: {
		type: Object,
		required: true
	}
})

const segments = [1, 2, 3, 4, 5]
</script>

<style scoped lang="scss">
.card {
	margin-top: 24rpx;
	margin-bottom: 8rpx;
	background: #ffffff;
	border-radius: 24rpx;
	padding: 28rpx 24rpx 8rpx;
	box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.05);
}

.card__title {
	display: block;
	text-align: center;
	font-size: 32rpx;
	font-weight: 700;
	color: #1a1d24;
	margin-bottom: 28rpx;
}

.row {
	display: flex;
	flex-direction: column;
	margin-bottom: 28rpx;
}

.row__top {
	display: flex;
	flex-direction: row;
	align-items: center;
}

.row__label {
	width: 170rpx;
	flex-shrink: 0;
	font-size: 26rpx;
	color: #3d4450;
	font-weight: 500;
}

.row__explain {
	display: block;
	margin-top: 8rpx;
	padding-left: 0;
	font-size: 20rpx;
	line-height: 1.45;
	color: #8a8f99;
}

.row__right {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: row;
	align-items: center;
}

.row__segments {
	flex: 1;
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: space-between;
	margin: 0 12rpx 0 0;
	min-width: 0;
}

.seg {
	flex: 1;
	height: 16rpx;
	margin: 0 4rpx;
	border-radius: 6rpx;
	background: #e2e5eb;
	min-width: 0;
}

.seg:first-child {
	margin-left: 0;
}

.seg:last-child {
	margin-right: 0;
}

.seg--on {
	background: linear-gradient(90deg, #153d82 0%, #1a4a9e 100%);
}

.row__score {
	width: 72rpx;
	flex-shrink: 0;
	text-align: right;
	font-size: 28rpx;
	font-weight: 700;
	color: #1a4a9e;
}
</style>
