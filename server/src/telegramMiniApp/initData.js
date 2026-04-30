const crypto = require("crypto");

/**
 * Перевірка initData з Telegram.WebApp (див. core.telegram.org / bots / webapps).
 */
function verifyTelegramWebAppInitData(initData, botToken, { maxAgeSec = 86400 } = {}) {
  if (!initData || typeof initData !== "string" || !botToken) {
    return { ok: false, reason: "missing" };
  }
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return { ok: false, reason: "no_hash" };

  const pairs = [];
  for (const [k, v] of params.entries()) {
    if (k === "hash" || k === "signature") continue;
    pairs.push([k, v]);
  }
  pairs.sort(([a], [b]) => a.localeCompare(b));
  const dataCheckString = pairs.map(([k, v]) => `${k}=${v}`).join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const calculated = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  const ah = Buffer.from(calculated, "hex");
  const bh = Buffer.from(hash, "hex");
  if (ah.length !== bh.length || !crypto.timingSafeEqual(ah, bh)) {
    return { ok: false, reason: "bad_hash" };
  }

  const authDate = Number(params.get("auth_date") || "0");
  if (!authDate || Number.isNaN(authDate)) return { ok: false, reason: "no_auth_date" };
  if (Math.floor(Date.now() / 1000) - authDate > maxAgeSec) return { ok: false, reason: "stale" };

  let user = null;
  const userJson = params.get("user");
  if (userJson) {
    try {
      user = JSON.parse(userJson);
    } catch {
      return { ok: false, reason: "bad_user" };
    }
  }

  let chat = null;
  const chatJson = params.get("chat");
  if (chatJson) {
    try {
      chat = JSON.parse(chatJson);
    } catch {
      return { ok: false, reason: "bad_chat" };
    }
  }

  return { ok: true, user, chat, params };
}

function getTelegramIdsFromVerified({ user, chat }) {
  const telegramUserId = user?.id != null ? user.id : null;
  let telegramChatId = chat?.id != null ? chat.id : null;
  if (telegramChatId == null && telegramUserId != null) telegramChatId = telegramUserId;
  return { telegramUserId, telegramChatId, user };
}

module.exports = { verifyTelegramWebAppInitData, getTelegramIdsFromVerified };
