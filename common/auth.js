import { CLOUD_CALL_TIMEOUT_MS } from '@/common/data.js'
import { markLoginSuccess } from '@/common/analytics.js'

const STORAGE_OPENID = 'calc_openid'
const STORAGE_USER_COUNT = 'calc_user_count'
const STORAGE_LOGIN_AT = 'calc_login_at'
const STORAGE_LOGIN_RETURN_URL = 'calc_login_return_url'

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

export function getStoredOpenid() {
	return uni.getStorageSync(STORAGE_OPENID) || ''
}

export function getStoredUserCount() {
	const n = uni.getStorageSync(STORAGE_USER_COUNT)
	return typeof n === 'number' ? n : parseInt(String(n), 10) || 0
}

export function clearLogin() {
	try {
		uni.removeStorageSync(STORAGE_OPENID)
		uni.removeStorageSync(STORAGE_USER_COUNT)
		uni.removeStorageSync(STORAGE_LOGIN_AT)
	} catch (e) {}
}

/**
 * 微信小程序静默登录：uni.login → 云函数 login-by-wx
 * @returns {{ openid: string, userCount: number, isNew: boolean }}
 */
export async function loginByWxCloud() {
	const loginRes = await uni.login({ provider: 'weixin' })
	if (!loginRes.code) {
		throw new Error(loginRes.errMsg || 'uni.login 未返回 code')
	}

	let res
	try {
		res = await uniCloud.callFunction({
			name: 'login-by-wx',
			data: { code: loginRes.code },
			timeout: CLOUD_CALL_TIMEOUT_MS
		})
	} catch (e) {
		throw new Error(
			e.errMsg ||
				e.message ||
				'云函数调用失败：请确认已在 HBuilderX 关联 uniCloud-aliyun 并上传云函数 login-by-wx'
		)
	}

	if (res.errMsg && res.errMsg !== 'cloud.callFunction:ok' && res.errMsg !== 'callFunction:ok') {
		throw new Error(res.errMsg)
	}

	const payload = res.result
	if (!payload || payload.errCode !== 0) {
		const msg = (payload && payload.errMsg) || '登录失败'
		throw new Error(msg)
	}

	uni.setStorageSync(STORAGE_OPENID, payload.openid)
	uni.setStorageSync(STORAGE_USER_COUNT, payload.userCount || 0)
	uni.setStorageSync(STORAGE_LOGIN_AT, Date.now())
	markLoginSuccess()

	return {
		openid: payload.openid,
		userCount: payload.userCount || 0,
		isNew: !!payload.isNew
	}
}

/**
 * 使用对比、报告等能力前调用：已登录返回 true；未登录则弹窗，点「去登录」跳转登录页并返回 false。
 * @param {{ title?: string, content?: string }} [options]
 */
export function ensureLoggedInOrPrompt(options) {
	if (getStoredOpenid()) return Promise.resolve(true)
	const title = (options && options.title) || '需要登录'
	const content =
		(options && options.content) || '使用对比与报告功能前请先完成微信登录。'
	const returnUrl = (options && options.returnUrl) || buildCurrentPageUrl()
	return new Promise((resolve) => {
		uni.setStorageSync(STORAGE_LOGIN_RETURN_URL, returnUrl)
		uni.showModal({
			title,
			content,
			confirmText: '去登录',
			cancelText: '取消',
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
