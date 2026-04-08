// === ФАЙЛ: settings_app/module_settings.js ===
import { hashPassword } from '../utils.js';

// Словник для красивих назв кнопок (для списку)
const navNames = {
  'nav-lessons': '📚 Уроки',
  'nav-students': '👥 Учні',
  'nav-reports': '📊 Звіти',
  'nav-tests': '📝 Тести',
  'nav-board': '🎨 Дошка',
  'nav-notes': '🗒️ Замітки'
};

export function renderSettings() {
  
  // === Блоки з вашого сніпету ===
  
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

  // === ВАШ БЛОК ПЕРСОНАЛІЗАЦІЇ ===
  let menuOrderBlock = `
    <div class="export-section-info">
      <h3>Персоналізація меню</h3>
      <p>Налаштуйте порядок кнопок (перетягніть, щоб зберегти).</p>
      <div class="editor-list" id="settings-nav-order-list" style="max-width: 300px; margin-top: 12px; background: var(--bg); border-radius: 8px;"></div>
      <div id="nav-order-feedback" style="color: var(--grade-10); font-size: 14px; min-height: 1.2em; margin-top: 4px;"></div>
    </div>
  `;
  
  // === ВАШ БЛОК ПАРОЛЮ ===
  let passwordBlock = `
    <div class="export-section-info">
      <h3>Безпека <span style="font-weight: normal; font-size: 14px; color: var(--muted);">(для блокування доступу до програми)</span></h3>
      <p>Пароль вчителя (4 цифри). Використовується для швидкого блокування екрану.</p>
      <div class="form-group" style="max-width: 250px;">
        <input type="password" class="input" id="teacher-pass" maxlength="4" value="" placeholder="${window.state.settings.teacherPassword ? '••••' : '****'}">
        <div id="save-feedback" style="color: var(--grade-10); font-size: 14px; min-height: 1.2em; margin-top: 4px;"></div>
      </div>
    </div>
  `;
  
  // === ВАШ БЛОК ПАПКИ ДАНИХ ===
  let dataFolderBlock = `
    <div class="export-section-info">
      <h3>Локальна папка даних <span style="font-weight: normal; font-size: 14px; color: var(--muted);">(для ручної синхронізації через сторонні сервіси)</span></h3>
      <p>Фізичний шлях до файлів програми на цьому комп'ютері.</p>
      <div class="form-group">
        <input type="text" class="input" value="${window.esc(window.paths?.root || "")}" readonly style="opacity: 0.7">
      </div>
    </div>
  `;

  // === ВАШ МАКЕТ INNERHTML ===
  window.areaEl.innerHTML = `
    <h2>Налаштування</h2>
    
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

  // 1. Логіка для Google Auth
  updateGoogleAuthStatusUI();
  
  // 2. Логіка для Бекапів
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

  // 3. Логіка для Паролю (з вашого сніпету)
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

  // 4. Логіка для Порядку Меню (Автозбереження)
  renderNavOrderList(); // Рендеримо список
}

/**
 * Рендерить список кнопок меню для сортування (drag-and-drop)
 */
function renderNavOrderList() {
  const container = window.$("#settings-nav-order-list"); 
  if (!container) return;
  
  container.innerHTML = "";
  const order = window.state.settings.navOrder || ['nav-lessons', 'nav-students', 'nav-reports', 'nav-tests', 'nav-board', 'nav-notes'];

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
  
  // Логіка перетягування
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

/**
 * Оновлює UI для блоку Google Auth (з "запобіжником")
 */
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
    
    // === "ЗАПОБІЖНИК" (залишається) ===
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

/**
 * Оновлює поле "Остання копія" (з виправленням 'modifiedTime')
 */
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
        console.warn("Invalid date received from getBackupMeta:", meta.modifiedTime);
        return;
      }
      
      const dateStr = d.toLocaleDateString("uk-UA", {
        day: '2-digit', month: '2-digit', year: 'numeric'
      });
      const timeStr = d.toLocaleTimeString("uk-UA", {
        hour: '2-digit', minute: '2-digit'
      });
      el.textContent = `Остання копія: ${dateStr}, ${timeStr}`;
      
    } else {
      el.textContent = "У хмарі ще немає резервних копій.";
    }
  } catch(e) {
    el.textContent = `Помилка: ${e.message}`;
    el.style.color = "var(--danger)";
  }
}