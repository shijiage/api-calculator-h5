import { CLOUD_CALL_TIMEOUT_MS } from '@/common/data.js'

async function checkFunction(name, data = {}) {
	try {
		const res = await uniCloud.callFunction({
			name,
			data: { action: 'health', ...data },
			timeout: CLOUD_CALL_TIMEOUT_MS
		})
		const payload = res && res.result ? res.result : null
		if (!payload || payload.errCode !== 0) {
			return {
				name,
				ok: false,
				reason: (payload && payload.errMsg) || '返回异常'
			}
		}
		return {
			name,
			ok: true,
			detail: payload
		}
	} catch (e) {
		return {
			name,
			ok: false,
			reason: e && (e.errMsg || e.message) ? e.errMsg || e.message : '调用失败'
		}
	}
}

export async function runEnvSelfCheck() {
	const [login, compare, report, favorites] = await Promise.all([
		checkFunction('login-by-wx'),
		checkFunction('compare-data'),
		checkFunction('report-records'),
		checkFunction('case-favorites')
	])
	return { login, compare, report, favorites }
}

export function formatEnvSelfCheckText(result) {
	const lines = []
	const order = [
		['login-by-wx', result.login],
		['compare-data', result.compare],
		['report-records', result.report],
		['case-favorites', result.favorites]
	]
	for (const [name, item] of order) {
		if (!item || !item.ok) {
			lines.push(`- ${name}: 异常（${(item && item.reason) || '未知原因'}）`)
		} else {
			const ext =
				name === 'login-by-wx' && item.detail && item.detail.configReady === false
					? '，但未检测到微信密钥配置'
					: ''
			lines.push(`- ${name}: 正常${ext}`)
		}
	}
	lines.push('')
	lines.push('若异常：请确认已关联 uniCloud 空间，并上传对应云函数。')
	return lines.join('\n')
}
