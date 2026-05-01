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

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
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

  /** Приклад з офіційної доки: є `signature` → перевірка Ed25519 (не HMAC). */
  const ed25519Init =
    "user=%7B%22id%22%3A279058397%2C%22first_name%22%3A%22Vladislav%20%2B%20-%20%3F%20%5C%2F%22%2C%22last_name%22%3A%22Kibenko%22%2C%22username%22%3A%22vdkfrost%22%2C%22language_code%22%3A%22ru%22%2C%22is_premium%22%3Atrue%2C%22allows_write_to_pm%22%3Atrue%2C%22photo_url%22%3A%22https%3A%5C%2F%5C%2Ft.me%5C%2Fi%5C%2Fuserpic%5C%2F320%5C%2F4FPEE4tmP3ATHa57u6MqTDih13LTOiMoKoLDRG4PnSA.svg%22%7D" +
    "&chat_instance=8134722200314281151" +
    "&chat_type=private" +
    "&auth_date=1733584787" +
    "&signature=zL-ucjNyREiHDE8aihFwpfR9aggP2xiAo3NSpfe-p7IbCisNlDKlo7Kb6G4D0Ao2mBrSgEk4maLSdv6MLIlADQ" +
    "&hash=2174df5b000556d044f3f020384e879c8efcab55ddea2ced4eb752e93e7080d6";
  const tokenForEd = "7342037359:DOCUMENTATION_EXAMPLE_CI_ONLY";
  const vEd = verifyTelegramWebAppInitData(ed25519Init, tokenForEd, { maxAgeSec: 86400 * 365 * 50 });
  assert.strictEqual(vEd.ok, true, `Ed25519 initData: ${JSON.stringify(vEd)}`);
  assert.strictEqual(vEd.matched && vEd.matched.mode, "ed25519");

  console.log("OK: mini-app crypto checks passed");
}

main();
