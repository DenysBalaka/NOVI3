const { Telegraf, Markup } = require("telegraf");
const { buildRunTest, calcScore, dataUrlToBuffer, shuffleArray } = require("../testLogic");
const Q = require("./queries");

const MENU_BTN_CHOOSE_TEST = "📋 Обрати тест";
const sessions = new Map();

function replyMainMenu() {
  return Markup.keyboard([[MENU_BTN_CHOOSE_TEST]]).resize();
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
    const instruct = `Варіанти:\n${optLines}\n\nВкажіть номери правильних відповідей через кому (наприклад: <code>1,3</code>). Нумерація з 1.`;
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

  if (qType === "text") {
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
  const caption =
    `<b>Питання ${qi + 1}</b> (${pi + 1}/${total} — відповідність)\n${escHtml(q.text)}\n\n` +
    `Ліва частина: <b>${escHtml(pair.left)}</b>\n\nОберіть відповідь справа:`;
  const kb = matchingKeyboard(qi, pi, rights);
  await ctx.reply(caption, { parse_mode: "HTML", ...kb });
}

async function finishTest(ctx, session) {
  const originalTest = session.originalTest;
  const runTest = session.test;
  const answers = session.answers;
  const score = calcScore(runTest, answers);
  const pct = score.maxPoints > 0 ? Math.round((score.earnedPoints / score.maxPoints) * 100) : 0;

  const attemptPayload = {
    testId: originalTest.external_id || originalTest.id,
    testTitle: originalTest.title,
    studentName: session.studentName || "Telegram",
    date: new Date().toLocaleString("uk-UA"),
    score,
    answers,
    questions: runTest.questions,
    questionMap: session.questionMap,
    optionMaps: session.optionMaps,
    source: "telegram",
    telegramChatId: session.chatId,
    cloudTestId: session.cloudTestId,
  };

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
    clearSession(session.chatId);
    return;
  }

  await ctx.reply(
    `✅ <b>Тест завершено</b>\n\n` +
      `Учень: ${escHtml(session.studentName)}\n` +
      `Бали: ${score.earnedPoints} з ${score.maxPoints} (${pct}%)\n` +
      `Правильних відповідей: ${score.correctCount} з ${score.totalQuestions}\n\n` +
      `Результат збережено у хмарі. Вчитель побачить його після синхронізації в TeacherJournal.\n\n` +
      `Натисніть «${MENU_BTN_CHOOSE_TEST}» внизу або /start, щоб пройти інший тест.`,
    { parse_mode: "HTML", ...replyMainMenu() }
  );

  clearSession(session.chatId);
}

async function showTestPicker(ctx) {
  const chatId = ctx.chat.id;
  clearSession(chatId);
  const st = await Q.getStudentByTelegram(chatId);
  if (!st) {
    await ctx.reply(
      "Ваш Telegram ще не прив’язано до класу.\n\n" +
        "Попросіть у вчителя посилання-запрошення або щоб він додав ваш ідентифікатор у журналі.",
      replyMainMenu()
    );
    return;
  }

  const list = await Q.getAvailableTests(chatId);
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
  await ctx.reply(
    `Кнопка меню внизу: «${MENU_BTN_CHOOSE_TEST}» — знову відкрити список.`,
    replyMainMenu()
  );
  const s = getSession(chatId);
  s.step = "pick";
  s.chatId = chatId;
}

async function processStartPayload(ctx, payload) {
  const chatId = ctx.chat.id;
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

  if (inv.student_id) {
    try {
      const ok = await Q.bindStudentTelegram(inv.student_id, chatId, username);
      const check = await Q.getStudentByTelegram(chatId);
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
    const s = getSession(chatId);
    s.step = "invite_class_name";
    s.inviteClassId = inv.class_id;
    s.chatId = chatId;
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

  bot.command("start", async (ctx) => {
    const raw = ctx.message.text || "";
    const parts = raw.trim().split(/\s+/);
    const payload = parts.length > 1 ? parts.slice(1).join(" ") : "";
    if (payload && (await processStartPayload(ctx, payload))) return;
    await showTestPicker(ctx);
  });

  bot.command("cancel", async (ctx) => {
    clearSession(ctx.chat.id);
    await ctx.reply("Сесію скинуто. Оберіть тест через меню внизу або /start.", replyMainMenu());
  });

  bot.on("callback_query", async (ctx) => {
    const data = ctx.callbackQuery.data || "";
    const chatId = ctx.chat.id;

    if (data.startsWith("p:")) {
      const testUuid = data.slice(2);
      await ctx.answerCbQuery();
      const row = await Q.validateTestAccess(chatId, testUuid);
      if (!row) {
        await ctx.reply("Тест недоступний.");
        return;
      }
      const payload = row.payload_json;
      const originalTest = typeof payload === "string" ? JSON.parse(payload) : payload;
      if (!originalTest.id) originalTest.id = row.external_id;
      if (!originalTest.title) originalTest.title = row.title;
      const { test, questionMap, optionMaps } = buildRunTest(originalTest);
      const stu = await Q.getStudentByTelegram(chatId);
      const s = getSession(chatId);
      Object.assign(s, {
        step: "question",
        testId: row.external_id,
        cloudTestId: row.id,
        teacherId: row.teacher_id,
        studentRowId: stu?.id,
        telegramUserId: chatId,
        originalTest,
        test,
        questionMap,
        optionMaps,
        answers: {},
        qi: 0,
        chatId,
        studentName: stu?.full_name || ctx.from?.first_name || "Telegram",
      });
      await ctx.reply(`Починаємо тест «${escHtml(originalTest.title)}».`, { parse_mode: "HTML", ...replyMainMenu() });
      await presentQuestion(ctx, s);
      return;
    }

    if (data.startsWith("r:")) {
      const parts = data.split(":");
      const qi = parseInt(parts[1], 10);
      const oi = parseInt(parts[2], 10);
      const s = getSession(chatId);
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
      const s = getSession(chatId);
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
    const chatId = ctx.chat.id;
    const text = (ctx.message.text || "").trim();
    if (text.startsWith("/")) return;

    if (text === MENU_BTN_CHOOSE_TEST) {
      await showTestPicker(ctx);
      return;
    }

    const s = getSession(chatId);

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
        await Q.bindStudentTelegram(matches[0].id, chatId, ctx.from?.username || null);
        clearSession(chatId);
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
      await ctx.reply(`Дякую, ${escHtml(text)}. Починаємо тест.`, { parse_mode: "HTML" });
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
