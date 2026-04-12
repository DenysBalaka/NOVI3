const { pool } = require("../db");
const { hashApiKey } = require("../apiKey");

async function authTeacher(req, res, next) {
  const raw = req.headers.authorization;
  let key = null;
  if (raw && raw.startsWith("Bearer ")) key = raw.slice(7).trim();
  if (!key) key = (req.headers["x-api-key"] || "").trim();
  if (!key) {
    res.status(401).json({ error: "Потрібен API-ключ (Authorization: Bearer … або X-Api-Key)" });
    return;
  }
  const h = hashApiKey(key);
  try {
    let r;
    try {
      r = await pool.query(
        "SELECT id, display_name, school, telegram_notify_chat_id FROM teachers WHERE api_key_hash = $1",
        [h]
      );
    } catch (inner) {
      // Старі БД без міграції 003 (колонка telegram_notify_chat_id)
      if (inner.code !== "42703") throw inner;
      r = await pool.query("SELECT id, display_name, school FROM teachers WHERE api_key_hash = $1", [h]);
      if (r.rows.length > 0) r.rows[0].telegram_notify_chat_id = null;
    }
    if (r.rows.length === 0) {
      res.status(401).json({ error: "Невірний API-ключ" });
      return;
    }
    req.teacher = r.rows[0];
    next();
  } catch (e) {
    console.error("[authTeacher]", e.code || "", e.message);
    res.status(500).json({ error: "Помилка БД" });
  }
}

module.exports = { authTeacher };
