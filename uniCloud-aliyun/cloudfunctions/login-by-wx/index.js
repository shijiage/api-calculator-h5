'use strict'

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

/**
 * 微信小程序 code 换 openid，并写入用户表、返回当前用户总数。
 * 本函数在 **uniCloud-aliyun** 目录下，用 HBuilderX 上传部署。
 *
 * 【阿里云控制台通常没有「环境变量」入口】请在本云函数目录下配置密钥：
 * 1. 复制 config.example.json 为 config.json
 * 2. 填写 appId、appSecret（勿把 config.json 提交到 Git，已写入 .gitignore）
 * 3. 右键 login-by-wx 上传部署（config.json 会随云函数一起上传，仅存在于云端）
 *
 * 若你使用腾讯云空间且已在控制台配置环境变量，仍可读 process.env.WX_APPID / WX_SECRET（见下方兼容）。
 *
 * 数据库：
 *   - calc_users：用户（openid 为文档 _id）
 *   - calc_login_logs：每次成功登录一条日志，含可读时间与时间戳
 */
const db = uniCloud.database()
const USERS = 'calc_users'
const LOGIN_LOGS = 'calc_login_logs'
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

/** 东八区可读时间，便于在云数据库控制台查看 */
function formatLoginTime(ms) {
	try {
		return new Date(ms).toLocaleString('zh-CN', {
			hour12: false,
			timeZone: 'Asia/Shanghai'
		})
	} catch (e) {
		return new Date(ms).toISOString()
	}
}

function loadWxCredentials() {
	let fileCfg = {}
	try {
		const p = path.join(__dirname, 'config.json')
		if (fs.existsSync(p)) {
			fileCfg = JSON.parse(fs.readFileSync(p, 'utf8'))
		}
	} catch (e) {
		// ignore
	}
	const appId = String(fileCfg.appId || fileCfg.WX_APPID || process.env.WX_APPID || '').trim()
	const appSecret = String(fileCfg.appSecret || fileCfg.WX_SECRET || process.env.WX_SECRET || '').trim()
	return { appId, appSecret }
}

function generateRandomEnglishUsername(length = 10) {
	const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
	let username = ''
	for (let i = 0; i < length; i += 1) {
		username += letters.charAt(Math.floor(Math.random() * letters.length))
	}
	return username
}

async function generateUniqueDefaultNickname(users, maxAttempts = 8) {
	for (let i = 0; i < maxAttempts; i += 1) {
		const nickname = generateRandomEnglishUsername(10)
		try {
			const exists = await users.where({ nickname }).limit(1).get()
			const rows = Array.isArray(exists && exists.data) ? exists.data : []
			if (!rows.length) return nickname
		} catch (e) {
			// 昵称查重失败时退化为直接使用当前随机值，避免阻塞注册流程。
			return nickname
		}
	}
	return generateRandomEnglishUsername(10)
}

function generateSessionToken() {
	return crypto.randomBytes(24).toString('hex')
}

function hashSessionToken(token) {
	return crypto.createHash('sha256').update(String(token || '')).digest('hex')
}

exports.main = async (event) => {
	if (event && event.action === 'health') {
		const { appId: APPID, appSecret: SECRET } = loadWxCredentials()
		return {
			errCode: 0,
			service: 'login-by-wx',
			ok: true,
			configReady: !!(APPID && SECRET),
			serverTime: Date.now()
		}
	}

	const code = event.code
	if (!code) {
		return { errCode: 'INVALID_PARAM', errMsg: '缺少 code' }
	}

	const { appId: APPID, appSecret: SECRET } = loadWxCredentials()
	if (!APPID || !SECRET) {
		return {
			errCode: 'SERVER_CONFIG',
			errMsg:
				'未配置微信密钥：请在 login-by-wx 目录下复制 config.example.json 为 config.json 并填写 appId、appSecret 后重新上传云函数（阿里云控制台一般无环境变量项）'
		}
	}

	const url =
		'https://api.weixin.qq.com/sns/jscode2session?appid=' +
		encodeURIComponent(APPID) +
		'&secret=' +
		encodeURIComponent(SECRET) +
		'&js_code=' +
		encodeURIComponent(code) +
		'&grant_type=authorization_code'

	const http = await uniCloud.httpclient.request(url, {
		method: 'GET',
		dataType: 'json',
		timeout: 10000
	})

	const body = http.data || {}
	if (body.errcode) {
		return {
			errCode: 'WX_API',
			errMsg: body.errmsg || '微信接口错误',
			detail: body
		}
	}

	const openid = body.openid
	const unionid = body.unionid

	if (!openid) {
		return { errCode: 'WX_NO_OPENID', errMsg: '未获取到 openid', detail: body }
	}

	const users = db.collection(USERS)
	const now = Date.now()
	const sessionToken = generateSessionToken()
	const sessionTokenHash = hashSessionToken(sessionToken)
	const sessionExpiresAt = now + SESSION_TTL_MS
	let isNew = false
	let isAdmin = false

	try {
		const got = await users.doc(openid).get()
		const doc = got.data && (Array.isArray(got.data) ? got.data[0] : got.data)
		const exists = !!(doc && (doc._id || doc.openid))
		if (!exists) {
			isNew = true
			const nickname = await generateUniqueDefaultNickname(users)
			await users.doc(openid).set({
				openid,
				unionid: unionid || '',
				nickname,
				isAdmin: false,
				create_date: now,
				last_login: now,
				session_token_hash: sessionTokenHash,
				session_expires_at: sessionExpiresAt
			})
		} else {
			isAdmin = !!doc.isAdmin
			const patch = {
				last_login: now,
				session_token_hash: sessionTokenHash,
				session_expires_at: sessionExpiresAt
			}
			if (unionid) patch.unionid = unionid
			await users.doc(openid).update(patch)
		}
	} catch (e) {
		return { errCode: 'DB_ERROR', errMsg: e.message || '数据库错误' }
	}

	// 登录日志（带时间）；失败不影响登录主流程
	try {
		await db.collection(LOGIN_LOGS).add({
			openid,
			login_at: new Date(now),
			login_time: formatLoginTime(now),
			is_new: isNew
		})
	} catch (logErr) {
		console.error('[login-by-wx] calc_login_logs add failed', logErr)
	}

	let userCount = 0
	try {
		const c = await users.count()
		userCount = c.total
	} catch (e) {
		userCount = isNew ? 1 : 0
	}

	return {
		errCode: 0,
		openid,
		isNew,
		userCount,
		isAdmin,
		sessionToken,
		sessionExpiresAt
	}
}
