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
			<text class="desc">
				可先浏览页面；使用对比、报告和云端同步前，请先完成账号登录。
			</text>

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

			<!-- #ifdef MP-WEIXIN -->
			<button
				class="btn"
				type="primary"
				:loading="loading"
				:disabled="loading || !agreed"
				@click="onWxLogin"
			>
				微信一键登录
			</button>

			<text class="hint">
				登录仅用于身份识别、个人资料同步与匿名使用统计，不采集手机号等敏感信息。
			</text>
			<!-- #endif -->

			<!-- #ifdef H5 -->
			<view class="mode-tabs">
				<view
					class="mode-tab"
					:class="{ 'mode-tab--active': mode === 'login' }"
					@click="switchMode('login')"
				>
					<text class="mode-tab__text" :class="{ 'mode-tab__text--active': mode === 'login' }">账号登录</text>
				</view>
				<view
					class="mode-tab"
					:class="{ 'mode-tab--active': mode === 'register' }"
					@click="switchMode('register')"
				>
					<text class="mode-tab__text" :class="{ 'mode-tab__text--active': mode === 'register' }">注册账号</text>
				</view>
			</view>

			<view class="form-card">
				<input
					v-model.trim="form.username"
					class="input"
					maxlength="24"
					placeholder="请输入账号，4-24 位字母/数字/下划线"
					placeholder-class="input__placeholder"
				/>
				<input
					v-model="form.password"
					class="input"
					password
					maxlength="64"
					placeholder="请输入密码，至少 6 位"
					placeholder-class="input__placeholder"
				/>

				<template v-if="mode === 'register'">
					<input
						v-model="form.confirmPassword"
						class="input"
						password
						maxlength="64"
						placeholder="请再次输入密码"
						placeholder-class="input__placeholder"
					/>

					<view class="captcha-row">
						<input
							v-model.trim="form.captchaInput"
							class="input input--captcha"
							maxlength="4"
							placeholder="请输入验证码"
							placeholder-class="input__placeholder"
						/>
						<view class="captcha-box" hover-class="captcha-box--hover" @click="refreshCaptcha">
							<text
								v-for="(char, index) in captchaChars"
								:key="`${char}-${index}-${captchaSeed}`"
								class="captcha-box__char"
								:style="captchaCharStyle(index)"
							>
								{{ char }}
							</text>
						</view>
					</view>
					<text class="captcha-tip">点击验证码可刷新，注册时需通过人机校验。</text>
				</template>
			</view>

			<button
				class="btn"
				type="primary"
				:loading="loading"
				:disabled="loading || !agreed"
				@click="onWebSubmit"
			>
				{{ mode === 'login' ? '登录账号' : '注册并登录' }}
			</button>

			<text class="hint">
				网页端不走微信小程序登录，已切换为账号注册/登录模式。
			</text>
			<!-- #endif -->
		</view>
	</view>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import {
	loginByWxCloud,
	loginByWebAccount,
	registerByWebAccount,
	hasStoredSession,
	getStoredLoginReturnUrl,
	clearLoginReturnUrl
} from '@/common/auth.js'

const statusBarH = ref(20)
const loading = ref(false)
const error = ref('')
const agreed = ref(false)
const mode = ref('login')
const captchaCode = ref('')
const captchaSeed = ref(0)
const form = ref({
	username: '',
	password: '',
	confirmPassword: '',
	captchaInput: ''
})

const captchaChars = computed(() => captchaCode.value.split(''))

function goHomeIfLogged() {
	if (hasStoredSession()) {
		uni.reLaunch({ url: '/pages/index/index' })
	}
}

function refreshCaptcha() {
	const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
	let next = ''
	for (let i = 0; i < 4; i += 1) {
		next += chars.charAt(Math.floor(Math.random() * chars.length))
	}
	captchaCode.value = next
	captchaSeed.value = Date.now()
	form.value.captchaInput = ''
}

function captchaCharStyle(index) {
	const base = Number(captchaSeed.value || 0) + index * 97
	const rotate = ((base % 31) - 15).toFixed(0)
	const offset = ((base % 7) - 3).toFixed(0)
	return {
		transform: `translateY(${offset}px) rotate(${rotate}deg)`
	}
}

onMounted(() => {
	const sys = uni.getSystemInfoSync()
	statusBarH.value = sys.statusBarHeight || 20
	refreshCaptcha()
	goHomeIfLogged()
})

onShow(() => {
	goHomeIfLogged()
})

function toggleAgree() {
	agreed.value = !agreed.value
}

function openAgreement(type) {
	const url = type === 'privacy' ? '/pages/agreement/privacy' : '/pages/agreement/service'
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

function switchMode(nextMode) {
	if (loading.value || mode.value === nextMode) return
	mode.value = nextMode
	error.value = ''
	form.value.password = ''
	form.value.confirmPassword = ''
	form.value.captchaInput = ''
	refreshCaptcha()
}

function validateUsername(username) {
	return /^[a-zA-Z][a-zA-Z0-9_]{3,23}$/.test(username)
}

function validateWebForm() {
	const username = String(form.value.username || '').trim()
	const password = String(form.value.password || '')

	if (!validateUsername(username)) {
		throw new Error('账号需为 4-24 位，以字母开头，可使用字母、数字和下划线')
	}

	if (password.length < 6 || password.length > 64) {
		throw new Error('密码长度需为 6-64 位')
	}

	if (mode.value === 'register') {
		if (password !== String(form.value.confirmPassword || '')) {
			throw new Error('两次输入的密码不一致')
		}
		if (String(form.value.captchaInput || '').trim().toUpperCase() !== captchaCode.value) {
			refreshCaptcha()
			throw new Error('验证码错误，请重新输入')
		}
	}

	return { username, password }
}

function finishLogin() {
	const next = getStoredLoginReturnUrl()
	clearLoginReturnUrl()
	uni.reLaunch({ url: next || '/pages/index/index' })
}

async function onWxLogin() {
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
		setTimeout(finishLogin, 400)
	} catch (e) {
		error.value = e.message || '登录失败，请检查网络与 uniCloud 配置'
	} finally {
		loading.value = false
	}
}

async function onWebSubmit() {
	if (!agreed.value) {
		uni.showToast({ title: '请先阅读并勾选协议', icon: 'none' })
		return
	}

	error.value = ''
	loading.value = true
	try {
		const { username, password } = validateWebForm()
		const payload =
			mode.value === 'login'
				? await loginByWebAccount({ username, password })
				: await registerByWebAccount({ username, password })

		uni.showToast({
			title: payload.isNew ? '注册成功，已自动登录' : '登录成功',
			icon: 'success'
		})

		setTimeout(finishLogin, 350)
	} catch (e) {
		error.value = e.message || (mode.value === 'login' ? '账号登录失败' : '账号注册失败')
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

.mode-tabs {
	margin-top: 24rpx;
	display: inline-flex;
	align-self: center;
	padding: 10rpx;
	background: #edf2fb;
	border-radius: 999rpx;
	gap: 10rpx;
}

.mode-tab {
	min-width: 172rpx;
	height: 68rpx;
	padding: 0 28rpx;
	border-radius: 999rpx;
	display: inline-flex;
	align-items: center;
	justify-content: center;
}

.mode-tab--active {
	background: #1a4a9e;
	box-shadow: 0 12rpx 28rpx rgba(26, 74, 158, 0.2);
}

.mode-tab__text {
	font-size: 24rpx;
	font-weight: 700;
	color: #6c7380;
}

.mode-tab__text--active {
	color: #ffffff;
}

.form-card {
	margin-top: 28rpx;
	padding: 30rpx 28rpx;
	background: #ffffff;
	border-radius: 24rpx;
	box-shadow: 0 18rpx 40rpx rgba(20, 31, 58, 0.06);
}

.input {
	height: 88rpx;
	margin-top: 18rpx;
	padding: 0 26rpx;
	border-radius: 18rpx;
	background: #f5f7fb;
	font-size: 28rpx;
	color: #1a1d24;
	box-sizing: border-box;
}

.input:first-child {
	margin-top: 0;
}

.input__placeholder {
	color: #9aa0ab;
}

.captcha-row {
	margin-top: 18rpx;
	display: flex;
	gap: 18rpx;
	align-items: center;
}

.input--captcha {
	flex: 1;
	margin-top: 0;
}

.captcha-box {
	width: 220rpx;
	height: 88rpx;
	border-radius: 18rpx;
	background:
		linear-gradient(135deg, rgba(26, 74, 158, 0.08) 0%, rgba(26, 74, 158, 0.16) 100%),
		repeating-linear-gradient(
			-45deg,
			rgba(26, 74, 158, 0.06) 0,
			rgba(26, 74, 158, 0.06) 12rpx,
			rgba(26, 74, 158, 0.01) 12rpx,
			rgba(26, 74, 158, 0.01) 24rpx
		);
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 8rpx;
}

.captcha-box--hover {
	opacity: 0.88;
}

.captcha-box__char {
	font-size: 40rpx;
	font-weight: 800;
	color: #1a4a9e;
	letter-spacing: 3rpx;
}

.captcha-tip {
	display: block;
	margin-top: 14rpx;
	font-size: 22rpx;
	line-height: 1.6;
	color: #8b93a3;
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
