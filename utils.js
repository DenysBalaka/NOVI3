// === ДОПОМІЖНІ ФУНКЦІЇ (доступні глобально) ===

const DANGEROUS_TAGS = /(<\s*\/?\s*)(script|iframe|object|embed|form|link|meta|base)(\s|>)/gi;
const EVENT_HANDLERS = /\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)/gi;
const JAVASCRIPT_URLS = /href\s*=\s*["']?\s*javascript:/gi;

export function sanitizeHTML(html) {
  if (!html) return "";
  return html
    .replace(DANGEROUS_TAGS, "&lt;$2$3")
    .replace(EVENT_HANDLERS, "")
    .replace(JAVASCRIPT_URLS, 'href="');
}

const PBKDF2_ITERATIONS = 100000;

function bufToHex(buf) {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPassword(password, existingSalt) {
  const encoder = new TextEncoder();
  const salt = existingSalt
    ? Uint8Array.from(existingSalt.match(/.{2}/g).map(h => parseInt(h, 16)))
    : crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]
  );
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial, 256
  );
  const saltHex = bufToHex(salt);
  const hashHex = bufToHex(derived);
  return `pbkdf2:${PBKDF2_ITERATIONS}:${saltHex}:${hashHex}`;
}

export async function verifyPassword(password, stored) {
  if (!stored || !password) return false;
  if (stored.startsWith("pbkdf2:")) {
    const parts = stored.split(":");
    if (parts.length !== 4) return false;
    const iterations = parseInt(parts[1], 10);
    const saltHex = parts[2];
    const expectedHash = parts[3];
    const encoder = new TextEncoder();
    const salt = Uint8Array.from(saltHex.match(/.{2}/g).map(h => parseInt(h, 16)));
    const keyMaterial = await crypto.subtle.importKey(
      "raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]
    );
    const derived = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
      keyMaterial, 256
    );
    return bufToHex(derived) === expectedHash;
  }
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return bufToHex(hashBuffer) === stored;
}

export function debounce(func, timeout = 400){
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => { func.apply(this, args); }, timeout);
  };
}

export function showCustomAlert(title, message) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    const dialog = document.createElement("div");
    dialog.className = "modal-dialog";
    dialog.innerHTML = `
      <h3>${window.esc(title)}</h3>
      <pre style="white-space: pre-wrap; font-family: Segoe UI, Arial; font-size: 14px; color: var(--text-secondary);">${window.esc(message)}</pre>
      <div class="modal-actions">
        <button class="btn" id="modal-ok">OK</button>
      </div>
    `;
    overlay.appendChild(dialog); // <-- Додаємо діалог до оверлею
    document.body.appendChild(overlay);
    const btnOk = window.$("#modal-ok", overlay);
    
    const close = () => { overlay.remove(); resolve(true); };
    
    btnOk.onclick = close;
    overlay.onclick = (e) => {
      if (e.target === overlay) { close(); }
    };
  });
}

export function showCustomConfirm(title, message, okText = "Так", cancelText = "Скасувати", isDanger = false) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    const dialog = document.createElement("div");
    dialog.className = "modal-dialog";
    dialog.innerHTML = `
      <h3>${window.esc(title)}</h3>
      <p>${window.esc(message)}</p>
      <div class="modal-actions">
        <button class="btn danger" id="modal-cancel">${window.esc(cancelText)}</button>
        <button class="btn ${isDanger ? 'danger' : ''}" id="modal-ok">${window.esc(okText)}</button>
      </div>
    `;
    overlay.appendChild(dialog); // <-- Додаємо діалог до оверлею
    document.body.appendChild(overlay);
    const btnOk = window.$("#modal-ok", overlay);
    const btnCancel = window.$("#modal-cancel", overlay);
    btnOk.onclick = () => { overlay.remove(); resolve(true); };
    btnCancel.onclick = () => { overlay.remove(); resolve(false); };
    overlay.onclick = (e) => {
      if (e.target === overlay) { overlay.remove(); resolve(false); }
    };
  });
}

export function showTestStartDialog(testTitle, students, className) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    const dialog = document.createElement("div");
    dialog.className = "modal-dialog";
    
    let studentInputHtml = '';
    const studentsInClass = students[className];
    
    if (studentsInClass && studentsInClass.length > 0) {
      studentInputHtml = `
        <label for="test-student-select">Оберіть учня:</label>
        <select id="test-student-select" class="input">
          <option value="">-- Оберіть зі списку --</option>
          ${studentsInClass.map(s => `<option value="${window.esc(s)}">${window.esc(s)}</option>`).join('')}
          <option value="other_name">-- Ввести ім'я вручну --</option>
        </select>
        <input type="text" id="test-student-name" class="input" placeholder="Або введіть ПІБ..." style="display: none; margin-top: 8px;">
      `;
    } else {
      studentInputHtml = `
        <label for="test-student-name">Прізвище та Ім'я учня:</label>
        <input type="text" id="test-student-name" class="input" placeholder="Введіть ПІБ...">
      `;
    }

    dialog.innerHTML = `
      <h3>Початок тесту</h3>
      <p><b>Тест:</b> ${window.esc(testTitle)}</p>
      
      <div class="form-group" style="margin-top: 16px;">
        ${studentInputHtml}
      </div>
      
      <div class="form-group" style="margin-top: 16px;">
        <label for="timer-slider">Обмеження часу:</label>
        <span id="timer-slider-label">Без ліміту</span>
        <input type="range" id="timer-slider" class="input" min="0" max="120" value="0" step="1">
      </div>

      <div class="modal-actions">
        <button class="btn danger" id="modal-cancel">Скасувати</button>
        <button class="btn" id="modal-ok">Почати</button>
      </div>
    `;
    overlay.appendChild(dialog); // <-- Додаємо діалог до оверлею
    document.body.appendChild(overlay);

    const btnOk = window.$("#modal-ok", overlay);
    const btnCancel = window.$("#modal-cancel", overlay);
    const studentNameInput = window.$("#test-student-name", overlay);
    const studentSelect = window.$("#test-student-select", overlay);
    const slider = window.$("#timer-slider", overlay);
    const sliderLabel = window.$("#timer-slider-label", overlay);
    
    if (studentSelect) {
      studentSelect.onchange = () => {
        if (studentSelect.value === 'other_name') {
          studentNameInput.style.display = 'block';
          studentNameInput.focus();
        } else {
          studentNameInput.style.display = 'none';
        }
      };
    }

    const updateSliderLabel = () => {
      const val = parseInt(slider.value, 10);
      if (val === 0) {
        sliderLabel.textContent = "Без ліміту";
      } else if (val === 1) {
        sliderLabel.textContent = "1 хвилина";
      } else if (val > 1 && val < 5) {
        sliderLabel.textContent = `${val} хвилини`;
      } else {
        sliderLabel.textContent = `${val} хвилин`;
      }
    };

    slider.oninput = updateSliderLabel;
    updateSliderLabel(); 

    btnOk.onclick = async () => {
      let studentName = "";
      if (studentSelect) {
        if (studentSelect.value === 'other_name') {
          studentName = studentNameInput.value.trim();
        } else {
          studentName = studentSelect.value;
        }
      } else {
        studentName = studentNameInput.value.trim();
      }

      if (!studentName) {
        await window.showCustomAlert("Помилка", "Будь ласка, оберіть або введіть ім'я учня.");
        studentSelect ? studentSelect.focus() : studentNameInput.focus();
        return;
      }
      const timeLimitInMinutes = parseInt(slider.value, 10);
      overlay.remove();
      resolve({ studentName, timeLimitInMinutes, canceled: false });
    };
    
    btnCancel.onclick = () => {
      overlay.remove();
      resolve({ canceled: true });
    };
    
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        overlay.remove();
        resolve({ canceled: true });
      }
    };
  });
}


export function createContextMenu(e, items) {
  window.closeContextMenu(); 
  const menu = document.createElement("div");
  menu.className = "ctx-menu";
  
  let x = e.clientX, y = e.clientY;
  if (e.currentTarget?.classList?.contains('nav-btn')) {
     const btnRect = e.currentTarget.getBoundingClientRect();
     x = btnRect.left;
     y = btnRect.bottom + 4;
  }
  
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;

  items.forEach(item => {
    if (item.type === 'separator') {
      menu.appendChild(document.createElement("hr"));
    } else {
      const btn = document.createElement("button");
      btn.textContent = item.label;
      btn.onclick = () => { item.click(); window.closeContextMenu(); };
      menu.appendChild(btn);
    }
  });
  document.body.appendChild(menu);
  window.activeContextMenu = menu;
}

export function closeContextMenu() {
  if (window.activeContextMenu) {
    window.activeContextMenu.remove();
    window.activeContextMenu = null;
  }
}

export function showTextEditContextMenu(e) {
  e.preventDefault();
  e.stopPropagation();
  window.createContextMenu(e, [
    { label: "Вирізати", click: () => document.execCommand("cut") },
    { label: "Копіювати", click: () => document.execCommand("copy") },
    { label: "Вставити", click: () => document.execCommand("paste") }
  ]);
}

/**
 * === ОНОВЛЕНА ФУНКЦІЯ: Модальне вікно для пароля ===
 * Показує модальне вікно для введення пароля
 * @param {string} title - Заголовок вікна
 * @param {string} correctPassword - Правильний пароль для перевірки
 * @returns {Promise<boolean>} - true, якщо пароль вірний, інакше false
 */
export function showPasswordPrompt(title, storedHash) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.id = "password-prompt-overlay";
    
    const dialog = document.createElement("div");
    dialog.className = "modal-dialog";
    
    dialog.innerHTML = `
      <h3>${window.esc(title)}</h3>
      <div class="form-group" style="margin-top: 16px;">
        <label for="modal-password-input">Пароль вчителя:</label>
        <input type="password" id="modal-password-input" class="input" autofocus maxlength="4">
        <div id="pass-error-msg" style="color: var(--danger); font-size: 14px; min-height: 1.2em; margin-top: 4px;"></div>
      </div>
      <div class="modal-actions">
        <button class="btn danger" id="modal-cancel">Скасувати</button>
        <button class="btn" id="modal-ok">OK</button>
      </div>
    `;
    
    overlay.appendChild(dialog); 
    document.body.appendChild(overlay); 

    const btnOk = window.$("#modal-ok", dialog);
    const btnCancel = window.$("#modal-cancel", dialog);
    const passInput = window.$("#modal-password-input", dialog);
    const errorMsg = window.$("#pass-error-msg", dialog);

    const closeAndResolve = (result) => {
      overlay.remove();
      resolve(result);
    };
    
    const checkPassword = async (value) => {
      return verifyPassword(value, storedHash);
    };

    passInput.oninput = async () => {
      const currentValue = passInput.value;
      if (storedHash && currentValue.length === 4) {
        if (await checkPassword(currentValue)) {
          closeAndResolve(true);
        }
      }
    };

    btnOk.onclick = async () => {
      if (await checkPassword(passInput.value)) {
        closeAndResolve(true);
      } else {
        errorMsg.textContent = "Невірний пароль.";
        dialog.classList.add('shake'); 
        setTimeout(() => dialog.classList.remove('shake'), 500);
        passInput.focus();
        passInput.select();
      }
    };
    
    passInput.onkeydown = (e) => {
      if (e.key === 'Enter') {
        btnOk.click();
      } else if (e.key === 'Escape') {
        btnCancel.click();
      }
    };
    
    btnCancel.onclick = () => closeAndResolve(false);
    
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        closeAndResolve(false);
      }
    };
    
    passInput.focus();
  });
}