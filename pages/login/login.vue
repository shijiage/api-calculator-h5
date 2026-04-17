<template>
	<view class="page">
		<view class="status-bar" :style="{ height: statusBarH + 'px' }" />
		<view class="panel">
			<text class="title">性价比助手</text>
			<text class="desc">可先浏览各页；使用对比与报告、云端同步前请完成微信登录，并参与匿名用户统计。</text>

			<view v-if="error" class="err">{{ error }}</view>

			<button
				class="btn"
				type="primary"
				:loading="loading"
				:disabled="loading"
				@click="onLogin"
			>
				微信一键登录
			</button>

			<text class="hint">登录即表示同意仅用于身份识别与匿名人数统计，不采集手机号。</text>
		</view>
	</view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { loginByWxCloud, getStoredOpenid, getStoredLoginReturnUrl, clearLoginReturnUrl } from '@/common/auth.js'

const statusBarH = ref(20)
const loading = ref(false)
const error = ref('')

function goHomeIfLogged() {
	if (getStoredOpenid()) {
		uni.reLaunch({ url: '/pages/index/index' })
	}
}

onMounted(() => {
	const sys = uni.getSystemInfoSync()
	statusBarH.value = sys.statusBarHeight || 20
	goHomeIfLogged()
})

onShow(() => {
	goHomeIfLogged()
})

async function onLogin() {
	error.value = ''
	loading.value = true
	try {
		const { userCount, isNew } = await loginByWxCloud()
		uni.showToast({
			title: isNew ? `欢迎，你是第 ${userCount} 位用户` : '欢迎回来',
			icon: 'none'
		})
		setTimeout(() => {
			const next = getStoredLoginReturnUrl()
			clearLoginReturnUrl()
			uni.reLaunch({ url: next || '/pages/index/index' })
		}, 400)
	} catch (e) {
		error.value = e.message || '登录失败，请检查网络与 uniCloud 配置'
	} finally {
		loading.value = false
	}
}
</script>

<style scoped lang="scss">
.page {
	min-height: 100vh;
	background: #f7f8fa;
	padding: 0 48rpx;
	box-sizing: border-box;
}

.status-bar {
	width: 100%;
}

.panel {
	padding-top: 120rpx;
	display: flex;
	flex-direction: column;
	align-items: stretch;
}

.title {
	font-size: 48rpx;
	font-weight: 700;
	color: #1a4a9e;
	text-align: center;
}

.desc {
	margin-top: 32rpx;
	font-size: 28rpx;
	color: #5c6370;
	line-height: 1.65;
	text-align: center;
}

.err {
	margin-top: 32rpx;
	padding: 20rpx;
	background: #fff2f0;
	color: #c0392b;
	font-size: 26rpx;
	border-radius: 12rpx;
	line-height: 1.5;
}

.btn {
	margin-top: 56rpx;
	height: 96rpx;
	line-height: 96rpx;
	border-radius: 16rpx;
	font-size: 32rpx;
	font-weight: 600;
	background: #1a4a9e;
}

.hint {
	margin-top: 40rpx;
	font-size: 22rpx;
	color: #9aa0ab;
	line-height: 1.5;
	text-align: center;
}
</style>
