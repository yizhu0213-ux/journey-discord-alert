"""旅程社区 Discord 邀请开门提醒器。使用公开邀请接口，不需要 Discord 登录令牌。"""
from __future__ import annotations

import json
import os
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

INVITE_CODE = "elysianhorizon"
INVITE_URL = f"https://discord.gg/{INVITE_CODE}"
API_URL = f"https://discord.com/api/v10/invites/{INVITE_CODE}?with_counts=true"
STATE_FILE = Path(__file__).with_name("state.json")
HEADERS = {"Accept": "application/json", "User-Agent": "JourneyCommunityInviteWatch/1.0"}


def get_invite_status() -> str:
    request = Request(API_URL, headers=HEADERS)
    try:
        with urlopen(request, timeout=20) as response:
            payload = json.load(response)
    except HTTPError as error:
        print(f"Discord API HTTP {error.code}; 不作为开门信号。")
        return "unknown"
    except (URLError, TimeoutError, ValueError, OSError) as error:
        print(f"Discord API 请求异常：{type(error).__name__}；不作为开门信号。")
        return "unknown"

    if not isinstance(payload, dict) or str(payload.get("code", "")).lower() != INVITE_CODE:
        print("邀请码与预期不符，跳过。")
        return "unknown"
    guild = payload.get("guild")
    features = guild.get("features") if isinstance(guild, dict) else None
    if not isinstance(features, list):
        print("API 未返回 guild.features，状态未知。")
        return "unknown"

    print("服务器：", guild.get("name", "未知"))
    return "closed" if "INVITES_DISABLED" in features else "open"


def send_discord(webhook_url: str, text: str, user_id: str) -> None:
    valid_id = user_id if user_id.isdecimal() else ""
    mention = f"<@{valid_id}> " if valid_id else ""
    payload = {
        "content": mention + text,
        "allowed_mentions": {"parse": [], "users": [valid_id] if valid_id else []},
    }
    request = Request(
        webhook_url,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json", "User-Agent": HEADERS["User-Agent"]},
        method="POST",
    )
    with urlopen(request, timeout=20) as response:
        if response.status not in (200, 204):
            raise RuntimeError(f"Webhook HTTP {response.status}")
    print("Discord 消息已发送。")


def main() -> None:
    webhook_url = os.getenv("DISCORD_WEBHOOK_URL", "").strip()
    user_id = os.getenv("DISCORD_USER_ID", "").strip()
    if not webhook_url.startswith("https://discord.com/api/webhooks/"):
        raise SystemExit("未正确设置 DISCORD_WEBHOOK_URL 仓库 Secret。")

    if os.getenv("TEST_NOTIFICATION", "").lower() == "true":
        send_discord(
            webhook_url,
            "🔔 **旅程开门提醒器：测试成功！**\n监控配置已接通。这是一条测试消息，不代表旅程已经开门。",
            user_id,
        )
        return

    try:
        previous = json.loads(STATE_FILE.read_text(encoding="utf-8")).get("status", "unknown")
    except (FileNotFoundError, ValueError, OSError):
        previous = "unknown"

    current = get_invite_status()
    print(f"上次状态：{previous}；本次状态：{current}")
    if current == "unknown":
        print("检测不可靠，既不发送也不更新状态。")
        return

    if current == "open" and previous != "open":
        send_discord(
            webhook_url,
            "🚨 **燕燕！旅程可能开门啦！快冲！** 🚨\n"
            f"检测到邀请暂停标志解除：{INVITE_URL}\n"
            "能否成功加入仍取决于 Discord 账号验证及服务器的其他限制。",
            user_id,
        )

    if current != previous:
        STATE_FILE.write_text(json.dumps({"status": current}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print("状态已写入 state.json，等待工作流提交。")
    else:
        print("状态未变化，无需提醒。")


if __name__ == "__main__":
    main()
