<template>
	<view class="wrap">
		<view v-for="(group, gi) in groups" :key="gi" class="group">
			<view
				v-for="(item, ii) in group.items"
				:key="item.key"
				class="cell"
				:class="{ 'cell--last': ii === group.items.length - 1 }"
				hover-class="cell--hover"
				@click="emit('select', item.key)"
			>
				<view class="cell__icon">
					<uni-icons :type="item.icon" size="36rpx" color="#1a4a9e" />
				</view>
				<text class="cell__label">{{ item.label }}</text>
				<uni-icons type="right" size="28rpx" color="#d0d4dc" />
			</view>
		</view>
	</view>
</template>

<script setup>
defineProps({
	groups: {
		type: Array,
		required: true
	}
})

const emit = defineEmits(['select'])
</script>

<style scoped lang="scss">
.wrap {
	padding: 0 8rpx;
}

.group {
	background: #ffffff;
	border-radius: 20rpx;
	margin-bottom: 24rpx;
	box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.05);
	overflow: hidden;
}

.cell {
	display: flex;
	flex-direction: row;
	align-items: center;
	padding: 28rpx 24rpx;
	border-bottom: 1rpx solid #f0f2f5;
}

.cell--last {
	border-bottom: none;
}

.cell--hover {
	background: #fafbfc;
}

.cell__icon {
	width: 64rpx;
	height: 64rpx;
	border-radius: 16rpx;
	background: #e8f1ff;
	display: flex;
	align-items: center;
	justify-content: center;
	margin-right: 20rpx;
	flex-shrink: 0;
}

.cell__label {
	flex: 1;
	font-size: 30rpx;
	font-weight: 600;
	color: #1a1d24;
}
</style>
