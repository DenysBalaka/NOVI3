const crypto = require("crypto");

/**
 * @typedef {{ inviteCode: string, guestName: string, guestAge?: number|null, guestGrade?: string|null }} InviteNavGuest
 */

/**
 * Підпис URL для Mini App: або звичайний доступ учня (v1), або відкрите запрошення (v2 + дані гостя з бота).
 * @param {string} botToken
 * @param {string} testUuid
 * @param {InviteNavGuest} [inviteGuest] — якщо задано, буде v2
 */
function signOpenTestNavToken(botToken, testUuid, inviteGuest) {
  const exp = Date.now() + 30 * 60 * 1000;
  let body;
  if (inviteGuest && typeof inviteGuest === "object") {
    const ic = String(inviteGuest.inviteCode || "").trim();
    const nm = String(inviteGuest.guestName || "").trim();
    if (!ic || !nm) {
      throw new Error("signOpenTestNavToken: inviteGuest потребує inviteCode та guestName");
    }
    const ag =
      inviteGuest.guestAge != null && Number.isFinite(Number(inviteGuest.guestAge))
        ? Number(inviteGuest.guestAge)
        : undefined;
    const grRaw = inviteGuest.guestGrade != null ? String(inviteGuest.guestGrade).trim() : "";
    const gr = grRaw ? grRaw.slice(0, 80) : undefined;
    body = {
      v: 2,
      tid: String(testUuid),
      exp,
      ic,
      nm: nm.slice(0, 500),
      ...(ag !== undefined ? { ag } : {}),
      ...(gr !== undefined ? { gr } : {}),
    };
  } else {
    body = { v: 1, tid: String(testUuid), exp };
  }
  const payload = Buffer.from(JSON.stringify(body), "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", botToken).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function verifyOpenTestNavToken(botToken, token) {
  if (!botToken || !token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = crypto.createHmac("sha256", botToken).update(payload).digest("base64url");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(sig, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let data;
  try {
    data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!data || typeof data.tid !== "string" || typeof data.exp !== "number") return null;
  if (Date.now() > data.exp) return null;
  if (data.v === 1) {
    return { testUuid: data.tid };
  }
  if (data.v === 2) {
    const ic = typeof data.ic === "string" ? data.ic.trim() : "";
    const nm = typeof data.nm === "string" ? data.nm.trim() : "";
    if (!ic || !nm) return null;
    const guestAge =
      typeof data.ag === "number" && Number.isFinite(data.ag) ? data.ag : undefined;
    const guestGrade = typeof data.gr === "string" && data.gr.trim() ? data.gr.trim().slice(0, 80) : undefined;
    return {
      testUuid: data.tid,
      inviteCode: ic,
      guestName: nm,
      guestAge,
      guestGrade,
    };
  }
  return null;
}

module.exports = { signOpenTestNavToken, verifyOpenTestNavToken };
