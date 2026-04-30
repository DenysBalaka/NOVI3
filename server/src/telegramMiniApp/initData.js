const crypto = require("crypto");

function decodeFormComponent(raw) {
  if (raw == null) return "";
  try {
    return decodeURIComponent(String(raw).replace(/\+/g, " "));
  } catch {
    return String(raw);
  }
}

/** Розбір query-string без зміни значень (лише розділення по &) */
function parseRawQueryPairs(initData) {
  const map = {};
  const s = String(initData || "").trim();
  if (!s) return map;
  for (const segment of s.split("&")) {
    if (!segment) continue;
    const eq = segment.indexOf("=");
    if (eq < 0) continue;
    const key = segment.slice(0, eq);
    const rawVal = segment.slice(eq + 1);
    map[key] = rawVal;
  }
  return map;
}

function buildCheckStringDecodedFromRawMap(rawMap) {
  const keys = Object.keys(rawMap)
    .filter((k) => k !== "hash" && k !== "signature")
    .sort((a, b) => a.localeCompare(b));
  return keys.map((k) => `${k}=${decodeFormComponent(rawMap[k])}`).join("\n");
}

function buildCheckStringRawFromRawMap(rawMap) {
  const keys = Object.keys(rawMap)
    .filter((k) => k !== "hash" && k !== "signature")
    .sort((a, b) => a.localeCompare(b));
  return keys.map((k) => `${k}=${rawMap[k]}`).join("\n");
}

function buildCheckStringFromURLSearchParams(initData) {
  const params = new URLSearchParams(initData);
  params.delete("hash");
  params.delete("signature");
  const keys = [...new Set([...params.keys()])].sort((a, b) => a.localeCompare(b));
  return keys.map((k) => `${k}=${params.get(k)}`).join("\n");
}

/**
 * Перевірка initData з Telegram.WebApp (core.telegram.org / bots / webapps).
 * Через відмінності кодування query-string пробуємо кілька канонічних варіантів data-check-string.
 */
function verifyTelegramWebAppInitData(initData, botToken, { maxAgeSec = 86400 } = {}) {
  const token = String(botToken || "").trim();
  if (!initData || typeof initData !== "string" || !token) {
    return { ok: false, reason: "missing" };
  }

  const rawMap = parseRawQueryPairs(initData);
  const hash = rawMap.hash ? decodeFormComponent(rawMap.hash) : null;
  if (!hash) return { ok: false, reason: "no_hash" };

  const bh = Buffer.from(hash, "hex");
  if (bh.length !== 32) return { ok: false, reason: "bad_hash_format" };

  const checkVariants = [
    buildCheckStringDecodedFromRawMap(rawMap),
    buildCheckStringRawFromRawMap(rawMap),
    buildCheckStringFromURLSearchParams(initData),
  ];

  // Документація (псевдокод): secret_key = HMAC_SHA256(<bot_token>, "WebAppData")
  const secretOfficial = crypto.createHmac("sha256", token).update("WebAppData").digest();
  // Поширена інтерпретація тексту доки: key="WebAppData", msg=bot_token
  const secretAlt = crypto.createHmac("sha256", "WebAppData").update(token).digest();

  let matched = false;
  for (const secretKey of [secretOfficial, secretAlt]) {
    for (const dataCheckString of checkVariants) {
      const calculated = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
      const ah = Buffer.from(calculated, "hex");
      if (ah.length === bh.length && crypto.timingSafeEqual(ah, bh)) {
        matched = true;
        break;
      }
    }
    if (matched) break;
  }

  if (!matched) return { ok: false, reason: "bad_hash" };

  const params = new URLSearchParams(initData);
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
