const crypto = require("crypto");

function signOpenTestNavToken(botToken, testUuid) {
  const exp = Date.now() + 30 * 60 * 1000;
  const payload = Buffer.from(JSON.stringify({ v: 1, tid: String(testUuid), exp }), "utf8").toString("base64url");
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
  if (!data || data.v !== 1 || typeof data.tid !== "string" || typeof data.exp !== "number") return null;
  if (Date.now() > data.exp) return null;
  return { testUuid: data.tid };
}

module.exports = { signOpenTestNavToken, verifyOpenTestNavToken };
