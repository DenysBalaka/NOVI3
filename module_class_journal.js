// === ФАЙЛ: module_class_journal.js ===

function gradeColor(val) {
  const n = parseInt(val);
  if (n >= 10) return "var(--grade-10)";
  if (n >= 7) return "var(--grade-7)";
  if (n >= 4) return "var(--grade-4)";
  if (n >= 1) return "var(--danger)";
  return "var(--text-primary)";
}

function presenceShort(val) {
  if (val === true || val === "present") return "";
  if (val === false || val === "absent") return "н";
  if (val === "sick") return "хв";
  if (val === "excused") return "зв";
  if (val === "late") return "зп";
  return "";
}

function normalizeStudentName(entry) {
  if (typeof entry === "string") return entry.trim();
  if (entry && typeof entry === "object") {
    if (entry.fullName != null) return String(entry.fullName).trim();
    if (entry.name != null) return String(entry.name).trim();
  }
  return "";
}

export function renderClassJournalPage() {
  const semesters = window.state.settings.semesters || [];

  window.areaEl.innerHTML = `
    <h2>Класний журнал</h2>
    <div class="config-box" style="margin-bottom: 16px;">
      <div class="form-group">
        <label for="cj-class">Клас</label>
        <select id="cj-class" class="input"></select>
      </div>
      <div class="form-group">
        <label for="cj-subject">Предмет</label>
        <select id="cj-subject" class="input"></select>
      </div>
      <div class="form-group">
        <label for="cj-semester">Семестр</label>
        <select id="cj-semester" class="input">
          <option value="">Весь рік</option>
          ${semesters.map((s, i) => `<option value="${i}">${window.esc(s.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-buttons-group">
        <button class="btn" id="cj-render-btn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> Показати</button>
      </div>
    </div>
    <div id="cj-output" style="overflow-x: auto;"></div>
  `;

  const classSel = window.$("#cj-class");
  const subjSel = window.$("#cj-subject");

  classSel.innerHTML = '';
  Object.keys(window.state.students).sort().forEach(c => {
    classSel.innerHTML += `<option value="${window.esc(c)}">${window.esc(c)}</option>`;
  });

  subjSel.innerHTML = '<option value="all">Всі предмети</option>';
  (window.state.subjects || []).sort().forEach(s => {
    subjSel.innerHTML += `<option value="${window.esc(s)}">${window.esc(s)}</option>`;
  });

  window.$("#cj-render-btn").onclick = () => renderJournal();
  renderJournal();

  function renderJournal() {
    const cls = classSel.value;
    const subFilter = subjSel.value;
    const semIdx = window.$("#cj-semester").value;
    const out = window.$("#cj-output");
    if (!cls) { out.innerHTML = '<p style="color:var(--muted)">Оберіть клас.</p>'; return; }

    const studentNames = (window.state.students[cls] || []).map(normalizeStudentName).filter(Boolean);
    if (!studentNames.length) { out.innerHTML = '<p style="color:var(--muted)">У цьому класі немає учнів.</p>'; return; }

    let lessons = window.state.lessons.filter(l => l.class === cls);
    if (subFilter !== "all") lessons = lessons.filter(l => l.subject === subFilter);

    if (semIdx !== "") {
      const sem = semesters[parseInt(semIdx)];
      if (sem) {
        lessons = lessons.filter(l => {
          const ld = (l.date || "").split("T")[0];
          return ld >= sem.startDate && ld <= sem.endDate;
        });
      }
    }

    lessons.sort((a, b) => new Date(a.date) - new Date(b.date));

    if (!lessons.length) { out.innerHTML = '<p style="color:var(--muted)">Немає уроків за обраними критеріями.</p>'; return; }

    const subjects = subFilter === "all" ? [...new Set(lessons.map(l => l.subject))].sort() : [subFilter];

    let html = '';

    subjects.forEach(subj => {
      const subLessons = lessons.filter(l => l.subject === subj);
      if (!subLessons.length) return;

      html += `<h3 style="margin-top:16px; color:var(--accent);">${window.esc(subj)}</h3>`;
      html += '<div style="overflow-x:auto; margin-bottom:16px;">';
      html += '<table class="table cj-table"><thead><tr><th style="position:sticky;left:0;background:var(--panel);z-index:2;min-width:160px;">Учень</th>';

      subLessons.forEach(l => {
        const dateStr = (l.date || "").split("T")[0];
        const parts = dateStr.split("-");
        const shortDate = parts.length === 3 ? `${parts[2]}.${parts[1]}` : dateStr;
        html += `<th style="text-align:center; min-width:50px; font-size:12px; writing-mode:vertical-lr; transform:rotate(180deg); height:70px;" title="${window.esc(l.title || dateStr)}">${shortDate}</th>`;
      });
      html += '<th style="text-align:center;min-width:60px;">Сер.</th></tr></thead><tbody>';

      studentNames.forEach(stName => {
        html += `<tr><td style="position:sticky;left:0;background:var(--panel);z-index:1;white-space:nowrap;">${window.esc(stName)}</td>`;
        let sum = 0, count = 0;
        subLessons.forEach(l => {
          const sd = l.students && l.students[stName];
          if (!sd) { html += '<td style="text-align:center;">-</td>'; return; }

          const pShort = presenceShort(sd.presence);
          if (pShort && pShort !== "зп") {
            html += `<td style="text-align:center; color:var(--danger); font-size:12px;" title="${window.esc(stName)} - ${(l.date||'').split('T')[0]}">${pShort}</td>`;
          } else if (sd.grade) {
            const g = parseInt(sd.grade);
            sum += g; count++;
            html += `<td style="text-align:center; color:${gradeColor(g)}; font-weight:600;" title="${window.esc(stName)} - ${(l.date||'').split('T')[0]}">${g}</td>`;
          } else {
            html += `<td style="text-align:center;" title="${window.esc(stName)} - ${(l.date||'').split('T')[0]}">-</td>`;
          }
        });

        const avg = count > 0 ? (sum / count).toFixed(1) : "-";
        html += `<td style="text-align:center;font-weight:700;color:${count > 0 ? gradeColor(Math.round(sum / count)) : 'var(--muted)'};">${avg}</td>`;
        html += '</tr>';
      });

      html += '</tbody></table></div>';
    });

    out.innerHTML = html || '<p style="color:var(--muted)">Немає даних.</p>';
  }
}
