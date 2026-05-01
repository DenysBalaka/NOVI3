/**
 * Локальний Telegram-бот (long polling у Electron) — режим розробки / резерв.
 * Продакшен: спільний бот на сервері (див. /server).
 */
const { Telegraf, Markup } = require("telegraf");
const fs = require("fs");
const { buildRunTest, calcScore, dataUrlToBuffer, shuffleArray } = require("./telegram_helpers");

let botInstance = null;

const sessions = new Map();

/** Текст кнопки нижнього меню (reply keyboard) — повторний вибір тесту */
const MENU_BTN_CHOOSE_TEST = "📋 Обрати тест";
const TEST_PICKER_TOOLTIP_TEXT = "📌 Цей тест буде зараховано лише за умови відповіді на всі питання";

const MAX_TRACKED_MESSAGE_IDS = 250;

function replyMainMenu() {
  const kb = Markup.keyboard([[MENU_BTN_CHOOSE_TEST]]).resize();
  if (typeof kb?.inputFieldPlaceholder === "function") {
    return kb.inputFieldPlaceholder(TEST_PICKER_TOOLTIP_TEXT);
  }
  return kb;
}

/** Окреме повідомлення лише з reply-клавіатурою (inline + reply в одному повідомленні в Telegram неможливі). */
async function sendMenuButtonKeyboard(ctx) {
  await ctx.reply(TEST_PICKER_TOOLTIP_TEXT, replyMainMenu());
}

function readJSON(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function writeJSON(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2), "utf8");
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

/** Тест у боті, якщо не вимкнено явно (false) і є хоча б одне питання */
function publishedTests(paths) {
  const tests = readJSON(paths.testsPath) || [];
  return tests.filter((t) => t.availableInTelegram !== false && (t.questions || []).length > 0);
}

function getSession(chatId) {
  if (!sessions.has(chatId)) sessions.set(chatId, { step: "idle", messageIds: [] });
  return sessions.get(chatId);
}

function clearSession(chatId) {
  const prev = sessions.get(chatId);
  sessions.set(chatId, { step: "idle", messageIds: Array.isArray(prev?.messageIds) ? prev.messageIds : [] });
}

function notify(win, kind) {
  if (win && !win.isDestroyed()) win.webContents.send("tj:data-changed", { kind });
}

function trackMessageId(session, messageId) {
  if (!session || !Number.isInteger(messageId)) return;
  if (!Array.isArray(session.messageIds)) session.messageIds = [];
  session.messageIds.push(messageId);
  if (session.messageIds.length > MAX_TRACKED_MESSAGE_IDS) {
    session.messageIds.splice(0, session.messageIds.length - MAX_TRACKED_MESSAGE_IDS);
  }
}

async function clearTrackedChatMessages(ctx, session) {
  const chatId = ctx?.chat?.id;
  if (!chatId || !session) return;

  const ids = Array.isArray(session.messageIds) ? [...new Set(session.messageIds)] : [];
  session.messageIds = [];
  if (ids.length === 0) return;

  // Видаляємо від новіших до старіших — так менше шансів впертися в обмеження редагування/видалення.
  ids.sort((a, b) => b - a);

  for (const messageId of ids) {
    try {
      // Може падати (старі повідомлення, відсутні права, вже видалено) — для UX це не критично.
      // В Telegraf deleteMessage повертає boolean.
      // eslint-disable-next-line no-await-in-loop
      await ctx.telegram.deleteMessage(chatId, messageId);
    } catch (_) {
      // Ігноруємо помилки видалення, щоб не ламати сценарій вибору тесту.
    }
  }
}

async function sendQuestionPhoto(ctx, caption, dataUrl) {
  const parsed = dataUrlToBuffer(dataUrl);
  if (!parsed) {
    await ctx.reply(caption, { parse_mode: "HTML" });
    return;
  }
  await ctx.replyWithPhoto({ source: parsed.buffer, filename: `q.${parsed.mime.split("/")[1] || "png"}` }, { caption, parse_mode: "HTML" });
}

/** Inline-кнопки з текстом варіанта (Telegram: до 64 символів на кнопку); callback_data окремо */
function radioKeyboard(qi, options) {
  const rows = [];
  (options || []).forEach((opt, oi) => {
    const raw = opt && opt.text != null ? String(opt.text) : `Варіант ${oi + 1}`;
    const label = truncate(raw.replace(/\s+/g, " ").trim(), 64) || "—";
    rows.push([Markup.button.callback(label, `r:${qi}:${oi}`)]);
  });
  return Markup.inlineKeyboard(rows);
}

function checkKeyboard(qi, options, selectedSet) {
  const picked = selectedSet instanceof Set ? selectedSet : new Set(Array.isArray(selectedSet) ? selectedSet : []);
  const rows = [];
  (options || []).forEach((opt, oi) => {
    const raw = opt && opt.text != null ? String(opt.text) : `Варіант ${oi + 1}`;
    const base = truncate(raw.replace(/\s+/g, " ").trim(), 56) || "—";
    const label = (picked.has(oi) ? "✅ " : "") + base;
    const row = Math.floor(oi / 2);
    if (!rows[row]) rows[row] = [];
    rows[row].push(Markup.button.callback(label, `c:${qi}:${oi}`));
  });
  rows.push([Markup.button.callback("Готово", `cd:${qi}`)]);
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

async function presentQuestion(ctx, paths, session) {
  session._paths = paths;
  const { test } = session;
  const qi = session.qi;
  const total = test.questions.length;
  if (qi >= total) {
    return finishTest(ctx, paths, session);
  }

  const q = test.questions[qi];
  const header = `<b>Питання ${qi + 1} з ${total}</b>\n${escHtml(q.text)}`;
  const qType = q.type;

  if (qType === "radio") {
    const opts = q.options || [];
    if (opts.length === 0) {
      session.answers[qi] = null;
      session.qi++;
      return presentQuestion(ctx, paths, session);
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
      return presentQuestion(ctx, paths, session);
    }
    // Для коротких списків — інлайн мультивибір. Для довгих — fallback на введення "1,3".
    if (opts.length <= 20) {
      session.step = "wait_check_inline";
      session.pendingQi = qi;
      session.checkSelected = session.checkSelected || {};
      if (!session.checkSelected[qi]) session.checkSelected[qi] = [];
      const kb = checkKeyboard(qi, opts, session.checkSelected[qi]);
      if (q.image) {
        await sendQuestionPhoto(ctx, header, q.image);
        await ctx.reply("Оберіть варіанти (можна кілька) і натисніть «Готово».", kb);
      } else {
        await ctx.reply(`${header}\n\nОберіть варіанти (можна кілька) і натисніть «Готово».`, { parse_mode: "HTML", ...kb });
      }
      return;
    }

    const optLines = opts.map((opt, i) => `${i + 1}) ${escHtml((opt && opt.text) || "—")}`).join("\n");
    const instruct = `Варіанти:\n${optLines}\n\nВкажіть номери обраних варіантів через кому (наприклад: <code>1,3</code>). Нумерація з 1.`;
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
      return presentQuestion(ctx, paths, session);
    }
    session.matchingQi = qi;
    session.matchingPairIdx = 0;
    session.matchingPicks = [];
    session.matchingRightsShuffled = shuffleArray(pairs.map((p) => p.right));
    return presentMatchingPair(ctx, paths, session);
  }

  session.answers[qi] = null;
  session.qi++;
  return presentQuestion(ctx, paths, session);
}

async function presentMatchingPair(ctx, paths, session) {
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
    return presentQuestion(ctx, paths, session);
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

async function finishTest(ctx, paths, session) {
  const originalTest = session.originalTest;
  const runTest = session.test;
  const answers = session.answers;
  const score = calcScore(runTest, answers);
  const pct = score.maxPoints > 0 ? Math.round((score.earnedPoints / score.maxPoints) * 100) : 0;

  const completedAt = new Date();
  const attempt = {
    testId: originalTest.id,
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
  };

  const attempts = readJSON(paths.attemptsPath) || [];
  attempts.push(attempt);
  writeJSON(paths.attemptsPath, attempts);

  notify(session._getWindow && session._getWindow(), "attempts");

  let resultMessage;
  if (score.hasTextQuestions) {
    resultMessage =
      `✅ <b>Тест завершено</b>\n\n` +
      `Учень: ${escHtml(session.studentName)}\n\n` +
      `Дякуємо за проходження тесту.\n` +
      `Ваші результати будуть оголошені після перевірки вчителем.\n\n` +
      `Результат збережено в журналі на комп'ютері вчителя.\n\n` +
      `Натисніть «${MENU_BTN_CHOOSE_TEST}» внизу або /start, щоб пройти інший тест.`;
  } else {
    resultMessage =
      `✅ <b>Тест завершено</b>\n\n` +
      `Учень: ${escHtml(session.studentName)}\n\n` +
      `Бали: ${score.earnedPoints} з ${score.maxPoints} (${pct}%)\n` +
      `Правильних відповідей: ${score.correctCount} з ${score.totalQuestions}\n\n` +
      `Дякуємо за проходження тесту!\n\n` +
      `Результат збережено в журналі на комп'ютері вчителя.\n\n` +
      `Натисніть «${MENU_BTN_CHOOSE_TEST}» внизу або /start, щоб пройти інший тест.`;
  }

  await ctx.reply(resultMessage, { parse_mode: "HTML", ...replyMainMenu() });
  clearSession(session.chatId);
}

async function showTestPicker(ctx, paths) {
  const chatId = ctx.chat.id;
  clearSession(chatId);
  const list = publishedTests(paths);
  if (list.length === 0) {
    const all = readJSON(paths.testsPath) || [];
    const withQuestions = all.filter((t) => (t.questions || []).length > 0);
    let hint = "Немає тестів, які можна пройти в боті.\n\n";
    if (all.length === 0) {
      hint += "У програмі ще немає збережених тестів.";
    } else if (withQuestions.length === 0) {
      hint += "У збережених тестів немає питань — відкрийте тест у редакторі та додайте питання.";
    } else {
      hint +=
        "Якщо тест не з’являється: у TeacherJournal відкрийте «Тести → Telegram» і увімкніть галочку «Доступний» біля потрібного тесту. Переконайтеся, що програма на ПК вчителя запущена.";
    }
    await ctx.reply(hint, replyMainMenu());
    return;
  }

  const rows = list.map((t) => [Markup.button.callback(truncate(t.title, 50), `p:${t.id}`)]);
  await ctx.reply(
    "Оберіть тест:",
    Markup.inlineKeyboard(rows)
  );
  await sendMenuButtonKeyboard(ctx);
  const s = getSession(chatId);
  s.step = "pick";
  s.chatId = chatId;
}

function makeBot(paths, getWindow) {
  const bot = new Telegraf(readJSON(paths.settingsPath)?.telegramBotToken || "");

  // Middleware: трекаємо message_id для подальшого авто-очищення чату при виборі тесту.
  // Також "обгортаємо" основні методи відповіді, щоб зберігати message_id повідомлень бота.
  bot.use(async (ctx, next) => {
    const chatId = ctx?.chat?.id;
    const s = chatId ? getSession(chatId) : null;

    const incomingId = ctx?.message?.message_id;
    if (s && Number.isInteger(incomingId)) trackMessageId(s, incomingId);

    if (s && typeof ctx?.reply === "function") {
      const origReply = ctx.reply.bind(ctx);
      ctx.reply = async (...args) => {
        const msg = await origReply(...args);
        if (msg && Number.isInteger(msg.message_id)) trackMessageId(s, msg.message_id);
        return msg;
      };
    }

    if (s && typeof ctx?.replyWithPhoto === "function") {
      const origReplyWithPhoto = ctx.replyWithPhoto.bind(ctx);
      ctx.replyWithPhoto = async (...args) => {
        const msg = await origReplyWithPhoto(...args);
        if (msg && Number.isInteger(msg.message_id)) trackMessageId(s, msg.message_id);
        return msg;
      };
    }

    return next();
  });

  bot.command("start", async (ctx) => {
    const s0 = getSession(ctx.chat.id);
    if (s0.test && (s0.step === "question" || s0.step === "wait_check" || s0.step === "wait_text")) {
      await ctx.reply("Ви проходите тест. Щоб скасувати: /cancel");
      return;
    }
    await showTestPicker(ctx, paths);
  });

  bot.command("cancel", async (ctx) => {
    clearSession(ctx.chat.id);
    await ctx.reply("Сесію скинуто. Оберіть тест через меню внизу або /start.", replyMainMenu());
  });

  bot.on("callback_query", async (ctx) => {
    const data = ctx.callbackQuery.data || "";
    const chatId = ctx.chat.id;

    if (data.startsWith("p:")) {
      const testId = data.slice(2);
      const tests = readJSON(paths.testsPath) || [];
      const originalTest = tests.find((t) => t.id === testId && t.availableInTelegram !== false);
      await ctx.answerCbQuery();
      if (!originalTest) {
        await ctx.reply("Тест недоступний.", replyMainMenu());
        return;
      }
      const { test, questionMap, optionMaps } = buildRunTest(originalTest);
      const s = getSession(chatId);
      Object.assign(s, {
        step: "name",
        testId,
        originalTest,
        test,
        questionMap,
        optionMaps,
        answers: {},
        qi: 0,
        chatId,
        _getWindow: getWindow,
        _paths: paths,
      });
      await ctx.reply("Введіть прізвище та ім'я учня одним повідомленням:", replyMainMenu());
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
      await presentQuestion(ctx, paths, s);
      return;
    }

    if (data.startsWith("c:")) {
      const parts = data.split(":");
      const qi = parseInt(parts[1], 10);
      const oi = parseInt(parts[2], 10);
      const s = getSession(chatId);
      await ctx.answerCbQuery();
      if (s.step !== "wait_check_inline" || !s.test || qi !== s.pendingQi) return;
      const opts = s.test.questions[qi]?.options || [];
      if (oi < 0 || oi >= opts.length) return;

      if (!s.checkSelected) s.checkSelected = {};
      const cur = new Set(Array.isArray(s.checkSelected[qi]) ? s.checkSelected[qi] : []);
      if (cur.has(oi)) cur.delete(oi);
      else cur.add(oi);
      s.checkSelected[qi] = [...cur].sort((a, b) => a - b);

      // Оновлюємо клавіатуру на тому ж повідомленні (якщо можливо)
      try {
        const kb = checkKeyboard(qi, opts, s.checkSelected[qi]);
        await ctx.editMessageReplyMarkup(kb.reply_markup);
      } catch (_) {
        // Якщо не можна відредагувати (старе повідомлення / немає прав) — просто ігноруємо.
      }
      return;
    }

    if (data.startsWith("cd:")) {
      const parts = data.split(":");
      const qi = parseInt(parts[1], 10);
      const s = getSession(chatId);
      await ctx.answerCbQuery();
      if (s.step !== "wait_check_inline" || !s.test || qi !== s.pendingQi) return;

      const picked = Array.isArray(s.checkSelected?.[qi]) ? s.checkSelected[qi] : [];
      s.answers[qi] = [...new Set(picked)].filter((n) => Number.isInteger(n));
      s.qi = qi + 1;
      s.step = "question";
      delete s.pendingQi;
      if (s.checkSelected) delete s.checkSelected[qi];
      await presentQuestion(ctx, paths, s);
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
      await presentMatchingPair(ctx, paths, s);
      return;
    }

    await ctx.answerCbQuery();
  });

  bot.on("text", async (ctx) => {
    const chatId = ctx.chat.id;
    const text = (ctx.message.text || "").trim();
    if (text.startsWith("/")) return;

    const s = getSession(chatId);

    if (text === MENU_BTN_CHOOSE_TEST) {
      if (s.test && (s.step === "question" || s.step === "wait_check" || s.step === "wait_text")) {
        await ctx.reply("Ви проходите тест. Щоб скасувати: /cancel");
        return;
      }
      await clearTrackedChatMessages(ctx, s);
      await showTestPicker(ctx, paths);
      return;
    }

    if (s.step === "idle") {
      await ctx.reply(
        `Натисніть «${MENU_BTN_CHOOSE_TEST}» внизу або надішліть /start, щоб обрати тест.`,
        replyMainMenu()
      );
      return;
    }
    if (s.step === "pick") {
      await ctx.reply(
        "Оберіть тест кнопками під повідомленням вище або натисніть «" + MENU_BTN_CHOOSE_TEST + "» внизу.",
        replyMainMenu()
      );
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
      await presentQuestion(ctx, paths, s);
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
      await presentQuestion(ctx, paths, s);
      return;
    }

    if (s.step === "wait_text") {
      const qi = s.pendingQi;
      s.answers[qi] = text;
      s.qi = qi + 1;
      s.step = "question";
      delete s.pendingQi;
      await presentQuestion(ctx, paths, s);
    }
  });

  return bot;
}

function startTelegramBot(paths, getWindow) {
  stopTelegramBot();
  const settings = readJSON(paths.settingsPath) || {};
  const token = (settings.telegramBotToken || "").trim();
  const localOn = settings.telegramLocalBotEnabled ?? settings.telegramBotEnabled;
  if (!localOn || !token) return { ok: true, running: false };

  const bot = makeBot(paths, getWindow);
  botInstance = bot;

  bot.catch((err) => console.error("[Telegram bot]", err));

  bot
    .launch()
    .then(() => {
      console.log("[Telegram bot] polling started");
      return bot.telegram.setMyCommands([
        { command: "start", description: "Обрати тест" },
        { command: "cancel", description: "Скасувати поточну дію" },
      ]);
    })
    .catch((e) => console.error("[Telegram bot] launch failed", e));

  return { ok: true, running: true };
}

function stopTelegramBot() {
  if (botInstance) {
    try {
      botInstance.stop("SIGINT");
    } catch (e) {
      /* ignore: можемо отримати помилку під час зупинки/перезапуску в Electron */
    }
    botInstance = null;
  }
}

module.exports = { startTelegramBot, stopTelegramBot };
