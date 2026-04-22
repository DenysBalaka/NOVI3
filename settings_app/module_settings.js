// === ФАЙЛ: settings_app/module_settings.js ===
import { hashPassword } from '../utils.js';

const navNames = {
  'nav-lessons': '📚 Уроки',
  'nav-students': '👥 Учні',
  'nav-reports': '📊 Звіти',
  'nav-tests': '📝 Тести',
  'nav-board': '🎨 Дошка',
  'nav-notes': '🗒️ Замітки',
  'nav-schedule': '📅 Розклад',
  'nav-classjournal': '📖 Класний журнал',
  'nav-curriculum': '📋 КТП'
};

const NAV_IDS = Object.keys(navNames);

function getHiddenSet() {
  const arr = (window.state?.settings?.navHidden || []);
  return new Set(Array.isArray(arr) ? arr : []);
}

function setNavHidden(id, hidden) {
  if (!window.state.settings.navHidden || !Array.isArray(window.state.settings.navHidden)) {
    window.state.settings.navHidden = [];
  }
  const set = new Set(window.state.settings.navHidden);
  if (hidden) set.add(id);
  else set.delete(id);
  window.state.settings.navHidden = [...set].filter(x => NAV_IDS.includes(x));
  window.saveSettings();
  window.reorderNav();
}

function eyeSvg(isVisible) {
  // Простий інлайн SVG без залежностей
  if (isVisible) {
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>`;
  }
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7c2.5 0 4.6 1 6.2 2.2"/><path d="M22 12s-3.5 7-10 7c-2.5 0-4.6-1-6.2-2.2"/><path d="M3 3l18 18"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="M14.1 14.1a3 3 0 0 0-4.2-4.2"/></svg>`;
}

const CATEGORIES = [
  "Спеціаліст", "Спеціаліст II категорії",
  "Спеціаліст I категорії", "Спеціаліст вищої категорії"
];

export function renderSettings() {
  const s = window.state.settings;
  const tp = s.teacherProfile || {};
  const sem = s.semesters || [];

  window.areaEl.innerHTML = `
    <div class="settings-page">
      <div class="export-page-header">
        <div>
          <h2 style="margin-bottom:4px;">Налаштування</h2>
          <p style="color:var(--text-secondary); margin:0;">Персоналізуйте додаток та керуйте даними</p>
        </div>
      </div>

      <div class="settings-card">
        <div class="settings-card-header">
          <div class="export-card-icon" style="background:linear-gradient(135deg,rgba(99,102,241,0.15),rgba(99,102,241,0.05));color:var(--accent);">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          <div class="export-card-title">
            <h3>Профіль вчителя</h3>
            <p>Ваші дані використовуються у заголовках звітів та експорті</p>
          </div>
        </div>
        <div class="settings-card-body">
          <div class="settings-form-grid">
            <div class="form-group">
              <label for="tp-fullname">ПІБ</label>
              <input class="input" id="tp-fullname" placeholder="Іванов Іван Іванович" value="${window.esc(tp.fullName || "")}">
            </div>
            <div class="form-group">
              <label for="tp-school">Навчальний заклад</label>
              <input class="input" id="tp-school" placeholder="Назва школи" value="${window.esc(tp.school || "")}">
            </div>
            <div class="form-group">
              <label for="tp-position">Посада</label>
              <input class="input" id="tp-position" placeholder="Вчитель" value="${window.esc(tp.position || "")}">
            </div>
            <div class="form-group">
              <label for="tp-category">Кваліфікаційна категорія</label>
              <select class="input" id="tp-category">
                <option value="">-- Не вказано --</option>
                ${CATEGORIES.map(c => `<option value="${window.esc(c)}" ${tp.category === c ? 'selected' : ''}>${window.esc(c)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label for="tp-title">Педагогічне звання</label>
              <input class="input" id="tp-title" placeholder="Наприклад: Старший вчитель" value="${window.esc(tp.title || "")}">
            </div>
            <div class="form-group">
              <label for="tp-experience">Стаж (років)</label>
              <input class="input" id="tp-experience" type="number" min="0" max="60" placeholder="0" value="${window.esc(tp.experience || "")}">
            </div>
          </div>
          <div id="tp-feedback" class="settings-feedback"></div>
        </div>
      </div>

      <div class="settings-card">
        <div class="settings-card-header">
          <div class="export-card-icon" style="background:linear-gradient(135deg,rgba(234,179,8,0.15),rgba(234,179,8,0.05));color:#eab308;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
          <div class="export-card-title">
            <h3>Навчальний рік та семестри</h3>
            <p>Визначає діапазони дат для фільтрації та підсумків</p>
          </div>
        </div>
        <div class="settings-card-body">
          <div class="settings-form-grid">
            <div class="form-group" style="grid-column: 1 / -1;">
              <label for="sy-year">Навчальний рік</label>
              <input class="input" id="sy-year" placeholder="2025-2026" value="${window.esc(s.schoolYear || "")}">
            </div>
            ${sem.map((sem_item, idx) => `
              <div class="form-group" style="grid-column: 1 / -1;">
                <label style="font-size:13px;color:var(--text-primary);font-weight:700;text-transform:none;">${window.esc(sem_item.name)}</label>
              </div>
              <div class="form-group">
                <label for="sem-start-${idx}">Початок</label>
                <input class="input" id="sem-start-${idx}" type="date" value="${sem_item.startDate || ''}">
              </div>
              <div class="form-group">
                <label for="sem-end-${idx}">Кінець</label>
                <input class="input" id="sem-end-${idx}" type="date" value="${sem_item.endDate || ''}">
              </div>
            `).join('')}
          </div>
          <div id="sy-feedback" class="settings-feedback"></div>
        </div>
      </div>

      <div class="settings-row">
        <div class="settings-card settings-card--half">
          <div class="settings-card-header">
            <div class="export-card-icon" style="background:linear-gradient(135deg,rgba(168,85,247,0.15),rgba(168,85,247,0.05));color:#a855f7;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            </div>
            <div class="export-card-title">
              <h3>Персоналізація меню</h3>
              <p>Перетягніть для зміни порядку</p>
            </div>
          </div>
          <div class="settings-card-body">
            <div class="editor-list" id="settings-nav-order-list" style="background: var(--bg); border-radius: var(--radius-md);"></div>
            <div id="nav-order-feedback" class="settings-feedback"></div>
          </div>
        </div>

        <div class="settings-card settings-card--half">
          <div class="settings-card-header">
            <div class="export-card-icon" style="background:linear-gradient(135deg,rgba(239,68,68,0.15),rgba(239,68,68,0.05));color:var(--danger);">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
            <div class="export-card-title">
              <h3>Безпека</h3>
              <p>Пароль для блокування екрану (4 цифри)</p>
            </div>
          </div>
          <div class="settings-card-body">
            <div class="form-group" style="max-width: 250px;">
              <label for="teacher-pass">Пароль вчителя</label>
              <input type="password" class="input" id="teacher-pass" maxlength="4" value="" placeholder="${s.teacherPassword ? '••••' : '****'}">
            </div>
            <div id="save-feedback" class="settings-feedback"></div>
          </div>
        </div>
      </div>

      <div class="settings-card" id="telegram-students-section">
        <div class="settings-card-header">
          <div class="export-card-icon" style="background:linear-gradient(135deg,rgba(0,136,204,0.15),rgba(0,136,204,0.05));color:#0088cc;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2L2 12l5.5 2L19 6l-8.5 6v6l3-4"/></svg>
          </div>
          <div class="export-card-title">
            <h3>Учням — тести в Telegram</h3>
            <p>Окремого входу в програму не потрібно</p>
          </div>
        </div>
        <div class="settings-card-body">
          <p style="font-size:14px;color:var(--text-secondary);line-height:1.5;margin:0 0 12px;">
            Учні проходять тести у Telegram. Посилання на бота вже вбудоване в цю копію програми — нічого налаштовувати не потрібно.
          </p>
          <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;">
            <button type="button" class="btn" id="btn-open-tg-bot">Відкрити бота в Telegram</button>
          </div>
          <p id="tg-bot-link-hint" style="font-size:12px;color:var(--muted);margin:10px 0 0;line-height:1.4;"></p>
        </div>
      </div>

      <div class="settings-card" id="telegram-teacher-section">
        <div class="settings-card-header">
          <div class="export-card-icon" style="background:linear-gradient(135deg,rgba(59,130,246,0.15),rgba(59,130,246,0.05));color:#3b82f6;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          <div class="export-card-title">
            <h3>Обліковий запис вчителя (хмара)</h3>
            <p>Один клік — без URL і ключів</p>
          </div>
        </div>
        <div class="settings-card-body">
          <p id="cloud-account-status" style="font-size:14px;margin:0 0 12px;line-height:1.5;"></p>
          <div style="display:flex;flex-wrap:wrap;gap:10px;">
            <button type="button" class="btn" id="btn-cloud-connect">Підключити хмару</button>
            <button type="button" class="btn danger" id="btn-cloud-disconnect">Вийти з хмари</button>
          </div>
          <p style="font-size:13px;color:var(--text-secondary);margin:12px 0 0;line-height:1.45;">
            Після підключення відкрийте <b>Тести → Telegram</b>: синхронізація класів, публікація тестів і результати.
          </p>
          <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border-color);">
            <h4 style="margin:0 0 8px;font-size:15px;">Сповіщення в Telegram</h4>
            <p style="font-size:13px;color:var(--text-secondary);margin:0 0 10px;line-height:1.45;">
              Якщо учень не зможе автоматично прив’язатися до журналу в боті, бот надішле вам повідомлення на вказаний акаунт.
              Свій числовий id можна подивитися в Telegram у бота <code>@userinfobot</code> (поле «Id»).
            </p>
            <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;">
              <div class="form-group" style="min-width:200px;margin:0;">
                <label for="teacher-tg-notify-id">Ваш Telegram user id</label>
                <input type="text" class="input" id="teacher-tg-notify-id" placeholder="наприклад 123456789" autocomplete="off">
              </div>
              <button type="button" class="btn" id="btn-save-tg-notify" ${window.isTeacherCloudConnected() ? "" : "disabled"}>Зберегти для сповіщень</button>
            </div>
            <p id="tg-notify-feedback" class="settings-feedback" style="margin-top:8px;"></p>
          </div>
        </div>
      </div>

      <div class="settings-card" id="dev-telegram-panel" style="display: ${typeof localStorage !== "undefined" && localStorage.getItem("tj_developer") === "1" ? "block" : "none"};">
        <div class="settings-card-header">
          <div class="export-card-icon" style="background:linear-gradient(135deg,rgba(113,113,122,0.25),rgba(113,113,122,0.08));color:var(--muted);">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <div class="export-card-title">
            <h3>Розробник (Ctrl+Shift+D)</h3>
            <p>URL сервера, API-ключ, локальний бот — не для кінцевих користувачів</p>
          </div>
        </div>
        <div class="settings-card-body">
          <div class="form-group">
            <label for="cloud-api-base">Базова URL сервісу (перекриває app_config.json, якщо задано)</label>
            <input type="url" class="input" id="cloud-api-base" placeholder="https://your-app.onrender.com" value="${window.esc(s.cloudApiBaseUrl || "")}" autocomplete="off">
          </div>
          <div class="form-group">
            <label for="cloud-api-key">API-ключ вчителя</label>
            <input type="password" class="input" id="cloud-api-key" placeholder="внутрішньо" value="${window.esc(s.cloudApiKey || "")}" autocomplete="off" spellcheck="false">
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:8px;">
            <button type="button" class="btn" id="cloud-register-btn">Реєстрація (показати ключ)</button>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:12px;">
            <button type="button" class="btn ghost" id="btn-check-updates" style="padding:8px 12px;font-size:13px;">Перевірити оновлення</button>
          </div>
          <div class="form-group" style="margin:0 0 12px;">
            <div style="font-size:12px;color:var(--muted);margin:0 0 6px;">Перевірка оновлень</div>
            <input
              type="text"
              class="input"
              value="Запускає перевірку нової версії. Якщо оновлення доступне — з’явиться системне вікно. Працює лише у встановленій (зібраній) версії."
              readonly
              style="opacity:0.75;font-size:12px;"
            >
          </div>
          <div class="settings-card-header" style="padding:12px 0 8px;margin:0;border:none;">
            <div class="export-card-title" style="margin:0;">
              <h3 style="font-size:16px;">Локальний бот</h3>
              <p style="margin:0;">Long polling у цьому додатку</p>
            </div>
          </div>
          <div class="form-group" style="margin-bottom:12px;">
            <label style="display:flex;align-items:center;gap:10px;cursor:pointer;">
              <input type="checkbox" id="tg-local-enabled" ${s.telegramLocalBotEnabled ? "checked" : ""}>
              <span>Увімкнути локальний бот на цьому ПК</span>
            </label>
          </div>
          <div class="form-group">
            <label for="tg-bot-token">HTTP API токен бота (@BotFather)</label>
            <input type="password" class="input" id="tg-bot-token" placeholder="123456789:AA..." value="${window.esc(s.telegramBotToken || "")}" autocomplete="off" spellcheck="false">
          </div>
          <div id="tg-feedback" class="settings-feedback"></div>

          <div class="settings-card-header" style="padding:12px 0 8px;margin:0;border:none;">
            <div class="export-card-title" style="margin:0;">
              <h3 style="font-size:16px;">AI API (Google)</h3>
              <p style="margin:0;">Налаштовується один раз розробником</p>
            </div>
          </div>
          <div class="form-group">
            <label for="ai-google-key">Google AI API ключ</label>
            <input type="password" class="input" id="ai-google-key" placeholder="AIza..." value="${window.esc(s.googleAiApiKey || "")}" autocomplete="off" spellcheck="false">
          </div>
          <div class="form-group">
            <label for="ai-google-model">Модель (за замовчуванням)</label>
            <input type="text" class="input" id="ai-google-model" placeholder="gemini-..." value="${window.esc(s.googleAiModel || "")}" autocomplete="off" spellcheck="false">
          </div>
        </div>
      </div>

      <div class="settings-card" id="google-settings-section">
        <div class="settings-card-header">
          <div class="export-card-icon" style="background:linear-gradient(135deg,rgba(34,197,94,0.15),rgba(34,197,94,0.05));color:#22c55e;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>
          </div>
          <div class="export-card-title">
            <h3>Хмарна синхронізація</h3>
            <p>Автоматичне збереження даних на Google Drive</p>
          </div>
        </div>
        <div class="settings-card-body">
          <div id="google-auth-status"></div>
        </div>
      </div>

      <div class="settings-card">
          <div class="settings-card-header">
            <div class="export-card-icon" style="background:linear-gradient(135deg,rgba(59,130,246,0.15),rgba(59,130,246,0.05));color:#3b82f6;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            </div>
            <div class="export-card-title">
              <h3>Локальний архів</h3>
              <p>Резервне копіювання без Google</p>
            </div>
          </div>
          <div class="settings-card-body">
            <div class="form-group" style="margin:0 0 12px;">
              <div style="font-size:12px;color:var(--muted);margin:0 0 6px;">Шлях до файлів на цьому комп'ютері</div>
              <input type="text" class="input" value="${window.esc(window.paths?.root || "")}" readonly style="opacity: 0.7; font-size: 12px;">
            </div>
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
              <button class="btn" id="btn-backup-create">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                Створити копію
              </button>
              <button class="btn danger" id="btn-backup-restore">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Відновити з копії
              </button>
            </div>
          </div>
      </div>
    </div>
  `;

  // === Логіка ===

  updateGoogleAuthStatusUI();

  const refreshCloudAccountUi = () => {
    const el = window.$("#cloud-account-status");
    if (el) {
      el.textContent = window.isTeacherCloudConnected()
        ? "Хмару підключено на цьому комп’ютері. Дані для синхронізації зберігаються локально."
        : "Хмару ще не підключено. Натисніть «Підключити хмару» (потрібен інтернет).";
    }
    const hint = window.$("#tg-bot-link-hint");
    if (hint) {
      const u = window.getTelegramBotUrl();
      hint.textContent = u
        ? `Посилання: ${u}`
        : "У збірці не задано telegramBotUsername / telegramBotPublicUrl у app_config.json — зверніться до розробника.";
    }
  };
  refreshCloudAccountUi();

  const openTgBtn = window.$("#btn-open-tg-bot");
  if (openTgBtn) {
    openTgBtn.onclick = async () => {
      const u = window.getTelegramBotUrl();
      if (!u) {
        await window.showCustomAlert(
          "Telegram",
          "Посилання на бота не налаштоване в app_config.json. Зверніться до розробника."
        );
        return;
      }
      const r = await window.tj.openExternal(u);
      if (r.error) await window.showCustomAlert("Помилка", r.error);
    };
  }

  const btnCloudConnect = window.$("#btn-cloud-connect");
  if (btnCloudConnect) {
    btnCloudConnect.onclick = async () => {
      if (window.isTeacherCloudConnected()) {
        await window.showCustomAlert(
          "Хмара",
          "Обліковий запис уже підключено. Щоб створити новий, спочатку натисніть «Вийти з хмари»."
        );
        return;
      }
      const base = window.getCloudBaseUrl();
      if (!base) {
        await window.showCustomAlert(
          "Підключення",
          "Немає адреси сервера хмари. Розробник має задати defaultCloudApiBaseUrl у app_config.json, або увімкніть режим розробника (Ctrl+Shift+D) і введіть URL вручну."
        );
        return;
      }
      const tp = window.state.settings.teacherProfile || {};
      const res = await window.tj.cloudRegister({
        baseUrl: base,
        displayName: tp.fullName || "Вчитель",
        school: tp.school || "",
      });
      if (res.error) {
        await window.showCustomAlert("Помилка", res.error);
        return;
      }
      const d = res.data;
      if (d && d.apiKey) {
        window.state.settings.cloudApiKey = d.apiKey;
        if (!(window.state.settings.cloudApiBaseUrl || "").trim()) {
          window.state.settings.cloudApiBaseUrl = base;
        }
        window.saveSettings();
        const cloudKeyEl = window.$("#cloud-api-key");
        if (cloudKeyEl) cloudKeyEl.value = d.apiKey;
        await window.showCustomAlert("Готово", "Хмару підключено. Можна керувати тестами в розділі «Тести → Telegram».");
        refreshCloudAccountUi();
      }
    };
  }

  (async () => {
    const notifyInput = window.$("#teacher-tg-notify-id");
    const notifyFb = window.$("#tg-notify-feedback");
    const notifyBtn = window.$("#btn-save-tg-notify");
    if (window.isTeacherCloudConnected && window.isTeacherCloudConnected() && notifyInput) {
      try {
        const me = await window.callCloudApi("GET", "me");
        if (me.telegramNotifyChatId != null && me.telegramNotifyChatId !== "") {
          notifyInput.value = String(me.telegramNotifyChatId);
        }
      } catch {
        /* ignore */
      }
    }
    if (notifyBtn) {
      notifyBtn.onclick = async () => {
        if (!window.isTeacherCloudConnected()) {
          await window.showCustomAlert("Хмара", "Спочатку підключіть хмару.");
          return;
        }
        const v = (notifyInput && notifyInput.value.trim()) || "";
        try {
          await window.callCloudApi("PATCH", "me/telegram-notify", {
            telegramNotifyChatId: v === "" ? null : v,
          });
          if (notifyFb) {
            notifyFb.textContent = "Збережено.";
            notifyFb.style.color = "var(--grade-10)";
            setTimeout(() => {
              notifyFb.textContent = "";
            }, 2500);
          }
        } catch (e) {
          await window.showCustomAlert("Помилка", e.message || String(e));
        }
      };
    }
  })();

  const btnCloudDisconnect = window.$("#btn-cloud-disconnect");
  if (btnCloudDisconnect) {
    btnCloudDisconnect.onclick = async () => {
      if (!window.isTeacherCloudConnected()) {
        await window.showCustomAlert("Хмара", "Немає активного підключення.");
        return;
      }
      const ok = await window.showCustomConfirm(
        "Вийти з хмари",
        "На цьому комп’ютері буде видалено збережений ключ доступу. Дані журналу залишаться. Продовжити?",
        "Вийти",
        "Скасувати",
        true
      );
      if (!ok) return;
      window.state.settings.cloudApiKey = "";
      window.state.settings.cloudRosterMap = {};
      window.saveSettings();
      const cloudKeyEl = window.$("#cloud-api-key");
      if (cloudKeyEl) cloudKeyEl.value = "";
      refreshCloudAccountUi();
    };
  }

  const tgFb = window.$("#tg-feedback");
  const reloadTelegramBot = async () => {
    try {
      await window.tj.telegramReload();
      if (tgFb) {
        tgFb.textContent = "Параметри збережено, бот перезапущено.";
        tgFb.style.color = "var(--grade-10)";
        setTimeout(() => { tgFb.textContent = ""; }, 2800);
      }
    } catch (e) {
      if (tgFb) {
        tgFb.textContent = "Не вдалося перезапустити бота.";
        tgFb.style.color = "var(--danger)";
      }
    }
  };
  const cloudBase = window.$("#cloud-api-base");
  const cloudKey = window.$("#cloud-api-key");
  if (cloudBase) {
    cloudBase.oninput = window.debounce(() => {
      window.state.settings.cloudApiBaseUrl = cloudBase.value.trim();
      window.saveSettings();
    }, 600);
  }
  if (cloudKey) {
    cloudKey.oninput = window.debounce(() => {
      window.state.settings.cloudApiKey = cloudKey.value.trim();
      window.saveSettings();
    }, 600);
  }
  const regBtn = window.$("#cloud-register-btn");
  if (regBtn) {
    regBtn.onclick = async () => {
      const base =
        (cloudBase && cloudBase.value.trim()) ||
        window.getCloudBaseUrl() ||
        "";
      if (!base) {
        await window.showCustomAlert("Реєстрація", "Задайте базову URL або defaultCloudApiBaseUrl у app_config.json.");
        return;
      }
      const tp = window.state.settings.teacherProfile || {};
      const res = await window.tj.cloudRegister({
        baseUrl: base,
        displayName: tp.fullName || "",
        school: tp.school || "",
      });
      if (res.error) {
        await window.showCustomAlert("Помилка", res.error);
        return;
      }
      const d = res.data;
      if (d && d.apiKey) {
        window.state.settings.cloudApiBaseUrl = base;
        window.state.settings.cloudApiKey = d.apiKey;
        if (cloudKey) cloudKey.value = d.apiKey;
        window.saveSettings();
        await window.showCustomAlert(
          "API-ключ (розробник)",
          `Збережіть ключ:\n\n${d.apiKey}\n\nВін також записаний у полі вище.`
        );
        refreshCloudAccountUi();
      }
    };
  }

  const btnCheckUpdates = window.$("#btn-check-updates");
  if (btnCheckUpdates) {
    btnCheckUpdates.onclick = async () => {
      const oldText = btnCheckUpdates.textContent;
      btnCheckUpdates.disabled = true;
      btnCheckUpdates.textContent = "Перевірка...";
      try {
        const res = await window.tj.updateCheck();
        if (res?.error) {
          await window.showCustomAlert("Оновлення", res.error);
        } else {
          // Якщо оновлення є — діалог покаже main-процес; якщо ні — electron-updater просто промовчить.
          await window.showCustomAlert(
            "Оновлення",
            "Перевірку запущено. Якщо доступна нова версія — з’явиться системне вікно з пропозицією оновитись."
          );
        }
      } catch (e) {
        await window.showCustomAlert("Оновлення", e?.message || "Не вдалося перевірити оновлення.");
      } finally {
        btnCheckUpdates.disabled = false;
        btnCheckUpdates.textContent = oldText;
      }
    };
  }
  const tgLocalEnabled = window.$("#tg-local-enabled");
  if (tgLocalEnabled) {
    tgLocalEnabled.onchange = async () => {
      window.state.settings.telegramLocalBotEnabled = !!tgLocalEnabled.checked;
      window.state.settings.telegramBotEnabled = !!tgLocalEnabled.checked;
      window.saveSettings();
      await reloadTelegramBot();
    };
  }
  const tgToken = window.$("#tg-bot-token");
  if (tgToken) {
    tgToken.oninput = window.debounce(async () => {
      window.state.settings.telegramBotToken = tgToken.value.trim();
      window.saveSettings();
      await reloadTelegramBot();
    }, 900);
  }

  const aiKey = window.$("#ai-google-key");
  if (aiKey) {
    aiKey.oninput = window.debounce(() => {
      window.state.settings.googleAiApiKey = aiKey.value.trim();
      window.saveSettings();
    }, 600);
  }
  const aiModel = window.$("#ai-google-model");
  if (aiModel) {
    aiModel.oninput = window.debounce(() => {
      window.state.settings.googleAiModel = aiModel.value.trim();
      window.saveSettings();
    }, 600);
  }

  // Бекапи
  window.$("#btn-backup-create").onclick = async () => {
    const res = await window.tj.createBackup();
    if (res && !res.error) await window.showCustomAlert("Успіх", "Резервну копію створено.");
    if (res?.error) await window.showCustomAlert("Помилка", res.error);
  };
  window.$("#btn-backup-restore").onclick = async () => {
    if (await window.showCustomConfirm("Відновлення", "Поточні дані будуть перезаписані. Програма перезапуститься. Продовжити?", "Відновити", "Скасувати", true)) {
      const res = await window.tj.restoreBackup();
      if (res?.error) await window.showCustomAlert("Помилка", res.error);
    }
  };

  // Пароль
  const passInput = window.$("#teacher-pass");
  const feedbackEl = window.$("#save-feedback");
  passInput.oninput = window.debounce(async () => {
    const newPass = passInput.value.trim();
    if (newPass.length === 0) {
      window.state.settings.teacherPassword = null;
      window.saveSettings();
      feedbackEl.textContent = "Збережено!";
      setTimeout(() => feedbackEl.textContent = "", 2000);
    } else if (newPass.length === 4) {
      window.state.settings.teacherPassword = await hashPassword(newPass);
      window.saveSettings();
      feedbackEl.textContent = "Збережено!";
      setTimeout(() => feedbackEl.textContent = "", 2000);
    } else {
      feedbackEl.textContent = "Пароль має бути 4 цифри.";
      feedbackEl.style.color = "var(--danger)";
      setTimeout(() => { feedbackEl.textContent = ""; feedbackEl.style.color = "var(--grade-10)"; }, 2000);
    }
  }, 500);

  // Профіль вчителя
  const tpFields = ['tp-fullname', 'tp-school', 'tp-position', 'tp-category', 'tp-title', 'tp-experience'];
  const tpKeys = ['fullName', 'school', 'position', 'category', 'title', 'experience'];
  const tpFeedback = window.$("#tp-feedback");
  tpFields.forEach((fieldId, idx) => {
    const el = window.$("#" + fieldId);
    if (!el) return;
    const handler = window.debounce(() => {
      if (!window.state.settings.teacherProfile) window.state.settings.teacherProfile = {};
      window.state.settings.teacherProfile[tpKeys[idx]] = el.value.trim();
      window.saveSettings();
      tpFeedback.textContent = "Збережено!";
      setTimeout(() => tpFeedback.textContent = "", 2000);
    }, 600);
    el.oninput = handler;
    el.onchange = handler;
  });

  // Навчальний рік та семестри
  const syFeedback = window.$("#sy-feedback");
  const saveSY = window.debounce(() => {
    window.saveSettings();
    syFeedback.textContent = "Збережено!";
    setTimeout(() => syFeedback.textContent = "", 2000);
  }, 600);

  const syYearInput = window.$("#sy-year");
  if (syYearInput) {
    syYearInput.oninput = () => {
      window.state.settings.schoolYear = syYearInput.value.trim();
      saveSY();
    };
  }

  sem.forEach((_, idx) => {
    const startEl = window.$("#sem-start-" + idx);
    const endEl = window.$("#sem-end-" + idx);
    if (startEl) startEl.onchange = () => { window.state.settings.semesters[idx].startDate = startEl.value; saveSY(); };
    if (endEl) endEl.onchange = () => { window.state.settings.semesters[idx].endDate = endEl.value; saveSY(); };
  });

  renderNavOrderList();
}

function renderNavOrderList() {
  const container = window.$("#settings-nav-order-list"); 
  if (!container) return;
  
  container.innerHTML = "";
  const order = window.state.settings.navOrder || ['nav-lessons', 'nav-students', 'nav-reports', 'nav-tests', 'nav-board', 'nav-notes', 'nav-schedule', 'nav-classjournal', 'nav-curriculum'];
  const hidden = getHiddenSet();

  order.forEach(id => {
    const name = navNames[id] || id; 
    const el = document.createElement("div");
    el.className = "nav-order-item";
    
    el.style.cssText = `
      display: flex; 
      align-items: center; 
      padding: 10px; 
      border-bottom: 1px solid var(--border-color); 
      cursor: grab; 
      user-select: none;
    `;
    
    el.dataset.navId = id;
    el.draggable = true;
    const isHidden = hidden.has(id);
    const isVisible = !isHidden;
    if (isHidden) el.style.opacity = "0.65";
    el.innerHTML = `
      <span style="margin-right: 8px; color: var(--muted); cursor: grab; flex: 0 0 auto;">≡</span>
      <span style="flex: 1 1 auto; min-width: 0;">${window.esc(name)}</span>
      <div style="display:flex; align-items:center; gap:10px; margin-left:auto; flex: 0 0 auto;">
        <button type="button"
          class="nav-eye-btn"
          aria-label="${isVisible ? "Видимо" : "Приховано"}"
          style="
            width: 34px; height: 34px;
            display:inline-flex; align-items:center; justify-content:center;
            background: transparent;
            border: 1px solid rgba(255,255,255,0.10);
            border-radius: 10px;
            color: ${isVisible ? "var(--text-secondary)" : "var(--muted)"};
            cursor: pointer;
          "
        >${eyeSvg(isVisible)}</button>
      </div>
    `;
    container.appendChild(el);

    const eyeBtn = el.querySelector(".nav-eye-btn");

    const stop = (e) => { e.stopPropagation(); };
    eyeBtn.addEventListener("mousedown", stop);
    eyeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const nowHidden = !getHiddenSet().has(id);
      setNavHidden(id, nowHidden);
      renderNavOrderList();
    });
  });
  
  if (container.lastChild) {
    container.lastChild.style.borderBottom = "none";
  }
  
  // DnD-обробники підв'язуємо один раз, щоб не дублювати слухачі після re-render
  if (!container.dataset.dndBound) {
    container.dataset.dndBound = "1";
    let draggedItem = null;

    container.addEventListener('dragstart', (e) => {
      const target = e.target?.closest?.('.nav-order-item');
      if (target && container.contains(target)) {
        draggedItem = target;
        draggedItem.style.cursor = 'grabbing';
        setTimeout(() => target.classList.add('dragging'), 0);
      }
    });

    container.addEventListener('dragend', () => {
      if (!draggedItem) return;
      draggedItem.classList.remove('dragging');
      draggedItem.style.cursor = 'grab';
      draggedItem = null;

      const list = window.$("#settings-nav-order-list");
      const newOrder = window.$$(".nav-order-item", list).map(el => el.dataset.navId);
      window.state.settings.navOrder = newOrder;
      window.saveSettings();
      window.reorderNav();

      const feedback = window.$("#nav-order-feedback");
      if (feedback) {
        feedback.textContent = "Порядок збережено!";
        setTimeout(() => feedback.textContent = "", 2000);
      }

      window.$$(".nav-order-item", list).forEach(item => item.style.borderBottom = "1px solid var(--border-color)");
      if (list.lastChild) list.lastChild.style.borderBottom = "none";
    });

    container.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (!draggedItem) return;
      const target = e.target?.closest?.('.nav-order-item');
      if (target && target !== draggedItem) {
        const rect = target.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        if (e.clientY < mid) {
          container.insertBefore(draggedItem, target);
        } else {
          container.insertBefore(draggedItem, target.nextSibling);
        }
      }
    });
  }
}

export async function updateGoogleAuthStatusUI() {
  const container = window.$("#google-auth-status");
  if (!container) return; 
  
  const profile = window.auth.profile;
  
  if (profile) {
    container.innerHTML = `
      <div class="cloud-auth-grid">
        <div class="cloud-auth-row">
          <div class="cloud-profile">
            <img src="${window.esc(profile.picture)}" class="cloud-avatar">
            <div>
              <div style="font-weight:600;">${window.esc(profile.name || profile.given_name || '')}</div>
              <div style="font-size:12px;color:var(--muted);">${window.esc(profile.email)}</div>
            </div>
          </div>

          <label class="toggle-switch" style="margin-left: auto;">
            <input type="checkbox" id="settings-autosync">
            <span class="toggle-track"></span>
            <span class="toggle-label">Автосинхронізація</span>
          </label>
        </div>
        
        <div class="cloud-status-bar">
          <span class="cloud-status-dot cloud-status-dot--loading" id="cloud-status-dot"></span>
          <span id="cloud-info-text" style="color: var(--text-secondary);">Перевірка...</span>
        </div>

        <div class="cloud-actions">
          <button class="btn" id="btn-cloud-upload">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/></svg>
            Синхронізувати
          </button>
          <button class="btn ghost" id="btn-cloud-download">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/></svg>
            З хмари
          </button>
          <button class="btn danger" id="btn-cloud-logout">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Вийти
          </button>
        </div>
      </div>
    `;
    
    const autoSyncCheck = window.$("#settings-autosync");
    autoSyncCheck.checked = !!window.state.settings.autoSync;
    autoSyncCheck.onchange = () => {
      window.state.settings.autoSync = autoSyncCheck.checked;
      window.saveSettings();
    };
    
    window.$("#btn-cloud-logout").onclick = window.handleGoogleLogout;
    
    const UPLOAD_BTN_HTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/></svg> Синхронізувати';
    const resetUploadBtn = (btn) => { btn.disabled = false; btn.innerHTML = UPLOAD_BTN_HTML; };

    window.$("#btn-cloud-upload").onclick = async () => {
      const btn = window.$("#btn-cloud-upload"); btn.disabled = true; btn.innerHTML = "Вивантаження...";
      const res = await window.tj.cloudSyncUpload();
      
      if (res && res.error === "LOCAL_DATA_EMPTY") {
        resetUploadBtn(btn);
        await window.showCustomAlert("Дію скасовано", "Ваші локальні дані порожні. Вивантаження скасовано, щоб не затерти хмарну копію.\n\nЯкщо ви хочете відновити дані, натисніть «З хмари».");

      } else if (res && res.error === "CLOUD_IS_NEWER") {
        const cloudDate = new Date(res.cloudDate).toLocaleString("uk-UA");
        const force = await window.showCustomConfirm(
          "Хмарна копія новіша",
          `У хмарі є новіша копія від ${cloudDate}.\n\nЯкщо продовжити, хмарна копія буде замінена вашими локальними даними.\n\nПеред цим буде автоматично створено страховий бекап.`,
          "Замінити хмарну копію",
          "Скасувати",
          true
        );
        if (force) {
          btn.disabled = true; btn.innerHTML = "Вивантаження...";
          const forceRes = await window.tj.cloudSyncUploadForce();
          resetUploadBtn(btn);
          if (forceRes && forceRes.success) {
            await window.showCustomAlert("Успіх", "Дані збережено у хмару!");
            updateCloudInfo();
          } else {
            await window.showCustomAlert("Помилка", forceRes?.error || "Невідома помилка");
          }
        } else {
          resetUploadBtn(btn);
        }
      
      } else if (res && res.success) {
        resetUploadBtn(btn);
        await window.showCustomAlert("Успіх", "Дані збережено у хмару!"); 
        updateCloudInfo();
      } else {
        resetUploadBtn(btn);
        await window.showCustomAlert("Помилка", res?.error || "Невідома помилка");
      }
    };
    
    window.$("#btn-cloud-download").onclick = async () => {
      if (await window.showCustomConfirm(
        "Завантаження з хмари",
        "Локальні дані будуть замінені хмарною копією.\n\nПеред цим буде автоматично створено страховий бекап ваших поточних даних.\n\nПрограма перезапуститься. Продовжити?",
        "Завантажити",
        "Скасувати",
        true
      )) {
        const btn = window.$("#btn-cloud-download"); btn.disabled = true; btn.innerHTML = "Завантаження...";
        const res = await window.tj.cloudSyncDownload();
        if (res?.error) { btn.disabled = false; btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/></svg> З хмари'; await window.showCustomAlert("Помилка", res.error); }
      }
    };
    updateCloudInfo();
  } else {
    container.innerHTML = `<button class="btn" id="google-login-btn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg> Увійти через Google</button>`;
    window.$("#google-login-btn").onclick = window.handleGoogleLogin;
  }
}

async function updateCloudInfo() {
  const el = window.$("#cloud-info-text");
  const dot = window.$("#cloud-status-dot");
  if (!el) return;

  const setStatus = (text, state) => {
    el.textContent = text;
    if (dot) {
      dot.className = `cloud-status-dot cloud-status-dot--${state}`;
    }
  };

  setStatus("Перевірка...", "loading");
  try {
    const meta = await window.tj.googleGetBackupMeta();
    if (meta?.error) throw new Error(meta.error);
    if (meta && meta.id) {
      const d = new Date(meta.modifiedTime); 
      if (isNaN(d.getTime())) {
        setStatus("Помилка формату дати.", "error");
        return;
      }
      const dateStr = d.toLocaleDateString("uk-UA", { day: '2-digit', month: '2-digit', year: 'numeric' });
      const timeStr = d.toLocaleTimeString("uk-UA", { hour: '2-digit', minute: '2-digit' });
      setStatus(`Остання копія: ${dateStr}, ${timeStr}`, "ok");
    } else {
      setStatus("У хмарі ще немає резервних копій.", "loading");
    }
  } catch(e) {
    setStatus(`Помилка: ${e.message}`, "error");
  }
}
