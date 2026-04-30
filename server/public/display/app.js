function qs(id) {
  return document.getElementById(id);
}

function clamp(n, a, b) {
  return Math.min(b, Math.max(a, n));
}

function safeText(s) {
  return String(s ?? "");
}

function getUrlParams() {
  const u = new URL(window.location.href);
  return {
    key: u.searchParams.get("key") || "",
    interval: u.searchParams.get("interval") || "",
    autoplay: u.searchParams.get("autoplay") || "",
  };
}

function setStatus(msg, { error = false } = {}) {
  const el = qs("status");
  el.className = "status" + (error ? " status--error" : "");
  el.innerHTML = error ? `<b>Помилка:</b> ${safeText(msg)}` : safeText(msg);
}

function parseIntervalSeconds(raw) {
  const n = Number(String(raw || "").trim());
  if (!Number.isFinite(n)) return 15;
  return clamp(Math.round(n), 3, 600);
}

function isAutoplayOn(value) {
  const v = String(value || "").trim().toLowerCase();
  if (v === "0" || v === "false" || v === "off" || v === "no") return false;
  if (v === "1" || v === "true" || v === "on" || v === "yes") return true;
  return true;
}

async function apiFetch(path, apiKey) {
  const r = await fetch(path, {
    headers: {
      "x-api-key": apiKey,
    },
  });
  const text = await r.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // ignore
  }
  if (!r.ok) {
    const msg = data?.error || `${r.status} ${r.statusText}`;
    throw new Error(msg);
  }
  return data;
}

function renderTest(test, idx, total) {
  const titleEl = qs("testTitle");
  const bodyEl = qs("testBody");
  const pillIndex = qs("pillIndex");
  const pillQuestions = qs("pillQuestions");
  const smallInfo = qs("smallInfo");

  const payload = test?.payloadJson || {};
  const questions = Array.isArray(payload.questions) ? payload.questions : [];

  pillIndex.textContent = total ? `Тест ${idx + 1} / ${total}` : "—";
  pillQuestions.textContent = questions.length ? `Питань: ${questions.length}` : "Без питань";
  titleEl.textContent = safeText(test?.title || payload.title || "Без назви");

  const parts = [];
  const maxShow = 6;
  for (let i = 0; i < Math.min(questions.length, maxShow); i++) {
    const q = questions[i] || {};
    const qType = safeText(q.type || "—").toLowerCase();
    const qText = safeText(q.text || "");
    const options = Array.isArray(q.options) ? q.options : [];

    const optHtml =
      qType === "radio" || qType === "check"
        ? `<div class="opts">${options
            .slice(0, 5)
            .map((o) => `<div class="opt">${safeText(o?.text || "")}</div>`)
            .join("")}</div>`
        : qType === "matching"
          ? `<div class="opts"><div class="opt">Відповідність (matching)</div></div>`
          : `<div class="opts"><div class="opt">Відкрита відповідь</div></div>`;

    parts.push(
      `<section class="q">
        <div class="q__top">
          <div class="q__idx">Питання ${i + 1}</div>
          <div class="q__type">${safeText(qType)}</div>
        </div>
        <div class="q__text">${escapeHtml(qText) || "<span style='opacity:.65'>—</span>"}</div>
        ${optHtml}
      </section>`
    );
  }

  if (questions.length > maxShow) {
    parts.push(
      `<section class="q">
        <div class="q__text" style="opacity:.7">… ще ${questions.length - maxShow} питань</div>
      </section>`
    );
  }

  bodyEl.innerHTML = parts.join("") || `<div style="opacity:.7">У цьому тесті немає питань.</div>`;
  smallInfo.textContent = safeText(test?.externalId ? `ID: ${test.externalId}` : "");
}

function escapeHtml(s) {
  return safeText(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function createSlideshow({ getIntervalMs, onTickProgress, onNext }) {
  let t0 = 0;
  let raf = 0;
  let timer = 0;
  let running = false;

  function stop() {
    running = false;
    if (timer) clearTimeout(timer);
    if (raf) cancelAnimationFrame(raf);
    timer = 0;
    raf = 0;
    onTickProgress(0);
  }

  function start() {
    stop();
    running = true;
    t0 = performance.now();

    const intervalMs = getIntervalMs();
    timer = setTimeout(() => {
      if (!running) return;
      onNext();
      start();
    }, intervalMs);

    const loop = () => {
      if (!running) return;
      const dt = performance.now() - t0;
      const p = clamp(dt / intervalMs, 0, 1);
      onTickProgress(p);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  }

  return { start, stop, isRunning: () => running };
}

(function main() {
  const apiKeyEl = qs("apiKey");
  const intervalEl = qs("intervalSec");
  const autoplayEl = qs("autoplay");
  const btnLoad = qs("btnLoad");
  const btnPrev = qs("btnPrev");
  const btnNext = qs("btnNext");
  const btnPlayPause = qs("btnPlayPause");
  const btnFullscreen = qs("btnFullscreen");
  const progressBar = qs("progressBar");

  const params = getUrlParams();
  if (params.key) apiKeyEl.value = params.key;
  if (params.interval) intervalEl.value = params.interval;
  if (params.autoplay) autoplayEl.value = isAutoplayOn(params.autoplay) ? "on" : "off";

  /** @type {Array<{externalId:string,title:string,payloadJson:any}>} */
  let tests = [];
  let index = 0;

  function intervalMs() {
    return parseIntervalSeconds(intervalEl.value || 15) * 1000;
  }

  function autoplayOn() {
    return autoplayEl.value === "on";
  }

  function setProgress(p) {
    progressBar.style.width = `${Math.round(p * 100)}%`;
  }

  function showCurrent() {
    if (!tests.length) {
      renderTest(null, 0, 0);
      return;
    }
    index = ((index % tests.length) + tests.length) % tests.length;
    renderTest(tests[index], index, tests.length);
  }

  const slideshow = createSlideshow({
    getIntervalMs: intervalMs,
    onTickProgress: setProgress,
    onNext: () => {
      if (!tests.length) return;
      index = (index + 1) % tests.length;
      showCurrent();
    },
  });

  function syncPlayPauseBtn() {
    const running = slideshow.isRunning();
    btnPlayPause.textContent = running ? "Пауза" : "Пуск";
    btnPlayPause.classList.toggle("btn--primary", running);
  }

  function stopAutoplay() {
    slideshow.stop();
    syncPlayPauseBtn();
  }

  function startAutoplayIfEnabled() {
    if (!autoplayOn() || tests.length <= 1) {
      stopAutoplay();
      return;
    }
    slideshow.start();
    syncPlayPauseBtn();
  }

  async function loadTests() {
    const key = String(apiKeyEl.value || "").trim();
    if (!key) {
      setStatus("Вкажіть API key (можна взяти з реєстрації /register).", { error: true });
      return;
    }
    setStatus("Завантажую список тестів…");
    try {
      const list = await apiFetch("/api/v1/tests", key);
      const rows = Array.isArray(list?.tests) ? list.tests : [];
      if (!rows.length) {
        tests = [];
        index = 0;
        showCurrent();
        stopAutoplay();
        setStatus("Тестів не знайдено для цього ключа.");
        return;
      }

      setStatus(`Завантажую повні дані (${rows.length})…`);
      const full = [];
      for (const row of rows) {
        const ext = row?.external_id;
        if (!ext) continue;
        // eslint-disable-next-line no-await-in-loop
        const t = await apiFetch(`/api/v1/tests/${encodeURIComponent(ext)}`, key);
        full.push(t);
      }

      tests = full;
      index = 0;
      showCurrent();
      startAutoplayIfEnabled();
      setStatus(`Готово. Тестів: ${tests.length}. Інтервал: ${parseIntervalSeconds(intervalEl.value)} сек.`);
    } catch (e) {
      tests = [];
      index = 0;
      showCurrent();
      stopAutoplay();
      setStatus(e.message || "Не вдалося завантажити", { error: true });
    }
  }

  btnLoad.addEventListener("click", () => void loadTests());

  btnPrev.addEventListener("click", () => {
    if (!tests.length) return;
    index = (index - 1 + tests.length) % tests.length;
    showCurrent();
    startAutoplayIfEnabled();
  });

  btnNext.addEventListener("click", () => {
    if (!tests.length) return;
    index = (index + 1) % tests.length;
    showCurrent();
    startAutoplayIfEnabled();
  });

  btnPlayPause.addEventListener("click", () => {
    if (!tests.length) return;
    if (slideshow.isRunning()) stopAutoplay();
    else startAutoplayIfEnabled();
  });

  autoplayEl.addEventListener("change", () => startAutoplayIfEnabled());
  intervalEl.addEventListener("change", () => startAutoplayIfEnabled());

  btnFullscreen.addEventListener("click", async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch {
      // ignore
    }
  });

  // Initial UI
  setStatus("Готово. Введіть ключ і натисніть “Завантажити тести”.");
  showCurrent();
  stopAutoplay();
  syncPlayPauseBtn();

  // Auto-load when key passed via URL
  if (String(apiKeyEl.value || "").trim()) {
    void loadTests();
  }
})();

