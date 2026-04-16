export type UsageRow = {
	inputTokens: string
	outputTokens: string
	costUsd: string
}

export type SiteConfig = {
	rechargeCny: string
	quotaUsd: string
	rows: UsageRow[]
}

export const initialSiteA = (): SiteConfig => ({
	rechargeCny: '',
	quotaUsd: '',
	rows: [{ inputTokens: '', outputTokens: '', costUsd: '' }]
})

export const initialSiteB = (): SiteConfig => ({
	rechargeCny: '',
	quotaUsd: '',
	rows: [{ inputTokens: '', outputTokens: '', costUsd: '' }]
})
