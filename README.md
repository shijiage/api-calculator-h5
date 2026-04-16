# 性价比助手（api-calculator-h5）

基于 uni-app 的微信小程序项目，用于对比两个 API 站点（A/B）的使用成本，生成性价比报告，并支持记录存储与恢复对比。

## 核心功能

- 双站点成本对比（A/B）
  - 充值比例（CNY/$）
  - 实际人民币花费
  - 每 1K Tokens 均价
- 报告生成与展示
  - 性价比结论
  - 成本/用量汇总
  - 数据可信度评分（可量化）
- 记录管理
  - 本地 + 云端历史记录
  - 恢复历史配置继续对比
  - 删除记录（本地删除 + 云端重试）
- 登录与用户体系
  - 微信登录（uniCloud 云函数）
  - 登录日志、用户统计
- 环境与可用性
  - 云函数环境自检
  - 关键动作失败可重试

## 技术栈

- uni-app（Vue 3）
- 微信小程序
- uniCloud（阿里云空间）
- 云函数 + 云数据库

## 主要目录

- `pages/`：页面（计算、报告、记录、我的、登录、测试案例）
- `components/`：通用组件
- `common/`：业务逻辑与工具（计算、鉴权、记录、埋点、环境自检）
- `uniCloud-aliyun/cloudfunctions/`：云函数
- `uniCloud-aliyun/database/`：数据库 schema

## 云函数

- `login-by-wx`：微信登录、用户统计、登录日志
- `compare-data`：用户 A/B 草稿存取
- `report-records`：报告记录增删查

> 修改云函数后需重新上传部署到对应 uniCloud 空间。

## 数据集合（uniCloud）

- `calc_users`
- `calc_login_logs`
- `calc_user_compare`
- `calc_report_records`

## 本地开发

1. 使用 HBuilderX 打开项目根目录  
2. 关联正确的 `uniCloud-aliyun` 服务空间  
3. 上传并部署所需云函数  
4. 微信开发者工具预览调试

## 体验版/线上注意事项

- 在微信公众平台配置 request 合法域名（按实际报错域名为准）
- 常见域名示例：
  - `https://list.api.next.bspapp.com`
  - `https://api.next.bspapp.com`
- 确保体验版对应的 AppID 与域名配置后台一致

## 当前状态

项目已具备可用的登录、计算、报告、记录、恢复、删除、分享与基础埋点能力，可继续围绕数据上报与增长分析完善。
