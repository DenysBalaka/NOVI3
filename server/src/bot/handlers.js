const { Telegraf, Markup } = require("telegraf");
const { buildRunTest, calcScore, dataUrlToBuffer, shuffleArray } = require("../testLogic");
const Q = require("./queries");

const MENU_BTN_CHOOSE_TEST = "📋 Обрати тест";
const sessions = new Map();

/** У групі ctx.chat.id — id чату (−100…), а не учня. Для БД і прив’язки потрібен id користувача (from.id). */
function dbTelegramUserId(ctx) {
  if (ctx?.from?.id != null) return ctx.from.id;
  return ctx?.chat?.id;
}

/** Сесія в групі — на користувача (чат+user), у приватному — лише chat.id */
function sessionKey(ctx) {
  const chat = ctx?.chat;
  const from = ctx?.from;
  if (!chat) return "0";
  if (chat.type === "private") return String(chat.id);
  if (from?.id != null) return `${chat.id}:${from.id}`;
  return String(chat.id);
}

function replyMainMenu() {
  return Markup.keyboard([[MENU_BTN_CHOOSE_TEST]]).resize();
}

/** Окреме повідомлення лише з reply-клавіатурою (inline + reply в одному повідомленні в Telegram неможливі). Текст — невидимий символ. */
async function sendMenuButtonKeyboard(ctx) {
  await ctx.reply("\u2060", replyMainMenu());
}

function getSession(chatId) {
  if (!sessions.has(chatId)) sessions.set(chatId, { step: "idle" });
  return sessions.get(chatId);
}

function clearSession(chatId) {
  sessions.set(chatId, { step: "idle" });
}

function escHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function truncate(s, n) {
  const t = String(s || "");
  return t.length <= n ? t : t.slice(0, n - 1) + "…";
}

function isTextQuestionTypeName(qType) {
  const t = String(qType || "").toLowerCase().trim();
  return t === "text" || t === "textarea" || t === "open";
}

function logError(op, ctx, err) {
  console.error("op failed", {
    op,
    ...ctx,
    err: { name: err?.name, message: err?.message, stack: err?.stack },
  });
}

function parseTestPayload(payload) {
  if (payload == null) return null;
  if (typeof payload === "string") {
    try {
      return JSON.parse(payload);
    } catch (e) {
      return null;
    }
  }
  if (typeof payload === "object") return payload;
  return null;
}

function validateTestShape(test) {
  if (!test || typeof test !== "object") return { ok: false, reason: "empty" };
  if (!Array.isArray(test.questions)) return { ok: false, reason: "questions_not_array" };
  if (test.questions.length === 0) return { ok: false, reason: "questions_empty" };
  return { ok: true };
}

function radioKeyboard(qi, options) {
  const rows = [];
  (options || []).forEach((opt, oi) => {
    const raw = opt && opt.text != null ? String(opt.text) : `Варіант ${oi + 1}`;
    const label = truncate(raw.replace(/\s+/g, " ").trim(), 64) || "—";
    rows.push([Markup.button.callback(label, `r:${qi}:${oi}`)]);
  });
  return Markup.inlineKeyboard(rows);
}

function matchingKeyboard(qi, pi, rightsShuffled) {
  const rows = [];
  rightsShuffled.forEach((_, idx) => {
    const row = Math.floor(idx / 3);
    if (!rows[row]) rows[row] = [];
    const label = truncate(String(rightsShuffled[idx]), 28);
    rows[row].push(Markup.button.callback(label, `m:${qi}:${pi}:${idx}`));
  });
  return Markup.inlineKeyboard(rows);
}

async function sendQuestionPhoto(ctx, caption, dataUrl) {
  const parsed = dataUrlToBuffer(dataUrl);
  if (!parsed) {
    await ctx.reply(caption, { parse_mode: "HTML" });
    return;
  }
  await ctx.replyWithPhoto(
    { source: parsed.buffer, filename: `q.${parsed.mime.split("/")[1] || "png"}` },
    { caption, parse_mode: "HTML" }
  );
}

async function beginTestSession(ctx, row, meta = {}) {
  const sk = sessionKey(ctx);
  const replyChatId = ctx.chat.id;
  const tgUserId = dbTelegramUserId(ctx);
  const payload = row.payload_json;
  const originalTest = parseTestPayload(payload);
  const shape = validateTestShape(originalTest);
  if (!originalTest || !shape.ok) {
    logError(
      "telegram.beginTestSession.invalid_payload",
      { chatId: replyChatId, telegramUserId: tgUserId, testUuid: row?.id, reason: shape.reason },
      new Error("Invalid test payload")
    );
    await ctx.reply(
      "Не вдалося відкрити тест (пошкоджені дані). Зверніться до вчителя або спробуйте інший тест.",
      replyMainMenu()
    );
    clearSession(sk);
    return;
  }
  if (!originalTest.id) originalTest.id = row.external_id;
  if (!originalTest.title) originalTest.title = row.title;
  let built;
  try {
    built = buildRunTest(originalTest);
  } catch (e) {
    logError("telegram.beginTestSession.buildRunTest", { chatId: replyChatId, testUuid: row?.id }, e);
    await ctx.reply("Не вдалося підготувати тест. Спробуйте інший або зверніться до вчителя.", replyMainMenu());
    clearSession(sk);
    return;
  }
  const { test, questionMap, optionMaps } = built;
  const s = getSession(sk);
  Object.assign(s, {
    sessionKey: sk,
    step: "question",
    testId: row.external_id,
    cloudTestId: row.id,
    teacherId: row.teacher_id,
    studentRowId: meta.studentRowId != null ? meta.studentRowId : null,
    telegramUserId: tgUserId,
    originalTest,
    test,
    questionMap,
    optionMaps,
    answers: {},
    qi: 0,
    chatId: replyChatId,
    studentName: meta.studentName || ctx.from?.first_name || "Telegram",
    guestAge: meta.guestAge,
    guestGrade: meta.guestGrade,
  });
  await ctx.reply(`Починаємо тест «${escHtml(originalTest.title)}».`, {
    parse_mode: "HTML",
    ...Markup.removeKeyboard(),
  });
  await presentQuestion(ctx, s);
}

async function presentQuestion(ctx, session) {
  const { test } = session;
  const qi = session.qi;
  const total = test.questions.length;
  if (qi >= total) {
    return finishTest(ctx, session);
  }

  const q = test.questions[qi];
  const header = `<b>Питання ${qi + 1} з ${total}</b>\n${escHtml(q.text)}`;
  const qType = q.type;

  if (qType === "radio") {
    const opts = q.options || [];
    if (opts.length === 0) {
      session.answers[qi] = null;
      session.qi++;
      return presentQuestion(ctx, session);
    }
    const kb = radioKeyboard(qi, opts);
    if (q.image) {
      await sendQuestionPhoto(ctx, header, q.image);
      await ctx.reply("Оберіть варіант:", kb);
    } else {
      await ctx.reply(`${header}\n\nОберіть варіант:`, { parse_mode: "HTML", ...kb });
    }
    return;
  }

  if (qType === "check") {
    const opts = q.options || [];
    if (opts.length === 0) {
      session.answers[qi] = [];
      session.qi++;
      return presentQuestion(ctx, session);
    }
    const optLines = opts.map((opt, i) => `${i + 1}) ${escHtml((opt && opt.text) || "—")}`).join("\n");
    const instruct =
      `Варіанти:\n${optLines}\n\nВкажіть номери обраних варіантів через кому (наприклад: <code>1,3</code>). Нумерація з 1.`;
    if (q.image) {
      await sendQuestionPhoto(ctx, header, q.image);
      await ctx.reply(instruct, { parse_mode: "HTML" });
    } else {
      await ctx.reply(`${header}\n\n${instruct}`, { parse_mode: "HTML" });
    }
    session.step = "wait_check";
    session.pendingQi = qi;
    return;
  }

  if (isTextQuestionTypeName(qType)) {
    if (q.image) {
      await sendQuestionPhoto(ctx, header, q.image);
      await ctx.reply("Відповідь текстом:");
    } else {
      await ctx.reply(`${header}\n\nНадішліть відповідь одним повідомленням.`, { parse_mode: "HTML" });
    }
    session.step = "wait_text";
    session.pendingQi = qi;
    return;
  }

  if (qType === "matching") {
    const pairs = q.pairs || [];
    if (pairs.length === 0) {
      session.answers[qi] = [];
      session.qi++;
      return presentQuestion(ctx, session);
    }
    session.matchingQi = qi;
    session.matchingPairIdx = 0;
    session.matchingPicks = [];
    session.matchingRightsShuffled = shuffleArray(pairs.map((p) => p.right));
    return presentMatchingPair(ctx, session);
  }

  session.answers[qi] = null;
  session.qi++;
  return presentQuestion(ctx, session);
}

async function presentMatchingPair(ctx, session) {
  const qi = session.matchingQi;
  const q = session.test.questions[qi];
  const pairs = q.pairs || [];
  const pi = session.matchingPairIdx;
  const total = pairs.length;

  if (pi >= total) {
    session.answers[qi] = session.matchingPicks;
    session.qi = qi + 1;
    session.step = "question";
    delete session.matchingQi;
    delete session.matchingPairIdx;
    delete session.matchingPicks;
    delete session.matchingRightsShuffled;
    return presentQuestion(ctx, session);
  }

  const pair = pairs[pi];
  const rights = session.matchingRightsShuffled;
  const totalQ = session.test.questions.length;
  const stem = q.image && pi > 0 ? "" : `${escHtml(q.text)}\n\n`;
  const caption =
    `<b>Питання ${qi + 1} з ${totalQ}</b> (${pi + 1}/${total} — відповідність)\n${stem}` +
    `Ліва частина: <b>${escHtml(pair.left)}</b>\n\nОберіть відповідь справа:`;
  const kb = matchingKeyboard(qi, pi, rights);

  if (pi === 0 && q.image) {
    const parsed = dataUrlToBuffer(q.image);
    if (parsed) {
      await ctx.replyWithPhoto(
        { source: parsed.buffer, filename: `q.${parsed.mime.split("/")[1] || "png"}` },
        { caption, parse_mode: "HTML", ...kb }
      );
    } else {
      await ctx.reply(caption, { parse_mode: "HTML", ...kb });
    }
    return;
  }

  await ctx.reply(caption, { parse_mode: "HTML", ...kb });
}

async function finishTest(ctx, session) {
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
    source: "telegram",
    telegramChatId: session.chatId,
    cloudTestId: session.cloudTestId,
  };
  if (session.guestAge != null) attemptPayload.guestAge = session.guestAge;
  if (session.guestGrade != null && String(session.guestGrade).trim() !== "")
    attemptPayload.guestGrade = String(session.guestGrade).trim();

  try {
    await Q.insertAttempt({
      teacherId: session.teacherId,
      testId: session.cloudTestId,
      studentId: session.studentRowId,
      telegramUserId: session.telegramUserId,
      telegramChatId: session.chatId,
      studentName: session.studentName,
      payload: attemptPayload,
    });
  } catch (e) {
    console.error("[attempt insert]", e);
    await ctx.reply("Помилка збереження результату. Спробуйте пізніше.", replyMainMenu());
    clearSession(session.sessionKey != null ? session.sessionKey : String(session.chatId));
    return;
  }

  let resultMessage;
  if (score.hasTextQuestions) {
    resultMessage =
      `✅ <b>Тест завершено</b>\n\n` +
      `Учень: ${escHtml(session.studentName)}\n\n` +
      `Ваш тест містить текстові відповіді, які потребують перевірки вчителем.\n` +
      `Ви отримаєте результат після оцінювання.\n\n` +
      `Результат збережено у хмарі.\n\n` +
      `Натисніть «${MENU_BTN_CHOOSE_TEST}» внизу або /start, щоб пройти інший тест.`;
  } else {
    resultMessage =
      `✅ <b>Тест завершено</b>\n\n` +
      `Учень: ${escHtml(session.studentName)}\n` +
      `Бали: ${score.earnedPoints} з ${score.maxPoints} (${pct}%)\n` +
      `Правильних відповідей: ${score.correctCount} з ${score.totalQuestions}\n\n` +
      `Результат збережено у хмарі. Вчитель побачить його після синхронізації в TeacherJournal.\n\n` +
      `Натисніть «${MENU_BTN_CHOOSE_TEST}» внизу або /start, щоб пройти інший тест.`;
  }

  await ctx.reply(resultMessage, { parse_mode: "HTML", ...replyMainMenu() });
  clearSession(session.sessionKey != null ? session.sessionKey : String(session.chatId));
}

async function notifyTeachersFailedSelfLink(ctx, { className, fullName, reason, telegramUserId, username }) {
  const chatIds = await Q.getTeacherNotifyChatIdsForClassName(className);
  const uname = username ? `@${username}` : "—";
  const msg =
    `TeacherJournal: не вдалося автоматично прив’язати учня.\n\n` +
    `Клас: ${className}\n` +
    `ПІБ (як ввів учень): ${fullName}\n` +
    `Telegram: ${uname} (id: ${telegramUserId})\n` +
    `Причина: ${reason}\n\n` +
    `Перевірте журнал (ПІБ має збігатися) або надішліть учню посилання-запрошення з «Тести → Telegram».`;
  for (const chatId of chatIds) {
    try {
      await ctx.telegram.sendMessage(chatId, msg);
    } catch (e) {
      console.error("[notify teacher]", e.message);
    }
  }
}

async function beginSelfLinkFlow(ctx) {
  const sk = sessionKey(ctx);
  const replyChatId = ctx.chat.id;
  clearSession(sk);
  const s = getSession(sk);
  s.step = "link_class";
  s.sessionKey = sk;
  s.chatId = replyChatId;
  await ctx.reply(
    "Вітаємо! Щоб бачити тести, прив’яжіть цей Telegram до журналу.\n\n" +
      "<b>Крок 1 з 2:</b> введіть <b>назву класу</b> так само, як у вчителя в журналі (наприклад: 10-А).",
    { parse_mode: "HTML", ...replyMainMenu() }
  );
}

async function processSelfLinkName(ctx, s, fullNameText) {
  const sk = sessionKey(ctx);
  const tgUserId = dbTelegramUserId(ctx);
  const className = s.pendingClassName || "";
  const fullName = fullNameText.trim();
  if (!fullName) {
    await ctx.reply("Введіть прізвище та ім'я одним рядком.");
    return;
  }

  const rows = await Q.findStudentsByClassAndFullName(className, fullName);
  const unlinked = rows.filter((r) => r.telegram_user_id == null);

  if (unlinked.length === 1) {
    try {
      const ok = await Q.bindStudentTelegram(unlinked[0].id, tgUserId, ctx.from?.username || null);
      if (!ok) {
        await notifyTeachersFailedSelfLink(ctx, {
          className,
          fullName,
          reason: "запис учня вже прив’язаний до іншого Telegram або недоступний",
          telegramUserId: tgUserId,
          username: ctx.from?.username,
        });
        clearSession(sk);
        await ctx.reply(
          "Не вдалося завершити прив’язку. Вчителя повідомлено. Зверніться до класного керівника.",
          replyMainMenu()
        );
        return;
      }
      clearSession(sk);
      await ctx.reply(
        "Вас прив’язано до журналу. Натисніть «Обрати тест» внизу або надішліть /start.",
        replyMainMenu()
      );
    } catch (e) {
      if (e.code === "23505") {
        await notifyTeachersFailedSelfLink(ctx, {
          className,
          fullName,
          reason: "цей Telegram уже використовується в системі для іншого учня",
          telegramUserId: tgUserId,
          username: ctx.from?.username,
        });
      } else {
        console.error(e);
      }
      clearSession(sk);
      await ctx.reply(
        "Помилка прив’язки. Вчителя могли сповістити. Зверніться до вчителя.",
        replyMainMenu()
      );
    }
    return;
  }

  let reason = "не знайдено учня з таким класом і ПІБ у жодному журналі";
  if (rows.length > 0 && unlinked.length === 0) {
    reason = "учень з таким ПІБ у цьому класі вже прив’язаний до іншого Telegram";
  } else if (unlinked.length > 1) {
    reason = "знайдено кілька однакових записів у різних школах — потрібне посилання від вчителя";
  }

  await notifyTeachersFailedSelfLink(ctx, {
    className,
    fullName,
    reason,
    telegramUserId: tgUserId,
    username: ctx.from?.username,
  });
  clearSession(sk);
  const notified = (await Q.getTeacherNotifyChatIdsForClassName(className)).length > 0;
  await ctx.reply(
    "Не вдалося автоматично вас додати до журналу." +
      (notified
        ? " Вчителів з таким класом (які вказали Telegram для сповіщень) повідомлено."
        : "") +
      "\n\nЗверніться до вчителя або перевірте написання класу та ПІБ.",
    replyMainMenu()
  );
}

async function startOpenInviteTest(ctx, s) {
  const sk = sessionKey(ctx);
  const row = await Q.validateOpenTestInvite(s.inviteCode, s.inviteOpenTestId);
  if (!row) {
    await ctx.reply("Запрошення недійсне або тест знято з публікації.", replyMainMenu());
    clearSession(sk);
    return;
  }
  const name = s.guestFullName || ctx.from?.first_name || "Гість";
  const age = s.guestAge;
  const grade = s.guestGrade;
  delete s.inviteCode;
  delete s.inviteOpenTestId;
  delete s.guestFullName;
  delete s.guestAge;
  delete s.guestGrade;
  await beginTestSession(ctx, row, {
    studentRowId: null,
    studentName: name,
    guestAge: age,
    guestGrade: grade,
  });
}

async function handleStartCommand(ctx) {
  const sk = sessionKey(ctx);
  const s0 = getSession(sk);
  if (["invite_open_name", "invite_open_age", "invite_open_grade"].includes(s0.step)) {
    await ctx.reply("Завершіть кроки запрошення або надішліть /cancel.");
    return;
  }
  if (
    s0.test &&
    (s0.step === "question" || s0.step === "wait_check" || s0.step === "wait_text")
  ) {
    await ctx.reply("Ви проходите тест. Щоб скасувати: /cancel");
    return;
  }

  const raw = ctx.message.text || "";
  const parts = raw.trim().split(/\s+/);
  const payload = parts.length > 1 ? parts.slice(1).join(" ") : "";
  if (payload && (await processStartPayload(ctx, payload))) return;
  const st = await Q.getStudentByTelegram(dbTelegramUserId(ctx));
  if (st) {
    await showTestPicker(ctx);
  } else {
    await beginSelfLinkFlow(ctx);
  }
}

async function showTestPicker(ctx) {
  const sk = sessionKey(ctx);
  const replyChatId = ctx.chat.id;
  const tgUserId = dbTelegramUserId(ctx);
  const st = await Q.getStudentByTelegram(tgUserId);
  if (!st) {
    await beginSelfLinkFlow(ctx);
    return;
  }

  clearSession(sk);

  const list = await Q.getAvailableTests(tgUserId);
  if (list.length === 0) {
    await ctx.reply(
      "Наразі немає доступних тестів.\n\n" +
        "Вчитель має опублікувати тест і призначити його вам або вашому класу.",
      replyMainMenu()
    );
    return;
  }

  const rows = list.map((t) => [Markup.button.callback(truncate(t.title, 50), `p:${t.id}`)]);
  await ctx.reply("Оберіть тест:", Markup.inlineKeyboard(rows));
  await sendMenuButtonKeyboard(ctx);
  const s = getSession(sk);
  s.step = "pick";
  s.sessionKey = sk;
  s.chatId = replyChatId;
}

async function processStartPayload(ctx, payload) {
  const sk = sessionKey(ctx);
  const replyChatId = ctx.chat.id;
  const tgUserId = dbTelegramUserId(ctx);
  const username = ctx.from?.username || null;
  if (!payload || !payload.startsWith("invite_")) return false;
  const code = payload.replace(/^invite_/, "");
  const inv = await Q.getInviteByCode(code);
  if (!inv) {
    await ctx.reply("Запрошення недійсне або прострочене.");
    return true;
  }
  if (inv.expires_at && new Date(inv.expires_at) < new Date()) {
    await ctx.reply("Термін запрошення минув.");
    return true;
  }

  if (inv.test_id && !inv.student_id && !inv.class_id) {
    const s = getSession(sk);
    s.step = "invite_open_name";
    s.inviteCode = code;
    s.inviteOpenTestId = inv.test_id;
    s.sessionKey = sk;
    s.chatId = replyChatId;
    await ctx.reply(
      `Відкрите запрошення на тест.\n\n` +
        `<b>Крок 1 з 3:</b> введіть <b>ПІБ</b> повністю (одним повідомленням).`,
      { parse_mode: "HTML", ...replyMainMenu() }
    );
    return true;
  }

  if (inv.student_id) {
    try {
      const ok = await Q.bindStudentTelegram(inv.student_id, tgUserId, username);
      const check = await Q.getStudentByTelegram(tgUserId);
      if (!ok || !check) {
        await ctx.reply(
          "Не вдалося прив’язати акаунт (можливо, цей Telegram уже використовується іншим учнем)."
        );
        return true;
      }
      await ctx.reply(`Вас прив’язано до класу «${escHtml(inv.class_name || "")}». Натисніть /start, щоб обрати тест.`, {
        parse_mode: "HTML",
        ...replyMainMenu(),
      });
    } catch (e) {
      if (e.code === "23505") {
        await ctx.reply("Цей Telegram уже прив’язано до іншого учня.");
      } else {
        console.error(e);
        await ctx.reply("Помилка прив’язки.");
      }
    }
    return true;
  }

  if (inv.class_id) {
    const s = getSession(sk);
    s.step = "invite_class_name";
    s.inviteClassId = inv.class_id;
    s.sessionKey = sk;
    s.chatId = replyChatId;
    await ctx.reply(
      `Запрошення до класу «${escHtml(inv.class_name || "")}».\n\n` +
        `Введіть <b>Прізвище та ім'я</b> точно як у класному журналі (одним рядком).`,
      { parse_mode: "HTML", ...replyMainMenu() }
    );
    return true;
  }

  return false;
}

function createBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN не задано");
  }
  const bot = new Telegraf(token);

  bot.command("start", (ctx) => handleStartCommand(ctx));

  bot.hears(/^start$/i, async (ctx, next) => {
    const t = (ctx.message.text || "").trim();
    if (t.startsWith("/")) return next();
    const s = getSession(sessionKey(ctx));
    if (
      [
        "link_class",
        "link_name",
        "invite_class_name",
        "invite_open_name",
        "invite_open_age",
        "invite_open_grade",
      ].includes(s.step)
    ) {
      return next();
    }
    await handleStartCommand(ctx);
  });

  bot.command("cancel", async (ctx) => {
    clearSession(sessionKey(ctx));
    await ctx.reply("Сесію скинуто. Оберіть тест через меню внизу або /start.", replyMainMenu());
  });

  bot.on("callback_query", async (ctx) => {
    const data = ctx.callbackQuery.data || "";
    const sk = sessionKey(ctx);
    const tgUserId = dbTelegramUserId(ctx);

    if (data.startsWith("p:")) {
      const testUuid = data.slice(2);
      await ctx.answerCbQuery();
      const row = await Q.validateTestAccess(tgUserId, testUuid);
      if (!row) {
        await ctx.reply("Тест недоступний.", replyMainMenu());
        return;
      }
      await beginTestSession(ctx, row, {
        studentRowId: row.student_id,
        studentName: row.full_name,
      });
      return;
    }

    if (data.startsWith("r:")) {
      const parts = data.split(":");
      const qi = parseInt(parts[1], 10);
      const oi = parseInt(parts[2], 10);
      const s = getSession(sk);
      await ctx.answerCbQuery();
      if (s.step !== "question" || !s.test || typeof s.qi !== "number" || qi !== s.qi) return;

      s.answers[qi] = oi;
      s.qi = qi + 1;
      await presentQuestion(ctx, s);
      return;
    }

    if (data.startsWith("m:")) {
      const parts = data.split(":");
      const qi = parseInt(parts[1], 10);
      const pi = parseInt(parts[2], 10);
      const idx = parseInt(parts[3], 10);
      const s = getSession(sk);
      await ctx.answerCbQuery();
      if (s.matchingQi !== qi || s.matchingPairIdx !== pi) return;

      const q = s.test.questions[qi];
      const pair = (q.pairs || [])[pi];
      const picked = s.matchingRightsShuffled[idx];
      if (!s.matchingPicks) s.matchingPicks = [];
      s.matchingPicks[pi] = picked;
      s.matchingPairIdx = pi + 1;
      await presentMatchingPair(ctx, s);
      return;
    }

    await ctx.answerCbQuery();
  });

  bot.on("text", async (ctx) => {
    const sk = sessionKey(ctx);
    const text = (ctx.message.text || "").trim();
    if (text.startsWith("/")) return;

    const s = getSession(sk);

    if (text === MENU_BTN_CHOOSE_TEST) {
      if (s.test && (s.step === "question" || s.step === "wait_check" || s.step === "wait_text")) {
        await ctx.reply("Ви проходите тест. Щоб скасувати: /cancel");
        return;
      }
      await showTestPicker(ctx);
      return;
    }

    if (s.step === "invite_open_name") {
      if (!text.trim()) {
        await ctx.reply("Введіть непорожнє ПІБ.");
        return;
      }
      s.guestFullName = text.trim();
      s.step = "invite_open_age";
      await ctx.reply("<b>Крок 2 з 3:</b> вкажіть <b>вік</b> числом років (наприклад 15).", {
        parse_mode: "HTML",
        ...replyMainMenu(),
      });
      return;
    }

    if (s.step === "invite_open_age") {
      const age = parseInt(String(text).replace(/[^\d]/g, ""), 10);
      if (Number.isNaN(age) || age < 3 || age > 120) {
        await ctx.reply("Введіть вік одним числом (років), наприклад 14.");
        return;
      }
      s.guestAge = age;
      s.step = "invite_open_grade";
      await ctx.reply(
        "<b>Крок 3 з 3:</b> вкажіть <b>клас / курс</b> (наприклад 9-А). Якщо не застосовується — надішліть <code>—</code>.",
        { parse_mode: "HTML", ...replyMainMenu() }
      );
      return;
    }

    if (s.step === "invite_open_grade") {
      let g = text.trim();
      if (g === "—" || g === "-" || g.toLowerCase() === "немає") g = "";
      s.guestGrade = g;
      await startOpenInviteTest(ctx, s);
      return;
    }

    if (s.step === "link_class") {
      if (!text) {
        await ctx.reply("Введіть назву класу текстом.");
        return;
      }
      s.pendingClassName = text.trim();
      s.step = "link_name";
      await ctx.reply(
        "<b>Крок 2 з 2:</b> введіть <b>прізвище та ім'я</b> одним рядком — як у класному журналі вчителя.",
        { parse_mode: "HTML", ...replyMainMenu() }
      );
      return;
    }

    if (s.step === "link_name") {
      await processSelfLinkName(ctx, s, text);
      return;
    }

    if (s.step === "invite_class_name") {
      const matches = await Q.findStudentInClassByName(s.inviteClassId, text);
      if (matches.length === 0) {
        await ctx.reply("Учня з таким іменем не знайдено серед тих, хто ще не прив’язав Telegram. Перевірте написання.");
        return;
      }
      if (matches.length > 1) {
        await ctx.reply("Знайдено кілька збігів. Зверніться до вчителя за індивідуальним посиланням.");
        return;
      }
      try {
        await Q.bindStudentTelegram(matches[0].id, dbTelegramUserId(ctx), ctx.from?.username || null);
        clearSession(sk);
        await ctx.reply("Вас успішно прив’язано. Натисніть /start, щоб обрати тест.", replyMainMenu());
      } catch (e) {
        if (e.code === "23505") {
          await ctx.reply("Цей Telegram уже прив’язано до іншого учня.");
        } else {
          console.error(e);
          await ctx.reply("Помилка прив’язки.");
        }
      }
      return;
    }

    if (s.step === "idle") {
      const linked = await Q.getStudentByTelegram(dbTelegramUserId(ctx));
      if (!linked) {
        await beginSelfLinkFlow(ctx);
        return;
      }
      await ctx.reply(`Натисніть «${MENU_BTN_CHOOSE_TEST}» внизу або надішліть /start, щоб обрати тест.`, replyMainMenu());
      return;
    }
    if (s.step === "pick") {
      await ctx.reply("Оберіть тест кнопками вище або натисніть «" + MENU_BTN_CHOOSE_TEST + "» внизу.", replyMainMenu());
      return;
    }

    if (s.step === "name") {
      if (!text) {
        await ctx.reply("Введіть непорожнє ім'я.");
        return;
      }
      s.studentName = text;
      s.step = "question";
      s.qi = 0;
      await ctx.reply(`Дякую, ${escHtml(text)}. Починаємо тест.`, {
        parse_mode: "HTML",
        ...Markup.removeKeyboard(),
      });
      await presentQuestion(ctx, s);
      return;
    }

    if (s.step === "wait_check") {
      const qi = s.pendingQi;
      const q = s.test.questions[qi];
      const opts = q.options || [];
      const parts = text.split(/[,\s]+/).filter(Boolean);
      const nums = parts.map((p) => parseInt(p, 10)).filter((n) => !Number.isNaN(n));
      const zeroBased = nums.map((n) => n - 1).filter((i) => i >= 0 && i < opts.length);
      s.answers[qi] = [...new Set(zeroBased)];
      s.qi = qi + 1;
      s.step = "question";
      delete s.pendingQi;
      await presentQuestion(ctx, s);
      return;
    }

    if (s.step === "wait_text") {
      const qi = s.pendingQi;
      s.answers[qi] = text;
      s.qi = qi + 1;
      s.step = "question";
      delete s.pendingQi;
      await presentQuestion(ctx, s);
    }
  });

  bot.catch((err) => console.error("[Telegram bot]", err));

  return bot;
}

module.exports = { createBot, showTestPicker };
