// === ФАЙЛ: module_curriculum.js ===

export function renderCurriculumPage() {
  const curriculum = window.state.curriculum || [];

  window.areaEl.innerHTML = `
    <h2>Календарно-тематичне планування</h2>
    <div class="config-box" style="margin-bottom:16px;">
      <div class="form-group">
        <label for="ktp-class">Клас</label>
        <select id="ktp-class" class="input"></select>
      </div>
      <div class="form-group">
        <label for="ktp-subject">Предмет</label>
        <select id="ktp-subject" class="input"></select>
      </div>
      <div class="form-buttons-group">
        <button class="btn" id="ktp-create-btn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Створити КТП</button>
        <button class="btn" id="ktp-show-btn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> Показати</button>
      </div>
    </div>
    <div id="ktp-list" style="margin-bottom: 16px;"></div>
    <div id="ktp-editor" style="display:none;"></div>
  `;

  const classSel = window.$("#ktp-class");
  const subjSel = window.$("#ktp-subject");

  classSel.innerHTML = '';
  Object.keys(window.state.students).sort().forEach(c => {
    classSel.innerHTML += `<option value="${window.esc(c)}">${window.esc(c)}</option>`;
  });

  subjSel.innerHTML = '';
  (window.state.subjects || []).sort().forEach(s => {
    subjSel.innerHTML += `<option value="${window.esc(s)}">${window.esc(s)}</option>`;
  });

  window.$("#ktp-create-btn").onclick = () => {
    const cls = classSel.value;
    const subj = subjSel.value;
    if (!cls || !subj) { window.showCustomAlert("Помилка", "Оберіть клас та предмет."); return; }
    const existing = (window.state.curriculum || []).find(k => k.class === cls && k.subject === subj);
    if (existing) { window.showCustomAlert("Увага", "КТП для цього класу та предмету вже існує. Відкрийте його зі списку."); return; }

    const newKtp = {
      id: "ktp_" + Date.now(),
      class: cls,
      subject: subj,
      semester: "I семестр",
      items: []
    };
    if (!window.state.curriculum) window.state.curriculum = [];
    window.state.curriculum.push(newKtp);
    window.saveCurriculum();
    renderKtpList();
    openKtpEditor(newKtp.id);
  };

  window.$("#ktp-show-btn").onclick = () => renderKtpList();
  renderKtpList();
}

function renderKtpList() {
  const container = window.$("#ktp-list");
  if (!container) return;

  const list = window.state.curriculum || [];
  if (!list.length) {
    container.innerHTML = '<p style="color:var(--muted)">КТП ще не створено.</p>';
    return;
  }

  let html = '<table class="table"><thead><tr><th>Клас</th><th>Предмет</th><th>Кількість тем</th><th style="width:200px;">Дії</th></tr></thead><tbody>';
  list.forEach(ktp => {
    html += `<tr>
      <td>${window.esc(ktp.class)}</td>
      <td>${window.esc(ktp.subject)}</td>
      <td style="text-align:center;">${(ktp.items || []).length}</td>
      <td>
        <div style="display:flex;gap:8px;">
          <button class="btn ktp-open" data-id="${ktp.id}">Відкрити</button>
          <button class="btn danger ktp-del" data-id="${ktp.id}">Видалити</button>
        </div>
      </td>
    </tr>`;
  });
  html += '</tbody></table>';
  container.innerHTML = html;

  window.$$(".ktp-open", container).forEach(btn => {
    btn.onclick = () => openKtpEditor(btn.dataset.id);
  });

  window.$$(".ktp-del", container).forEach(btn => {
    btn.onclick = async () => {
      const confirmed = await window.showCustomConfirm("Видалити КТП?", "Цю дію неможливо скасувати.", "Видалити", "Скасувати", true);
      if (confirmed) {
        window.state.curriculum = (window.state.curriculum || []).filter(k => k.id !== btn.dataset.id);
        window.saveCurriculum();
        renderKtpList();
        const editorEl = window.$("#ktp-editor");
        if (editorEl) editorEl.style.display = 'none';
      }
    };
  });
}

function openKtpEditor(ktpId) {
  const ktp = (window.state.curriculum || []).find(k => k.id === ktpId);
  if (!ktp) return;

  const editorEl = window.$("#ktp-editor");
  if (!editorEl) return;
  editorEl.style.display = 'block';
  editorEl.scrollIntoView({ behavior: 'smooth' });

  renderEditor();

  function renderEditor() {
    const items = ktp.items || [];

    let rows = '';
    items.forEach((item, idx) => {
      rows += `<tr>
        <td style="text-align:center;">${idx + 1}</td>
        <td><input class="input ktp-topic" data-idx="${idx}" value="${window.esc(item.topic || "")}" placeholder="Тема уроку"></td>
        <td><input class="input ktp-date" data-idx="${idx}" type="date" value="${item.date || ''}"></td>
        <td><input class="input ktp-hours" data-idx="${idx}" type="number" min="1" max="10" value="${item.hours || 1}" style="width:60px;"></td>
        <td><input class="input ktp-hw" data-idx="${idx}" value="${window.esc(item.homework || "")}" placeholder="Домашнє завдання"></td>
        <td><input class="input ktp-notes" data-idx="${idx}" value="${window.esc(item.notes || "")}" placeholder="Примітки"></td>
        <td><button class="btn danger ktp-row-del" data-idx="${idx}" style="padding:4px 8px;">✕</button></td>
      </tr>`;
    });

    editorEl.innerHTML = `
      <div class="output-box">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <h3 style="margin:0; color:var(--accent);">КТП: ${window.esc(ktp.class)} — ${window.esc(ktp.subject)}</h3>
          <div style="display:flex;gap:8px;">
            <button class="btn" id="ktp-add-row">+ Додати тему</button>
            <button class="btn ghost" id="ktp-close-editor">Закрити</button>
          </div>
        </div>
        <div style="overflow-x:auto;">
          <table class="table">
            <thead>
              <tr>
                <th style="width:50px;">№</th>
                <th>Тема</th>
                <th style="width:130px;">Дата</th>
                <th style="width:70px;">Годин</th>
                <th>Домашнє завдання</th>
                <th>Примітки</th>
                <th style="width:50px;"></th>
              </tr>
            </thead>
            <tbody>${rows || '<tr><td colspan="7" style="text-align:center; color:var(--muted)">Натисніть "+ Додати тему" щоб почати</td></tr>'}</tbody>
          </table>
        </div>
        <div id="ktp-editor-feedback" style="color: var(--grade-10); font-size: 14px; min-height: 1.2em; margin-top: 8px;"></div>
      </div>
    `;

    window.$("#ktp-add-row", editorEl).onclick = () => {
      if (!ktp.items) ktp.items = [];
      const lastItem = ktp.items[ktp.items.length - 1];
      let nextDate = '';
      if (lastItem && lastItem.date) {
        const d = new Date(lastItem.date);
        d.setDate(d.getDate() + 7);
        nextDate = d.toISOString().split('T')[0];
      }
      ktp.items.push({ topic: '', date: nextDate, hours: 1, homework: '', notes: '' });
      window.saveCurriculum();
      renderEditor();
    };

    window.$("#ktp-close-editor", editorEl).onclick = () => {
      editorEl.style.display = 'none';
    };

    const saveField = window.debounce(() => {
      window.saveCurriculum();
      const fb = window.$("#ktp-editor-feedback", editorEl);
      if (fb) { fb.textContent = "Збережено!"; setTimeout(() => fb.textContent = "", 1500); }
    }, 400);

    window.$$(".ktp-topic", editorEl).forEach(inp => {
      inp.oninput = () => { ktp.items[parseInt(inp.dataset.idx)].topic = inp.value; saveField(); };
    });
    window.$$(".ktp-date", editorEl).forEach(inp => {
      inp.onchange = () => { ktp.items[parseInt(inp.dataset.idx)].date = inp.value; saveField(); };
    });
    window.$$(".ktp-hours", editorEl).forEach(inp => {
      inp.onchange = () => { ktp.items[parseInt(inp.dataset.idx)].hours = parseInt(inp.value) || 1; saveField(); };
    });
    window.$$(".ktp-hw", editorEl).forEach(inp => {
      inp.oninput = () => { ktp.items[parseInt(inp.dataset.idx)].homework = inp.value; saveField(); };
    });
    window.$$(".ktp-notes", editorEl).forEach(inp => {
      inp.oninput = () => { ktp.items[parseInt(inp.dataset.idx)].notes = inp.value; saveField(); };
    });

    window.$$(".ktp-row-del", editorEl).forEach(btn => {
      btn.onclick = () => {
        ktp.items.splice(parseInt(btn.dataset.idx), 1);
        window.saveCurriculum();
        renderEditor();
      };
    });
  }
}
