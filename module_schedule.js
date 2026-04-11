// === ФАЙЛ: module_schedule.js ===

const DAYS = ["Понеділок", "Вівторок", "Середа", "Четвер", "П'ятниця"];
const DAYS_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт"];
const MAX_LESSONS = 8;

export function renderSchedulePage() {
  const schedule = window.state.schedule || [];

  window.areaEl.innerHTML = `
    <h2>Розклад уроків</h2>
    <div class="config-box" style="margin-bottom: 16px;">
      <div class="form-group">
        <label for="sched-class">Клас</label>
        <select id="sched-class" class="input"></select>
      </div>
      <div class="form-buttons-group">
        <button class="btn" id="sched-add-btn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Додати урок</button>
      </div>
    </div>
    <div id="sched-grid" style="overflow-x: auto;"></div>
  `;

  const classSel = window.$("#sched-class");
  classSel.innerHTML = '<option value="">-- Всі класи --</option>';
  Object.keys(window.state.students).sort().forEach(c => {
    classSel.innerHTML += `<option value="${window.esc(c)}">${window.esc(c)}</option>`;
  });

  const render = () => renderGrid(classSel.value);
  classSel.onchange = render;

  window.$("#sched-add-btn").onclick = () => showAddLessonDialog(classSel.value, render);

  render();
}

function renderGrid(classFilter) {
  const container = window.$("#sched-grid");
  if (!container) return;

  const schedule = (window.state.schedule || []).filter(s =>
    !classFilter || s.class === classFilter
  );

  let html = '<table class="table"><thead><tr><th style="width:50px;">№</th>';
  DAYS.forEach(d => { html += `<th style="text-align:center;">${d}</th>`; });
  html += '</tr></thead><tbody>';

  for (let ln = 1; ln <= MAX_LESSONS; ln++) {
    html += `<tr><td style="text-align:center; font-weight:600;">${ln}</td>`;
    for (let dayIdx = 0; dayIdx < 5; dayIdx++) {
      const items = schedule.filter(s => s.dayOfWeek === dayIdx && s.lessonNumber === ln);
      if (items.length === 0) {
        html += `<td style="text-align:center; color:var(--muted); cursor:pointer;" class="sched-cell" data-day="${dayIdx}" data-ln="${ln}">—</td>`;
      } else {
        const cellParts = items.map(item => {
          const timeStr = item.startTime && item.endTime ? `<br><small style="color:var(--muted)">${item.startTime}-${item.endTime}</small>` : '';
          const roomStr = item.room ? `<br><small style="color:var(--muted)">к.${window.esc(item.room)}</small>` : '';
          return `<div style="margin-bottom:4px;" class="sched-item" data-id="${item.id}">
            <strong>${window.esc(item.subject)}</strong><br>
            <small>${window.esc(item.class)}</small>${timeStr}${roomStr}
            <button class="sched-del-btn" data-id="${item.id}" style="position:absolute;top:2px;right:2px;background:none;border:none;cursor:pointer;color:var(--danger);font-size:12px;display:none;">✕</button>
          </div>`;
        }).join('');
        html += `<td style="text-align:center; position:relative; cursor:pointer;" class="sched-cell" data-day="${dayIdx}" data-ln="${ln}">${cellParts}</td>`;
      }
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  container.innerHTML = html;

  window.$$(".sched-cell", container).forEach(cell => {
    cell.onmouseenter = () => {
      window.$$(".sched-del-btn", cell).forEach(b => b.style.display = 'block');
    };
    cell.onmouseleave = () => {
      window.$$(".sched-del-btn", cell).forEach(b => b.style.display = 'none');
    };
  });

  window.$$(".sched-del-btn", container).forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const confirmed = await window.showCustomConfirm("Видалити", "Видалити цей урок з розкладу?", "Так", "Ні", true);
      if (confirmed) {
        window.state.schedule = window.state.schedule.filter(s => s.id !== id);
        window.saveSchedule();
        renderGrid(window.$("#sched-class")?.value || "");
      }
    };
  });

  window.$$(".sched-cell", container).forEach(cell => {
    cell.ondblclick = () => {
      const dayIdx = parseInt(cell.dataset.day);
      const ln = parseInt(cell.dataset.ln);
      showAddLessonDialog(window.$("#sched-class")?.value || "", () => renderGrid(window.$("#sched-class")?.value || ""), dayIdx, ln);
    };
  });
}

function showAddLessonDialog(defaultClass, onSave, preDay, preLn) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  const dialog = document.createElement("div");
  dialog.className = "modal-dialog";

  let classOptions = Object.keys(window.state.students).sort().map(c =>
    `<option value="${window.esc(c)}" ${c === defaultClass ? 'selected' : ''}>${window.esc(c)}</option>`
  ).join('');

  let subjectOptions = (window.state.subjects || []).sort().map(s =>
    `<option value="${window.esc(s)}">${window.esc(s)}</option>`
  ).join('');

  let dayOptions = DAYS.map((d, i) =>
    `<option value="${i}" ${preDay === i ? 'selected' : ''}>${d}</option>`
  ).join('');

  let lnOptions = '';
  for (let i = 1; i <= MAX_LESSONS; i++) {
    lnOptions += `<option value="${i}" ${preLn === i ? 'selected' : ''}>${i}</option>`;
  }

  dialog.innerHTML = `
    <h3>Додати урок до розкладу</h3>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:12px;">
      <div class="form-group"><label>День</label><select class="input" id="sd-day">${dayOptions}</select></div>
      <div class="form-group"><label>Номер уроку</label><select class="input" id="sd-ln">${lnOptions}</select></div>
      <div class="form-group"><label>Клас</label><select class="input" id="sd-class">${classOptions}</select></div>
      <div class="form-group"><label>Предмет</label><select class="input" id="sd-subj">${subjectOptions}</select></div>
      <div class="form-group"><label>Початок</label><input class="input" id="sd-start" type="time" value="08:30"></div>
      <div class="form-group"><label>Кінець</label><input class="input" id="sd-end" type="time" value="09:15"></div>
      <div class="form-group" style="grid-column:1/-1;"><label>Кабінет</label><input class="input" id="sd-room" placeholder="Номер кабінету"></div>
    </div>
    <div class="modal-actions">
      <button class="btn danger" id="sd-cancel">Скасувати</button>
      <button class="btn" id="sd-ok">Додати</button>
    </div>
  `;
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  window.$("#sd-cancel", dialog).onclick = () => overlay.remove();
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

  window.$("#sd-ok", dialog).onclick = () => {
    const cls = window.$("#sd-class", dialog).value;
    const subj = window.$("#sd-subj", dialog).value;
    if (!cls || !subj) { window.showCustomAlert("Помилка", "Оберіть клас та предмет."); return; }

    if (!window.state.schedule) window.state.schedule = [];
    window.state.schedule.push({
      id: "sched_" + Date.now(),
      dayOfWeek: parseInt(window.$("#sd-day", dialog).value),
      lessonNumber: parseInt(window.$("#sd-ln", dialog).value),
      class: cls,
      subject: subj,
      startTime: window.$("#sd-start", dialog).value,
      endTime: window.$("#sd-end", dialog).value,
      room: window.$("#sd-room", dialog).value.trim()
    });
    window.saveSchedule();
    overlay.remove();
    if (onSave) onSave();
  };
}
