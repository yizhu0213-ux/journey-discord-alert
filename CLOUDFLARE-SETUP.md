# Cloudflare Workers 迁移：旅程 Discord 开门提醒器

这套方案改用 Cloudflare 的 Cron Triggers，每分钟检查一次，不再依赖 GitHub Actions 的定时调度。提醒仍发送到 yuzu 的 Discord 频道并 @ 用户。

> 代码已准备，但尚未部署到 Cloudflare。部署并完成配置前不会自动运行，旧 GitHub 版可以暂时保留。

## 配置步骤

1. 登录 https://dash.cloudflare.com/ ，进入 **Workers & Pages** 创建 Worker（例如 journey-invite-watch）。在 Edit Code / 编辑代码里用 **cloudflare-worker.js** 的完整内容替换并 Deploy。
2. 在 **Workers KV** 创建 namespace：`journey-watch-state`。回到 Worker **Settings → Bindings → Add → KV Namespace**，绑定变量名填写 `WATCH_STATE`，选择这个 namespace，保存并部署。
3. 在 Worker **Settings → Variables and Secrets** 添加 **Secret**：`DISCORD_WEBHOOK_URL`，值是原 Discord Webhook URL。密钥不要写在公开仓库，也不要发聊天。
4. 同一页创建文本 **Variable**：`DISCORD_USER_ID`，值是你的 Discord 数字用户 ID。可从原 GitHub 仓库 Variables 页面复制。
5. 在 Worker **Settings → Triggers → Cron Triggers** 添加 `* * * * *`（每分钟）。设置最多约 15 分钟后生效。
6. 到 **Settings → Trigger Events → View events** 查看运行记录，或打开部署后的 workers.dev 地址看 `last_known_state`。若显示 closed，说明已经检测到关闭。
7. 确认新 Worker 真正定时运行后，再到 GitHub **Actions → 旅程开门 Discord 提醒 → ⋯ → Disable workflow** 禁用旧版，避免重复通知。

## 检测方式

- 查询 Discord 邀请 API，发现 `INVITES_DISABLED` 即 closed。
- 如没发现此标志，10 秒后复核，连续两次判断 open 才发 @ 提醒。
- Workers KV 保存状态，同一次开放只通知一次；重新检测到 closed 后，下次开放会再次提醒。
- API 报错、限流、字段异常一律 unknown，不会当成开门。
- 无法 100% 保证可入群：邀请标志只是一条信号，社区还可能有其他限制。Cron 也不能保证秒级准时。

官方文档：https://developers.cloudflare.com/workers/configuration/cron-triggers/
KV 绑定：https://developers.cloudflare.com/kv/concepts/kv-namespaces/
