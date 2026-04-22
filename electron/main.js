// === ФАЙЛ: electron/main.js (Оновлено) ===
const { app, BrowserWindow, ipcMain, dialog, shell, net } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const ExcelJS = require("exceljs");
const { Document, Packer, Paragraph, TextRun, ImageRun } = require("docx");
const AdmZip = require("adm-zip");

const auth = require("./auth_handler.js");
const { startTelegramBot, stopTelegramBot } = require("./telegram_bot.js");

let win;

function ensureDirs(){
  const root = path.join(app.getPath("appData"), "TeacherJournal");
  const files = path.join(root, "files");
  if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive:true });
  if (!fs.existsSync(files)) fs.mkdirSync(files, { recursive:true });
  return { 
    root, 
    files, 
    lessonsPath: path.join(root, "lessons.json"),
    studentsPath: path.join(root, "students.json"),
    subjectsPath: path.join(root, "subjects.json"),
    settingsPath: path.join(root, "settings.json"),
    testsPath: path.join(root, "tests.json"),
    notesPath: path.join(root, "notes.json"),
    classOrderPath: path.join(root, "classOrder.json"),
    reportsPath: path.join(root, "reports.json"),
    attemptsPath: path.join(root, "attempts.json"),
    boardsPath: path.join(root, "boards.json"),
    schedulePath: path.join(root, "schedule.json"),
    curriculumPath: path.join(root, "curriculum.json")
  };
}
const paths = ensureDirs();
auth.init(paths.root);

function loadAppConfig() {
  try {
    const p = path.join(__dirname, "..", "app_config.json");
    if (!fs.existsSync(p)) return {};
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    console.warn("app_config.json:", e.message);
    return {};
  }
}
const appConfig = loadAppConfig();

function readSettingsJson() {
  try {
    const p = paths.settingsPath;
    if (!fs.existsSync(p)) return {};
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return {};
  }
}

function safeErrObj(err) {
  return {
    name: err && err.name ? String(err.name) : "Error",
    message: err && err.message ? String(err.message) : String(err || ""),
    stack: err && err.stack ? String(err.stack) : undefined,
  };
}

function clampInt(n, min, max, fallback) {
  const v = Number.parseInt(String(n), 10);
  if (Number.isNaN(v)) return fallback;
  return Math.max(min, Math.min(max, v));
}

function toDataSvgCaption(caption) {
  const text = String(caption || "").trim().slice(0, 80) || "Зображення";
  const bg = "#111827";
  const border = "#374151";
  const fg = "#E5E7EB";
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="420" viewBox="0 0 800 420">` +
    `<rect x="0" y="0" width="800" height="420" rx="18" ry="18" fill="${bg}" stroke="${border}" stroke-width="4"/>` +
    `<g font-family="Segoe UI, Arial, sans-serif" fill="${fg}">` +
    `<text x="40" y="72" font-size="22" opacity="0.9">AI-зображення (плейсхолдер)</text>` +
    `<text x="40" y="126" font-size="34" font-weight="700">${text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</text>` +
    `<text x="40" y="380" font-size="18" opacity="0.7">За потреби замініть на реальне фото в редакторі питання.</text>` +
    `</g>` +
    `</svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

function normalizeAiGeneratedTest(obj, { wantImages }) {
  const out = {
    title: "AI тест",
    shuffle: false,
    questions: [],
  };

  if (obj && typeof obj.title === "string" && obj.title.trim()) out.title = obj.title.trim().slice(0, 120);
  if (obj && typeof obj.shuffle === "boolean") out.shuffle = obj.shuffle;

  const qs = obj && Array.isArray(obj.questions) ? obj.questions : [];
  for (const raw of qs) {
    if (!raw || typeof raw !== "object") continue;
    let q = raw;
    let type = String(q.type || "radio").trim();
    if (type === "matching") {
      const pairs = Array.isArray(q.pairs) ? q.pairs : [];
      const fromPairs = pairs
        .map((p) => {
          if (!p || typeof p !== "object") return null;
          const left = String(p.left || "").trim().slice(0, 160);
          const right = String(p.right || "").trim().slice(0, 160);
          if (!left || !right) return null;
          return { text: `${left} → ${right}`.slice(0, 200), correct: true };
        })
        .filter(Boolean);
      if (fromPairs.length >= 2) {
        q = { ...q, type: "check", options: fromPairs };
        delete q.pairs;
        type = "check";
      } else {
        continue;
      }
    }
    if (!["radio", "check", "text"].includes(type)) continue;
    const text = String(q.text || "").trim();
    if (!text) continue;

    const points = clampInt(q.points, 1, 12, 1);

    const nq = { type, text, image: null, points };

    const cap = String(q.imageCaption || q.image_hint || q.imageHint || "").trim();
    if (wantImages && cap) nq.image = toDataSvgCaption(cap);

    if (type === "text") {
      out.questions.push(nq);
      continue;
    }

    if (type === "radio" || type === "check") {
      const opts = Array.isArray(q.options) ? q.options : [];
      const cleaned = opts
        .map((o) => {
          if (!o) return null;
          if (typeof o === "string") return { text: String(o).trim().slice(0, 200), correct: false };
          if (typeof o === "object") {
            return {
              text: String(o.text || o.value || "").trim().slice(0, 200),
              correct: o.correct === true,
            };
          }
          return null;
        })
        .filter((o) => o && o.text);
      if (cleaned.length < 2) continue;

      if (type === "radio") {
        // ensure exactly one correct
        const idx = cleaned.findIndex((o) => o.correct);
        cleaned.forEach((o, i) => (o.correct = i === (idx >= 0 ? idx : 0)));
      } else {
        // ensure at least one correct
        if (!cleaned.some((o) => o.correct)) cleaned[0].correct = true;
      }
      nq.options = cleaned.slice(0, 8);
    }

    out.questions.push(nq);
  }

  return out;
}

function extractFirstJsonObject(text) {
  const s = String(text || "");
  if (!s.trim()) return null;

  // Strip common Markdown fences
  const unfenced = s
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  // Fast path: direct JSON
  if (unfenced.startsWith("{") && unfenced.endsWith("}")) return unfenced;

  // Balanced-brace scan to find first full {...}
  let start = -1;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = 0; i < unfenced.length; i++) {
    const ch = unfenced[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === "\"") inStr = false;
      continue;
    }
    if (ch === "\"") {
      inStr = true;
      continue;
    }
    if (ch === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === "}") {
      if (depth > 0) depth--;
      if (depth === 0 && start >= 0) {
        return unfenced.slice(start, i + 1);
      }
    }
  }
  return null;
}

async function googleGenerateTestViaApi({ prompt, count, wantImages, locale = "uk" }) {
  const st = readSettingsJson();
  const apiKey = String(st.googleAiApiKey || "").trim();
  const configuredModel = String(st.googleAiModel || "gemini-2.0-flash-lite").trim();
  if (!apiKey) return { error: "AI не налаштовано. Розробник має ввести Google AI API ключ у Налаштуваннях → Розробник." };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const listModels = async () => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
    let res;
    try {
      res = await fetch(url, { method: "GET" });
    } catch (e) {
      console.error("ai.listModels fetch failed", { op: "ai.listModels.fetch", err: safeErrObj(e) });
      return { error: "Не вдалося отримати список моделей (перевірте інтернет)." };
    }
    const text = await res.text();
    if (!res.ok) {
      console.error("ai.listModels http error", { op: "ai.listModels.http", status: res.status, body: String(text || "").slice(0, 800) });
      return { error: `AI API помилка під час ListModels (HTTP ${res.status}).` };
    }
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (e) {
      console.error("ai.listModels invalid JSON", { op: "ai.listModels.parse", body: String(text || "").slice(0, 800) });
      return { error: "AI API повернуло некоректну відповідь (ListModels)." };
    }
    const models = Array.isArray(data?.models) ? data.models : [];
    const usable = models
      .map((m) => {
        const name = String(m?.name || "").trim(); // e.g. "models/gemini-2.0-flash"
        const methods = Array.isArray(m?.supportedGenerationMethods) ? m.supportedGenerationMethods : [];
        return { name, methods };
      })
      .filter((m) => m.name && m.methods.includes("generateContent"))
      .map((m) => m.name.replace(/^models\//, ""));
    return { data: usable };
  };

  const parseApiErrorMessage = (rawText) => {
    const t = String(rawText || "").trim();
    if (!t) return "";
    try {
      const j = JSON.parse(t);
      const msg = j && j.error && (j.error.message || j.error.status);
      return msg ? String(msg) : "";
    } catch {
      return t.slice(0, 400);
    }
  };

  const buildCandidateModels = (availableModels) => {
    const preferred = [
      configuredModel,
      "gemini-2.5-flash-lite",
      "gemini-2.5-flash",
      "gemini-2.0-flash-lite",
      "gemini-2.0-flash",
    ]
      .map((m) => String(m || "").trim())
      .filter(Boolean);

    const avail = Array.isArray(availableModels) ? availableModels.map((m) => String(m || "").trim()).filter(Boolean) : [];
    const ranked = [];
    const seen = new Set();
    const push = (m) => {
      if (!m || seen.has(m)) return;
      seen.add(m);
      ranked.push(m);
    };
    preferred.forEach(push);

    // додаємо будь-які доступні gemini-* flash моделі як запасні
    avail
      .filter((m) => /^gemini-/i.test(m))
      .sort((a, b) => a.localeCompare(b))
      .forEach(push);
    return ranked;
  };

  const sys = [
    "Ти — генератор тестів для шкільного журналу.",
    "Поверни ЛИШЕ валідний JSON без Markdown і без пояснень.",
    "Формат JSON:",
    "{",
    '  "title": "string",',
    '  "shuffle": false,',
    '  "questions": [',
    "    {",
    '      "type": "radio|check|text",',
    '      "text": "string",',
    '      "points": 1,',
    '      "imageCaption": "string (опціонально, якщо потрібні зображення)",',
    '      "options": [{"text":"string","correct":true|false}] (лише для radio/check),',
    "    }",
    "  ]",
    "}",
    "Правила:",
    "- Використовуй лише типи: radio (одна відповідь), check (декілька відповідей), text (відкрита текстова відповідь).",
    "- Для radio: рівно 1 правильний варіант.",
    "- Для check: 1-3 правильні варіанти.",
    "- Для text: без поля options.",
    "- Опцій максимум 4 (radio) або 6 (check).",
    "- Питань рівно стільки, скільки вказано користувачем.",
    "- Мова питань: українська.",
  ].join("\n");

  const user = [
    `Тема/побажання: ${String(prompt || "").trim()}`,
    `Кількість питань: ${count}`,
    `Потрібні зображення: ${wantImages ? "так" : "ні"}`,
  ].join("\n");

  const requestBody = {
    contents: [
      { role: "user", parts: [{ text: sys }] },
      { role: "user", parts: [{ text: user }] },
    ],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 4096,
      // Якщо API підтримує — примусити JSON-відповідь
      responseMimeType: "application/json",
    },
  };

  let lastHttp = null;
  let lastBody = "";
  // Спершу пробуємо без ListModels (швидко), але якщо впадемо в 404 по моделі — підтягнемо список моделей.
  let availableModels = null;
  let modelsToTry = buildCandidateModels(availableModels);

  for (let mi = 0; mi < modelsToTry.length; mi++) {
    const model = modelsToTry[mi];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    // retries only for transient errors
    for (let attempt = 0; attempt < 3; attempt++) {
      let res;
      try {
        res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });
      } catch (e) {
        console.error("ai.generateTest fetch failed", {
          op: "ai.generateTest.fetch",
          model,
          attempt,
          err: safeErrObj(e),
        });
        return { error: "Не вдалося підключитися до AI (перевірте інтернет)." };
      }

      const text = await res.text();
      if (res.ok) {
        // success path uses "text" below
        lastBody = text;
        lastHttp = { status: res.status, model };
        attempt = 999; // break retries
        break;
      }

      lastHttp = { status: res.status, model };
      lastBody = text;
      const apiMsg = parseApiErrorMessage(text);
      console.error("ai.generateTest http error", {
        op: "ai.generateTest.http",
        status: res.status,
        model,
        attempt,
        apiMsg: apiMsg || undefined,
        body: String(text || "").slice(0, 800),
      });

      // transient: retry with backoff
      if (res.status === 503 || res.status === 429) {
        const waitMs = 600 * Math.pow(2, attempt) + Math.floor(Math.random() * 250);
        await sleep(waitMs);
        continue;
      }

      // model not found / unsupported: fetch ListModels once and rebuild candidates
      if (res.status === 404 && availableModels == null) {
        const lm = await listModels();
        if (lm?.data && Array.isArray(lm.data) && lm.data.length > 0) {
          availableModels = lm.data;
          modelsToTry = buildCandidateModels(availableModels);
          // restart model loop from beginning with refined list
          mi = -1;
          break;
        }
      }

      // non-transient: try next model
      break;
    }

    // if we got OK response, stop trying models
    if (lastHttp && lastHttp.model === model) {
      // if lastBody is non-empty and status might still be non-ok, we continue to next model
      // We only want to stop early if it was successful; successful path sets attempt to 999 and breaks retry loop,
      // but we don't have res.ok here. We'll detect success by trying to parse JSON later; if parse fails due to error,
      // we will continue models only when status indicates model issue. For simplicity: if status is 200, stop.
      if (lastHttp.status >= 200 && lastHttp.status < 300) break;
    }
  }

  if (!lastHttp || !(lastHttp.status >= 200 && lastHttp.status < 300)) {
    const apiMsg = parseApiErrorMessage(lastBody);
    const status = lastHttp ? lastHttp.status : 0;
    const model = lastHttp ? lastHttp.model : configuredModel;
    return {
      error:
        apiMsg
          ? `AI API помилка (HTTP ${status}, модель ${model}): ${apiMsg}`
          : `AI API помилка (HTTP ${status}, модель ${model}).`,
    };
  }

  let data;
  try {
    data = lastBody ? JSON.parse(lastBody) : null;
  } catch (e) {
    console.error("ai.generateTest invalid JSON from API", { op: "ai.generateTest.parseApi", body: lastBody?.slice(0, 800) });
    return { error: "AI API повернуло некоректну відповідь." };
  }

  const outText =
    data &&
    data.candidates &&
    data.candidates[0] &&
    data.candidates[0].content &&
    Array.isArray(data.candidates[0].content.parts)
      ? data.candidates[0].content.parts.map((p) => (p && p.text ? String(p.text) : "")).join("")
      : "";

  const trimmed = String(outText || "").trim();
  if (!trimmed) {
    console.error("ai.generateTest empty model output", { op: "ai.generateTest.empty", api: data });
    return { error: "AI не згенерувало результат." };
  }

  let obj;
  try {
    const maybeJson = extractFirstJsonObject(trimmed) || trimmed;
    obj = JSON.parse(maybeJson);
  } catch (e) {
    console.error("ai.generateTest model output not JSON", { op: "ai.generateTest.parseModel", sample: trimmed.slice(0, 800) });
    return { error: "AI повернуло не JSON. Спробуйте переформулювати промпт." };
  }

  const normalized = normalizeAiGeneratedTest(obj, { wantImages });
  if (!normalized.questions || normalized.questions.length === 0) {
    console.error("ai.generateTest normalized empty", { op: "ai.generateTest.normalizeEmpty", obj });
    return { error: "AI не змогло сформувати коректні питання. Спробуйте інший запит." };
  }
  // гарантуємо рівно count (обрізаємо, якщо модель дала більше)
  normalized.questions = normalized.questions.slice(0, count);
  return { data: normalized };
}

function isPathSafe(targetPath) {
  const resolved = path.resolve(targetPath);
  return resolved.startsWith(paths.root + path.sep) || resolved === paths.root;
}

// === Керування вікном Дошки ===
let boardWindow = null;
async function createBoardWindow(boardPath) {
  if (boardWindow) {
    boardWindow.focus();
    return;
  }
  
  boardWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"), 
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  boardWindow.loadFile(path.join(__dirname, "../board_app/board.html"));
  
  boardWindow.webContents.on('did-finish-load', () => {
    boardWindow.webContents.send('board-init-data', boardPath);
  });

  boardWindow.on("close", (e) => {});

  boardWindow.on("closed", () => {
    boardWindow = null;
  });
}
// === КІНЕЦЬ БЛОКУ ДОШКИ ===


// === Головне вікно ===
function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 940,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: false, 
    icon: path.join(__dirname, "../assets/icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true
    },
  });

  win.loadFile("index.html");
  // win.webContents.openDevTools();

  win.webContents.on('context-menu', (event, params) => {
    if (params.dictionarySuggestions && params.dictionarySuggestions.length > 0) {
      win.webContents.send("show-context-menu", { 
        type: "spellcheck", 
        suggestions: params.dictionarySuggestions,
        x: params.x,
        y: params.y
      });
    } else if (params.isEditable) {
      win.webContents.send("show-context-menu", { 
        type: "edit",
        x: params.x,
        y: params.y
      });
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  const st = readSettingsJson();
  const localOn =
    !!(st.telegramLocalBotEnabled ?? st.telegramBotEnabled) &&
    String(st.telegramBotToken || "").trim().length > 0;
  if (localOn) startTelegramBot(paths, () => win);
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("before-quit", () => {
  stopTelegramBot();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// === IPC: Системні ===
ipcMain.handle("tj:win-min", () => win.minimize());
ipcMain.handle("tj:win-max", () => (win.isMaximized() ? win.unmaximize() : win.maximize()));

ipcMain.handle("tj:win-close", async () => {
  try {
    const profile = await auth.getUserProfile();
    if (profile) {
      console.log("Hiding window and syncing data before exit...");
      if (win) win.hide();
      if (boardWindow) boardWindow.hide(); 

      if (!isLocalDataEmpty()) {
        createSafetyBackup("before-exit");
        try {
          createZipBackup(CLOUD_BACKUP_PATH); 
          await auth.syncUpload(CLOUD_BACKUP_PATH); 
          try { fs.unlinkSync(CLOUD_BACKUP_PATH); } catch(e){} 
          console.log("Sync on exit successful.");
        } catch (syncErr) {
          console.error("Sync on exit failed, but safety backup exists:", syncErr.message);
        }
      } else {
        console.log("Local data empty, skipping sync on exit to preserve cloud data.");
      }
      app.quit();
    } else {
      console.log("User not logged in, closing normally.");
      app.quit(); 
    }
  } catch (authErr) {
    console.log("User not logged in (auth error), closing normally.");
    app.quit(); 
  }
});


// === IPC: Дошка ===
ipcMain.handle("tj:board-win-min", () => boardWindow?.minimize());
ipcMain.handle("tj:board-win-max", () => (boardWindow?.isMaximized() ? boardWindow.unmaximize() : boardWindow.maximize()));
ipcMain.handle("tj:board-win-close", () => boardWindow?.close());
ipcMain.handle("tj:open-board-window", (e, boardPath) => createBoardWindow(boardPath));

// === IPC: Файли ===
ipcMain.handle("tj:get-paths", () => paths);

ipcMain.handle("tj:get-app-config", () => ({ ...appConfig }));

ipcMain.handle("tj:open-external", async (_e, url) => {
  const u = typeof url === "string" ? url.trim() : "";
  if (!/^https?:\/\//i.test(u)) return { error: "Недійсне посилання" };
  try {
    await shell.openExternal(u);
    return { ok: true };
  } catch (e) {
    return { error: e.message || String(e) };
  }
});

ipcMain.handle("tj:telegram-reload", () => {
  const st = readSettingsJson();
  const localOn =
    !!(st.telegramLocalBotEnabled ?? st.telegramBotEnabled) &&
    String(st.telegramBotToken || "").trim().length > 0;
  if (localOn) startTelegramBot(paths, () => win);
  else stopTelegramBot();
  return { ok: true };
});

ipcMain.handle("tj:cloud-api", async (_e, { method = "GET", path: apiPath, body }) => {
  const settings = readSettingsJson();
  const base = String(settings.cloudApiBaseUrl || appConfig.defaultCloudApiBaseUrl || "")
    .trim()
    .replace(/\/$/, "");
  const key = String(settings.cloudApiKey || "").trim();
  if (!base) {
    return {
      error:
        "Адреса хмари не задана. Розробник має вказати defaultCloudApiBaseUrl у app_config.json або увімкніть режим розробника (Ctrl+Shift+D).",
    };
  }
  if (!key) {
    return { error: "Підключіть хмару в Налаштуваннях (обліковий запис вчителя)." };
  }
  const url = `${base}/api/v1/${String(apiPath || "").replace(/^\/+/, "")}`;
  const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body !== undefined && body !== null ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    return { error: e.message || String(e) };
  }
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { _raw: text };
  }
  if (!res.ok) {
    const msg = (data && data.error) || text || `HTTP ${res.status}`;
    return { error: msg, status: res.status };
  }
  return { data };
});

ipcMain.handle("tj:cloud-register", async (_e, { baseUrl, displayName, school }) => {
  const base = String(baseUrl || appConfig.defaultCloudApiBaseUrl || "")
    .trim()
    .replace(/\/$/, "");
  if (!base) {
    return { error: "Немає адреси сервісу. Розробник має задати defaultCloudApiBaseUrl у app_config.json." };
  }
  const url = `${base}/api/v1/register`;
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: displayName || "", school: school || "" }),
    });
  } catch (e) {
    return { error: e.message || String(e) };
  }
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = {};
  }
  if (!res.ok) {
    return { error: (data && data.error) || text || `HTTP ${res.status}` };
  }
  return { data };
});

ipcMain.handle("tj:ai-generate-test", async (_e, payload) => {
  const op = "ai.generateTest";
  try {
    const prompt = payload && payload.prompt != null ? String(payload.prompt) : "";
    const count = clampInt(payload && payload.questionCount, 1, 50, 10);
    const wantImages = !!(payload && payload.wantImages);
    if (!prompt.trim()) return { error: "Введіть тему/запит для генерації." };

    const r = await googleGenerateTestViaApi({ prompt, count, wantImages, locale: "uk" });
    if (r.error) return { error: r.error };
    return { data: r.data };
  } catch (e) {
    console.error("ai.generateTest failed", { op, err: safeErrObj(e) });
    return { error: "Не вдалося згенерувати тест. Перевірте налаштування AI та інтернет." };
  }
});

ipcMain.handle("tj:read-json", async (e, p) => {
  try {
    if (!isPathSafe(p)) { console.error(`Path rejected: ${p}`); return null; }
    if (!fs.existsSync(p)) return null;
    const data = await fs.promises.readFile(p, "utf-8");
    return JSON.parse(data);
  } catch (err) { console.error(`Failed to read ${p}:`, err); return null; }
});

ipcMain.handle("tj:write-json", async (e, p, d) => {
  try {
    if (!isPathSafe(p)) { console.error(`Path rejected: ${p}`); return false; }
    await fs.promises.writeFile(p, JSON.stringify(d, null, 2), "utf-8");
    return true;
  } catch (err) { console.error(`Failed to write ${p}:`, err); return false; }
});

ipcMain.handle("tj:choose-files", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    properties: ["openFile", "multiSelections"]
  });
  if (canceled) return []; return filePaths;
});

ipcMain.handle("tj:choose-folder", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    properties: ["openDirectory"]
  });
  if (canceled) return null; return filePaths[0];
});

ipcMain.handle("tj:add-files", async (e, filePaths) => {
  const added = [];
  for (const p of filePaths) {
    const fn = `file_${Date.now()}_${path.basename(p)}`;
    const dest = path.join(paths.files, fn);
    try {
      await fs.promises.copyFile(p, dest);
      added.push({ original_path: p, original_name: path.basename(p), saved_path: dest, type:"file" });
    } catch (err) { console.error("Failed to add file:", err); }
  }
  return added;
});

ipcMain.handle("tj:open-path", (e, p) => {
  if (!isPathSafe(p)) { console.error(`Path rejected: ${p}`); return; }
  return shell.openPath(p);
});
ipcMain.handle("tj:delete-path", async (e, p) => {
  try {
    if (!isPathSafe(p)) { console.error(`Path rejected: ${p}`); return false; }
    if (fs.existsSync(p)) await fs.promises.unlink(p);
    return true;
  } catch (err) { console.error("Failed to delete file:", err); return false; }
});

ipcMain.handle("tj:read-file-as-dataurl", async (e) => {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    properties: ["openFile"],
    filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp"] }]
  });
  if (canceled) return null;
  
  try {
    const data = await fs.promises.readFile(filePaths[0]);
    const ext = path.extname(filePaths[0]).toLowerCase();
    let mime = "image/jpeg";
    if (ext === ".png") mime = "image/png";
    else if (ext === ".gif") mime = "image/gif";
    else if (ext === ".webp") mime = "image/webp";
    return `data:${mime};base64,${data.toString("base64")}`;
  } catch (err) {
    return { error: err.message };
  }
});

// === IPC: Експорт ===

// === ЗМІНА №1: Додано діалог збереження ===
ipcMain.handle("tj:show-save-dialog", async (e, options) => {
  return await dialog.showSaveDialog(win, options);
});
// =======================================

function isExportPathSafe(targetPath) {
  if (!targetPath || typeof targetPath !== "string") return false;
  const resolved = path.resolve(targetPath);
  const home = app.getPath("home");
  const desktop = app.getPath("desktop");
  const docs = app.getPath("documents");
  const downloads = app.getPath("downloads");
  return resolved.startsWith(paths.root + path.sep) || resolved === paths.root
    || resolved.startsWith(desktop + path.sep) || resolved.startsWith(docs + path.sep)
    || resolved.startsWith(downloads + path.sep);
}

ipcMain.handle("tj:write-base64-file", async (e, p, base64) => {
  try {
    if (!p || typeof p !== "string") return { error: "Invalid path" };
    if (!isExportPathSafe(p)) return { error: "Path rejected" };
    if (!base64 || typeof base64 !== "string") return { error: "Invalid data" };
    const cleaned = base64.replace(/^data:.*?;base64,/, "");
    const buf = Buffer.from(cleaned, "base64");
    await fs.promises.writeFile(p, buf);
    return true;
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle("tj:write-csv", async (e, p, txt) => {
  try {
    if (!isExportPathSafe(p)) return { error: "Path rejected" };
    await fs.promises.writeFile(p, "\uFEFF" + txt, "utf-8");
    return true;
  } catch (err) { return { error: err.message }; }
});

/** Експорт JSON у папки користувача (Desktop/Documents/Downloads), як write-csv */
ipcMain.handle("tj:write-json-export", async (e, p, data) => {
  try {
    if (!isExportPathSafe(p)) return { error: "Path rejected" };
    await fs.promises.writeFile(p, JSON.stringify(data, null, 2), "utf-8");
    return { ok: true };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle("tj:write-xlsx", async (e, p, data) => {
  try {
    if (!isExportPathSafe(p)) return { error: "Path rejected" };
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Електронний журнал';
    workbook.created = new Date();

    const formatSheet = (sheet, rows, sheetTitle) => {
      if (!rows || rows.length === 0) return;
      
      const keys = Object.keys(rows[0]);

      const maxContentWidths = {};
      keys.forEach(key => { maxContentWidths[key] = key.length; });
      rows.forEach(row => {
        keys.forEach(key => {
          const val = String(row[key] || '');
          if (val.length > maxContentWidths[key]) maxContentWidths[key] = val.length;
        });
      });

      const columns = keys.map(key => ({
        header: key,
        key: key,
        width: Math.min(Math.max(maxContentWidths[key] + 3, 10), 40)
      }));
      sheet.columns = columns;

      rows.forEach(row => sheet.addRow(row));

      const headerRow = sheet.getRow(1);
      headerRow.height = 28;
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Calibri' };
      headerRow.fill = {
        type: 'pattern', pattern: 'solid',
        fgColor: { argb: 'FF4472C4' }
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

      const thinBorder = {
        top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        right: { style: 'thin', color: { argb: 'FFD9D9D9' } }
      };
      const headerBorder = {
        top: { style: 'thin', color: { argb: 'FF2F5496' } },
        left: { style: 'thin', color: { argb: 'FF2F5496' } },
        bottom: { style: 'medium', color: { argb: 'FF2F5496' } },
        right: { style: 'thin', color: { argb: 'FF2F5496' } }
      };

      headerRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = headerBorder;
      });

      sheet.eachRow((row, rowNumber) => {
        if (rowNumber <= 1) return;
        const isEven = rowNumber % 2 === 0;
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          cell.border = thinBorder;
          cell.alignment = { vertical: 'middle', horizontal: colNumber === 1 ? 'left' : 'center', wrapText: true };
          cell.font = { size: 10, name: 'Calibri' };
          if (isEven) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F7FB' } };
          }
          const val = String(cell.value || '');
          if (val === 'Н' || val === 'ні') {
            cell.font = { size: 10, name: 'Calibri', color: { argb: 'FFDC2626' }, bold: true };
          } else if (val === '✓' || val === 'так') {
            cell.font = { size: 10, name: 'Calibri', color: { argb: 'FF16A34A' }, bold: true };
          }
        });
      });

      sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: keys.length } };
      sheet.views = [{ state: 'frozen', ySplit: 1 }];
    };

    if (Array.isArray(data)) {
      const sheet = workbook.addWorksheet("Експорт");
      formatSheet(sheet, data, "Експорт");
    } else if (typeof data === 'object') {
      for (const [sheetName, rows] of Object.entries(data)) {
        const safeName = String(sheetName).substring(0, 31);
        const sheet = workbook.addWorksheet(safeName);
        formatSheet(sheet, rows, safeName);
      }
    }

    await workbook.xlsx.writeFile(p);
    return true;
  } catch (err) {
    console.error("Помилка експорту Excel:", err);
    return false;
  }
});

ipcMain.handle("tj:export-test-docx", async (e, p, arg1, arg2) => {
  try {
    if (!isExportPathSafe(p)) return { error: "Path rejected" };
    const { AlignmentType, HeadingLevel, BorderStyle, PageNumber, Footer, Header, TabStopPosition, TabStopType } = require("docx");
    let testTitle = "Тест";
    let questionsList = [];
    let isTeacher = false;
    let testClassName = "";

    if (arg1 && typeof arg1 === 'object' && Array.isArray(arg1.questions)) {
        testTitle = arg1.title || "Тест";
        questionsList = arg1.questions;
        testClassName = arg1.className || "";
        isTeacher = arg2 === true || arg2 === "teacher";
    } else if (typeof arg1 === 'string') {
        testTitle = arg1;
        if (Array.isArray(arg2)) {
            questionsList = arg2; 
        } else if (arg2 && typeof arg2 === 'object') {
            questionsList = arg2.questions || Object.values(arg2);
        } else if (typeof arg2 === 'string') {
            try {
                let parsed = JSON.parse(arg2);
                questionsList = Array.isArray(parsed) ? parsed : (parsed.questions || []);
            } catch(err) {}
        }
    }

    questionsList = questionsList.filter(q => q && typeof q === 'object');
    const totalPoints = questionsList.reduce((sum, q) => sum + (parseInt(q.points, 10) || 1), 0);

    const docElements = [];

    docElements.push(new Paragraph({
      children: [new TextRun({ text: testTitle, bold: true, size: 36, font: 'Calibri' })],
      alignment: "center",
      spacing: { after: 100 },
      heading: HeadingLevel.HEADING_1
    }));

    if (testClassName) {
      docElements.push(new Paragraph({
        children: [new TextRun({ text: `Клас: ${testClassName}`, size: 22, color: '666666', font: 'Calibri' })],
        alignment: "center",
        spacing: { after: 80 }
      }));
    }

    docElements.push(new Paragraph({
      children: [new TextRun({ text: `Кількість питань: ${questionsList.length}    |    Максимальний бал: ${totalPoints}`, size: 20, color: '888888', font: 'Calibri' })],
      alignment: "center",
      spacing: { after: 100 }
    }));

    docElements.push(new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '4472C4' } },
      spacing: { after: 300 }
    }));

    if (!isTeacher) {
        docElements.push(new Paragraph({
          children: [
            new TextRun({ text: "Прізвище, ім'я: ", size: 24, font: 'Calibri', bold: true }),
            new TextRun({ text: "___________________________________________", size: 24, font: 'Calibri', color: 'AAAAAA' })
          ],
          spacing: { after: 120 }
        }));
        docElements.push(new Paragraph({
          children: [
            new TextRun({ text: "Клас: ", size: 24, font: 'Calibri', bold: true }),
            new TextRun({ text: "____________", size: 24, font: 'Calibri', color: 'AAAAAA' }),
            new TextRun({ text: "          Дата: ", size: 24, font: 'Calibri', bold: true }),
            new TextRun({ text: "____________", size: 24, font: 'Calibri', color: 'AAAAAA' })
          ],
          spacing: { after: 400 }
        }));
    } else {
        docElements.push(new Paragraph({
          children: [new TextRun({ text: "⚑ ВАРІАНТ ДЛЯ ВЧИТЕЛЯ (з відповідями)", bold: true, color: "CC0000", size: 26, font: 'Calibri' })],
          spacing: { after: 400 },
          alignment: "center"
        }));
    }

    questionsList.forEach((q, index) => {
      let rawText = q.text || q.question || q.title || "Питання без тексту";
      let cleanText = String(rawText).replace(/^\d+[\.\)]\s*/, '');
      const points = parseInt(q.points, 10) || 1;
      const pointsLabel = points === 1 ? 'бал' : (points < 5 ? 'бали' : 'балів');

      docElements.push(new Paragraph({
        children: [
          new TextRun({ text: `${index + 1}. `, bold: true, size: 24, font: 'Calibri', color: '4472C4' }),
          new TextRun({ text: cleanText, size: 24, font: 'Calibri' }),
          new TextRun({ text: `  (${points} ${pointsLabel})`, size: 20, font: 'Calibri', color: '999999', italics: true }),
        ],
        spacing: { before: 300, after: 120 }
      }));

      let imgDataUrl = q.image || q.img || q.picture || q.photo;
      if (imgDataUrl && typeof imgDataUrl === 'string' && imgDataUrl.includes('base64,')) {
         try {
           const base64Data = imgDataUrl.split('base64,')[1];
           const imageBuffer = Buffer.from(base64Data, 'base64');
           docElements.push(new Paragraph({
             children: [
               new ImageRun({ data: imageBuffer, transformation: { width: 350, height: 230 } })
             ],
             alignment: "center",
             spacing: { after: 120 }
           }));
         } catch(err) {
             console.error("Не вдалося обробити фото", err);
         }
      }

      let options = q.options || q.answers || q.variants || [];
      if (Array.isArray(options) && options.length > 0) {
        const letters = ["А", "Б", "В", "Г", "Д", "Е", "Є", "Ж", "З", "И", "І"];

        options.forEach((opt, optIndex) => {
          const letter = letters[optIndex] || "-";
          let optText = "";
          let isCorrect = false;

          if (typeof opt === 'string') {
              optText = opt;
          } else if (typeof opt === 'object') {
              optText = opt.text || opt.value || opt.answer || "";
              isCorrect = opt.correct === true || opt.isCorrect === true;
          }

          const children = [];
          if (isTeacher && isCorrect) {
            children.push(new TextRun({ text: `    ${letter}) `, bold: true, size: 24, font: 'Calibri', color: '16A34A' }));
            children.push(new TextRun({ text: String(optText), bold: true, size: 24, font: 'Calibri', color: '16A34A' }));
            children.push(new TextRun({ text: "  ✓", bold: true, size: 24, font: 'Calibri', color: '16A34A' }));
          } else {
            children.push(new TextRun({ text: `    ${letter}) `, bold: true, size: 24, font: 'Calibri' }));
            children.push(new TextRun({ text: String(optText), size: 24, font: 'Calibri' }));
          }

          docElements.push(new Paragraph({ children, spacing: { after: 60 } }));
        });
      } else {
         docElements.push(new Paragraph({
            children: [new TextRun({ text: "    Відповідь: ___________________________________________________________", size: 24, font: 'Calibri', color: 'BBBBBB' })],
            spacing: { after: 120 }
         }));
         if (!isTeacher) {
             docElements.push(new Paragraph({
                children: [new TextRun({ text: "    ______________________________________________________________________", size: 24, font: 'Calibri', color: 'BBBBBB' })],
                spacing: { after: 200 }
             }));
         }
      }
    });

    const footerParagraph = new Paragraph({
      children: [
        new TextRun({ text: "Електронний журнал  •  Сторінка ", size: 16, color: 'AAAAAA', font: 'Calibri' }),
        new TextRun({ children: [PageNumber.CURRENT], size: 16, color: 'AAAAAA', font: 'Calibri' }),
        new TextRun({ text: " з ", size: 16, color: 'AAAAAA', font: 'Calibri' }),
        new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: 'AAAAAA', font: 'Calibri' }),
      ],
      alignment: "center"
    });

    const doc = new Document({
      sections: [{
        properties: {
          page: {
            margin: { top: 720, right: 720, bottom: 720, left: 720 }
          }
        },
        footers: { default: new Footer({ children: [footerParagraph] }) },
        children: docElements
      }]
    });

    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(p, buffer);
    return true;
  } catch (err) {
    console.error("Помилка експорту Docx:", err);
    return false;
  }
});


// === IPC: Google Auth & Cloud Sync ===
ipcMain.handle("tj:google-auth-start", async () => auth.startAuth());
ipcMain.handle("tj:google-logout", async () => auth.logout());
ipcMain.handle("tj:google-get-profile", async () => auth.getUserProfile());
ipcMain.handle("tj:google-get-backup-meta", async () => auth.getBackupMetadata());

// Функція для створення ZIP-архіву
function createZipBackup(targetPath) {
  try {
    const zip = new AdmZip();
    const addFileIfExists = (filePath) => {
      if (fs.existsSync(filePath)) {
        zip.addLocalFile(filePath);
      } else {
        console.warn(`Warning: File not found during backup, skipping: ${filePath}`);
      }
    };
    
    addFileIfExists(paths.lessonsPath);
    addFileIfExists(paths.studentsPath);
    addFileIfExists(paths.subjectsPath);
    addFileIfExists(paths.settingsPath);
    addFileIfExists(paths.testsPath);
    addFileIfExists(paths.notesPath);
    addFileIfExists(paths.classOrderPath);
    addFileIfExists(paths.reportsPath);
    addFileIfExists(paths.attemptsPath);
    addFileIfExists(paths.boardsPath);
    addFileIfExists(paths.schedulePath);
    addFileIfExists(paths.curriculumPath);

    if (fs.existsSync(paths.files)) {
      zip.addLocalFolder(paths.files, "files");
    }
    zip.writeZip(targetPath);
  } catch (err) {
    console.error("Failed to create ZIP backup:", err);
    throw err;
  }
}

ipcMain.handle("tj:create-backup", async () => {
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    defaultPath: `TeacherJournal_Backup_${new Date().toISOString().split('T')[0]}.zip`,
    filters: [{ name: "ZIP Archives", extensions: ["zip"] }]
  });
  if (canceled) return false;
  
  try {
    createZipBackup(filePath);
    shell.showItemInFolder(filePath);
    return true;
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle("tj:restore-backup", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    properties: ["openFile"],
    filters: [{ name: "ZIP Archives", extensions: ["zip"] }]
  });
  if (canceled) return false;
  
  try {
    const zip = new AdmZip(filePaths[0]);
    const entries = zip.getEntries();
    for (const entry of entries) {
      const target = path.resolve(paths.root, entry.entryName);
      if (!target.startsWith(paths.root + path.sep) && target !== paths.root) {
        throw new Error("ZIP contains invalid path: " + entry.entryName);
      }
    }

    if (fs.existsSync(paths.files)) {
      fs.rmSync(paths.files, { recursive: true, force: true });
    }
    fs.mkdirSync(paths.files, { recursive: true });
    
    zip.extractAllTo(paths.root, true);
    
    app.relaunch();
    app.exit();
    return true;
  } catch (err) {
    return { error: err.message };
  }
});


// === IPC: Хмарна синхронізація ===
const CLOUD_BACKUP_PATH = path.join(paths.root, "cloud_backup.zip");
const SAFETY_BACKUP_DIR = path.join(paths.root, "safety_backups");

function ensureSafetyDir() {
  if (!fs.existsSync(SAFETY_BACKUP_DIR)) {
    fs.mkdirSync(SAFETY_BACKUP_DIR, { recursive: true });
  }
}

function createSafetyBackup(reason) {
  ensureSafetyDir();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safePath = path.join(SAFETY_BACKUP_DIR, `safety_${reason}_${stamp}.zip`);
  try {
    createZipBackup(safePath);
    console.log(`Safety backup created: ${safePath}`);
    pruneSafetyBackups();
    return safePath;
  } catch (e) {
    console.error("Failed to create safety backup:", e.message);
    return null;
  }
}

function pruneSafetyBackups() {
  try {
    const MAX_BACKUPS = 5;
    const files = fs.readdirSync(SAFETY_BACKUP_DIR)
      .filter(f => f.startsWith("safety_") && f.endsWith(".zip"))
      .map(f => ({ name: f, time: fs.statSync(path.join(SAFETY_BACKUP_DIR, f)).mtimeMs }))
      .sort((a, b) => b.time - a.time);
    for (let i = MAX_BACKUPS; i < files.length; i++) {
      fs.unlinkSync(path.join(SAFETY_BACKUP_DIR, files[i].name));
    }
  } catch (e) {
    console.warn("Prune safety backups warning:", e.message);
  }
}

function isLocalDataEmpty() {
  let lessonsData = [];
  let studentsData = {};
  try {
    if (fs.existsSync(paths.lessonsPath)) {
      const content = fs.readFileSync(paths.lessonsPath, "utf-8");
      if (content) lessonsData = JSON.parse(content);
    }
    if (fs.existsSync(paths.studentsPath)) {
      const content = fs.readFileSync(paths.studentsPath, "utf-8");
      if (content) studentsData = JSON.parse(content);
    }
  } catch (e) {
    console.warn("Could not parse local data for safety check:", e.message);
  }
  const emptyLessons = !Array.isArray(lessonsData) || lessonsData.length === 0;
  const emptyStudents = typeof studentsData !== 'object' || Object.keys(studentsData).length === 0;
  return emptyLessons && emptyStudents;
}

ipcMain.handle("tj:cloud-sync-upload", async () => {
  try {
    if (isLocalDataEmpty()) {
      console.warn("Upload blocked: Local data appears empty.");
      return { error: "LOCAL_DATA_EMPTY" };
    }

    let cloudMeta = null;
    try { cloudMeta = await auth.getBackupMetadata(); } catch(e) {}

    if (cloudMeta && cloudMeta.modifiedTime) {
      const cloudDate = new Date(cloudMeta.modifiedTime);
      const localModTimes = [
        paths.lessonsPath, paths.studentsPath, paths.settingsPath,
        paths.testsPath, paths.notesPath, paths.reportsPath
      ].filter(p => fs.existsSync(p)).map(p => fs.statSync(p).mtimeMs);
      const latestLocal = Math.max(...localModTimes, 0);

      if (latestLocal > 0 && cloudDate.getTime() > latestLocal + 60000) {
        return { error: "CLOUD_IS_NEWER", cloudDate: cloudMeta.modifiedTime };
      }
    }

    createSafetyBackup("before-upload");
    createZipBackup(CLOUD_BACKUP_PATH);
    await auth.syncUpload(CLOUD_BACKUP_PATH);
    try { fs.unlinkSync(CLOUD_BACKUP_PATH); } catch(e){}
    return { success: true, date: new Date().toISOString() };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle("tj:cloud-sync-upload-force", async () => {
  try {
    if (isLocalDataEmpty()) {
      return { error: "LOCAL_DATA_EMPTY" };
    }
    createSafetyBackup("before-force-upload");
    createZipBackup(CLOUD_BACKUP_PATH);
    await auth.syncUpload(CLOUD_BACKUP_PATH);
    try { fs.unlinkSync(CLOUD_BACKUP_PATH); } catch(e){}
    return { success: true, date: new Date().toISOString() };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle("tj:cloud-sync-download", async () => {
  try {
    createSafetyBackup("before-download");

    await auth.syncDownload(CLOUD_BACKUP_PATH);
    const zip = new AdmZip(CLOUD_BACKUP_PATH);

    const entries = zip.getEntries();
    for (const entry of entries) {
      const target = path.resolve(paths.root, entry.entryName);
      if (!target.startsWith(paths.root + path.sep) && target !== paths.root) {
        throw new Error("ZIP contains invalid path: " + entry.entryName);
      }
    }

    if (fs.existsSync(paths.files)) {
      fs.rmSync(paths.files, { recursive: true, force: true });
    }
    fs.mkdirSync(paths.files, { recursive: true });
    zip.extractAllTo(paths.root, true);
    
    try { fs.unlinkSync(CLOUD_BACKUP_PATH); } catch(e){}

    app.relaunch();
    app.exit();
    return { success: true };
  } catch (err) {
    return { error: err.message };
  }
});