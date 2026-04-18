<template>
	<view class="page">
		<scroll-view class="scroll" scroll-y :show-scrollbar="false">
			<text class="title">隐私政策</text>
			<text class="time">更新日期：2026-04-18</text>

			<text class="section">1. 我们收集的信息</text>
			<text class="paragraph">在用户主动登录后，我们会收集微信 `openid`、可能填写的昵称、头像文件标识，以及用户在小程序内主动录入的对比记录、报告记录和收藏数据。</text>

			<text class="section">2. 信息使用目的</text>
			<text class="paragraph">收集的信息仅用于身份识别、个人资料展示、云端同步、功能统计和服务优化，不用于向第三方出售或共享用户个人信息。</text>

			<text class="section">3. 我们不会收集的信息</text>
			<text class="paragraph">本小程序不会主动收集手机号、身份证号、通讯录、短信、精确定位、相册等与当前服务无关的敏感信息。</text>

			<text class="section">4. 信息存储与保护</text>
			<text class="paragraph">用户数据存储于 uniCloud 云服务与本地缓存中，我们会采取合理措施保护数据安全。用户也可通过退出登录清除本地登录状态。</text>

			<text class="section">5. 用户权利</text>
			<text class="paragraph">用户可选择不同意本隐私政策并放弃登录；也可在后续停止使用相关登录能力。若需删除或更正云端资料，可联系运营者处理。</text>

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
