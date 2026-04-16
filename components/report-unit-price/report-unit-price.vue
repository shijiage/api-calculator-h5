<template>
	<view class="box">
		<view class="box__head">
			<view class="box__indicator" />
			<text class="box__title">{{ section.title }}</text>
		</view>
		<view v-for="(row, index) in section.rows" :key="index" class="row">
			<view class="row__top">
				<text class="row__name">{{ row.name }}</text>
				<text class="row__price" :class="{ 'row__price--accent': row.variant === 'low' }">{{ row.price }}</text>
			</view>
			<view class="track">
				<view
					class="track__fill"
					:class="row.variant === 'high' ? 'track__fill--high' : 'track__fill--low'"
					:style="{ width: row.fillPercent + '%' }"
				/>
			</view>
		</view>
	</view>
</template>

<script setup>
defineProps({
	section: {
		type: Object,
		required: true
	}
})
</script>

<style scoped lang="scss">
.box {
	margin-top: 24rpx;
	background: #eef1f6;
	border-radius: 24rpx;
	padding: 28rpx 24rpx 32rpx;
}

.box__head {
	display: flex;
	flex-direction: row;
	align-items: center;
	margin-bottom: 28rpx;
}

.box__indicator {
	width: 8rpx;
	height: 32rpx;
	background: #1a4a9e;
	border-radius: 4rpx;
	margin-right: 14rpx;
	flex-shrink: 0;
}

.box__title {
	font-size: 30rpx;
	font-weight: 700;
	color: #1a1d24;
}

.row {
	margin-bottom: 28rpx;
}

.row:last-child {
	margin-bottom: 0;
}

.row__top {
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 14rpx;
}

.row__name {
	flex: 1;
	font-size: 26rpx;
	color: #3d4450;
	font-weight: 500;
	padding-right: 16rpx;
}

.row__price {
	font-size: 28rpx;
	font-weight: 700;
	color: #5c6370;
	flex-shrink: 0;
}

.row__price--accent {
	color: #1a4a9e;
}

.track {
	height: 16rpx;
	border-radius: 999rpx;
	background: rgba(255, 255, 255, 0.75);
	overflow: hidden;
}

.track__fill {
	height: 100%;
	border-radius: 999rpx;
	transition: width 0.25s ease;
}

.track__fill--high {
	background: linear-gradient(90deg, #d4d8e8 0%, #c5c9dc 100%);
}

.track__fill--low {
	background: linear-gradient(90deg, #1a4a9e 0%, #3b7fd9 100%);
}
</style>
