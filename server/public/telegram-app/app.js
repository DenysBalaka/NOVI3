(function () {
  const $ = (id) => document.getElementById(id);

  const screenLoading = $("screen-loading");
  const screenError = $("screen-error");
  const screenQuiz = $("screen-quiz");
  const screenDone = $("screen-done");
  const loadingText = $("loading-text");
  const errorText = $("error-text");
  const progressFill = $("progress-fill");
  const quizMeta = $("quiz-meta");
  const qImageWrap = $("q-image-wrap");
  const qImage = $("q-image");
  const qText = $("q-text");
  const qBody = $("q-body");
  const btnSubmit = $("btn-submit");
  const btnCloseError = $("btn-close-error");
  const btnCloseApp = $("btn-close-app");
  const doneMessage = $("done-message");

  let tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
  let sessionId = null;
  /** @type {Set<number>} */
  let selectedCheck = new Set();

  function show(el) {
    [screenLoading, screenError, screenQuiz, screenDone].forEach((n) => n.classList.add("hidden"));
    el.classList.remove("hidden");
  }

  function applyTheme() {
    if (!tg || !tg.themeParams) return;
    const p = tg.themeParams;
    const root = document.documentElement;
    if (p.bg_color) root.style.setProperty("--bg", p.bg_color);
    if (p.text_color) root.style.setProperty("--text", p.text_color);
    if (p.secondary_bg_color) root.style.setProperty("--card", p.secondary_bg_color);
    if (p.hint_color) root.style.setProperty("--muted", p.hint_color);
    if (p.button_color) root.style.setProperty("--accent", p.button_color);
  }

  async function api(path, body) {
    const r = await fetch(`/api/v1/telegram-webapp${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || `${r.status}`);
    return data;
  }

  async function pingBackend() {
    try {
      await fetch("/api/v1/telegram-webapp/ping", { method: "GET" });
    } catch {
      // ignore
    }
  }

  function getNavToken() {
    const u = new URL(window.location.href);
    const t = u.searchParams.get("t");
    if (!t || !String(t).trim()) return null;
    return String(t).trim();
  }

  function setProgress(qi, total) {
    const p = total > 0 ? ((qi + 1) / total) * 100 : 0;
    progressFill.style.width = `${Math.min(100, Math.max(0, p))}%`;
    quizMeta.textContent = total ? `Питання ${qi + 1} з ${total}` : "";
  }

  function renderImage(image) {
    if (image && typeof image === "string" && image.startsWith("data:")) {
      qImage.src = image;
      qImage.alt = "";
      qImageWrap.classList.remove("hidden");
    } else {
      qImage.removeAttribute("src");
      qImageWrap.classList.add("hidden");
    }
  }

  function clearQuizBody() {
    qBody.innerHTML = "";
    btnSubmit.classList.add("hidden");
    selectedCheck = new Set();
  }

  function renderView(view) {
    if (!view || view.phase === "done") return;

    const { qi, total, text, image, type } = view;
    setProgress(qi, total);
    qText.textContent = text || "—";
    renderImage(image);
    clearQuizBody();

    if (type === "radio") {
      const opts = view.options || [];
      opts.forEach((opt, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "opt";
        b.textContent = opt.text || "—";
        b.addEventListener("click", () => void sendRadio(i));
        qBody.appendChild(b);
      });
      return;
    }

    if (type === "check") {
      const opts = view.options || [];
      opts.forEach((opt, i) => {
        const row = document.createElement("div");
        row.className = "check-row";
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.id = `cb-${i}`;
        const lab = document.createElement("label");
        lab.htmlFor = `cb-${i}`;
        lab.textContent = opt.text || "—";
        cb.addEventListener("change", () => {
          if (cb.checked) selectedCheck.add(i);
          else selectedCheck.delete(i);
        });
        row.appendChild(cb);
        row.appendChild(lab);
        qBody.appendChild(row);
      });
      btnSubmit.classList.remove("hidden");
      btnSubmit.onclick = () => void sendCheck();
      return;
    }

    if (type === "text") {
      const ta = document.createElement("textarea");
      ta.className = "textarea";
      ta.id = "answer-text";
      ta.placeholder = "Ваша відповідь…";
      qBody.appendChild(ta);
      btnSubmit.classList.remove("hidden");
      btnSubmit.onclick = () => void sendText(ta.value);
      return;
    }

    if (type === "matching") {
      const left = document.createElement("div");
      left.className = "match-left";
      const line1 = document.createElement("span");
      line1.textContent = `Пара ${(view.pairIndex || 0) + 1} з ${view.pairTotal || 0}`;
      const strong = document.createElement("strong");
      strong.textContent = view.left || "";
      left.appendChild(line1);
      left.appendChild(strong);
      qBody.appendChild(left);
      const choices = view.choices || [];
      choices.forEach((c) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "opt";
        b.textContent = c.text || "—";
        b.addEventListener("click", () => void sendMatching(c.i));
        qBody.appendChild(b);
      });
    }
  }

  async function sendRadio(index) {
    await postAnswer({ index });
  }

  async function sendCheck() {
    const indices = [...selectedCheck].sort((a, b) => a - b);
    if (indices.length === 0) {
      if (tg) tg.showAlert("Оберіть хоча б один варіант.");
      else alert("Оберіть хоча б один варіант.");
      return;
    }
    await postAnswer({ indices });
  }

  async function sendText(raw) {
    const text = String(raw || "").trim();
    if (!text) {
      if (tg) tg.showAlert("Введіть відповідь.");
      else alert("Введіть відповідь.");
      return;
    }
    await postAnswer({ text });
  }

  async function sendMatching(index) {
    await postAnswer({ index });
  }

  async function postAnswer(answer) {
    if (!tg || !tg.initData) {
      errorText.textContent = "Відкрийте сторінку з Telegram (Mini App).";
      show(screenError);
      return;
    }
    try {
      loadingText.textContent = "Збереження…";
      show(screenLoading);
      const data = await api("/answer", { initData: tg.initData, sessionId, answer });
      if (data.done && data.result) {
        doneMessage.textContent = data.result.message || "";
        show(screenDone);
        if (tg) tg.expand();
        return;
      }
      show(screenQuiz);
      renderView(data.view);
    } catch (e) {
      errorText.textContent = e.message || "Помилка";
      show(screenError);
    }
  }

  function showDoneFromStart(result) {
    doneMessage.textContent = (result && result.message) || "Тест завершено.";
    show(screenDone);
  }

  async function start() {
    void pingBackend();
    const token = getNavToken();
    if (!token) {
      errorText.textContent = "Немає посилання на тест (?t=…).";
      show(screenError);
      return;
    }
    if (!tg || !tg.initData) {
      errorText.textContent = "Відкрийте через кнопку тесту в Telegram.";
      show(screenError);
      return;
    }
    try {
      loadingText.textContent = "Підготовка тесту…";
      show(screenLoading);
      const data = await api("/start", { initData: tg.initData, token });
      if (data.done && data.result) {
        showDoneFromStart(data.result);
        return;
      }
      sessionId = data.sessionId;
      show(screenQuiz);
      renderView(data.view);
    } catch (e) {
      errorText.textContent = e.message || "Помилка";
      show(screenError);
    }
  }

  btnCloseError.addEventListener("click", () => {
    if (tg) tg.close();
  });
  btnCloseApp.addEventListener("click", () => {
    if (tg) tg.close();
  });

  if (tg) {
    tg.ready();
    tg.expand();
    applyTheme();
  }
  start();
})();
