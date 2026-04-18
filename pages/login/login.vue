<template>
	<view class="page">
		<view class="status-bar" :style="{ height: statusBarH + 'px' }" />
		<view class="nav">
			<view class="nav__side" @click="onBack">
				<uni-icons type="left" size="40rpx" color="#1a1d24" />
			</view>
			<text class="nav__title">登录</text>
			<view class="nav__side nav__side--placeholder" />
		</view>
		<view class="panel">
			<text class="title">性价比助手</text>
			<text class="desc">可先浏览页面；使用对比、报告和云端同步前，请先完成微信登录。</text>

			<view v-if="error" class="err">{{ error }}</view>

			<view class="agreement" @click="toggleAgree">
				<view class="agreement__icon">
					<uni-icons
						:type="agreed ? 'checkbox-filled' : 'circle'"
						size="34rpx"
						:color="agreed ? '#1a4a9e' : '#b7bfcc'"
					/>
				</view>
				<view class="agreement__content">
					<text class="agreement__text">我已阅读并同意</text>
					<text class="agreement__link" @click.stop="openAgreement('service')">《用户服务协议》</text>
					<text class="agreement__text">和</text>
					<text class="agreement__link" @click.stop="openAgreement('privacy')">《隐私政策》</text>
				</view>
			</view>

			<button
				class="btn"
				type="primary"
				:loading="loading"
				:disabled="loading || !agreed"
				@click="onLogin"
			>
				微信一键登录
			</button>

			<text class="hint">登录仅用于身份识别、个人资料同步与匿名使用统计，不采集手机号等敏感信息。</text>
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
const agreed = ref(false)

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

function toggleAgree() {
	agreed.value = !agreed.value
}

function openAgreement(type) {
	const url =
		type === 'privacy' ? '/pages/agreement/privacy' : '/pages/agreement/service'
	uni.navigateTo({ url })
}

function onBack() {
	const pages = getCurrentPages()
	if (Array.isArray(pages) && pages.length > 1) {
		uni.navigateBack()
		return
	}
	uni.reLaunch({ url: '/pages/index/index' })
}

async function onLogin() {
	if (!agreed.value) {
		uni.showToast({ title: '请先阅读并勾选协议', icon: 'none' })
		return
	}

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

.nav {
	display: flex;
	align-items: center;
	padding: 8rpx 0 12rpx;
}

.nav__side {
	width: 80rpx;
	height: 64rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}

.nav__side--placeholder {
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

.panel {
	padding-top: 92rpx;
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

.agreement {
	margin-top: 44rpx;
	padding: 24rpx 0 12rpx;
	display: flex;
	align-items: flex-start;
}

.agreement__icon {
	width: 40rpx;
	padding-top: 4rpx;
	flex-shrink: 0;
}

.agreement__content {
	flex: 1;
	font-size: 26rpx;
	line-height: 1.75;
	color: #6c7380;
}

.agreement__text {
	color: #6c7380;
}

.agreement__link {
	color: #1a4a9e;
	font-weight: 600;
}

.btn {
	margin-top: 32rpx;
	height: 96rpx;
	line-height: 96rpx;
	border-radius: 16rpx;
	font-size: 32rpx;
	font-weight: 600;
	background: #1a4a9e;
}

.btn[disabled] {
	background: #b8c7e6;
	color: rgba(255, 255, 255, 0.9);
}

.hint {
	margin-top: 40rpx;
	font-size: 22rpx;
	color: #9aa0ab;
	line-height: 1.5;
	text-align: center;
}
</style>
