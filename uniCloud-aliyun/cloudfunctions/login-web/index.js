'use strict'

const crypto = require('crypto')

const db = uniCloud.database()
const USERS = 'calc_users'
const LOGIN_LOGS = 'calc_login_logs'
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
const PASSWORD_ITERATIONS = 100000
const PASSWORD_KEY_LENGTH = 64
const PASSWORD_DIGEST = 'sha512'

function normalizeUsername(value) {
	return String(value || '')
		.trim()
		.replace(/\s+/g, '')
}

function validateUsername(username) {
	return /^[a-zA-Z][a-zA-Z0-9_]{3,23}$/.test(username)
}

function validatePassword(password) {
	return typeof password === 'string' && password.length >= 6 && password.length <= 64
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
			return nickname
		}
	}
	return generateRandomEnglishUsername(10)
}

function createPasswordSalt() {
	return crypto.randomBytes(16).toString('hex')
}

function hashPassword(password, salt) {
	return crypto.pbkdf2Sync(password, salt, PASSWORD_ITERATIONS, PASSWORD_KEY_LENGTH, PASSWORD_DIGEST).toString('hex')
}

function isPasswordValid(password, salt, expectedHash) {
	const digest = hashPassword(password, salt)
	const left = Buffer.from(String(digest || ''), 'hex')
	const right = Buffer.from(String(expectedHash || ''), 'hex')
	if (!left.length || left.length !== right.length) return false
	return crypto.timingSafeEqual(left, right)
}

function generateSessionToken() {
	return crypto.randomBytes(24).toString('hex')
}

function hashSessionToken(token) {
	return crypto.createHash('sha256').update(String(token || '')).digest('hex')
}

function createWebUserId() {
	return `web_${Date.now().toString(36)}${crypto.randomBytes(4).toString('hex')}`
}

async function findUserByUsername(users, usernameKey) {
	const got = await users.where({ username_key: usernameKey }).limit(1).get()
	const rows = Array.isArray(got && got.data) ? got.data : []
	return rows[0] || null
}

async function countUsers(users) {
	try {
		const c = await users.count()
		return Number(c && c.total) || 0
	} catch (e) {
		return 0
	}
}

async function writeLoginLog(openid, isNew, loginType) {
	try {
		await db.collection(LOGIN_LOGS).add({
			openid,
			login_at: Date.now(),
			login_time: new Date().toLocaleString('zh-CN', {
				hour12: false,
				timeZone: 'Asia/Shanghai'
			}),
			is_new: !!isNew,
			login_type: String(loginType || 'web')
		})
	} catch (e) {
		console.error('[login-web] calc_login_logs add failed', e)
	}
}

async function buildLoginResult(user, isNew, userCount) {
	const sessionToken = generateSessionToken()
	const sessionTokenHash = hashSessionToken(sessionToken)
	const sessionExpiresAt = Date.now() + SESSION_TTL_MS

	await db.collection(USERS).doc(String(user._id || user.openid)).update({
		last_login: Date.now(),
		session_token_hash: sessionTokenHash,
		session_expires_at: sessionExpiresAt
	})

	await writeLoginLog(String(user.openid || user._id || ''), isNew, 'web')

	return {
		errCode: 0,
		openid: String(user.openid || user._id || ''),
		isNew: !!isNew,
		userCount: Number(userCount || 0),
		isAdmin: !!user.isAdmin,
		sessionToken,
		sessionExpiresAt
	}
}

exports.main = async (event) => {
	const action = String(event && event.action ? event.action : 'login').trim()
	const username = normalizeUsername(event && event.username)
	const password = String((event && event.password) || '')

	if (!validateUsername(username)) {
		return {
			errCode: 'INVALID_USERNAME',
			errMsg: '账号需为 4-24 位，以字母开头，可使用字母、数字和下划线'
		}
	}

	if (!validatePassword(password)) {
		return {
			errCode: 'INVALID_PASSWORD',
			errMsg: '密码长度需为 6-64 位'
		}
	}

	const users = db.collection(USERS)
	const usernameKey = username.toLowerCase()

	try {
		if (action === 'register') {
			const existing = await findUserByUsername(users, usernameKey)
			if (existing) {
				return { errCode: 'USERNAME_EXISTS', errMsg: '该账号已被注册' }
			}

			const userId = createWebUserId()
			const salt = createPasswordSalt()
			const passwordHash = hashPassword(password, salt)
			const nickname = await generateUniqueDefaultNickname(users)
			const now = Date.now()

			await users.doc(userId).set({
				openid: userId,
				username,
				username_key: usernameKey,
				nickname,
				login_type: 'web',
				password_salt: salt,
				password_hash: passwordHash,
				isAdmin: false,
				create_date: now,
				last_login: now,
				session_token_hash: '',
				session_expires_at: 0
			})

			const userCount = await countUsers(users)
			return buildLoginResult(
				{
					_id: userId,
					openid: userId,
					isAdmin: false
				},
				true,
				userCount
			)
		}

		if (action === 'login') {
			const user = await findUserByUsername(users, usernameKey)
			if (!user || String(user.login_type || 'web') !== 'web') {
				return { errCode: 'ACCOUNT_NOT_FOUND', errMsg: '账号或密码错误' }
			}

			if (!isPasswordValid(password, String(user.password_salt || ''), String(user.password_hash || ''))) {
				return { errCode: 'INVALID_CREDENTIALS', errMsg: '账号或密码错误' }
			}

			const userCount = await countUsers(users)
			return buildLoginResult(user, false, userCount)
		}

		return { errCode: 'INVALID_ACTION', errMsg: 'unsupported action' }
	} catch (e) {
		return { errCode: 'DB_ERROR', errMsg: e.message || 'web login failed' }
	}
}
