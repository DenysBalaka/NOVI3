let activeClassForEditing = null;
let studentsViewMode = "list"; // "list" | "edit"
let telegramRosterCache = { at: 0, byClassName: {} }; // { [className]: { [fullName]: { hasTelegram: boolean, username?: string|null } } }
let openStudentModal = null;

export function renderEditorPage() {
  window.areaEl.innerHTML = `
    <div class="students-page">
      <h2 class="students-page-title">Учні</h2>
      <p class="students-page-subtitle">Керуйте вашими класами, учнями та предметами.</p>

      <details class="config-box students-telegram-hint">
        <summary><b>Telegram</b>: як учню прив’язати акаунт</summary>
        <div class="students-telegram-hint-body">
          Учні можуть самі прив’язати акаунт у боті: після <code>/start</code> вони вводять <b>назву класу</b> і <b>ПІБ</b> так само, як у списку нижче.
          Якщо не вийде, вам може прийти сповіщення (якщо збережено «Telegram для сповіщень» у Налаштуваннях), або використайте посилання-запрошення в «Тести → Telegram».
        </div>
      </details>

      <div class="editor-layout students-editor-layout">
      <div class="editor-column">
        <h3>Класи</h3>
        <div class="editor-list" id="editor-classes-list"></div>
        <div class="editor-actions">
          <input class="input" id="editor-new-class-name" placeholder="Назва нового класу">
          <button id="editor-add-class" class="btn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Додати</button>
        </div>
      </div>
      <div class="editor-column">
        <h3>Список учнів</h3>
        <div id="editor-students-view" class="editor-students-view editor-textarea" aria-disabled="true"></div>
        <textarea id="editor-students-textarea" class="editor-textarea" placeholder="Введіть список учнів, по одному на рядок..." disabled style="display:none;"></textarea>
        <div class="editor-actions">
          <button id="editor-toggle-students-view" class="btn ghost" disabled>Редагувати</button>
          <div style="flex:1"></div>
          <button id="editor-save-students" class="btn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Зберегти учнів</button>
        </div>
      </div>
      <div class="editor-column">
        <h3>Предмети</h3>
        <div class="editor-list" id="editor-subjects-list"></div>
        <div class="editor-actions">
          <input class="input" id="editor-new-subject-name" placeholder="Назва нового предмету">
          <button id="editor-add-subject" class="btn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Додати</button>
        </div>
      </div>
      </div>
    </div>
  `;
  activeClassForEditing = null;
  window.populateEditorClasses();
  window.populateEditorSubjects();
  window.bindEditorPageLogic();
  studentsViewMode = "list";
  applyStudentsViewModeUi();
  renderStudentsListView([]);
}

export function populateEditorClasses() {
  const editorClassesList = window.$("#editor-classes-list");
  if (!editorClassesList) return;
  editorClassesList.innerHTML = "";
  window.state.classOrder.forEach((name, index) => {
    const item = document.createElement("div");
    item.className = "editor-list-item";
    item.dataset.className = name;
    if (name === activeClassForEditing) item.classList.add("selected");
    const nameSpan = document.createElement("span"); nameSpan.textContent = name;
    const controls = document.createElement("div"); controls.className = "item-controls";
    const upBtn = document.createElement("button"); upBtn.className = "order-btn"; upBtn.innerHTML = "↑";
    upBtn.disabled = (index === 0);
    upBtn.onclick = (e) => { e.stopPropagation(); window.moveClassOrder(index, index - 1); };
    const downBtn = document.createElement("button"); downBtn.className = "order-btn"; downBtn.innerHTML = "↓";
    downBtn.disabled = (index === window.state.classOrder.length - 1);
    downBtn.onclick = (e) => { e.stopPropagation(); window.moveClassOrder(index, index + 1); };
    controls.appendChild(upBtn); controls.appendChild(downBtn);
    item.appendChild(nameSpan); item.appendChild(controls);
    item.onclick = () => {
      activeClassForEditing = name;
      window.populateEditorClasses(); 
      const textarea = window.$("#editor-students-textarea");
      const toggleBtn = window.$("#editor-toggle-students-view");
      if (textarea) {
        textarea.value = (window.state.students[name] || [])
          .map((s, idx) => normalizeStudentEntry(s, idx).fullName)
          .filter(Boolean)
          .join("\n");
        textarea.disabled = false;
      }
      if (toggleBtn) toggleBtn.disabled = false;
      studentsViewMode = "list";
      applyStudentsViewModeUi();
      renderStudentsListView(window.state.students[name] || [], name);
    };
    item.oncontextmenu = (e) => { e.preventDefault(); window.showEditorContextMenu(e, 'class', name, item); };
    editorClassesList.appendChild(item);
  });
}

export async function moveClassOrder(fromIndex, toIndex) {
  if (toIndex < 0 || toIndex >= window.state.classOrder.length) return;
  const [item] = window.state.classOrder.splice(fromIndex, 1);
  window.state.classOrder.splice(toIndex, 0, item);
  try { await window.saveClassOrderSync(); } catch (e) { console.error("Failed to reorder class:", e); }
  window.populateEditorClasses();
}

export function populateEditorSubjects() {
  const editorSubjectsList = window.$("#editor-subjects-list");
  if (!editorSubjectsList) return;
  editorSubjectsList.innerHTML = "";
  [...window.state.subjects].sort().forEach(name => {
    const item = document.createElement("div");
    item.className = "editor-list-item";
    item.textContent = name;
    item.dataset.subjectName = name;
    item.oncontextmenu = (e) => { e.preventDefault(); window.showEditorContextMenu(e, 'subject', name, item); };
    editorSubjectsList.appendChild(item);
  });
}

export async function showEditorContextMenu(e, type, name, itemElement) {
  const isClass = type === 'class';
  const menuItems = [
    {
      label: isClass ? "Видалити клас..." : "Видалити предмет...",
      click: async () => {
        const confirmMessage = `Ви впевнені, що хочете видалити "${name}"?\n\nЦю дію неможливо скасувати.`;
        const confirmed = await window.showCustomConfirm("Підтвердження видалення", confirmMessage, "Видалити", "Скасувати", true);
        if (confirmed) {
          if (isClass) {
            delete window.state.students[name];
            const index = window.state.classOrder.indexOf(name);
            if (index > -1) window.state.classOrder.splice(index, 1);
            try { await window.saveStudentsSync(); await window.saveClassOrderSync(); } catch (e) { console.error("Failed to delete class:", e); }
            window.populateEditorClasses();
            if (activeClassForEditing === name) {
              activeClassForEditing = null;
              const ta = window.$("#editor-students-textarea");
              const toggleBtn = window.$("#editor-toggle-students-view");
              if (ta) { ta.value = ""; ta.disabled = true; }
              if (toggleBtn) toggleBtn.disabled = true;
              studentsViewMode = "list";
              applyStudentsViewModeUi();
              renderStudentsListView([]);
            }
          } else {
            const index = window.state.subjects.indexOf(name);
            if (index > -1) window.state.subjects.splice(index, 1);
            try { await window.saveSubjectsSync(); } catch (e) { console.error("Failed to delete subject:", e); }
            window.populateEditorSubjects();
          }
        }
      }
    }
  ];
  window.createContextMenu(e, menuItems);
}

export function bindEditorPageLogic() {
  const textarea = window.$("#editor-students-textarea");
  const toggleBtn = window.$("#editor-toggle-students-view");

  if (textarea) {
    textarea.addEventListener(
      "input",
      window.debounce(() => {
        if (!activeClassForEditing) return;
        renderStudentsListView(
          textarea.value.split("\n").map((s) => s.trim()).filter(Boolean),
          activeClassForEditing
        );
      }, 120)
    );
  }

  if (toggleBtn) {
    toggleBtn.onclick = () => {
      if (!activeClassForEditing) return;
      studentsViewMode = studentsViewMode === "list" ? "edit" : "list";
      applyStudentsViewModeUi();
      if (studentsViewMode === "list" && textarea) {
        renderStudentsListView(
          textarea.value.split("\n").map((s) => s.trim()).filter(Boolean),
          activeClassForEditing
        );
      }
      if (studentsViewMode === "edit" && textarea) textarea.focus();
    };
  }

  window.$("#editor-add-class").onclick = async () => {
    const input = window.$("#editor-new-class-name"), newName = input.value.trim();
    if (newName) {
      if (window.state.students[newName]) { 
        await window.showCustomAlert("Помилка", "Клас з такою назвою вже існує."); 
        return; 
      }
      window.state.students[newName] = [];
      window.state.classOrder.push(newName);
      try { await window.saveStudentsSync(); await window.saveClassOrderSync(); } catch (e) { console.error("Failed to add class:", e); }
      activeClassForEditing = newName; 
      window.populateEditorClasses();
      const ta = window.$("#editor-students-textarea");
      if (ta) { ta.value = ""; ta.disabled = false; }
      if (toggleBtn) toggleBtn.disabled = false;
      studentsViewMode = "edit";
      applyStudentsViewModeUi();
      renderStudentsListView([], newName);
      input.value = ""; 
    }
  };
  window.$("#editor-add-subject").onclick = async () => {
    const input = window.$("#editor-new-subject-name"), newName = input.value.trim();
    if (newName) {
      if (window.state.subjects.includes(newName)) { 
        await window.showCustomAlert("Помилка", "Предмет з такою назвою вже існує."); 
        return; 
      }
      window.state.subjects.push(newName);
      try { await window.saveSubjectsSync(); } catch (e) { console.error("Failed to add subject:", e); }
      window.populateEditorSubjects();
      input.value = ""; 
    }
  };
  window.$("#editor-save-students").onclick = async () => {
    if (activeClassForEditing) {
      const studentsList = window.$("#editor-students-textarea").value.split('\n').map(s => s.trim()).filter(Boolean);

      const prev = window.state.students[activeClassForEditing] || [];
      const prevByName = new Map();
      prev.forEach((entry, idx) => {
        const n = normalizeStudentEntry(entry, idx);
        if (!n.fullName) return;
        prevByName.set(n.fullName, n.entry);
      });

      const unique = [];
      const seen = new Set();
      studentsList.forEach((fullName) => {
        const key = String(fullName || "").trim();
        if (!key || seen.has(key)) return;
        seen.add(key);
        const existing = prevByName.get(key);
        unique.push(existing && typeof existing === "object" ? { ...existing, fullName: key } : key);
      });

      window.state.students[activeClassForEditing] = unique;
      try { 
        await window.saveStudentsSync(); 
        await window.showCustomAlert("Успіх", `Список учнів для класу "${activeClassForEditing}" збережено.`);
        renderStudentsListView(window.state.students[activeClassForEditing] || [], activeClassForEditing);
      } 
      catch (e) { 
        console.error("Failed to save students:", e); 
        await window.showCustomAlert("Помилка", "Помилка збереження учнів."); 
      }
    } else {
      await window.showCustomAlert("Увага", "Спочатку оберіть клас.");
    }
  };
}

function applyStudentsViewModeUi() {
  const textarea = window.$("#editor-students-textarea");
  const viewEl = window.$("#editor-students-view");
  const toggleBtn = window.$("#editor-toggle-students-view");
  const canEdit = !!activeClassForEditing && textarea && !textarea.disabled;

  if (toggleBtn) {
    toggleBtn.textContent = studentsViewMode === "list" ? "Редагувати" : "Перегляд";
    toggleBtn.disabled = !canEdit;
  }
  if (!textarea || !viewEl) return;
  if (studentsViewMode === "edit") {
    viewEl.style.display = "none";
    textarea.style.display = "block";
  } else {
    textarea.style.display = "none";
    viewEl.style.display = "block";
  }
  viewEl.setAttribute("aria-disabled", canEdit ? "false" : "true");
}

async function getTelegramRosterByClassNameCached() {
  const isConnected = typeof window.isTeacherCloudConnected === "function" && window.isTeacherCloudConnected();
  if (!isConnected) return null;

  const now = Date.now();
  if (telegramRosterCache && now - telegramRosterCache.at < 25_000 && telegramRosterCache.byClassName) {
    return telegramRosterCache.byClassName;
  }
  try {
    const data = await window.callCloudApi("GET", "roster");
    const byClassName = {};
    for (const c of data.classes || []) {
      const className = c && c.name != null ? String(c.name).trim() : "";
      if (!className) continue;
      const map = {};
      for (const st of c.students || []) {
        const fn = st && st.full_name != null ? String(st.full_name).trim() : "";
        if (!fn) continue;
        const hasTelegram = !!(st.telegram_user_id != null && String(st.telegram_user_id).trim() !== "");
        map[fn] = {
          id: st.id != null ? String(st.id) : null,
          hasTelegram,
          userId: st.telegram_user_id != null ? String(st.telegram_user_id) : null,
          username: st.telegram_username ?? null,
        };
      }
      byClassName[className] = map;
    }
    telegramRosterCache = { at: now, byClassName };
    return byClassName;
  } catch (_) {
    return null;
  }
}

function renderStudentsListView(students, className = null) {
  const viewEl = window.$("#editor-students-view");
  if (!viewEl) return;

  const normalized = (students || [])
    .map((s, idx) => normalizeStudentEntry(s, idx))
    .filter((x) => x.fullName);
  const unique = [];
  const seen = new Set();
  for (const n of normalized) {
    if (seen.has(n.fullName)) continue;
    seen.add(n.fullName);
    unique.push(n);
  }
  viewEl.innerHTML = `
    <div class="editor-students-list" role="list">
      ${unique.length === 0 ? `<div class="editor-students-empty">Немає учнів у списку.</div>` : unique.map((st) => `
        <div class="editor-student-row" role="listitem" data-fullname="${window.esc(st.fullName)}" data-index="${st.index}">
          <div class="editor-student-name">${window.esc(st.fullName)}</div>
          <div class="editor-student-tg editor-student-tg--loading">Telegram: …</div>
        </div>
      `).join("")}
    </div>
  `;

  (async () => {
    const rosterByClass = className ? await getTelegramRosterByClassNameCached() : null;
    const map = rosterByClass && className && rosterByClass[className] ? rosterByClass[className] : null;
    const rows = viewEl.querySelectorAll(".editor-student-row");
    rows.forEach((row) => {
      const tgEl = row.querySelector(".editor-student-tg");
      if (!tgEl) return;
      const fn = (row.getAttribute("data-fullname") || "").trim();

      if (!className) {
        tgEl.textContent = "Telegram: невідомо";
        tgEl.classList.remove("editor-student-tg--loading");
        tgEl.classList.add("editor-student-tg--unknown");
        return;
      }

      if (!map) {
        tgEl.textContent =
          typeof window.isTeacherCloudConnected === "function" && !window.isTeacherCloudConnected()
            ? "Telegram: хмару не підключено"
            : "Telegram: невідомо";
        tgEl.classList.remove("editor-student-tg--loading");
        tgEl.classList.add("editor-student-tg--unknown");
        return;
      }

      const info = map[fn];
      const has = !!(info && info.hasTelegram);
      if (has) {
        const u = info && info.username ? ` (@${String(info.username).replace(/^@/, "")})` : "";
        tgEl.textContent = `Telegram: додано${u}`;
        tgEl.classList.remove("editor-student-tg--loading");
        tgEl.classList.add("editor-student-tg--yes");
      } else {
        tgEl.textContent = "Telegram: не додано";
        tgEl.classList.remove("editor-student-tg--loading");
        tgEl.classList.add("editor-student-tg--no");
      }
    });
  })();

  // Клік по учню — відкрити форму профілю
  const rows = viewEl.querySelectorAll(".editor-student-row");
  rows.forEach((row) => {
    row.onclick = () => {
      if (!className) return;
      const idx = Number(row.getAttribute("data-index"));
      if (!Number.isFinite(idx)) return;
      openStudentProfileDialog({ className, index: idx });
    };
  });
}

function normalizeStudentEntry(entry, index) {
  if (typeof entry === "string") {
    return { index, fullName: entry.trim(), entry: { fullName: entry.trim() } };
  }
  if (entry && typeof entry === "object") {
    const fn =
      entry.fullName != null
        ? String(entry.fullName).trim()
        : entry.name != null
          ? String(entry.name).trim()
          : "";
    return { index, fullName: fn, entry: { ...entry, fullName: fn } };
  }
  return { index, fullName: "", entry: { fullName: "" } };
}

function calcAgeFromBirthDate(birthDateIso) {
  const d = birthDateIso ? new Date(birthDateIso) : null;
  if (!d || Number.isNaN(d.getTime())) return "";
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 0 && age <= 120 ? String(age) : "";
}

function closeStudentProfileDialog() {
  if (openStudentModal) {
    openStudentModal.remove();
    openStudentModal = null;
  }
}

async function openStudentProfileDialog({ className, index }) {
  closeStudentProfileDialog();
  const arr = window.state.students && window.state.students[className] ? window.state.students[className] : [];
  const raw = arr[index];
  const st = normalizeStudentEntry(raw, index);
  if (!st.fullName) return;

  const profile = (st.entry && st.entry.profile && typeof st.entry.profile === "object") ? st.entry.profile : {};
  const birthDate = profile.birthDate || "";
  const gender = profile.gender || "";
  const hobbies = profile.hobbies || "";
  const phone = profile.phone || "";
  const username = profile.username || "";
  const parents = (profile.parents && typeof profile.parents === "object") ? profile.parents : {};
  const motherName = parents.motherName || "";
  const fatherName = parents.fatherName || "";
  const parentsPhone = parents.phone || "";

  // Telegram info (з хмари, якщо доступно)
  const rosterByClass = await getTelegramRosterByClassNameCached();
  const tgMap = rosterByClass && rosterByClass[className] ? rosterByClass[className] : null;
  const tg = tgMap ? tgMap[st.fullName] : null;
  const tgId = tg && tg.userId ? String(tg.userId) : "";
  const tgUser = tg && tg.username ? String(tg.username).replace(/^@/, "") : "";
  const tgLinked = !!tgId;
  const tgStudentId = tg && tg.id ? String(tg.id) : "";

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  const dialog = document.createElement("div");
  dialog.className = "modal-dialog";
  dialog.style.maxWidth = "720px";
  dialog.innerHTML = `
    <div style="display:flex;gap:10px;align-items:flex-start;justify-content:space-between;">
      <div>
        <h3 style="margin:0 0 6px;">${window.esc(st.fullName)}</h3>
        <div style="font-size:13px;color:var(--text-secondary);">Профіль учня</div>
      </div>
      <button class="btn ghost" id="student-modal-close" title="Закрити">Закрити</button>
    </div>

    <div style="margin-top:14px;display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div class="form-group" style="min-width:0;">
        <label>Дата народження</label>
        <input type="date" class="input" id="student-birthdate" value="${window.esc(birthDate)}">
      </div>
      <div class="form-group" style="min-width:0;">
        <label>Вік</label>
        <input type="text" class="input" id="student-age" value="${window.esc(calcAgeFromBirthDate(birthDate))}" readonly style="opacity:0.8;">
      </div>
      <div class="form-group" style="min-width:0;">
        <label>Стать</label>
        <select class="input" id="student-gender">
          <option value="" ${gender === "" ? "selected" : ""}>—</option>
          <option value="female" ${gender === "female" ? "selected" : ""}>Жіноча</option>
          <option value="male" ${gender === "male" ? "selected" : ""}>Чоловіча</option>
          <option value="other" ${gender === "other" ? "selected" : ""}>Інше</option>
        </select>
      </div>
      <div class="form-group" style="min-width:0;">
        <label>Телефон учня</label>
        <input type="text" class="input" id="student-phone" value="${window.esc(phone)}" placeholder="+380...">
      </div>
      <div class="form-group" style="grid-column:1 / -1;min-width:0;">
        <label>Хобі (до 100 символів)</label>
        <input type="text" class="input" id="student-hobbies" value="${window.esc(hobbies)}" maxlength="100" placeholder="Коротко: спорт, музика...">
        <div style="font-size:11px;color:var(--muted);margin-top:4px;">
          <span id="student-hobbies-count">${String(hobbies || "").length}</span>/100
        </div>
      </div>
    </div>

    <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border-color);">
      <div style="display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;">
        <div style="font-weight:700;">Контакти та батьки</div>
      </div>
      <div style="margin-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group" style="min-width:0;">
          <label>Username (локально)</label>
          <input type="text" class="input" id="student-username" value="${window.esc(username)}" placeholder="наприклад, логін">
        </div>
        <div class="form-group" style="min-width:0;">
          <label>Телефон батьків</label>
          <input type="text" class="input" id="parents-phone" value="${window.esc(parentsPhone)}" placeholder="+380...">
        </div>
        <div class="form-group" style="min-width:0;">
          <label>Мама (ПІБ)</label>
          <input type="text" class="input" id="mother-name" value="${window.esc(motherName)}">
        </div>
        <div class="form-group" style="min-width:0;">
          <label>Тато (ПІБ)</label>
          <input type="text" class="input" id="father-name" value="${window.esc(fatherName)}">
        </div>
      </div>
    </div>

    <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border-color);">
      <div style="display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;">
        <div style="font-weight:700;">Telegram</div>
        <div style="font-size:12px;color:var(--text-secondary);">
          ${tgMap
            ? (tgLinked ? "Прив’язано" : "Не прив’язано")
            : "Хмару не підключено — статус може бути невідомий"}
        </div>
      </div>
      <div style="margin-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group" style="min-width:0;">
          <label>Telegram user id</label>
          <input type="text" class="input" id="tg-id" value="${window.esc(tgId)}" readonly style="opacity:0.8;">
        </div>
        <div class="form-group" style="min-width:0;">
          <label>Telegram username</label>
          <input type="text" class="input" id="tg-user" value="${window.esc(tgUser ? "@" + tgUser : "")}" readonly style="opacity:0.8;">
        </div>
      </div>
      <div style="margin-top:10px;display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;">
        <button class="btn danger" id="tg-unlink" ${tgStudentId && tgLinked ? "" : "disabled"}>Відв’язати від бота</button>
      </div>
      <div id="tg-unlink-feedback" style="font-size:12px;color:var(--muted);min-height:1.2em;margin-top:6px;"></div>
    </div>

    <div class="modal-actions" style="margin-top:16px;">
      <button class="btn danger" id="student-cancel">Скасувати</button>
      <button class="btn" id="student-save">Зберегти</button>
    </div>
  `;
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  openStudentModal = overlay;

  const closeBtn = window.$("#student-modal-close", overlay);
  const cancelBtn = window.$("#student-cancel", overlay);
  const saveBtn = window.$("#student-save", overlay);
  const birthEl = window.$("#student-birthdate", overlay);
  const ageEl = window.$("#student-age", overlay);
  const hobbiesEl = window.$("#student-hobbies", overlay);
  const hobbiesCountEl = window.$("#student-hobbies-count", overlay);
  const unlinkBtn = window.$("#tg-unlink", overlay);
  const unlinkFb = window.$("#tg-unlink-feedback", overlay);

  const close = () => closeStudentProfileDialog();
  if (closeBtn) closeBtn.onclick = close;
  if (cancelBtn) cancelBtn.onclick = close;
  overlay.onclick = (e) => { if (e.target === overlay) close(); };

  if (birthEl && ageEl) {
    birthEl.oninput = () => {
      ageEl.value = calcAgeFromBirthDate(birthEl.value);
    };
  }
  if (hobbiesEl && hobbiesCountEl) {
    hobbiesEl.oninput = () => {
      hobbiesCountEl.textContent = String(hobbiesEl.value.length);
    };
  }

  if (unlinkBtn) {
    unlinkBtn.onclick = async () => {
      if (!tgStudentId) return;
      if (!window.isTeacherCloudConnected || !window.isTeacherCloudConnected()) {
        await window.showCustomAlert("Telegram", "Хмара не підключена — неможливо виконати відв’язку.");
        return;
      }
      const ok = await window.showCustomConfirm(
        "Відв’язати Telegram",
        "Ви впевнені? Це скине прив’язку учня до Telegram-бота.",
        "Відв’язати",
        "Скасувати",
        true
      );
      if (!ok) return;
      unlinkBtn.disabled = true;
      if (unlinkFb) {
        unlinkFb.textContent = "Виконується відв’язка…";
        unlinkFb.style.color = "var(--muted)";
      }
      try {
        await window.callCloudApi("PATCH", `students/${encodeURIComponent(tgStudentId)}/telegram`, { unlink: true });
        telegramRosterCache.at = 0; // скинути кеш, щоб оновити статус
        if (unlinkFb) {
          unlinkFb.textContent = "Відв’язано.";
          unlinkFb.style.color = "var(--grade-10)";
        }
        renderStudentsListView(window.state.students[className] || [], className);
      } catch (e) {
        if (unlinkFb) {
          unlinkFb.textContent = e && e.message ? e.message : "Помилка відв’язки.";
          unlinkFb.style.color = "var(--danger)";
        }
        unlinkBtn.disabled = false;
      }
    };
  }

  if (saveBtn) {
    saveBtn.onclick = async () => {
      const newBirth = (window.$("#student-birthdate", overlay)?.value || "").trim();
      const newGender = (window.$("#student-gender", overlay)?.value || "").trim();
      const newPhone = (window.$("#student-phone", overlay)?.value || "").trim();
      const newUsername = (window.$("#student-username", overlay)?.value || "").trim();
      const newHobbies = (window.$("#student-hobbies", overlay)?.value || "").trim().slice(0, 100);
      const newMother = (window.$("#mother-name", overlay)?.value || "").trim();
      const newFather = (window.$("#father-name", overlay)?.value || "").trim();
      const newParentsPhone = (window.$("#parents-phone", overlay)?.value || "").trim();

      const next = {
        ...st.entry,
        fullName: st.fullName,
        profile: {
          ...(st.entry.profile && typeof st.entry.profile === "object" ? st.entry.profile : {}),
          birthDate: newBirth || "",
          gender: newGender || "",
          hobbies: newHobbies || "",
          phone: newPhone || "",
          username: newUsername || "",
          parents: {
            ...(parents && typeof parents === "object" ? parents : {}),
            motherName: newMother || "",
            fatherName: newFather || "",
            phone: newParentsPhone || "",
          },
        },
      };

      window.state.students[className][index] = next;
      try {
        await window.saveStudentsSync();
      } catch (e) {
        console.error("Failed to save students:", e);
        await window.showCustomAlert("Помилка", "Не вдалося зберегти дані учня.");
        return;
      }
      close();
    };
  }
}