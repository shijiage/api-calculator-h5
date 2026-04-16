<template>
	<view class="profile">
		<view class="profile__avatar-wrap">
			<!-- #ifdef MP-WEIXIN -->
			<button
				v-if="enableWxAvatar"
				class="profile__avatar-btn"
				hover-class="none"
				open-type="chooseAvatar"
				@chooseavatar="onChooseAvatar"
			>
				<view class="profile__avatar">
					<image v-if="avatarUrl" class="profile__avatar-img" :src="avatarUrl" mode="aspectFill" />
					<uni-icons v-else type="person-filled" size="72rpx" color="#1a4a9e" />
				</view>
			</button>
			<view v-else class="profile__avatar">
				<image v-if="avatarUrl" class="profile__avatar-img" :src="avatarUrl" mode="aspectFill" />
				<uni-icons v-else type="person-filled" size="72rpx" color="#1a4a9e" />
			</view>
			<!-- #endif -->
			<!-- #ifndef MP-WEIXIN -->
			<view class="profile__avatar">
				<image v-if="avatarUrl" class="profile__avatar-img" :src="avatarUrl" mode="aspectFill" />
				<uni-icons v-else type="person-filled" size="72rpx" color="#1a4a9e" />
			</view>
			<!-- #endif -->
			<view class="profile__badge">
				<uni-icons type="checkmarkempty" size="20rpx" color="#ffffff" />
			</view>
		</view>
		<text class="profile__hint" v-if="enableWxAvatar">{{
			avatarUrl ? '轻点头像可更换' : '轻点头像，使用微信头像'
		}}</text>
		<!-- #ifdef MP-WEIXIN -->
		<input
			v-if="enableWxAvatar"
			class="profile__name profile__name--input"
			type="nickname"
			:value="nickname"
			placeholder="轻点填写或使用微信昵称"
			maxlength="32"
			@blur="onNicknameBlur"
			@confirm="onNicknameBlur"
		/>
		<text v-else class="profile__name">{{ nickname }}</text>
		<!-- #endif -->
		<!-- #ifndef MP-WEIXIN -->
		<text class="profile__name">{{ nickname }}</text>
		<!-- #endif -->
		<text class="profile__uid">UID: {{ uidDisplay }}</text>
	</view>
</template>

<script setup>
defineProps({
	nickname: { type: String, required: true },
	uidDisplay: { type: String, required: true },
	avatarUrl: { type: String, default: '' },
	/** 已登录时在微信端展示「选择头像」与「昵称」能力 */
	enableWxAvatar: { type: Boolean, default: false }
})

const emit = defineEmits(['avatarChange', 'nicknameChange'])

function onChooseAvatar(e) {
	const url = e.detail && e.detail.avatarUrl ? String(e.detail.avatarUrl) : ''
	if (url) emit('avatarChange', url)
}

function onNicknameBlur(e) {
	const raw =
		e.detail && (e.detail.value !== undefined && e.detail.value !== null)
			? e.detail.value
			: ''
	emit('nicknameChange', String(raw).trim())
}
</script>

<style scoped lang="scss">
.profile {
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 8rpx 0 32rpx;
}

.profile__avatar-wrap {
	position: relative;
	margin-bottom: 12rpx;
}

.profile__avatar-btn {
	margin: 0;
	padding: 0;
	background: transparent;
	border: none;
	line-height: 0;
	border-radius: 28rpx;
	overflow: visible;
}

.profile__avatar-btn::after {
	border: none;
}

.profile__avatar {
	width: 160rpx;
	height: 160rpx;
	border-radius: 28rpx;
	background: linear-gradient(145deg, #e8f1ff 0%, #ffffff 100%);
	border: 4rpx solid rgba(26, 74, 158, 0.35);
	box-shadow: 0 8rpx 28rpx rgba(26, 74, 158, 0.18);
	display: flex;
	align-items: center;
	justify-content: center;
	overflow: hidden;
}

.profile__avatar-img {
	width: 100%;
	height: 100%;
	border-radius: 24rpx;
}

.profile__badge {
	position: absolute;
	right: -4rpx;
	bottom: -4rpx;
	width: 44rpx;
	height: 44rpx;
	border-radius: 50%;
	background: #1a4a9e;
	border: solid 4rpx #ffffff;
	display: flex;
	align-items: center;
	justify-content: center;
}

.profile__hint {
	font-size: 22rpx;
	color: #9aa0ab;
	margin-bottom: 8rpx;
}

.profile__name {
	font-size: 40rpx;
	font-weight: 700;
	color: #1a1d24;
}

.profile__name--input {
	width: 92%;
	max-width: 520rpx;
	min-height: 56rpx;
	line-height: 1.35;
	text-align: center;
	background: transparent;
	border: none;
	padding: 8rpx 12rpx;
	box-sizing: border-box;
}

.profile__name--input::placeholder {
	color: #9aa0ab;
	font-weight: 500;
}

.profile__uid {
	margin-top: 12rpx;
	font-size: 24rpx;
	color: #9aa0ab;
}
</style>
