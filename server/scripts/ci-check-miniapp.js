/**
 * Локальна перевірка без БД: підпис initData (офіційний псевдокод Telegram)
 * та round-trip токена навігації до тесту.
 */
const crypto = require("crypto");
const assert = require("assert");
const { verifyTelegramWebAppInitData } = require("../src/telegramMiniApp/initData");
const { signOpenTestNavToken, verifyOpenTestNavToken } = require("../src/telegramMiniApp/sign");

function syntheticInitData(botToken) {
  const auth_date = String(Math.floor(Date.now() / 1000));
  const query_id = "AAHdF6IQAAAAdF6IQ";
  const userStr = JSON.stringify({ id: 271992533, first_name: "Test", username: "testuser" });

  const keys = ["auth_date", "query_id", "user"].sort((a, b) => a.localeCompare(b));
  const map = { auth_date, query_id, user: userStr };
  const dataCheckString = keys.map((k) => `${k}=${map[k]}`).join("\n");

  const secretKey = crypto.createHmac("sha256", botToken).update("WebAppData").digest();
  const hash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  const params = new URLSearchParams();
  params.set("auth_date", auth_date);
  params.set("query_id", query_id);
  params.set("user", userStr);
  params.set("hash", hash);
  return params.toString();
}

function main() {
  const botToken = "123456789:TESTBOTTOKENxxxxxxxxxxxxxxxxxxxxxxxxxxxx";

  const initOk = syntheticInitData(botToken);
  const v = verifyTelegramWebAppInitData(initOk, botToken, { maxAgeSec: 120 });
  assert.strictEqual(v.ok, true, `initData має проходити перевірку: ${JSON.stringify(v)}`);

  const vBad = verifyTelegramWebAppInitData(initOk.replace(/hash=[^&]+/, "hash=00"), botToken, { maxAgeSec: 120 });
  assert.strictEqual(vBad.ok, false, "Пошкоджений hash не повинен проходити");

  const tid = "d1ba56c9-63f8-4360-b728-7ea31503ccb1";
  const tok = signOpenTestNavToken(botToken, tid);
  const nav = verifyOpenTestNavToken(botToken, tok);
  assert(nav && nav.testUuid === tid, "Токен навігації має верифікуватися");

  assert.strictEqual(verifyOpenTestNavToken(botToken, tok + "x"), null, "Битий токен має відхилятись");

  console.log("OK: mini-app crypto checks passed");
}

main();
