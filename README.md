# 旅程 Discord 开门提醒器 🍊

监控邀请：https://discord.gg/elysianhorizon

每约 5 分钟由 GitHub Actions 检查一次 Discord 邀请 API；当可识别的 `INVITES_DISABLED` 标志从“关闭”状态变为“开放”时，向自己的 Discord 频道发送消息。首次运行如果检测到“开放”也会通知一次。

> 这是邀请状态推断，不保证能成功入群。网络错误、403、404、缺少 features 等全部当作未知，不会误报“已开放”。GitHub Actions 的定时任务可能延迟或漏跑。

## 只需要你完成的配置

1. 打开仓库 Settings → Secrets and variables → Actions → **Secrets** → **New repository secret**。
2. Name: `DISCORD_WEBHOOK_URL`；Secret: 粘贴 Discord #插件 频道 Webhook URL。保存后不会公开显示。
3. 可选：在 Discord 开启开发者模式，复制**自己的用户 ID（数字）**；GitHub 同一页面 **Variables** → **New repository variable**，名称 `DISCORD_USER_ID`，值是数字用户 ID。这将允许提醒 @ 你。也可以只为频道打开通知。
4. 打开仓库 **Actions → 旅程开门 Discord 提醒 → Run workflow**，勾选 `test_notification` 后运行。Discord 收到“测试成功”代表发送端配置好了；这**不代表社区已开放**。
5. 不勾选测试开关再手动运行一次，以检查真实邀请 API。打开具体运行记录，看 `Check invite / send optional test` 的日志。
6. 如需确保状态保存，仓库 Settings → Actions → General → Workflow permissions 设置 **Read and write permissions**（如果页面允许）。配置文件已含 `contents: write`；但组织或仓库级限制仍可能阻止推送状态文件。
7. 启用手机 Discord 通知，并检查该频道没有静音。

## 说明

- 工作流位于 `.github/workflows/journey-watch.yml`，定时表达式 `2-59/5 * * * *`（每小时 02、07、12……分钟）；GitHub 不保证严格运行时间。
- `watch.py` 读取私密 Webhook Secret，调用 Discord 公开邀请接口并发送消息。
- `state.json` 用 GitHub 提交保存已识别状态，以避免持续重复刷屏。
- 如果不再需要监控，可在 Actions 页面禁用工作流。
- 千万不要把 Webhook URL 上传到公开代码、Issue 或聊天截图中。
