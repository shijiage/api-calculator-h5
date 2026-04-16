'use strict'

/**
 * 用户资料（头像）：
 * - get-avatar: 读取 calc_users.avatar_fileid
 * - set-avatar: 下载微信头像 URL -> 上传 uniCloud 云存储 -> 写回 avatar_fileid
 */

const db = uniCloud.database()
const USERS = 'calc_users'

function getFirstHeader(headers, key) {
	if (!headers) return ''
	const lower = String(key || '').toLowerCase()
	for (const h of Object.keys(headers)) {
		if (String(h).toLowerCase() === lower) return headers[h]
	}
	return ''
}

function guessExtByUrl(url) {
	try {
		const m = String(url).match(/\.([a-zA-Z0-9]{1,5})(?:\?|#|$)/)
		if (m && m[1]) return String(m[1]).toLowerCase()
	} catch (e) {}
	return ''
}

function guessExtByContentType(contentType) {
	const ct = String(contentType || '').toLowerCase()
	if (ct.includes('png')) return 'png'
	if (ct.includes('jpeg') || ct.includes('jpg')) return 'jpg'
	if (ct.includes('webp')) return 'webp'
	if (ct.includes('gif')) return 'gif'
	return ''
}

exports.main = async (event) => {
	const { action, openid, avatarUrl } = event || {}

	if (action === 'health') {
		return { errCode: 0, service: 'user-profile', ok: true, serverTime: Date.now() }
	}

	if (!openid || String(openid).length < 8) {
		return { errCode: 'INVALID_PARAM', errMsg: 'invalid openid' }
	}

	const coll = db.collection(USERS)

	if (action === 'get-avatar') {
		try {
			const got = await coll.doc(openid).get()
			const doc = got && got.data ? got.data : null
			const fileID = doc && doc.avatar_fileid ? String(doc.avatar_fileid) : ''
			return { errCode: 0, fileID }
		} catch (e) {
			return { errCode: 'DB_ERROR', errMsg: e.message || 'get-avatar failed' }
		}
	}

	if (action === 'set-avatar-fileid') {
		const { fileID } = event || {}
		if (!fileID || typeof fileID !== 'string') {
			return { errCode: 'INVALID_PARAM', errMsg: 'missing fileID' }
		}

		// 文档可能不存在时（极端情况下），先 update 再 fallback 到 set
		try {
			await coll.doc(openid).update({
				avatar_fileid: String(fileID),
				avatar_updated_at: Date.now()
			})
		} catch (e) {
			try {
				await coll.doc(openid).set({
					openid,
					avatar_fileid: String(fileID),
					avatar_updated_at: Date.now()
				})
			} catch (e2) {
				return { errCode: 'DB_ERROR', errMsg: e2.message || 'write avatar_fileid failed' }
			}
		}
		return { errCode: 0, fileID: String(fileID) }
	}

	if (action === 'set-avatar') {
		if (!avatarUrl || typeof avatarUrl !== 'string') {
			return { errCode: 'INVALID_PARAM', errMsg: 'missing avatarUrl' }
		}

		// 1) 下载微信头像内容
		let httpRes
		try {
			httpRes = await uniCloud.httpclient.request(avatarUrl, {
				method: 'GET',
				dataType: 'arraybuffer',
				timeout: 15000
			})
		} catch (e) {
			return { errCode: 'WX_AVATAR_DOWNLOAD_FAILED', errMsg: e.message || 'download avatar failed' }
		}

		// 2) 转成 Buffer 以便 uploadFile
		let buffer = null
		try {
			const raw = httpRes && httpRes.data !== undefined ? httpRes.data : httpRes
			if (Buffer.isBuffer(raw)) buffer = raw
			else if (raw && raw instanceof ArrayBuffer) buffer = Buffer.from(raw)
			else buffer = Buffer.from(raw || '')
		} catch (e) {
			return { errCode: 'AVATAR_BUFFER_FAILED', errMsg: e.message || 'buffer convert failed' }
		}

		const contentType =
			(httpRes && (httpRes.header || httpRes.headers) && getFirstHeader(httpRes.header || httpRes.headers, 'content-type')) ||
			getFirstHeader(httpRes && httpRes.headers, 'content-type') ||
			''
		const ext =
			guessExtByContentType(contentType) || guessExtByUrl(avatarUrl) || (contentType ? 'jpg' : 'jpg')

		const cloudPath = `avatars/${openid}.${ext}`

		// 3) 写入云存储
		let up
		try {
			up = await uniCloud.uploadFile({
				cloudPath,
				fileContent: buffer
			})
		} catch (e) {
			return { errCode: 'UPLOAD_FAILED', errMsg: e.message || 'upload avatar failed' }
		}

		const fileID = up && up.fileID ? String(up.fileID) : ''
		if (!fileID) return { errCode: 'UPLOAD_FAILED', errMsg: 'upload result missing fileID' }

		// 4) 写回数据库（优先 update，避免 set 覆盖其他字段）
		try {
			await coll.doc(openid).update({
				avatar_fileid: fileID,
				avatar_updated_at: Date.now()
			})
		} catch (e) {
			// 文档可能不存在（极端情况下），退回 set
			try {
				await coll.doc(openid).set({
					openid,
					avatar_fileid: fileID,
					avatar_updated_at: Date.now()
				})
			} catch (e2) {
				return { errCode: 'DB_ERROR', errMsg: e2.message || 'write avatar_fileid failed' }
			}
		}

		return { errCode: 0, fileID }
	}

	return { errCode: 'UNKNOWN', errMsg: 'unknown action' }
}

