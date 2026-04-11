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

      <div class="settings-row">
        <div class="settings-card settings-card--half">
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

        <div class="settings-card settings-card--half">
          <div class="settings-card-header">
            <div class="export-card-icon" style="background:linear-gradient(135deg,rgba(113,113,122,0.15),rgba(113,113,122,0.05));color:var(--muted);">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
            </div>
            <div class="export-card-title">
              <h3>Локальна папка даних</h3>
              <p>Шлях до файлів на цьому комп'ютері</p>
            </div>
          </div>
          <div class="settings-card-body">
            <div class="form-group">
              <input type="text" class="input" value="${window.esc(window.paths?.root || "")}" readonly style="opacity: 0.7; font-size: 12px;">
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // === Логіка ===

  updateGoogleAuthStatusUI();

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
    el.innerHTML = `<span style="margin-right: 8px; color: var(--muted); cursor: grab;">≡</span> ${window.esc(name)}`;
    container.appendChild(el);
  });
  
  if (container.lastChild) {
    container.lastChild.style.borderBottom = "none";
  }
  
  let draggedItem = null;
  
  container.addEventListener('dragstart', (e) => {
    if (e.target.classList.contains('nav-order-item')) {
      draggedItem = e.target;
      draggedItem.style.cursor = 'grabbing';
      setTimeout(() => e.target.classList.add('dragging'), 0); 
    }
  });
  
  container.addEventListener('dragend', (e) => {
    if (draggedItem) {
      draggedItem.classList.remove('dragging');
      draggedItem.style.cursor = 'grab';
      draggedItem = null;
      
      const list = window.$("#settings-nav-order-list");
      const newOrder = window.$$(".nav-order-item", list).map(el => el.dataset.navId);
      window.state.settings.navOrder = newOrder;
      window.saveSettings();
      window.reorderNav();

      const feedback = window.$("#nav-order-feedback");
      if(feedback) {
        feedback.textContent = "Порядок збережено!";
        setTimeout(() => feedback.textContent = "", 2000);
      }
      
      window.$$(".nav-order-item", list).forEach(item => item.style.borderBottom = "1px solid var(--border-color)");
      if (list.lastChild) list.lastChild.style.borderBottom = "none";
    }
  });
  
  container.addEventListener('dragover', (e) => {
    e.preventDefault();
    const target = e.target.closest('.nav-order-item');
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
