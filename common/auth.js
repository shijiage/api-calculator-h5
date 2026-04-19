import { CLOUD_CALL_TIMEOUT_MS } from '@/common/data.js'
import { markLoginSuccess } from '@/common/analytics.js'

const STORAGE_OPENID = 'calc_openid'
const STORAGE_USER_COUNT = 'calc_user_count'
const STORAGE_IS_ADMIN = 'calc_is_admin'
const STORAGE_LOGIN_AT = 'calc_login_at'
const STORAGE_LOGIN_RETURN_URL = 'calc_login_return_url'
const STORAGE_SESSION_TOKEN = 'calc_session_token'
const STORAGE_SESSION_EXPIRES_AT = 'calc_session_expires_at'

const TEXT = {
	loginNeeded: '\u9700\u8981\u767b\u5f55',
	loginBeforeUse: '\u4f7f\u7528\u5bf9\u6bd4\u4e0e\u62a5\u544a\u529f\u80fd\u524d\u8bf7\u5148\u5b8c\u6210\u5fae\u4fe1\u767b\u5f55\u3002',
	goLogin: '\u53bb\u767b\u5f55',
	cancel: '\u53d6\u6d88',
	loginCodeMissing: 'uni.login \u672a\u8fd4\u56de code',
	loginCallFailed:
		'\u4e91\u51fd\u6570\u8c03\u7528\u5931\u8d25\uff1a\u8bf7\u786e\u8ba4\u5df2\u5728 HBuilderX \u5173\u8054 uniCloud-aliyun \u5e76\u4e0a\u4f20\u4e91\u51fd\u6570 login-by-wx',
	loginFailed: '\u767b\u5f55\u5931\u8d25',
	webLoginFailed: '\u8d26\u53f7\u767b\u5f55\u5931\u8d25',
	webRegisterFailed: '\u8d26\u53f7\u6ce8\u518c\u5931\u8d25'
}

function buildCurrentPageUrl() {
	try {
		const pages = getCurrentPages()
		const cur = pages[pages.length - 1]
		const route = cur && cur.route ? String(cur.route) : ''
		if (!route) return '/pages/index/index'
		const opts = cur && cur.options ? cur.options : null
		let qs = ''
		if (opts && typeof opts === 'object') {
			const keys = Object.keys(opts).filter((k) => opts[k] !== undefined && opts[k] !== null && String(opts[k]) !== '')
			if (keys.length > 0) {
				qs = keys
					.map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(String(opts[k]))}`)
					.join('&')
			}
		}
		return '/' + route + (qs ? `?${qs}` : '')
	} catch {
		return '/pages/index/index'
	}
}

export function getStoredLoginReturnUrl() {
	try {
		return String(uni.getStorageSync(STORAGE_LOGIN_RETURN_URL) || '')
	} catch {
		return ''
	}
}

export function clearLoginReturnUrl() {
	try {
		uni.removeStorageSync(STORAGE_LOGIN_RETURN_URL)
	} catch (e) {}
}

export function setStoredLoginReturnUrl(returnUrl) {
	try {
		uni.setStorageSync(STORAGE_LOGIN_RETURN_URL, returnUrl || buildCurrentPageUrl())
	} catch (e) {}
}

export function getStoredOpenid() {
	return uni.getStorageSync(STORAGE_OPENID) || ''
}

export function getStoredSessionToken() {
	try {
		return String(uni.getStorageSync(STORAGE_SESSION_TOKEN) || '')
	} catch {
		return ''
	}
}

export function getStoredSessionExpiresAt() {
	try {
		const raw = uni.getStorageSync(STORAGE_SESSION_EXPIRES_AT)
		const value = Number(raw || 0)
		return Number.isFinite(value) ? value : 0
	} catch {
		return 0
	}
}

export function hasStoredSession() {
	const openid = getStoredOpenid()
	const sessionToken = getStoredSessionToken()
	const expiresAt = getStoredSessionExpiresAt()
	if (!openid || !sessionToken) return false
	if (expiresAt > 0 && expiresAt <= Date.now()) return false
	return true
}

export function getStoredUserCount() {
	const n = uni.getStorageSync(STORAGE_USER_COUNT)
	return typeof n === 'number' ? n : parseInt(String(n), 10) || 0
}

export function getStoredIsAdmin() {
	try {
		const raw = uni.getStorageSync(STORAGE_IS_ADMIN)
		return raw === true || raw === 1 || raw === '1'
	} catch {
		return false
	}
}

export function clearLogin() {
	try {
		uni.removeStorageSync(STORAGE_OPENID)
		uni.removeStorageSync(STORAGE_USER_COUNT)
		uni.removeStorageSync(STORAGE_IS_ADMIN)
		uni.removeStorageSync(STORAGE_LOGIN_AT)
		uni.removeStorageSync(STORAGE_SESSION_TOKEN)
		uni.removeStorageSync(STORAGE_SESSION_EXPIRES_AT)
	} catch (e) {}
}

function applyLoginPayload(payload) {
	uni.setStorageSync(STORAGE_OPENID, payload.openid)
	uni.setStorageSync(STORAGE_USER_COUNT, payload.userCount || 0)
	uni.setStorageSync(STORAGE_IS_ADMIN, payload.isAdmin ? 1 : 0)
	uni.setStorageSync(STORAGE_LOGIN_AT, Date.now())
	uni.setStorageSync(STORAGE_SESSION_TOKEN, payload.sessionToken || '')
	uni.setStorageSync(STORAGE_SESSION_EXPIRES_AT, payload.sessionExpiresAt || 0)
	markLoginSuccess()

	return {
		openid: String(payload.openid || ''),
		userCount: Number(payload.userCount || 0),
		isNew: !!payload.isNew,
		isAdmin: !!payload.isAdmin,
		sessionToken: String(payload.sessionToken || ''),
		sessionExpiresAt: Number(payload.sessionExpiresAt || 0)
	}
}

export function navigateToLoginWithReturnUrl(returnUrl) {
	setStoredLoginReturnUrl(returnUrl || buildCurrentPageUrl())
	uni.navigateTo({ url: '/pages/login/login' })
}

export async function loginByWxCloud() {
	const loginRes = await uni.login({ provider: 'weixin' })
	if (!loginRes.code) {
		throw new Error(loginRes.errMsg || TEXT.loginCodeMissing)
	}

	let res
	try {
		res = await uniCloud.callFunction({
			name: 'login-by-wx',
			data: { code: loginRes.code },
			timeout: CLOUD_CALL_TIMEOUT_MS
		})
	} catch (e) {
		throw new Error(e.errMsg || e.message || TEXT.loginCallFailed)
	}

	if (res.errMsg && res.errMsg !== 'cloud.callFunction:ok' && res.errMsg !== 'callFunction:ok') {
		throw new Error(res.errMsg)
	}

	const payload = res.result
	if (!payload || payload.errCode !== 0) {
		const msg = (payload && payload.errMsg) || TEXT.loginFailed
		throw new Error(msg)
	}

	return applyLoginPayload(payload)
}

async function callWebLoginFunction(data, fallbackMessage) {
	let res
	try {
		res = await uniCloud.callFunction({
			name: 'login-web',
			data,
			timeout: CLOUD_CALL_TIMEOUT_MS
		})
	} catch (e) {
		throw new Error(e.errMsg || e.message || fallbackMessage)
	}

	if (res.errMsg && res.errMsg !== 'cloud.callFunction:ok' && res.errMsg !== 'callFunction:ok') {
		throw new Error(res.errMsg)
	}

	const payload = res.result
	if (!payload || payload.errCode !== 0) {
		throw new Error((payload && payload.errMsg) || fallbackMessage)
	}

	return applyLoginPayload(payload)
}

export async function loginByWebAccount(options = {}) {
	return callWebLoginFunction(
		{
			action: 'login',
			username: String(options.username || '').trim(),
			password: String(options.password || '')
		},
		TEXT.webLoginFailed
	)
}

export async function registerByWebAccount(options = {}) {
	return callWebLoginFunction(
		{
			action: 'register',
			username: String(options.username || '').trim(),
			password: String(options.password || '')
		},
		TEXT.webRegisterFailed
	)
}

export function ensureLoggedInOrPrompt(options) {
	if (hasStoredSession()) return Promise.resolve(true)
	const title = (options && options.title) || TEXT.loginNeeded
	const content = (options && options.content) || TEXT.loginBeforeUse
	const returnUrl = (options && options.returnUrl) || buildCurrentPageUrl()
	return new Promise((resolve) => {
		setStoredLoginReturnUrl(returnUrl)
		uni.showModal({
			title,
			content,
			confirmText: TEXT.goLogin,
			cancelText: TEXT.cancel,
			success(res) {
				if (res.confirm) {
					uni.navigateTo({ url: '/pages/login/login' })
				}
				resolve(false)
			},
			fail() {
				resolve(false)
			}
		})
	})
}
