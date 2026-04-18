# API中转站个人计算器

本项目是一个基于 `uni-app + uniCloud` 的微信小程序，面向 API 中转站个人用户，帮助用户记录充值与消耗、对比不同站点成本，并生成可回看的性价比报告。

仓库内部历史名称为 `api-calculator-h5 / 性价比助手`，小程序对外名称统一为：

`API中转站个人计算器`

## 项目定位

这个小程序解决的是个人用户在多个 API 中转站之间做成本对比时的三个高频问题：

- 不同站点充值比例不同，真实人民币成本不好直接比较
- 一段时间后很难回忆“当时为什么选了 A 站或 B 站”
- 记录分散在聊天、表格、截图里，后续无法持续复盘

因此项目提供：

- 双站点 A/B 对比计算
- 报告生成与历史追踪
- 登录后的云端同步
- 推荐站点浏览
- 个人资料、头像、昵称维护

## 核心能力

### 1. 双站点成本对比

支持输入两个站点的充值数据与用量记录，自动计算：

- 充值比例：`充值金额(¥) / 获得额度($)`
- 单条记录人民币成本：`消耗额度($) × 充值比例`
- 总 Tokens 消耗
- 每 1K Tokens 人民币均价

核心算法位于：

- [calculator.js](D:/项目/api-calculator-h5/common/calculator.js)

### 2. 报告生成

生成报告后可展示：

- 哪个站点更具性价比
- 预计节省比例与节省金额
- 两站单价对比
- 充值与消耗汇总
- 数据可信度评分

### 3. 历史记录

支持保存每次报告对应的：

- 报告摘要
- 当时的 A/B 站点配置
- 报告快照

并支持：

- 查看历史报告
- 恢复历史配置继续计算
- 删除记录

说明：

- 已登录时，记录会同步到云端
- 未登录时，不展示用户历史记录
- 退出登录时会清空本地报告缓存，避免残留上一个用户的数据

### 4. 推荐站点页

推荐页支持：

- 按模型/分组浏览推荐站点
- 搜索站点
- 顶部分类快速跳转
- 后台同步推荐数据

相关逻辑位于：

- [recommend.vue](D:/项目/api-calculator-h5/pages/recommend/recommend.vue)
- [recommend-data.js](D:/项目/api-calculator-h5/common/recommend-data.js)

### 5. 用户资料

登录后可维护：

- 微信头像
- 用户昵称
- 管理员状态

相关逻辑位于：

- [mine.vue](D:/项目/api-calculator-h5/pages/mine/mine.vue)
- [user-profile 云函数](D:/项目/api-calculator-h5/uniCloud-aliyun/cloudfunctions/user-profile/index.js)

## 页面结构

当前页面定义位于：

- [pages.json](D:/项目/api-calculator-h5/pages.json)

主要页面如下：

- `pages/index/index`
  - 首页计算页
  - 输入 A/B 站点充值与使用记录
- `pages/report/report`
  - 报告详情页
- `pages/records/records`
  - 历史记录页
- `pages/recommend/recommend`
  - 推荐站点页
- `pages/mine/mine`
  - 个人中心
- `pages/login/login`
  - 微信登录页
- `pages/agreement/service`
  - 用户服务协议
- `pages/agreement/privacy`
  - 隐私政策
- `pages/test-cases/test-cases`
  - 测试案例页

## 技术栈

- `uni-app`
- `Vue 3 <script setup>`
- 微信小程序
- `uniCloud` 阿里云空间
- 云函数
- 云数据库

## 目录说明

### 前端目录

- `pages/`
  - 页面入口
- `components/`
  - 复用组件
- `common/`
  - 业务逻辑、数据结构、工具函数、存储逻辑
- `static/`
  - 静态资源

### 云端目录

- `uniCloud-aliyun/cloudfunctions/`
  - 云函数
- `uniCloud-aliyun/database/`
  - 数据表 schema

### 辅助目录

- `docs/`
  - 推荐站点种子数据
- `scripts/`
  - 数据抓取或辅助脚本

## 云函数说明

当前项目使用的云函数包括：

- `login-by-wx`
  - 微信登录
  - 写入 `calc_users`
  - 记录登录日志
- `user-profile`
  - 读取/写入头像
  - 读取/写入昵称
  - 返回管理员状态
- `compare-data`
  - 保存/读取首页 A/B 草稿
- `report-records`
  - 报告记录增删查
- `case-favorites`
  - 收藏案例
- `recommend-data`
  - 推荐站点列表
  - 推荐数据同步与去重

每次修改云函数后，都需要重新上传部署到当前绑定的 `uniCloud` 空间。

## 数据库表

项目目前涉及的主要数据集合：

- `calc_users`
  - 用户表
  - 包含 `openid / unionid / nickname / avatar_fileid / isAdmin` 等字段
- `calc_login_logs`
  - 登录日志
- `calc_user_compare`
  - 用户对比草稿
- `calc_report_records`
  - 报告历史
- `calc_case_favorites`
  - 案例收藏
- `calc_recommend_sites`
  - 推荐站点数据

Schema 文件位于：

- [database 目录](D:/项目/api-calculator-h5/uniCloud-aliyun/database)

## 登录、协议与隐私

为了满足微信审核要求，登录页已经调整为合规流程：

- 默认不勾选协议
- 用户必须主动勾选后才能点击登录
- 登录页可点击查看《用户服务协议》《隐私政策》全文
- 未勾选时不会允许直接登录

相关文件：

- [login.vue](D:/项目/api-calculator-h5/pages/login/login.vue)
- [service.vue](D:/项目/api-calculator-h5/pages/agreement/service.vue)
- [privacy.vue](D:/项目/api-calculator-h5/pages/agreement/privacy.vue)

## 本地开发

### 方式一：HBuilderX

这是本项目推荐的开发方式。

1. 用 `HBuilderX` 打开项目根目录
2. 绑定正确的 `uniCloud-aliyun` 服务空间
3. 上传数据库 schema
4. 上传并部署相关云函数
5. 运行到微信开发者工具进行调试

### 方式二：仅代码阅读

如果只是理解结构或做纯前端改动，可以直接查看：

- `pages/`
- `components/`
- `common/`

但涉及登录、记录同步、推荐数据时，仍需要配合 `uniCloud` 环境验证。

## 首次部署清单

新环境建议按下面顺序配置：

1. 创建并绑定 `uniCloud-aliyun` 空间
2. 上传 `uniCloud-aliyun/database/` 下的 schema
3. 配置并上传 `login-by-wx`
   - 复制 `config.example.json` 为 `config.json`
   - 填写微信小程序 `appId / appSecret`
4. 上传以下云函数
   - `login-by-wx`
   - `user-profile`
   - `compare-data`
   - `report-records`
   - `case-favorites`
   - `recommend-data`
5. 在微信公众平台补齐合法域名与隐私配置
6. 使用微信开发者工具真机调试登录、记录、推荐页

## 提审前自查

建议在提交审核前至少检查以下项目：

- 登录页是否默认未勾选协议
- 《用户服务协议》《隐私政策》是否可正常打开
- 登录页是否有返回按钮
- 未登录时“记录页”是否为空
- 退出登录后是否清空本地用户历史
- 推荐页顶部搜索栏是否固定
- 顶部分类点击是否可跳转到对应分组
- 个人中心昵称是否能写入用户表

## 常见问题

### 1. 未登录为什么还能看到历史记录？

旧版本中，记录页会直接读本地缓存，退出登录也不会清空报告历史。当前版本已经修复：

- 未登录时记录页显示空列表
- 退出登录时清空本地报告历史与快照

### 2. 用户表为什么没有昵称？

旧版本只把昵称存在本地缓存，没有同步云端。当前版本已经补齐：

- `calc_users.nickname`
- `nickname_updated_at`
- `user-profile.set-nickname`

### 3. 推荐页顶部点击为什么不跳？

推荐页已改为：

- 顶部搜索栏固定
- 内容区独立滚动
- 分类跳转优先走 H5 原生滚动，其他端走 `scroll-into-view`

## 后续可继续完善

- 管理员后台化，而不只放在个人中心入口
- 报告分享卡片
- 更细的成本统计维度
- 推荐页筛选与排序
- 更完整的埋点与漏斗分析
- 自动化测试与提审清单脚本化

## 维护建议

如果后续继续扩展这个项目，建议遵循下面的约定：

- 页面状态尽量放在页面内，通用逻辑放 `common/`
- 和云端强绑定的能力统一经 `common/` 封装后再被页面调用
- 所有涉及提审的交互改动，都同步更新 README 的“提审前自查”
- 每次新增用户数据字段时，同时修改：
  - 前端调用
  - 云函数
  - 数据库 schema

---

如果你准备把这个仓库给别人接手，最重要的是让对方先理解三件事：

- 这是一个“个人 API 中转站成本对比工具”，不是开放平台
- 真实业务核心在 `common/calculator.js`
- 关键线上能力依赖 `uniCloud`，不是纯前端项目
