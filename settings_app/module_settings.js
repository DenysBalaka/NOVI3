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

  let teacherProfileBlock = `
    <div class="export-section-info">
      <h3>Профіль вчителя</h3>
      <p>Ваші дані використовуються у заголовках звітів та експорті.</p>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; max-width: 600px; margin-top: 12px;">
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
      <div id="tp-feedback" style="color: var(--grade-10); font-size: 14px; min-height: 1.2em; margin-top: 4px;"></div>
    </div>
  `;

  let schoolYearBlock = `
    <div class="export-section-info">
      <h3>Навчальний рік та семестри</h3>
      <p>Визначає діапазони дат для фільтрації та підсумків.</p>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; max-width: 600px; margin-top: 12px;">
        <div class="form-group" style="grid-column: 1 / -1;">
          <label for="sy-year">Навчальний рік</label>
          <input class="input" id="sy-year" placeholder="2025-2026" value="${window.esc(s.schoolYear || "")}">
        </div>
        ${sem.map((sem_item, idx) => `
          <div class="form-group" style="grid-column: 1 / -1;">
            <label><strong>${window.esc(sem_item.name)}</strong></label>
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
      <div id="sy-feedback" style="color: var(--grade-10); font-size: 14px; min-height: 1.2em; margin-top: 4px;"></div>
    </div>
  `;

  let authBlock = `
    <div class="export-section-info">
      <h3>Хмарна синхронізація (Google Drive)</h3>
      <p>Увійдіть, щоб автоматично зберігати ваші дані у хмару та мати до них доступ з різних пристроїв.</p>
    </div>
    <div id="google-auth-status"></div>
  `;

  let backupBlock = `
    <div class="export-section-info">
      <h3>Локальний Архів <span style="font-weight: normal; font-size: 14px; color: var(--muted);">(для перенесення даних на інший пристрій без Google-авторизації)</span></h3>
      <p>Створення повного файлу-архіву всіх ваших даних на цьому комп'ютері.</p>
      <div style="margin-top: 12px; display: flex; gap: 10px;">
        <button class="btn" id="btn-backup-create">Створити резервну копію</button>
        <button class="btn danger" id="btn-backup-restore">Відновити з копії</button>
      </div>
    </div>
  `;

  let menuOrderBlock = `
    <div class="export-section-info">
      <h3>Персоналізація меню</h3>
      <p>Налаштуйте порядок кнопок (перетягніть, щоб зберегти).</p>
      <div class="editor-list" id="settings-nav-order-list" style="max-width: 300px; margin-top: 12px; background: var(--bg); border-radius: 8px;"></div>
      <div id="nav-order-feedback" style="color: var(--grade-10); font-size: 14px; min-height: 1.2em; margin-top: 4px;"></div>
    </div>
  `;

  let passwordBlock = `
    <div class="export-section-info">
      <h3>Безпека <span style="font-weight: normal; font-size: 14px; color: var(--muted);">(для блокування доступу до програми)</span></h3>
      <p>Пароль вчителя (4 цифри). Використовується для швидкого блокування екрану.</p>
      <div class="form-group" style="max-width: 250px;">
        <input type="password" class="input" id="teacher-pass" maxlength="4" value="" placeholder="${s.teacherPassword ? '••••' : '****'}">
        <div id="save-feedback" style="color: var(--grade-10); font-size: 14px; min-height: 1.2em; margin-top: 4px;"></div>
      </div>
    </div>
  `;

  let dataFolderBlock = `
    <div class="export-section-info">
      <h3>Локальна папка даних <span style="font-weight: normal; font-size: 14px; color: var(--muted);">(для ручної синхронізації через сторонні сервіси)</span></h3>
      <p>Фізичний шлях до файлів програми на цьому комп'ютері.</p>
      <div class="form-group">
        <input type="text" class="input" value="${window.esc(window.paths?.root || "")}" readonly style="opacity: 0.7">
      </div>
    </div>
  `;

  window.areaEl.innerHTML = `
    <h2>Налаштування</h2>

    <div class="export-section">
      ${teacherProfileBlock}
    </div>

    <div class="export-section">
      ${schoolYearBlock}
    </div>

    <div class="export-section">
      ${menuOrderBlock}
    </div>

    <div class="export-section" id="google-settings-section">
      ${authBlock}
    </div>

    <div class="export-section">
      ${backupBlock}
    </div>
    
    <div class="export-section">
      ${passwordBlock}
    </div>

    <div class="export-section">
      ${dataFolderBlock}
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
      <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
        <div style="text-align: center;">
          <img src="${window.esc(profile.picture)}" style="border-radius: 50%; width: 50px; height: 50px;">
          <p style="font-size: 12px; color: var(--muted); margin: 4px 0 0 0;">${window.esc(profile.email)}</p>
        </div>
        
        <div class="form-group" style="flex: 1;">
          <label>Статус синхронізації</label>
          <div id="cloud-info-text" style="color: var(--muted); font-size: 14px; min-height: 1.5em;">...</div>
        </div>
        
        <div class="form-group" style="display: flex; flex-direction: row; align-items: center; gap: 8px;">
          <label for="settings-autosync" style="cursor: pointer;">Автосинхронізація</label>
          <input type="checkbox" id="settings-autosync" style="width: 20px; height: 20px; cursor: pointer;">
        </div>
        <div class="export-section-actions" style="margin-left: auto;">
          <button class="btn" id="btn-cloud-upload">☁️⬆️ Синхронізувати зараз</button>
          <button class="btn ghost" id="btn-cloud-download">☁️⬇️ Завантажити з хмари</button>
          <button class="btn danger" id="btn-cloud-logout">Вийти</button>
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
    
    window.$("#btn-cloud-upload").onclick = async () => {
      const btn = window.$("#btn-cloud-upload"); btn.disabled = true; btn.textContent = "⏳ Вивантаження...";
      const res = await window.tj.cloudSyncUpload();
      
      if (res && res.error === "LOCAL_DATA_EMPTY") {
        btn.disabled = false; btn.textContent = "☁️⬆️ Синхронізувати зараз";
        await window.showCustomAlert("Дію скасовано", "Ваші локальні дані порожні. Вивантаження скасовано, щоб не затерти хмарну копію.\n\nЯкщо ви хочете відновити дані, натисніть 'Завантажити з хмари'.");
      
      } else if (res.success) {
        btn.disabled = false; btn.textContent = "☁️⬆️ Синхронізувати зараз";
        await window.showCustomAlert("Успіх", "Дані збережено у хмару!"); 
        updateCloudInfo();
      } else {
        btn.disabled = false; btn.textContent = "☁️⬆️ Синхронізувати зараз";
        await window.showCustomAlert("Помилка", res.error);
      }
    };
    
    window.$("#btn-cloud-download").onclick = async () => {
      if (await window.showCustomConfirm("Завантаження", "Локальні дані будуть замінені. Програма перезапуститься. Продовжити?", "Завантажити", "Скасувати", true)) {
        const btn = window.$("#btn-cloud-download"); btn.disabled = true; btn.textContent = "⏳ Завантаження...";
        const res = await window.tj.cloudSyncDownload();
        if (res?.error) { btn.disabled = false; btn.textContent = "☁️⬇️ Завантажити з хмари"; await window.showCustomAlert("Помилка", res.error); }
      }
    };
    updateCloudInfo();
  } else {
    container.innerHTML = `<button class="btn" id="google-login-btn">Увійти через Google</button>`;
    window.$("#google-login-btn").onclick = window.handleGoogleLogin;
  }
}

async function updateCloudInfo() {
  const el = window.$("#cloud-info-text");
  if (!el) return;
  el.textContent = "Завантаження...";
  try {
    const meta = await window.tj.googleGetBackupMeta();
    if (meta?.error) throw new Error(meta.error);
    if (meta && meta.id) {
      const d = new Date(meta.modifiedTime); 
      if (isNaN(d.getTime())) {
        el.textContent = "Помилка формату дати.";
        return;
      }
      const dateStr = d.toLocaleDateString("uk-UA", { day: '2-digit', month: '2-digit', year: 'numeric' });
      const timeStr = d.toLocaleTimeString("uk-UA", { hour: '2-digit', minute: '2-digit' });
      el.textContent = `Остання копія: ${dateStr}, ${timeStr}`;
    } else {
      el.textContent = "У хмарі ще немає резервних копій.";
    }
  } catch(e) {
    el.textContent = `Помилка: ${e.message}`;
    el.style.color = "var(--danger)";
  }
}
