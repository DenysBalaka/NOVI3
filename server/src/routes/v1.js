const express = require("express");
const crypto = require("crypto");
const { pool } = require("../db");
const { generateApiKey, hashApiKey } = require("../apiKey");
const { authTeacher } = require("../middleware/authTeacher");

const router = express.Router();
router.use(express.json({ limit: "25mb" }));

/** POST /api/v1/register — створити вчителя (повертає apiKey один раз) */
router.post("/register", async (req, res) => {
  try {
    const { displayName, school } = req.body || {};
    const apiKey = generateApiKey();
    const hash = hashApiKey(apiKey);
    const result = await pool.query(
      `INSERT INTO teachers (display_name, school, api_key_hash) VALUES ($1, $2, $3) RETURNING id`,
      [displayName || null, school || null, hash]
    );
    res.json({ teacherId: result.rows[0].id, apiKey });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Не вдалося зареєструвати" });
  }
});

router.use(authTeacher);

router.get("/me", (req, res) => {
  res.json({
    id: req.teacher.id,
    displayName: req.teacher.display_name,
    school: req.teacher.school,
    telegramNotifyChatId: req.teacher.telegram_notify_chat_id ?? null,
  });
});

/** PATCH /api/v1/me/telegram-notify — куди слати сповіщення про невдалу самоприв’язку учнів */
router.patch("/me/telegram-notify", async (req, res) => {
  const tid = req.teacher.id;
  const { telegramNotifyChatId } = req.body || {};
  const raw =
    telegramNotifyChatId != null && String(telegramNotifyChatId).trim() !== ""
      ? String(telegramNotifyChatId).trim()
      : null;
  try {
    if (raw == null) {
      await pool.query(`UPDATE teachers SET telegram_notify_chat_id = NULL WHERE id = $1::uuid`, [tid]);
    } else {
      await pool.query(
        `UPDATE teachers SET telegram_notify_chat_id = $2::bigint WHERE id = $1::uuid`,
        [tid, raw]
      );
    }
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    if (e.code === "42703") {
      res.status(503).json({
        error:
          "У базі немає колонки для сповіщень. Виконайте на Neon SQL з файлу server/migrations/003_teacher_telegram_notify.sql",
      });
      return;
    }
    res.status(500).json({ error: "Помилка збереження" });
  }
});

/** GET /api/v1/roster — поточні класи та учні з UUID (після sync) */
router.get("/roster", async (req, res) => {
  const tid = req.teacher.id;
  try {
    const classes = await pool.query(
      `SELECT id, name, sort_order FROM classes WHERE teacher_id = $1 ORDER BY sort_order, name`,
      [tid]
    );
    const out = { classes: [] };
    for (const c of classes.rows) {
      const sr = await pool.query(
        `SELECT id, full_name, sort_order, telegram_user_id, telegram_username FROM students WHERE class_id = $1 ORDER BY sort_order, full_name`,
        [c.id]
      );
      out.classes.push({
        id: c.id,
        name: c.name,
        sortOrder: c.sort_order,
        students: sr.rows,
      });
    }
    res.json(out);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Помилка" });
  }
});

/** POST /api/v1/roster/sync */
router.post("/roster/sync", async (req, res) => {
  const tid = req.teacher.id;
  const { classes: classList } = req.body || {};
  if (!Array.isArray(classList)) {
    res.status(400).json({ error: "Очікується classes: []" });
    return;
  }
  const client = await pool.connect();
  const roster = {};
  try {
    await client.query("BEGIN");
    for (let ci = 0; ci < classList.length; ci++) {
      const c = classList[ci];
      const cname = (c && c.name) != null ? String(c.name).trim() : "";
      if (!cname) continue;
      const sortOrder = typeof c.sortOrder === "number" ? c.sortOrder : ci;
      const cr = await client.query(
        `INSERT INTO classes (teacher_id, name, sort_order) VALUES ($1, $2, $3)
         ON CONFLICT (teacher_id, name) DO UPDATE SET sort_order = EXCLUDED.sort_order
         RETURNING id`,
        [tid, cname, sortOrder]
      );
      const classId = cr.rows[0].id;
      roster[cname] = { classId, students: {} };
      const studs = Array.isArray(c.students) ? c.students : [];
      for (let si = 0; si < studs.length; si++) {
        const s = studs[si];
        const fullName = (s && s.fullName) != null ? String(s.fullName).trim() : "";
        if (!fullName) continue;
        const sSort = typeof s.sortOrder === "number" ? s.sortOrder : si;
        const sr = await client.query(
          `INSERT INTO students (class_id, full_name, sort_order) VALUES ($1, $2, $3)
           ON CONFLICT (class_id, full_name) DO UPDATE SET sort_order = EXCLUDED.sort_order
           RETURNING id`,
          [classId, fullName, sSort]
        );
        roster[cname].students[fullName] = sr.rows[0].id;
      }
    }
    await client.query("COMMIT");
    res.json({ roster });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(e);
    res.status(500).json({ error: "Помилка синхронізації класів" });
  } finally {
    client.release();
  }
});

/** PUT /api/v1/tests/:externalId */
router.put("/tests/:externalId", async (req, res) => {
  const tid = req.teacher.id;
  const externalId = req.params.externalId;
  const { title, payloadJson, publishedTelegram } = req.body || {};
  if (!title || payloadJson === undefined) {
    res.status(400).json({ error: "Потрібні title та payloadJson" });
    return;
  }
  try {
    const payloadStr = typeof payloadJson === "string" ? payloadJson : JSON.stringify(payloadJson);
    const pub =
      publishedTelegram === undefined ? null : !!publishedTelegram;
    const r = await pool.query(
      `INSERT INTO tests (teacher_id, external_id, title, payload_json, published_telegram, updated_at)
       VALUES ($1, $2, $3, $4::jsonb, COALESCE($5::boolean, false), now())
       ON CONFLICT (teacher_id, external_id) DO UPDATE SET
         title = EXCLUDED.title,
         payload_json = EXCLUDED.payload_json,
         published_telegram = COALESCE($5::boolean, tests.published_telegram),
         updated_at = now()
       RETURNING id, external_id, title, published_telegram, updated_at`,
      [tid, externalId, title, payloadStr, pub]
    );
    res.json(r.rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Помилка збереження тесту" });
  }
});

router.get("/tests", async (req, res) => {
  const tid = req.teacher.id;
  try {
    const r = await pool.query(
      `SELECT id, external_id, title, published_telegram, updated_at FROM tests WHERE teacher_id = $1 ORDER BY updated_at DESC`,
      [tid]
    );
    res.json({ tests: r.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Помилка" });
  }
});

router.delete("/tests/:externalId", async (req, res) => {
  const tid = req.teacher.id;
  const externalId = req.params.externalId;
  try {
    await pool.query(`DELETE FROM tests WHERE teacher_id = $1 AND external_id = $2`, [tid, externalId]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Помилка видалення" });
  }
});

/** POST /api/v1/assignments */
router.post("/assignments", async (req, res) => {
  const tid = req.teacher.id;
  const { testExternalId, targetType, classId, studentId } = req.body || {};
  if (!testExternalId || !targetType || !["class", "user"].includes(targetType)) {
    res.status(400).json({ error: "Потрібні testExternalId та targetType (class|user)" });
    return;
  }
  if (targetType === "class" && !classId) {
    res.status(400).json({ error: "Для class потрібен classId" });
    return;
  }
  if (targetType === "user" && !studentId) {
    res.status(400).json({ error: "Для user потрібен studentId" });
    return;
  }
  try {
    const tr = await pool.query(`SELECT id FROM tests WHERE teacher_id = $1 AND external_id = $2`, [
      tid,
      testExternalId,
    ]);
    if (tr.rows.length === 0) {
      res.status(404).json({ error: "Тест не знайдено" });
      return;
    }
    const testId = tr.rows[0].id;
    if (targetType === "class") {
      const cr = await pool.query(`SELECT id FROM classes WHERE teacher_id = $1 AND id = $2`, [tid, classId]);
      if (cr.rows.length === 0) {
        res.status(404).json({ error: "Клас не знайдено" });
        return;
      }
      const ins = await pool.query(
        `INSERT INTO assignments (teacher_id, test_id, target_type, class_id, student_id, active)
         VALUES ($1, $2, 'class', $3, NULL, true) RETURNING id`,
        [tid, testId, classId]
      );
      res.json({ id: ins.rows[0].id });
    } else {
      const sr = await pool.query(
        `SELECT s.id FROM students s JOIN classes c ON c.id = s.class_id WHERE c.teacher_id = $1 AND s.id = $2`,
        [tid, studentId]
      );
      if (sr.rows.length === 0) {
        res.status(404).json({ error: "Учень не знайдено" });
        return;
      }
      const ins = await pool.query(
        `INSERT INTO assignments (teacher_id, test_id, target_type, class_id, student_id, active)
         VALUES ($1, $2, 'user', NULL, $3, true) RETURNING id`,
        [tid, testId, studentId]
      );
      res.json({ id: ins.rows[0].id });
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Помилка призначення" });
  }
});

router.get("/assignments", async (req, res) => {
  const tid = req.teacher.id;
  const testExternalId = req.query.testExternalId;
  if (!testExternalId) {
    res.status(400).json({ error: "testExternalId" });
    return;
  }
  try {
    const tr = await pool.query(`SELECT id FROM tests WHERE teacher_id = $1 AND external_id = $2`, [
      tid,
      testExternalId,
    ]);
    if (tr.rows.length === 0) {
      res.json({ assignments: [] });
      return;
    }
    const testId = tr.rows[0].id;
    const r = await pool.query(
      `SELECT a.id, a.target_type, a.class_id, a.student_id, a.active,
              c.name AS class_name, s.full_name AS student_name
       FROM assignments a
       LEFT JOIN classes c ON c.id = a.class_id
       LEFT JOIN students s ON s.id = a.student_id
       WHERE a.teacher_id = $1 AND a.test_id = $2`,
      [tid, testId]
    );
    res.json({ assignments: r.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Помилка" });
  }
});

router.delete("/assignments/:id", async (req, res) => {
  const tid = req.teacher.id;
  try {
    const r = await pool.query(`DELETE FROM assignments WHERE id = $1 AND teacher_id = $2 RETURNING id`, [
      req.params.id,
      tid,
    ]);
    if (r.rows.length === 0) res.status(404).json({ error: "Не знайдено" });
    else res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Помилка" });
  }
});

/** POST /api/v1/invites */
router.post("/invites", async (req, res) => {
  const tid = req.teacher.id;
  const { classId, studentId, testExternalId, expiresInDays } = req.body || {};
  const code = crypto.randomBytes(5).toString("base64url").replace(/=/g, "").slice(0, 10);
  let expiresAt = null;
  if (typeof expiresInDays === "number" && expiresInDays > 0) {
    expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);
  }
  try {
    if (testExternalId && String(testExternalId).trim()) {
      const tr = await pool.query(`SELECT id FROM tests WHERE teacher_id = $1 AND external_id = $2`, [
        tid,
        String(testExternalId).trim(),
      ]);
      if (tr.rows.length === 0) {
        res.status(404).json({ error: "Тест не знайдено" });
        return;
      }
      const testId = tr.rows[0].id;
      await pool.query(
        `INSERT INTO invites (teacher_id, class_id, student_id, test_id, code, expires_at) VALUES ($1, NULL, NULL, $2, $3, $4)`,
        [tid, testId, code, expiresAt]
      );
      const botUsername = process.env.TELEGRAM_BOT_USERNAME || "your_bot";
      const link = `https://t.me/${botUsername}?start=invite_${code}`;
      res.json({ code, link });
      return;
    }
    if (!classId && !studentId) {
      res.status(400).json({ error: "Потрібен classId, studentId або testExternalId" });
      return;
    }
    if (studentId) {
      const sr = await pool.query(
        `SELECT s.id, s.class_id FROM students s JOIN classes c ON c.id = s.class_id WHERE c.teacher_id = $1 AND s.id = $2`,
        [tid, studentId]
      );
      if (sr.rows.length === 0) {
        res.status(404).json({ error: "Учень не знайдено" });
        return;
      }
      await pool.query(
        `INSERT INTO invites (teacher_id, class_id, student_id, code, expires_at) VALUES ($1, $2, $3, $4, $5)`,
        [tid, sr.rows[0].class_id, studentId, code, expiresAt]
      );
    } else {
      const cr = await pool.query(`SELECT id FROM classes WHERE teacher_id = $1 AND id = $2`, [tid, classId]);
      if (cr.rows.length === 0) {
        res.status(404).json({ error: "Клас не знайдено" });
        return;
      }
      await pool.query(
        `INSERT INTO invites (teacher_id, class_id, student_id, code, expires_at) VALUES ($1, $2, NULL, $3, $4)`,
        [tid, classId, code, expiresAt]
      );
    }
    const botUsername = process.env.TELEGRAM_BOT_USERNAME || "your_bot";
    const link = `https://t.me/${botUsername}?start=invite_${code}`;
    res.json({ code, link });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Помилка створення запрошення" });
  }
});

/** GET /api/v1/attempts?since=ISO */
router.get("/attempts", async (req, res) => {
  const tid = req.teacher.id;
  const since = req.query.since;
  try {
    let q = `SELECT a.id, a.test_id, a.student_id, a.telegram_user_id, a.student_name, a.payload_json, a.created_at,
                    t.external_id AS test_external_id
             FROM attempts a
             JOIN tests t ON t.id = a.test_id
             WHERE a.teacher_id = $1`;
    const params = [tid];
    if (since) {
      q += ` AND a.created_at > $2::timestamptz`;
      params.push(since);
    }
    q += ` ORDER BY a.created_at ASC`;
    const r = await pool.query(q, params);
    res.json({ attempts: r.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Помилка" });
  }
});

/** PATCH учень — прив’язка Telegram (бот, інтеграції; UI десктопу не використовує) */
router.patch("/students/:id/telegram", async (req, res) => {
  const tid = req.teacher.id;
  const studentId = req.params.id;
  const { telegramUserId, telegramUsername, unlink } = req.body || {};
  const tgId =
    telegramUserId != null && String(telegramUserId).trim() !== ""
      ? String(telegramUserId).trim()
      : null;
  const tgUser =
    telegramUsername != null && String(telegramUsername).trim() !== ""
      ? String(telegramUsername).replace(/^@/, "").trim()
      : null;
  try {
    const r = await pool.query(
      `UPDATE students s SET
          telegram_user_id = CASE WHEN $5::boolean THEN NULL ELSE COALESCE($3::bigint, s.telegram_user_id) END,
          telegram_username = CASE WHEN $5::boolean THEN NULL ELSE COALESCE($4, s.telegram_username) END
       FROM classes c
       WHERE s.id = $1::uuid AND s.class_id = c.id AND c.teacher_id = $2::uuid
       RETURNING s.id`,
      [studentId, tid, tgId, tgUser, !!unlink]
    );
    if (r.rows.length === 0) res.status(404).json({ error: "Не знайдено" });
    else res.json({ ok: true });
  } catch (e) {
    if (e.code === "23505") {
      res.status(409).json({ error: "Цей Telegram вже прив’язано до іншого учня" });
      return;
    }
    console.error(e);
    res.status(500).json({ error: "Помилка" });
  }
});

/** POST /api/v1/notify — надіслати повідомлення учню в Telegram після оцінювання */
router.post("/notify", async (req, res) => {
  const { chatId, message } = req.body || {};
  if (!chatId || !message) {
    res.status(400).json({ error: "Потрібні chatId та message" });
    return;
  }
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    res.status(503).json({ error: "TELEGRAM_BOT_TOKEN не налаштовано на сервері" });
    return;
  }
  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const tgRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: "HTML" }),
    });
    const data = await tgRes.json();
    if (!data.ok) {
      console.error("telegram.sendMessage failed", { chatId, error: data.description });
      res.status(502).json({ error: data.description || "Telegram API error" });
      return;
    }
    res.json({ ok: true });
  } catch (e) {
    console.error("notify failed", { chatId, err: e.message });
    res.status(500).json({ error: "Помилка надсилання повідомлення" });
  }
});

module.exports = router;
