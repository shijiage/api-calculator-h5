<template>
	<view class="row">
		<view class="card card--light">
			<text class="card__label">{{ labels.history }}</text>
			<text class="card__val">{{ historyCount }}</text>
			<text v-if="trendTag" class="card__tag">{{ trendTag }}</text>
		</view>
		<view class="card card--light">
			<text class="card__label">{{ labels.favorites }}</text>
			<text class="card__val">{{ favoritesCount }}</text>
			<text v-if="labels.favoritesSub" class="card__sub">{{ labels.favoritesSub }}</text>
		</view>
		<view class="card card--accent">
			<text class="card__label card__label--inv">{{ labels.saved }}</text>
			<text class="card__val card__val--inv">{{ savedDisplay }}</text>
			<text v-if="labels.savedSub" class="card__sub card__sub--inv">{{ labels.savedSub }}</text>
		</view>
	</view>
</template>

<script setup>
defineProps({
	labels: {
		type: Object,
		required: true
	},
	historyCount: { type: Number, default: 0 },
	favoritesCount: { type: Number, default: 0 },
	savedDisplay: { type: String, default: '¥0' },
	trendTag: { type: String, default: '' }
})
</script>

<style scoped lang="scss">
.row {
	display: flex;
	flex-direction: row;
	padding: 0 8rpx;
	margin-bottom: 28rpx;
}

.card {
	flex: 1;
	border-radius: 20rpx;
	padding: 22rpx 12rpx;
	margin: 0 8rpx;
	box-shadow: 0 6rpx 20rpx rgba(0, 0, 0, 0.06);
	min-width: 0;
	display: flex;
	flex-direction: column;
	align-items: center;
}

.card--light {
	background: #ffffff;
}

.card--accent {
	background: linear-gradient(160deg, #0a2f6e 0%, #1a4a9e 55%, #2563c4 100%);
	box-shadow: 0 8rpx 24rpx rgba(10, 47, 110, 0.35);
}

.card__label {
	font-size: 22rpx;
	color: #8a8f99;
	text-align: center;
}

.card__label--inv {
	color: rgba(255, 255, 255, 0.85);
}

.card__val {
	margin-top: 10rpx;
	font-size: 36rpx;
	font-weight: 800;
	color: #1a1d24;
}

.card__val--inv {
	color: #ffffff;
	font-size: 34rpx;
}

.card__tag {
	margin-top: 8rpx;
	font-size: 20rpx;
	font-weight: 600;
	color: #1a4a9e;
	background: #e8f1ff;
	border-radius: 8rpx;
	padding: 4rpx 12rpx;
}

.card__sub {
	margin-top: 8rpx;
	font-size: 20rpx;
	color: #a0a5b0;
}

.card__sub--inv {
	color: rgba(255, 255, 255, 0.75);
}
</style>
