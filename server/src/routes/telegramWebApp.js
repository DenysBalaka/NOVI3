const express = require("express");
const { calcScore } = require("../testLogic");
const Q = require("../bot/queries");
const { verifyOpenTestNavToken } = require("../telegramMiniApp/sign");
const {
  verifyTelegramWebAppInitData,
  getTelegramIdsFromVerified,
  normalizeBotToken,
} = require("../telegramMiniApp/initData");
const sessions = require("../telegramMiniApp/sessions");
const { createSessionFromAccessRow, buildQuestionView, advanceWithAnswer } = require("../telegramMiniApp/flow");

const router = express.Router();
router.use(express.json({ limit: "25mb" }));

// Тех-діагностика: бачимо в логах, чи Mini App взагалі стукає в бекенд.
router.use((req, _res, next) => {
  console.log("[telegram-webapp]", req.method, req.path);
  next();
});

router.get("/ping", (_req, res) =>
  res.json({
    ok: true,
    ts: new Date().toISOString(),
    hasBotToken: Boolean(normalizeBotToken(process.env.TELEGRAM_BOT_TOKEN)),
  })
);

/** Хто такий бот, що стоїть за TELEGRAM_BOT_TOKEN. Корисно, коли user бачить «Невірні дані» — швидко перевіряєш bot mismatch. */
router.get("/whoami", async (_req, res) => {
  const token = normalizeBotToken(process.env.TELEGRAM_BOT_TOKEN);
  if (!token) return res.status(503).json({ ok: false, error: "TELEGRAM_BOT_TOKEN не налаштовано" });
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await r.json();
    if (!data.ok) {
      return res.status(502).json({ ok: false, error: data.description || "getMe failed" });
    }
    const me = data.result || {};
    return res.json({
      ok: true,
      bot: {
        id: me.id,
        username: me.username,
        firstName: me.first_name,
        canJoinGroups: me.can_join_groups,
        supportsInlineQueries: me.supports_inline_queries,
      },
      tokenPreview: `${token.slice(0, 6)}…${token.slice(-4)}`,
    });
  } catch (e) {
    return res.status(502).json({ ok: false, error: e?.message || "Network error" });
  }
});

function safePointsNumber(n) {
  const x = typeof n === "number" ? n : Number(n);
  return Number.isFinite(x) ? x : 0;
}

async function notifyTeacherAfterAttempt(session, score, originalTest) {
  try {
    const teacherChatId = await Q.getTeacherNotifyChatId(session.teacherId);
    if (!teacherChatId) return;
    const pct = score.maxPoints > 0 ? Math.round((score.earnedPoints / score.maxPoints) * 100) : 0;
    const pts = safePointsNumber(score.earnedPoints);
    const maxPts = safePointsNumber(score.maxPoints);
    const msg =
      `✅ Учень пройшов тест (Web App)\n\n` +
      `Учень: ${session.studentName || "—"}\n` +
      `Тест: ${originalTest?.title || "—"}\n` +
      `Бали: ${pts} з ${maxPts} (${pct}%)`;
    const token = normalizeBotToken(process.env.TELEGRAM_BOT_TOKEN);
    if (!token) return;
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const tgRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: teacherChatId, text: msg }),
    });
    const data = await tgRes.json();
    if (!data.ok) {
      console.error("telegram.sendMessage (teacher notify) failed", data.description);
    }
  } catch (e) {
    console.error("[teacher notify webapp]", e?.message || e);
  }
}

async function finalizeSession(session) {
  const originalTest = session.originalTest;
  const runTest = session.test;
  const answers = session.answers;
  const score = calcScore(runTest, answers);
  const pct = score.maxPoints > 0 ? Math.round((score.earnedPoints / score.maxPoints) * 100) : 0;
  const completedAt = new Date();

  const attemptPayload = {
    testId: originalTest.external_id || originalTest.id,
    testTitle: originalTest.title,
    studentName: session.studentName || "Telegram",
    date: completedAt.toLocaleString("uk-UA", { dateStyle: "short", timeStyle: "medium" }),
    completedAtIso: completedAt.toISOString(),
    score,
    answers,
    questions: runTest.questions,
    questionMap: session.questionMap,
    optionMaps: session.optionMaps,
    source: "telegram_webapp",
    telegramChatId: session.telegramChatId,
    cloudTestId: session.cloudTestId,
  };

  await Q.insertAttempt({
    teacherId: session.teacherId,
    testId: session.cloudTestId,
    studentId: session.studentRowId,
    telegramUserId: session.telegramUserId,
    telegramChatId: session.telegramChatId,
    studentName: session.studentName,
    payload: attemptPayload,
  });

  await notifyTeacherAfterAttempt(session, score, originalTest);

  const studentLabel = session.studentName || "Учень";
  let message;
  if (score.hasTextQuestions) {
    message =
      `✅ Тест завершено\n\n` +
      `Учень: ${studentLabel}\n\n` +
      `Є текстові відповіді — вчитель перевірить їх окремо.\n` +
      `Результат збережено.\n\n` +
      `Натисніть «Закрити» або поверніться до чату з ботом.`;
  } else {
    message =
      `✅ Тест завершено\n\n` +
      `Учень: ${studentLabel}\n` +
      `Бали: ${score.earnedPoints} з ${score.maxPoints} (${pct}%)\n` +
      `Правильних відповідей: ${score.correctCount} з ${score.totalQuestions}\n\n` +
      `Результат збережено.`;
  }

  return {
    score,
    pct,
    hasTextQuestions: score.hasTextQuestions,
    message,
  };
}

const FRIENDLY_REASONS = {
  missing_initdata: "Mini App відкрито поза Telegram або без даних авторизації.",
  missing_bot_token: "Сервер не налаштовано: відсутній TELEGRAM_BOT_TOKEN.",
  bad_bot_token_format:
    "TELEGRAM_BOT_TOKEN має вигляд 123456789:AAH… — перевірте, що в Render немає зайвих пробілів, лапок чи переносів рядка.",
  no_hash:
    "Telegram не передав поле hash (інколи при старому клієнті). Оновіть Telegram або закрийте й відкрийте тест знову.",
  bad_hash_format: "Поле hash пошкоджено. Закрийте і відкрийте тест ще раз.",
  bad_hash:
    "Застаріла або неправильна перевірка HMAC. Якщо це повторюється — оновіть застосунок на сервері; актуальні клієнти використовують поле signature (Ed25519).",
  bad_signature:
    "Підпис Ed25519 не збігся з жодним офіційним ключем Telegram. Якщо TELEGRAM_MINIAPP_TEST_ENV=true на Render, використовуйте лише разом із офіційним test-оточенням Telegram; для звичайного Telegram (учні, продакшен) цю змінну має бути вимкнено або false.",
  bad_signature_format: "Поле signature пошкоджене. Закрийте й відкрийте Mini App знову.",
  no_signature: "Внутрішня помилка перевірки signature.",
  no_auth_date: "У даних Telegram відсутня auth_date.",
  stale: "Сесію Telegram застаріло (>24 год). Поверніться до чату з ботом і відкрийте тест знову.",
  bad_user: "Telegram передав некоректне поле user.",
  bad_chat: "Telegram передав некоректне поле chat.",
};

function verifyClient(initData) {
  const botToken = normalizeBotToken(process.env.TELEGRAM_BOT_TOKEN);
  if (!botToken) {
    return {
      ok: false,
      status: 503,
      reason: "missing_bot_token",
      error: FRIENDLY_REASONS.missing_bot_token,
    };
  }
  const v = verifyTelegramWebAppInitData(initData, botToken, { maxAgeSec: 86400 });
  if (!v.ok) {
    console.warn("[telegram-webapp] initData rejected:", v.reason, v.meta || {});
    const friendly = FRIENDLY_REASONS[v.reason] || "Невірні дані Telegram";
    return {
      ok: false,
      status: 401,
      reason: v.reason,
      error: friendly,
      meta: v.meta,
    };
  }
  const ids = getTelegramIdsFromVerified(v);
  if (ids.telegramUserId == null) {
    return {
      ok: false,
      status: 401,
      reason: "no_user_id",
      error: "У даних Telegram немає id користувача.",
    };
  }
  return { ok: true, ...ids, matched: v.matched };
}

function sendVerifyError(res, client) {
  const body = { error: client.error, reason: client.reason };
  if (process.env.NODE_ENV !== "production") body.meta = client.meta;
  return res.status(client.status).json(body);
}

router.post("/start", async (req, res) => {
  try {
    const { initData, token } = req.body || {};
    const botToken = normalizeBotToken(process.env.TELEGRAM_BOT_TOKEN);
    const client = verifyClient(initData);
    if (!client.ok) return sendVerifyError(res, client);

    const nav = verifyOpenTestNavToken(botToken, token);
    if (!nav) return res.status(401).json({ error: "Посилання застаріло або пошкоджене", reason: "bad_nav_token" });

    const row = await Q.validateTestAccess(client.telegramUserId, nav.testUuid);
    if (!row) return res.status(403).json({ error: "Тест недоступний для цього акаунту.", reason: "no_access" });

    const built = createSessionFromAccessRow(row, client.telegramUserId, client.telegramChatId);
    if (built.error) return res.status(400).json({ error: "Не вдалося відкрити тест", reason: built.error });

    const session = built.session;
    if (session.qi >= session.test.questions.length) {
      const result = await finalizeSession(session);
      return res.json({ sessionId: null, view: { phase: "done" }, done: true, result });
    }
    const sessionId = sessions.put(session);
    const view = buildQuestionView(session);
    return res.json({
      sessionId,
      view,
      title: session.originalTest?.title || row.title || "Тест",
      studentName: session.studentName,
    });
  } catch (e) {
    console.error("[telegram-webapp/start]", e);
    return res.status(500).json({ error: "Помилка сервера", reason: "server_error" });
  }
});

router.post("/answer", async (req, res) => {
  try {
    const { initData, sessionId, answer } = req.body || {};
    const client = verifyClient(initData);
    if (!client.ok) return sendVerifyError(res, client);

    const session = sessions.get(sessionId);
    if (!session) return res.status(404).json({ error: "Сесію не знайдено", reason: "no_session" });
    if (String(session.telegramUserId) !== String(client.telegramUserId)) {
      return res.status(403).json({ error: "Чужа сесія", reason: "session_mismatch" });
    }

    const adv = advanceWithAnswer(session, answer || {});
    if (!adv.ok) return res.status(400).json({ error: adv.error || "Некоректна відповідь", reason: adv.error });

    if (session.qi >= session.test.questions.length) {
      const result = await finalizeSession(session);
      sessions.remove(sessionId);
      return res.json({ done: true, result });
    }

    const view = buildQuestionView(session);
    return res.json({ done: false, view });
  } catch (e) {
    console.error("[telegram-webapp/answer]", e);
    return res.status(500).json({ error: "Помилка сервера", reason: "server_error" });
  }
});

module.exports = router;
