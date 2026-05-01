const crypto = require("crypto");

/** Прибираємо типові «Render/копіпаст» артефакти з TELEGRAM_BOT_TOKEN. */
function normalizeBotToken(raw) {
  let t = String(raw ?? "").trim();
  t = t.replace(/^\uFEFF/, "");
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    t = t.slice(1, -1).trim();
  }
  return t.replace(/\r/g, "").replace(/\n/g, "");
}

/** application/x-www-form-urlencoded → utf-8 (як у Telegram WebApp). */
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

/** Числовий bot_id з токена `123456789:AA...` (потрібен для Ed25519-гілки). */
function parseBotIdFromToken(token) {
  const part = String(token || "").split(":")[0];
  const n = Number(part);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");
const TELEGRAM_ED25519_PROD = Buffer.from(
  "e7bf03a2fa4602af4580703d88dda5bb59f32ed8b02a56c187fe7d34caed242d",
  "hex"
);
const TELEGRAM_ED25519_TEST = Buffer.from(
  "40055058a4ee38156a06562e52eece92a771bcd8346a8c4615cb7376eddf72ec",
  "hex"
);

function telegramEd25519PublicKey(testEnv) {
  const raw = testEnv ? TELEGRAM_ED25519_TEST : TELEGRAM_ED25519_PROD;
  return crypto.createPublicKey({
    key: Buffer.concat([ED25519_SPKI_PREFIX, raw]),
    format: "der",
    type: "spki",
  });
}

function base64UrlToBuffer(s) {
  let b = String(s || "").replace(/-/g, "+").replace(/_/g, "/");
  const pad = b.length % 4;
  if (pad) b += "=".repeat(4 - pad);
  return Buffer.from(b, "base64");
}

/**
 * Новий формат (поле signature): Ed25519 за публічним ключем Telegram.
 * Є два ключі: production і test (test-оточення Bot API). Якщо на Render помилково
 * TELEGRAM_MINIAPP_TEST_ENV=true, а клієнт — звичайний Telegram, спершу мимо ключ спрацьовував би лише один раз — тому пробуємо обидва порядки й попереджаємо в логах.
 * @see https://core.telegram.org/bots/webapps#validating-data-for-third-party-use
 */
function verifyInitDataEd25519(initData, botId, { preferTestKey = false } = {}) {
  const params = new URLSearchParams(initData);
  const sigRaw = params.get("signature");
  if (!sigRaw || !String(sigRaw).trim()) {
    return { ok: false, reason: "no_signature" };
  }

  const pairs = [];
  let authDateStr;
  params.forEach((val, key) => {
    if (key === "hash" || key === "signature") return;
    if (key === "auth_date") authDateStr = val;
    pairs.push(`${key}=${val}`);
  });
  pairs.sort();
  const msg = Buffer.from(`${botId}:WebAppData\n${pairs.join("\n")}`, "utf8");

  let sigBuf;
  try {
    sigBuf = base64UrlToBuffer(sigRaw.trim());
  } catch {
    return { ok: false, reason: "bad_signature_format" };
  }
  if (sigBuf.length !== 64) {
    return { ok: false, reason: "bad_signature_format" };
  }

  const authDate = Number(authDateStr || "0");
  if (!Number.isFinite(authDate) || authDate <= 0) {
    return { ok: false, reason: "no_auth_date" };
  }

  const tryTestKeyFirst = Boolean(preferTestKey);
  const order = tryTestKeyFirst ? [true, false] : [false, true];

  for (const useTestKey of order) {
    const pub = telegramEd25519PublicKey(useTestKey);
    try {
      const ok = crypto.verify(null, msg, pub, sigBuf);
      if (ok) {
        if (useTestKey !== tryTestKeyFirst) {
          console.warn(
            `[telegram-webapp] Ed25519 OK з ${useTestKey ? "тестовим" : "продакшен"} ключем; TELEGRAM_MINIAPP_TEST_ENV=${tryTestKeyFirst}. ` +
              (tryTestKeyFirst
                ? "Видаліть або встановіть false для TELEGRAM_MINIAPP_TEST_ENV, якщо учні відкривають Mini App у звичайному Telegram (не test platform)."
                : "Увімкніть TELEGRAM_MINIAPP_TEST_ENV=true лише якщо бот підключений до test environment Telegram.")
          );
        }
        return { ok: true, authDate, ed25519TestKey: useTestKey };
      }
    } catch {
      // пробуємо інший ключ
    }
  }

  return { ok: false, reason: "bad_signature" };
}

function sortedKeysForHmac(rawMap) {
  return Object.keys(rawMap)
    .filter((k) => k !== "hash")
    .sort();
}

/** Як у @tma.js/init-data-node: пари key=value з сирого рядка, без decode value (як URLSearchParams.get). */
function buildCheckStringTmaStyle(initData) {
  const params = new URLSearchParams(initData);
  const pairs = [];
  params.forEach((val, key) => {
    if (key === "hash") return;
    pairs.push(`${key}=${val}`);
  });
  pairs.sort();
  return pairs.join("\n");
}

function buildCheckStringDecodedFromRawMap(rawMap) {
  return sortedKeysForHmac(rawMap)
    .map((k) => `${k}=${decodeFormComponent(rawMap[k])}`)
    .join("\n");
}

function buildCheckStringRawFromRawMap(rawMap) {
  return sortedKeysForHmac(rawMap)
    .map((k) => `${k}=${rawMap[k]}`)
    .join("\n");
}

function describeInitData(rawMap) {
  const fields = sortedKeysForHmac(rawMap);
  const initLen = Object.entries(rawMap).reduce(
    (n, [k, v]) => n + k.length + 1 + (v ? v.length : 0) + 1,
    0
  );
  return {
    fieldCount: fields.length,
    fields,
    hasHash: !!rawMap.hash,
    hasUser: !!rawMap.user,
    hasAuthDate: !!rawMap.auth_date,
    initLen,
  };
}

/**
 * Перевірка initData з Telegram.WebApp.
 * — Якщо є `signature` → Ed25519 (актуальні клієнти; поле `hash` при цьому ігнорується).
 * — Інакше → класичний HMAC-SHA-256 за токеном бота.
 */
function verifyTelegramWebAppInitData(initData, botToken, { maxAgeSec = 86400 } = {}) {
  const token = normalizeBotToken(botToken);
  if (!initData || typeof initData !== "string") {
    return { ok: false, reason: "missing_initdata" };
  }
  if (!token) {
    return { ok: false, reason: "missing_bot_token" };
  }

  const rawMap = parseRawQueryPairs(initData);
  const paramsAll = new URLSearchParams(initData);
  const hasSignature = !!(paramsAll.get("signature") || "").trim();
  const meta = { ...describeInitData(rawMap), hasSignature };

  const preferTestKey =
    process.env.TELEGRAM_MINIAPP_TEST_ENV === "true" ||
    process.env.TELEGRAM_MINI_APP_TEST === "true";

  if (hasSignature) {
    const botId = parseBotIdFromToken(token);
    if (!botId) {
      return { ok: false, reason: "bad_bot_token_format", meta };
    }
    const ed = verifyInitDataEd25519(initData, botId, { preferTestKey });
    if (!ed.ok) {
      return { ok: false, reason: ed.reason, meta };
    }
    const ageSec = Math.floor(Date.now() / 1000) - ed.authDate;
    if (ageSec > maxAgeSec) {
      return { ok: false, reason: "stale", meta: { ...meta, ageSec, maxAgeSec } };
    }
    const params = new URLSearchParams(initData);
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
    return {
      ok: true,
      user,
      chat,
      params,
      matched: { mode: "ed25519", botId, ed25519TestKey: ed.ed25519TestKey },
      meta,
    };
  }

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
    { label: "tma_urlsearchparams", str: buildCheckStringTmaStyle(initData) },
    { label: "decoded", str: buildCheckStringDecodedFromRawMap(rawMap) },
    { label: "raw", str: buildCheckStringRawFromRawMap(rawMap) },
  ];

  const secretOfficial = crypto.createHmac("sha256", token).update("WebAppData").digest();
  const secretAlt = crypto.createHmac("sha256", "WebAppData").update(token).digest();
  const secrets = [
    { label: "secret=hmac('WebAppData', token)", key: secretAlt },
    { label: "secret=hmac(token, 'WebAppData')", key: secretOfficial },
  ];

  let matched = null;
  outer: for (const sec of secrets) {
    for (const v of checkVariants) {
      const calculated = crypto.createHmac("sha256", sec.key).update(v.str).digest("hex");
      const ah = Buffer.from(calculated, "hex");
      if (ah.length === bh.length && crypto.timingSafeEqual(ah, bh)) {
        matched = { mode: "hmac", secret: sec.label, variant: v.label };
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
  normalizeBotToken,
  parseBotIdFromToken,
};
