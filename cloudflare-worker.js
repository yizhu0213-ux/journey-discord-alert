/**
 * 旅程社区开门提醒器 · Cloudflare Workers 版
 * 绑定：WATCH_STATE (KV namespace), DISCORD_WEBHOOK_URL (Secret), DISCORD_USER_ID (Variable)
 * Cron: * * * * * （每分钟；UTC）
 * 邀请公开特征标志只作为线索，不能保证一定能加入服务器。
 */
const INVITE_CODE = "elysianhorizon";
const INVITE_URL = `https://discord.gg/${INVITE_CODE}`;
const DISCORD_API = `https://discord.com/api/v10/invites/${INVITE_CODE}?with_counts=true`;
const KEY = "journey_invite_state_v2";

async function readInviteStatus() {
  let response;
  try {
    response = await fetch(DISCORD_API, {
      method: "GET",
      headers: { Accept: "application/json", "Cache-Control": "no-cache" },
      cf: { cacheTtl: 0 },
    });
  } catch (error) {
    console.log("邀请接口网络错误（未知状态）:", String(error));
    return "unknown";
  }

  if (!response.ok) {
    console.log("邀请接口 HTTP 状态（未知）:", response.status);
    return "unknown";
  }
  let data;
  try {
    data = await response.json();
  } catch (_) {
    console.log("邀请接口无法解析 JSON（未知）");
    return "unknown";
  }

  if (
    !data ||
    String(data.code || "").toLowerCase() !== INVITE_CODE ||
    !data.guild ||
    !Array.isArray(data.guild.features)
  ) {
    console.log("邀请 API 缺少必要字段（未知）");
    return "unknown";
  }
  return data.guild.features.includes("INVITES_DISABLED") ? "closed" : "open";
}

async function sendDiscord(env, message) {
  const webhook = env.DISCORD_WEBHOOK_URL;
  if (!webhook || !webhook.startsWith("https://discord.com/api/webhooks/")) {
    throw new Error("缺少合法的 DISCORD_WEBHOOK_URL Secret");
  }
  const userId = String(env.DISCORD_USER_ID || "").trim();
  const mentionId = /^\d{15,22}$/.test(userId) ? userId : "";
  const mention = mentionId ? `<@${mentionId}> ` : "";
  const result = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: mention + message,
      allowed_mentions: { parse: [], users: mentionId ? [mentionId] : [] },
    }),
  });
  if (!result.ok) {
    throw new Error(`Discord Webhook 推送失败：HTTP ${result.status}`);
  }
  console.log("Discord 开门提醒已发送");
}

async function checkJourney(env) {
  if (!env.WATCH_STATE) {
    throw new Error("缺少 WATCH_STATE KV 绑定");
  }
  const previous = (await env.WATCH_STATE.get(KEY)) || "unknown";
  const current = await readInviteStatus();
  console.log(`本次: ${current}; 上次: ${previous}`);

  if (current === "unknown") return;

  if (current === "closed") {
    if (previous !== "closed") await env.WATCH_STATE.put(KEY, "closed");
    return;
  }

  if (previous === "open") return;

  // 短暂 API 波动可能产生误报，10 秒后复核一次。
  await new Promise((resolve) => setTimeout(resolve, 10000));
  const confirmation = await readInviteStatus();
  console.log(`开门二次复核: ${confirmation}`);
  if (confirmation !== "open") return;

  await sendDiscord(
    env,
    `🚨 **燕燕！旅程疑似开门啦，快试着加入！** 🚨\n${INVITE_URL}\n` +
    "已连续两次检测到邀请暂停标志消失；实际能否进入仍取决于 Discord 服务器设置。"
  );
  await env.WATCH_STATE.put(KEY, "open");
}

export default {
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(checkJourney(env));
  },
  async fetch(_request, env) {
    // 公开的健康检查不会触发监控或发送消息，也不会暴露密钥。
    const current = env.WATCH_STATE ? await env.WATCH_STATE.get(KEY) : null;
    return Response.json({ service: "journey-invite-watch", configured: !!env.WATCH_STATE, last_known_state: current || "unknown" });
  },
};
