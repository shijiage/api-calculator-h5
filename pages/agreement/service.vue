<template>
	<view class="page">
		<scroll-view class="scroll" scroll-y :show-scrollbar="false">
			<text class="title">用户服务协议</text>
			<text class="time">更新日期：2026-04-18</text>

			<text class="section">1. 服务说明</text>
			<text class="paragraph">“性价比助手”提供 API 成本对比、报告生成、记录同步等工具能力，供用户自行记录和分析使用。</text>

			<text class="section">2. 用户使用规范</text>
			<text class="paragraph">用户应合法、合规地使用本小程序，不得利用本服务从事违法违规活动，不得干扰服务正常运行。</text>

			<text class="section">3. 账号说明</text>
			<text class="paragraph">本小程序通过微信登录识别用户身份，仅用于区分个人数据与提供同步能力。用户应妥善保管自己的微信账号。</text>

			<text class="section">4. 数据与责任</text>
			<text class="paragraph">用户填写、上传或同步的数据由用户自行负责。我们会尽力保障服务稳定，但不对因网络、平台或第三方原因导致的数据异常承担无限责任。</text>

			<text class="section">5. 协议变更</text>
			<text class="paragraph">如协议条款发生调整，我们会在页面更新内容。用户继续使用服务即视为理解并接受更新后的协议。</text>

			<view class="bottom-pad" />
		</scroll-view>
	</view>
</template>

<style scoped lang="scss">
.page {
	min-height: 100vh;
	background: #f7f8fa;
}

.scroll {
	height: 100vh;
	padding: 40rpx 32rpx 0;
	box-sizing: border-box;
}

.title {
	display: block;
	font-size: 40rpx;
	font-weight: 700;
	color: #1a1d24;
}

.time {
	display: block;
	margin-top: 16rpx;
	font-size: 24rpx;
	color: #8c94a3;
}

.section {
	display: block;
	margin-top: 36rpx;
	font-size: 30rpx;
	font-weight: 700;
	color: #1f2430;
}

.paragraph {
	display: block;
	margin-top: 14rpx;
	font-size: 27rpx;
	line-height: 1.8;
	color: #4d5562;
}

.bottom-pad {
	height: 60rpx;
}
</style>
