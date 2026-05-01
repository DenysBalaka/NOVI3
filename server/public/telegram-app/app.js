(function () {
  const $ = (id) => document.getElementById(id);

  const screens = {
    loading: $("screen-loading"),
    error: $("screen-error"),
    quiz: $("screen-quiz"),
    done: $("screen-done"),
  };
  const els = {
    loadingText: $("loading-text"),
    errorTitle: $("error-title"),
    errorText: $("error-text"),
    errorDetail: $("error-detail"),
    btnRetry: $("btn-retry"),
    btnCloseError: $("btn-close-error"),
    btnCloseApp: $("btn-close-app"),
    progressFill: $("progress-fill"),
    quizMetaQ: $("quiz-meta-question"),
    quizMetaType: $("quiz-meta-type"),
    qImageWrap: $("q-image-wrap"),
    qImage: $("q-image"),
    qText: $("q-text"),
    qHint: $("q-hint"),
    qBody: $("q-body"),
    doneMessage: $("done-message"),
    topbarTitle: $("topbar-title"),
    topbarSub: $("topbar-sub"),
    topbarMeta: $("topbar-meta"),
  };

  const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;

  /** @type {string|null} */
  let sessionId = null;
  /** @type {Set<number>} */
  let selectedCheck = new Set();
  /** @type {number|null} */
  let selectedRadio = null;
  /** @type {(() => void)|null} */
  let lastStartFn = null;
  /** Тест успішно завершено — не скасовувати сесію при закритті. */
  let testCompleted = false;
  /** Щоб не дублювати abandon. */
  let abandonSent = false;

  const TYPE_LABELS = {
    radio: "Один варіант",
    check: "Кілька варіантів",
    text: "Відкрите питання",
    matching: "Відповідність",
  };

  function show(name) {
    Object.values(screens).forEach((s) => s.classList.add("hidden"));
    screens[name].classList.remove("hidden");
    if (name !== "quiz") {
      hideMainButton();
    }
  }

  function markTestFinished() {
    testCompleted = true;
    sessionId = null;
  }

  /** Розгорнути вікно Mini App у межах Telegram (без примусового повноекрана). */
  function expandWebApp() {
    if (!tg) return;
    try {
      tg.expand();
    } catch {
      // ignore
    }
  }

  function buildAbandonPayload() {
    if (!sessionId || !tg || !tg.initData) return null;
    return JSON.stringify({ initData: tg.initData, sessionId });
  }

  function abandonBeacon() {
    if (abandonSent || testCompleted) return;
    const body = buildAbandonPayload();
    if (!body) return;
    abandonSent = true;
    const url = new URL("/api/v1/telegram-webapp/abandon", window.location.origin).href;
    try {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon && navigator.sendBeacon(url, blob)) {
        return;
      }
    } catch {
      // fall through
    }
    try {
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      });
    } catch {
      // ignore
    }
  }

  /** Офіційні десктоп-клієнти Telegram Mini App (не мобільні застосунки). */
  function isTelegramDesktopApp() {
    if (!tg || !tg.platform) return false;
    const p = String(tg.platform).toLowerCase();
    return p === "tdesktop" || p === "macos";
  }

  /** Одразу розгорнути та увімкнути повноекранний Web App на Desktop (якщо підтримує клієнт). */
  function applyDesktopFullscreen() {
    if (!isTelegramDesktopApp()) return;
    expandWebApp();
    try {
      if (typeof tg.requestFullscreen === "function") tg.requestFullscreen();
    } catch {
      // ignore
    }
  }

  function syncMainButtonStyle() {
    if (!tg || !tg.MainButton || typeof tg.MainButton.setParams !== "function") return;
    try {
      tg.MainButton.setParams({
        color: "#6366f1",
        text_color: "#ffffff",
      });
    } catch {
      // ignore
    }
  }

  function setMainButton(text, onClick) {
    if (!tg || !tg.MainButton) return false;
    try {
      if (tg.MainButton.__handler) {
        tg.MainButton.offClick(tg.MainButton.__handler);
        tg.MainButton.__handler = null;
      }
      tg.MainButton.setText(text);
      syncMainButtonStyle();
      tg.MainButton.show();
      tg.MainButton.enable();
      tg.MainButton.onClick(onClick);
      tg.MainButton.__handler = onClick;
      return true;
    } catch {
      return false;
    }
  }

  function hideMainButton() {
    if (!tg || !tg.MainButton) return;
    try {
      if (tg.MainButton.__handler) {
        tg.MainButton.offClick(tg.MainButton.__handler);
        tg.MainButton.__handler = null;
      }
      tg.MainButton.hide();
    } catch {
      // ignore
    }
  }

  function applyTheme() {
    if (!tg || !tg.themeParams) return;
    try {
      tg.setHeaderColor("secondary_bg_color");
      tg.setBackgroundColor("#0f0f11");
    } catch {
      // ignore — старі версії клієнта
    }
  }

  function haptic(kind) {
    if (!tg || !tg.HapticFeedback) return;
    try {
      if (kind === "ok") tg.HapticFeedback.impactOccurred("light");
      else if (kind === "warn") tg.HapticFeedback.notificationOccurred("warning");
      else if (kind === "error") tg.HapticFeedback.notificationOccurred("error");
      else if (kind === "success") tg.HapticFeedback.notificationOccurred("success");
    } catch {
      // ignore
    }
  }

  function alertUser(message) {
    haptic("warn");
    if (tg && tg.showAlert) {
      try {
        tg.showAlert(message);
        return;
      } catch {
        // fall through
      }
    }
    alert(message);
  }

  async function api(path, body) {
    const r = await fetch(`/api/v1/telegram-webapp${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    let data = {};
    try {
      data = await r.json();
    } catch {
      // ignore
    }
    if (!r.ok) {
      const err = new Error(data.error || `HTTP ${r.status}`);
      err.reason = data.reason || `http_${r.status}`;
      err.meta = data.meta;
      err.status = r.status;
      throw err;
    }
    return data;
  }

  function getNavToken() {
    const u = new URL(window.location.href);
    const t = u.searchParams.get("t");
    return t && String(t).trim() ? String(t).trim() : null;
  }

  function setProgress(qi, total) {
    const p = total > 0 ? ((qi + 1) / total) * 100 : 0;
    els.progressFill.style.width = `${Math.min(100, Math.max(0, p))}%`;
    els.quizMetaQ.textContent = total ? `Питання ${qi + 1} з ${total}` : "Питання";
  }

  function renderImage(image) {
    if (image && typeof image === "string" && image.startsWith("data:")) {
      els.qImage.src = image;
      els.qImage.alt = "";
      els.qImageWrap.classList.remove("hidden");
    } else {
      els.qImage.removeAttribute("src");
      els.qImageWrap.classList.add("hidden");
    }
  }

  function clearQuizBody() {
    els.qBody.innerHTML = "";
    hideMainButton();
    selectedCheck = new Set();
    selectedRadio = null;
    els.qHint.classList.add("hidden");
    els.qHint.textContent = "";
  }

  function renderRadio(view) {
    const opts = view.options || [];
    const buttons = [];
    opts.forEach((opt, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "opt";

      const bullet = document.createElement("span");
      bullet.className = "opt__bullet";
      const label = document.createElement("span");
      label.className = "opt__label";
      label.textContent = opt.text || "—";

      b.appendChild(bullet);
      b.appendChild(label);
      b.addEventListener("click", () => {
        selectedRadio = i;
        buttons.forEach((btn, idx) => btn.classList.toggle("selected", idx === i));
        haptic("ok");
      });
      els.qBody.appendChild(b);
      buttons.push(b);
    });
    const submit = () => {
      if (selectedRadio == null) {
        alertUser("Оберіть варіант, щоб продовжити.");
        return;
      }
      void postAnswer({ index: selectedRadio });
    };
    if (!setMainButton("Надіслати відповідь", submit)) {
      alertUser("Немає кнопки надсилання (відкрийте через Telegram Mini App).");
    }
  }

  function checkmarkSvg() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.setAttribute("fill", "none");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M3 8.5L6.5 12l7-7.5");
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", "2");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    svg.appendChild(path);
    return svg;
  }

  function renderCheck(view) {
    const opts = view.options || [];
    els.qHint.textContent = "Можна обрати кілька варіантів.";
    els.qHint.classList.remove("hidden");
    opts.forEach((opt, i) => {
      const row = document.createElement("div");
      row.className = "check-row";
      row.tabIndex = 0;
      row.setAttribute("role", "checkbox");
      row.setAttribute("aria-checked", "false");

      const box = document.createElement("span");
      box.className = "check-row__box";
      box.appendChild(checkmarkSvg());

      const label = document.createElement("span");
      label.className = "check-row__label";
      label.textContent = opt.text || "—";

      row.appendChild(box);
      row.appendChild(label);

      const toggle = () => {
        const isOn = selectedCheck.has(i);
        if (isOn) {
          selectedCheck.delete(i);
          row.classList.remove("selected");
          row.setAttribute("aria-checked", "false");
        } else {
          selectedCheck.add(i);
          row.classList.add("selected");
          row.setAttribute("aria-checked", "true");
        }
        haptic("ok");
      };
      row.addEventListener("click", toggle);
      row.addEventListener("keydown", (e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          toggle();
        }
      });

      els.qBody.appendChild(row);
    });

    const submit = () => {
      const indices = [...selectedCheck].sort((a, b) => a - b);
      if (indices.length === 0) {
        alertUser("Оберіть хоча б один варіант.");
        return;
      }
      void postAnswer({ indices });
    };
    if (!setMainButton("Надіслати відповідь", submit)) {
      alertUser("Немає кнопки надсилання (відкрийте через Telegram Mini App).");
    }
  }

  function renderText() {
    const ta = document.createElement("textarea");
    ta.className = "textarea";
    ta.id = "answer-text";
    ta.placeholder = "Ваша відповідь…";
    ta.autocapitalize = "sentences";
    ta.autocomplete = "off";
    ta.spellcheck = true;
    els.qBody.appendChild(ta);
    setTimeout(() => ta.focus(), 50);

    const submit = () => {
      const raw = String(ta.value || "").trim();
      if (!raw) {
        alertUser("Введіть відповідь.");
        return;
      }
      void postAnswer({ text: raw });
    };
    if (!setMainButton("Надіслати відповідь", submit)) {
      alertUser("Немає кнопки надсилання (відкрийте через Telegram Mini App).");
    }
  }

  function renderMatching(view) {
    const head = document.createElement("div");
    head.className = "match-head";
    const meta = document.createElement("div");
    meta.className = "match-head__meta";
    meta.textContent = `Пара ${(view.pairIndex || 0) + 1} з ${view.pairTotal || 0}`;
    const left = document.createElement("div");
    left.className = "match-head__left";
    left.textContent = view.left || "";
    head.appendChild(meta);
    head.appendChild(left);
    els.qBody.appendChild(head);

    const choices = view.choices || [];
    const buttons = [];
    let chosenIdx = null;
    choices.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "opt";

      const bullet = document.createElement("span");
      bullet.className = "opt__bullet";
      const label = document.createElement("span");
      label.className = "opt__label";
      label.textContent = c.text || "—";

      b.appendChild(bullet);
      b.appendChild(label);
      b.addEventListener("click", () => {
        chosenIdx = c.i;
        buttons.forEach((btn, idx) => btn.classList.toggle("selected", choices[idx].i === c.i));
        haptic("ok");
      });
      els.qBody.appendChild(b);
      buttons.push(b);
    });

    const submit = () => {
      if (chosenIdx == null) {
        alertUser("Оберіть відповідність праворуч.");
        return;
      }
      void postAnswer({ index: chosenIdx });
    };
    if (!setMainButton("Підтвердити", submit)) {
      alertUser("Немає кнопки надсилання (відкрийте через Telegram Mini App).");
    }
  }

  function renderView(view) {
    if (!view || view.phase === "done") return;
    const { qi, total, text, image, type } = view;
    setProgress(qi, total);
    els.qText.textContent = text || "—";
    els.quizMetaType.textContent = TYPE_LABELS[type] || type || "";
    renderImage(image);
    clearQuizBody();

    if (type === "radio") return renderRadio(view);
    if (type === "check") return renderCheck(view);
    if (type === "text") return renderText();
    if (type === "matching") return renderMatching(view);

    els.qHint.textContent = "Невідомий тип питання — пропускаємо.";
    els.qHint.classList.remove("hidden");
    const submit = () => void postAnswer({});
    if (!setMainButton("Далі", submit)) {
      alertUser("Немає кнопки надсилання (відкрийте через Telegram Mini App).");
    }
  }

  function showError({ title, message, detail, retry }) {
    haptic("error");
    els.errorTitle.textContent = title || "Не вдалося відкрити тест";
    els.errorText.textContent = message || "Невідома помилка";
    if (detail) {
      els.errorDetail.textContent = detail;
      els.errorDetail.classList.remove("hidden");
    } else {
      els.errorDetail.classList.add("hidden");
    }
    els.btnRetry.classList.toggle("hidden", !retry);
    els.btnRetry.onclick = retry || null;
    show("error");
  }

  function describeError(e) {
    const msg = e?.message || "Помилка";
    const reason = e?.reason || "";
    let detail = "";
    if (reason) detail += `reason: ${reason}\n`;
    if (e?.meta) {
      try {
        detail += JSON.stringify(e.meta, null, 2);
      } catch {
        // ignore
      }
    }
    return { msg, detail: detail.trim() };
  }

  async function postAnswer(answer) {
    if (!tg || !tg.initData) {
      showError({
        title: "Mini App відкрито поза Telegram",
        message: "Поверніться до бота і відкрийте тест через кнопку «📋 Обрати тест».",
      });
      return;
    }
    try {
      els.loadingText.textContent = "Збереження…";
      show("loading");
      const data = await api("/answer", { initData: tg.initData, sessionId, answer });
      if (data.done && data.result) {
        haptic("success");
        markTestFinished();
        els.doneMessage.textContent = data.result.message || "";
        show("done");
        expandWebApp();
        return;
      }
      show("quiz");
      renderView(data.view);
    } catch (e) {
      const { msg, detail } = describeError(e);
      showError({ title: "Не вдалося надіслати відповідь", message: msg, detail });
    }
  }

  function showDoneFromStart(result) {
    haptic("success");
    markTestFinished();
    els.doneMessage.textContent = (result && result.message) || "Тест завершено.";
    show("done");
  }

  async function start() {
    lastStartFn = start;
    testCompleted = false;
    abandonSent = false;
    sessionId = null;

    const token = getNavToken();
    if (!token) {
      showError({
        title: "Немає посилання на тест",
        message: "Поверніться до Telegram-бота і натисніть «📋 Обрати тест», щоб обрати тест із меню.",
      });
      return;
    }
    if (!tg || !tg.initData) {
      showError({
        title: "Mini App відкрито поза Telegram",
        message:
          "Цю сторінку треба відкривати лише через кнопку тесту в Telegram. Поверніться до чату з ботом і виберіть тест.",
      });
      return;
    }
    try {
      els.loadingText.textContent = "Підготовка тесту…";
      show("loading");
      const data = await api("/start", { initData: tg.initData, token });
      if (data.title) {
        els.topbarTitle.textContent = data.title;
        els.topbarSub.textContent = "Тестування";
      }
      if (data.studentName) {
        els.topbarMeta.textContent = data.studentName;
      }
      if (data.done && data.result) {
        showDoneFromStart(data.result);
        return;
      }
      sessionId = data.sessionId;
      abandonSent = false;
      show("quiz");
      renderView(data.view);
    } catch (e) {
      const { msg, detail } = describeError(e);
      showError({
        title: "Не вдалося відкрити тест",
        message: msg,
        detail,
        retry: () => void start(),
      });
    }
  }

  els.btnCloseError.addEventListener("click", () => {
    if (tg && tg.close) tg.close();
  });
  els.btnCloseApp.addEventListener("click", () => {
    if (tg && tg.close) tg.close();
  });
  els.btnRetry.addEventListener("click", () => {
    if (lastStartFn) void lastStartFn();
  });

  window.addEventListener("pagehide", () => {
    if (!testCompleted && sessionId && tg && tg.initData) {
      abandonBeacon();
    }
  });

  if (tg) {
    try {
      tg.ready();
      expandWebApp();
      applyDesktopFullscreen();
    } catch {
      // ignore
    }
    applyTheme();
    if (tg.onEvent) {
      tg.onEvent("themeChanged", applyTheme);
    }
  }

  start();
})();
