<template>
	<view class="nav">
		<view class="nav__side" @click="emit('back')">
			<uni-icons type="left" size="40rpx" color="#1a1d24" />
		</view>
		<text class="nav__title">{{ title }}</text>
		<view
			class="nav__side nav__side--right"
			:class="{ 'nav__side--right--hide': !showSettings }"
			@click="emit('settings')"
		>
			<uni-icons type="gear" size="40rpx" color="#1a1d24" />
		</view>
	</view>
</template>

<script setup>
defineProps({
	title: {
		type: String,
		default: '个人中心'
	},
	showSettings: {
		type: Boolean,
		default: true
	}
})

const emit = defineEmits(['back', 'settings'])
</script>

<style scoped lang="scss">
.nav {
	display: flex;
	flex-direction: row;
	align-items: center;
	padding: 8rpx 12rpx 20rpx 8rpx;
}

.nav__side {
	width: 80rpx;
	height: 64rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}

.nav__side--right {
	justify-content: center;
}

.nav__side--right--hide {
	opacity: 0;
	pointer-events: none;
}

.nav__title {
	flex: 1;
	text-align: center;
	font-size: 34rpx;
	font-weight: 700;
	color: #1a1d24;
}
</style>
