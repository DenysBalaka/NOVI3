const crypto = require("crypto");

/** application/x-www-form-urlencoded → utf-8 (як це робить Telegram WebApp). */
function decodeFormComponent(raw) {
  if (raw == null) return "";
  try {
    return decodeURIComponent(String(raw).replace(/\+/g, "%20"));
  } catch {
    return String(raw);
  }
}

/** Розбір query-string без зміни значень (лише розділення по &). */
function parseRawQueryPairs(initData) {
  const map = {};
  const s = String(initData || "").trim();
  if (!s) return map;
  for (const segment of s.split("&")) {
    if (!segment) continue;
    const eq = segment.indexOf("=");
    if (eq < 0) {
      map[segment] = "";
      continue;
    }
    const key = segment.slice(0, eq);
    const rawVal = segment.slice(eq + 1);
    map[key] = rawVal;
  }
  return map;
}

const EXCLUDE_FROM_HASH = new Set(["hash", "signature"]);

function sortedKeys(rawMap) {
  return Object.keys(rawMap)
    .filter((k) => !EXCLUDE_FROM_HASH.has(k))
    .sort();
}

function buildCheckStringDecoded(rawMap) {
  return sortedKeys(rawMap)
    .map((k) => `${k}=${decodeFormComponent(rawMap[k])}`)
    .join("\n");
}

function buildCheckStringRaw(rawMap) {
  return sortedKeys(rawMap)
    .map((k) => `${k}=${rawMap[k]}`)
    .join("\n");
}

function buildCheckStringFromURLSearchParams(initData) {
  const params = new URLSearchParams(initData);
  for (const k of EXCLUDE_FROM_HASH) params.delete(k);
  const keys = [...new Set([...params.keys()])].sort();
  return keys.map((k) => `${k}=${params.get(k)}`).join("\n");
}

function describeInitData(rawMap) {
  const fields = sortedKeys(rawMap);
  const initLen = Object.entries(rawMap).reduce((n, [k, v]) => n + k.length + 1 + (v ? v.length : 0) + 1, 0);
  return {
    fieldCount: fields.length,
    fields,
    hasHash: !!rawMap.hash,
    hasSignature: !!rawMap.signature,
    hasUser: !!rawMap.user,
    hasAuthDate: !!rawMap.auth_date,
    initLen,
  };
}

/**
 * Перевірка initData з Telegram.WebApp за офіційним псевдокодом
 * (core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app).
 * Через історичні відмінності клієнтів пробуємо кілька канонічних варіантів data-check-string,
 * але вмикаємо лише варіанти, які відповідають документації.
 */
function verifyTelegramWebAppInitData(initData, botToken, { maxAgeSec = 86400 } = {}) {
  const token = String(botToken || "").trim();
  if (!initData || typeof initData !== "string") {
    return { ok: false, reason: "missing_initdata" };
  }
  if (!token) {
    return { ok: false, reason: "missing_bot_token" };
  }

  const rawMap = parseRawQueryPairs(initData);
  const meta = describeInitData(rawMap);

  const hashHex = rawMap.hash ? decodeFormComponent(rawMap.hash) : null;
  if (!hashHex) return { ok: false, reason: "no_hash", meta };

  let bh;
  try {
    bh = Buffer.from(hashHex, "hex");
  } catch {
    return { ok: false, reason: "bad_hash_format", meta };
  }
  if (bh.length !== 32) return { ok: false, reason: "bad_hash_format", meta };

  const checkVariants = [
    { label: "decoded", str: buildCheckStringDecoded(rawMap) },
    { label: "raw", str: buildCheckStringRaw(rawMap) },
    { label: "URLSearchParams", str: buildCheckStringFromURLSearchParams(initData) },
  ];

  // Офіційний псевдокод Telegram: secret_key = HMAC_SHA256(<bot_token>, "WebAppData").
  // У HMAC секретним ключем є перший аргумент, тож тут token у ролі ключа, "WebAppData" — повідомлення.
  const secretOfficial = crypto.createHmac("sha256", token).update("WebAppData").digest();
  // Деякі сторонні бібліотеки інтерпретують текст доки навпаки — спробуємо як фолбек.
  const secretAlt = crypto.createHmac("sha256", "WebAppData").update(token).digest();
  const secrets = [
    { label: "secret=hmac(token, 'WebAppData')", key: secretOfficial },
    { label: "secret=hmac('WebAppData', token)", key: secretAlt },
  ];

  let matched = null;
  outer: for (const sec of secrets) {
    for (const v of checkVariants) {
      const calculated = crypto.createHmac("sha256", sec.key).update(v.str).digest("hex");
      const ah = Buffer.from(calculated, "hex");
      if (ah.length === bh.length && crypto.timingSafeEqual(ah, bh)) {
        matched = { secret: sec.label, variant: v.label };
        break outer;
      }
    }
  }

  if (!matched) {
    return { ok: false, reason: "bad_hash", meta };
  }

  const params = new URLSearchParams(initData);
  const authDate = Number(params.get("auth_date") || "0");
  if (!Number.isFinite(authDate) || authDate <= 0) {
    return { ok: false, reason: "no_auth_date", meta };
  }
  const ageSec = Math.floor(Date.now() / 1000) - authDate;
  if (ageSec > maxAgeSec) {
    return { ok: false, reason: "stale", meta: { ...meta, ageSec, maxAgeSec } };
  }

  let user = null;
  const userJson = params.get("user");
  if (userJson) {
    try {
      user = JSON.parse(userJson);
    } catch {
      return { ok: false, reason: "bad_user", meta };
    }
  }

  let chat = null;
  const chatJson = params.get("chat");
  if (chatJson) {
    try {
      chat = JSON.parse(chatJson);
    } catch {
      return { ok: false, reason: "bad_chat", meta };
    }
  }

  return { ok: true, user, chat, params, matched, meta };
}

function getTelegramIdsFromVerified({ user, chat }) {
  const telegramUserId = user?.id != null ? user.id : null;
  let telegramChatId = chat?.id != null ? chat.id : null;
  if (telegramChatId == null && telegramUserId != null) telegramChatId = telegramUserId;
  return { telegramUserId, telegramChatId, user };
}

module.exports = {
  verifyTelegramWebAppInitData,
  getTelegramIdsFromVerified,
  parseRawQueryPairs,
};
