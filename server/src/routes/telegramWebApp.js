const express = require("express");
const { calcScore } = require("../testLogic");
const Q = require("../bot/queries");
const { verifyOpenTestNavToken } = require("../telegramMiniApp/sign");
const { verifyTelegramWebAppInitData, getTelegramIdsFromVerified } = require("../telegramMiniApp/initData");
const sessions = require("../telegramMiniApp/sessions");
const { createSessionFromAccessRow, buildQuestionView, advanceWithAnswer } = require("../telegramMiniApp/flow");

const router = express.Router();
router.use(express.json({ limit: "25mb" }));

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
    const token = process.env.TELEGRAM_BOT_TOKEN;
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

function verifyClient(initData) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return { ok: false, status: 503, error: "TELEGRAM_BOT_TOKEN не налаштовано" };
  const v = verifyTelegramWebAppInitData(initData, botToken, { maxAgeSec: 86400 });
  if (!v.ok) {
    return { ok: false, status: 401, error: "Невірні дані Telegram" };
  }
  const ids = getTelegramIdsFromVerified(v);
  if (ids.telegramUserId == null) {
    return { ok: false, status: 401, error: "Немає user у initData" };
  }
  return { ok: true, ...ids };
}

router.post("/start", async (req, res) => {
  try {
    const { initData, token } = req.body || {};
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const client = verifyClient(initData);
    if (!client.ok) return res.status(client.status).json({ error: client.error });

    const nav = verifyOpenTestNavToken(botToken, token);
    if (!nav) return res.status(401).json({ error: "Посилання застаріло або пошкоджене" });

    const row = await Q.validateTestAccess(client.telegramUserId, nav.testUuid);
    if (!row) return res.status(403).json({ error: "Тест недоступний" });

    const built = createSessionFromAccessRow(row, client.telegramUserId, client.telegramChatId);
    if (built.error) return res.status(400).json({ error: "Не вдалося відкрити тест" });

    const session = built.session;
    if (session.qi >= session.test.questions.length) {
      const result = await finalizeSession(session);
      return res.json({ sessionId: null, view: { phase: "done" }, done: true, result });
    }
    const sessionId = sessions.put(session);
    const view = buildQuestionView(session);
    return res.json({ sessionId, view });
  } catch (e) {
    console.error("[telegram-webapp/start]", e);
    return res.status(500).json({ error: "Помилка сервера" });
  }
});

router.post("/answer", async (req, res) => {
  try {
    const { initData, sessionId, answer } = req.body || {};
    const client = verifyClient(initData);
    if (!client.ok) return res.status(client.status).json({ error: client.error });

    const session = sessions.get(sessionId);
    if (!session) return res.status(404).json({ error: "Сесію не знайдено" });
    if (String(session.telegramUserId) !== String(client.telegramUserId)) {
      return res.status(403).json({ error: "Чужа сесія" });
    }

    const adv = advanceWithAnswer(session, answer || {});
    if (!adv.ok) return res.status(400).json({ error: adv.error || "Некоректна відповідь" });

    if (session.qi >= session.test.questions.length) {
      const result = await finalizeSession(session);
      sessions.remove(sessionId);
      return res.json({ done: true, result });
    }

    const view = buildQuestionView(session);
    return res.json({ done: false, view });
  } catch (e) {
    console.error("[telegram-webapp/answer]", e);
    return res.status(500).json({ error: "Помилка сервера" });
  }
});

module.exports = router;
