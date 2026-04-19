'use strict'

const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const cloudFnDir = path.join(projectRoot, 'uniCloud-aliyun', 'cloudfunctions', 'community-data')
const outputFile = path.join(cloudFnDir, 'sensitive-word-seeds.js')
const lexiconTempDir = process.env.SENSITIVE_LEXICON_DIR || path.join(process.env.TEMP || '', 'Sensitive-lexicon', 'Vocabulary')

const { COMMUNITY_REVIEW_KEYWORDS, COMMUNITY_REJECT_KEYWORDS } = require(path.join(cloudFnDir, 'sensitive-lexicon.js'))

const SOURCE_FILE_CONFIG = {
	'COVID-19词库.txt': { level: 'review', scopes: ['comment'], category: 'covid' },
	'GFW补充词库.txt': { level: 'review', scopes: ['comment'], category: 'general' },
	'其他词库.txt': { level: 'review', scopes: ['comment'], category: 'general' },
	'反动词库.txt': { level: 'review', scopes: ['comment'], category: 'politics' },
	'广告类型.txt': { level: 'review', scopes: ['comment', 'post'], category: 'ad' },
	'政治类型.txt': { level: 'review', scopes: ['comment'], category: 'politics' },
	'新思想启蒙.txt': { level: 'review', scopes: ['comment'], category: 'politics' },
	'暴恐词库.txt': { level: 'review', scopes: ['comment', 'post'], category: 'terror' },
	'民生词库.txt': { level: 'review', scopes: ['comment'], category: 'general' },
	'涉枪涉爆.txt': { level: 'review', scopes: ['comment', 'post'], category: 'weapon' },
	'网易前端过滤敏感词库.txt': { level: 'review', scopes: ['comment'], category: 'general' },
	'色情类型.txt': { level: 'review', scopes: ['comment', 'post'], category: 'porn' },
	'色情词库.txt': { level: 'review', scopes: ['comment', 'post'], category: 'porn' },
	'补充词库.txt': { level: 'review', scopes: ['comment'], category: 'general' },
	'贪腐词库.txt': { level: 'review', scopes: ['comment'], category: 'politics' },
	'零时-Tencent.txt': { level: 'review', scopes: ['comment'], category: 'general' },
	'非法网址.txt': { level: 'review', scopes: ['comment', 'post'], category: 'url' }
}

function escapeWord(value) {
	return JSON.stringify(String(value))
}

function sanitizeWords(words) {
	return Array.from(
		new Set(
			(words || [])
				.map((item) => String(item || '').trim())
				.filter(Boolean)
				.filter((item) => item.length >= 2)
				.filter((item) => !/[=><]/.test(item))
		)
	).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))
}

function readLines(filePath) {
	return sanitizeWords(
		fs.readFileSync(filePath, 'utf8').split(/\r?\n/)
	)
}

function createSourceDoc({ sourceKey, sourceName, category, level, scopes, words, sourceType }) {
	return {
		sourceKey,
		sourceName,
		sourceType,
		category,
		level,
		scopes,
		words: sanitizeWords(words)
	}
}

function getLocalSourceDocs() {
	if (!fs.existsSync(lexiconTempDir)) {
		throw new Error(`未找到本地敏感词目录: ${lexiconTempDir}`)
	}

	const files = fs.readdirSync(lexiconTempDir).filter((file) => file.endsWith('.txt')).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))
	return files.map((file) => {
		const config = SOURCE_FILE_CONFIG[file] || { level: 'review', scopes: ['comment'], category: 'general' }
		return createSourceDoc({
			sourceKey: `local-${file.replace(/\.txt$/i, '').replace(/[^\w\u4e00-\u9fa5-]+/g, '-').toLowerCase()}`,
			sourceName: file.replace(/\.txt$/i, ''),
			sourceType: 'local-file',
			category: config.category,
			level: config.level,
			scopes: config.scopes,
			words: readLines(path.join(lexiconTempDir, file))
		})
	})
}

function buildSeedDocs() {
	const docs = [
		createSourceDoc({
			sourceKey: 'project-review',
			sourceName: '项目内置审核词',
			sourceType: 'project',
			category: 'project',
			level: 'review',
			scopes: ['comment', 'post'],
			words: COMMUNITY_REVIEW_KEYWORDS
		}),
		createSourceDoc({
			sourceKey: 'project-reject',
			sourceName: '项目内置高风险词',
			sourceType: 'project',
			category: 'project',
			level: 'reject',
			scopes: ['comment', 'post'],
			words: COMMUNITY_REJECT_KEYWORDS
		}),
		...getLocalSourceDocs()
	]

	return docs
}

function renderModule(docs) {
	const renderedDocs = docs.map((doc) => {
		const words = doc.words.map((word) => `\t\t${escapeWord(word)}`).join(',\n')
		const scopes = doc.scopes.map((scope) => `\t\t${escapeWord(scope)}`).join(',\n')
		return [
			'\t{',
			`\t\tsourceKey: ${escapeWord(doc.sourceKey)},`,
			`\t\tsourceName: ${escapeWord(doc.sourceName)},`,
			`\t\tsourceType: ${escapeWord(doc.sourceType)},`,
			`\t\tcategory: ${escapeWord(doc.category)},`,
			`\t\tlevel: ${escapeWord(doc.level)},`,
			'\t\tscopes: [',
			scopes,
			'\t\t],',
			'\t\twords: [',
			words,
			'\t\t]',
			'\t}'
		].join('\n')
	}).join(',\n')

	return `'use strict'\n\n/**\n * 本文件由 tools/build-sensitive-word-seeds.js 自动生成。\n * 来源：项目内置敏感词 + 本机 Sensitive-lexicon 本地 txt 词库。\n */\n\nconst SENSITIVE_WORD_SEED_DOCS = [\n${renderedDocs}\n]\n\nmodule.exports = {\n\tSENSITIVE_WORD_SEED_DOCS\n}\n`
}

function main() {
	const docs = buildSeedDocs()
	fs.writeFileSync(outputFile, renderModule(docs), 'utf8')
	const totalWordCount = docs.reduce((sum, doc) => sum + doc.words.length, 0)
	console.log(JSON.stringify({
		outputFile,
		sourceCount: docs.length,
		totalWordCount
	}, null, 2))
}

main()
