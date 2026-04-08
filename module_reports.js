// === ФАЙЛ: module_reports.js ===

function presenceLabel(val) {
  if (val === true || val === "present") return "✓";
  if (val === false || val === "absent") return "<span style='color:var(--danger);font-weight:bold;'>н/б</span>";
  if (val === "sick") return "<span style='color:var(--grade-4);font-weight:bold;'>хв</span>";
  if (val === "excused") return "<span style='color:var(--muted);font-weight:bold;'>зв</span>";
  if (val === "late") return "<span style='color:var(--grade-4);'>зп</span>";
  return "✓";
}

function isAbsent(val) {
  return val === false || val === "absent" || val === "sick" || val === "excused";
}

function hwLabel(val) {
  if (val === true || val === "done") return "✓";
  if (val === "partial") return "◐";
  if (val === "not_done") return "<span style='color:var(--danger);'>✗</span>";
  if (val === "late") return "<span style='color:var(--grade-4);'>пізно</span>";
  return "-";
}

function gradeTypeLabel(val) {
  const map = { current: "Пот.", thematic: "Тем.", semester: "Сем.", annual: "Річ." };
  return map[val] || "Пот.";
}

function filterBySemester(lessons, semIdx) {
  if (semIdx === "" || semIdx === undefined) return lessons;
  const sem = (window.state.settings.semesters || [])[parseInt(semIdx)];
  if (!sem) return lessons;
  return lessons.filter(l => {
    const ld = (l.date || "").split("T")[0];
    return ld >= sem.startDate && ld <= sem.endDate;
  });
}

export function renderReportPage() {
  const semesters = window.state.settings.semesters || [];
  window.areaEl.innerHTML = `
    <h2>Створення звіту</h2>
    
    <div class="config-box">
      <div class="form-group">
        <label for="report-type">Тип звіту</label>
        <select id="report-type" class="input">
          <option value="student">По учню</option>
          <option value="class">По класу</option>
          <option value="summary">Зведений (підсумки)</option>
        </select>
      </div>
      <div class="form-group">
        <label for="report-class">Клас</label>
        <select id="report-class" class="input"></select>
      </div>
      <div class="form-group" id="report-student-group">
        <label for="report-student">Учень</label>
        <select id="report-student" class="input"></select>
      </div>
      <div class="form-group">
        <label for="report-subject">Предмет</label>
        <select id="report-subject" class="input">
          <option value="all">Всі предмети</option>
        </select>
      </div>
      <div class="form-group">
        <label for="report-semester">Семестр</label>
        <select id="report-semester" class="input">
          <option value="">Весь рік</option>
          ${semesters.map((s, i) => `<option value="${i}">${window.esc(s.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label for="report-grade-type">Тип оцінок</label>
        <select id="report-grade-type" class="input">
          <option value="all">Всі типи</option>
          <option value="current">Поточні</option>
          <option value="thematic">Тематичні</option>
          <option value="semester">Семестрові</option>
          <option value="annual">Річні</option>
        </select>
      </div>
      
      <div class="form-buttons-group">
        <button id="report-generate-btn" class="btn">Сформувати</button>
        <button id="report-save-btn" class="btn">Зберегти</button>
      </div>
    </div>
    
    <div class="output-box" id="report-output">
      <p style="color: var(--muted)">Оберіть параметри та натисніть "Сформувати"</p>
    </div>

    <div class="output-box" id="saved-reports-output" style="margin-top: 20px;">
      <h3>Збережені звіти</h3>
      <table class="table" id="saved-reports-table">
        <thead>
          <tr>
            <th>Дата</th>
            <th>Назва звіту</th>
            <th>Тип</th>
            <th style="width: 200px;">Дії</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>
  `;

  populateReportPageFilters();
  bindReportPageLogic();
  populateSavedReportsList();
}

export function populateReportPageFilters() {
  const typeSel = window.$("#report-type");
  const classSel = window.$("#report-class");
  const studentSel = window.$("#report-student");
  const studentGroup = window.$("#report-student-group");
  const subjectSel = window.$("#report-subject");

  classSel.innerHTML = "";
  const classes = Object.keys(window.state.students || {});
  if (classes.length === 0) {
    classSel.innerHTML = `<option value="">Немає класів</option>`;
  } else {
    classes.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c; opt.textContent = c;
      classSel.appendChild(opt);
    });
  }

  subjectSel.innerHTML = `<option value="all">Всі предмети</option>`;
  (window.state.subjects || []).forEach(sub => {
    const opt = document.createElement("option");
    opt.value = sub; opt.textContent = sub;
    subjectSel.appendChild(opt);
  });

  const updateStudents = () => {
    studentSel.innerHTML = "";
    const selectedClass = classSel.value;
    if (!selectedClass || !window.state.students[selectedClass]) return;
    window.state.students[selectedClass].forEach(st => {
      const opt = document.createElement("option");
      opt.value = st; opt.textContent = st;
      studentSel.appendChild(opt);
    });
  };

  classSel.onchange = updateStudents;
  updateStudents();

  typeSel.onchange = () => {
    studentGroup.style.display = typeSel.value === "student" ? "block" : "none";
  };
  typeSel.onchange();
}

export function bindReportPageLogic() {
  const btnGen = window.$("#report-generate-btn");
  const btnSave = window.$("#report-save-btn");
  const out = window.$("#report-output");

  let lastGeneratedHtml = "";
  let lastGeneratedTitle = "";

  btnGen.onclick = () => {
    const type = window.$("#report-type").value;
    const cls = window.$("#report-class").value;
    const stu = window.$("#report-student").value;
    const sub = window.$("#report-subject").value;
    const semIdx = window.$("#report-semester").value;
    const gradeType = window.$("#report-grade-type").value;

    if (!cls) {
      out.innerHTML = `<p style="color: var(--danger)">Помилка: Не обрано клас.</p>`;
      return;
    }

    const reportData = generateReportHTML(type, cls, stu, sub, semIdx, gradeType);
    lastGeneratedHtml = reportData.html;
    lastGeneratedTitle = reportData.title;
    out.innerHTML = lastGeneratedHtml;
  };

  btnSave.onclick = async () => {
    if (!lastGeneratedHtml) {
      await window.showCustomAlert("Увага", "Спочатку сформуйте звіт.");
      return;
    }
    if (!window.state.reports) window.state.reports = [];

    const newReport = {
      id: "rep_" + Date.now(),
      title: lastGeneratedTitle,
      type: window.$("#report-type").value,
      date: new Date().toISOString(),
      html: lastGeneratedHtml
    };

    window.state.reports.push(newReport);
    await window.tj.writeJSON(window.paths.reportsPath, window.state.reports);
    await window.showCustomAlert("Успіх", "Звіт успішно збережено!");
    populateSavedReportsList();
  };
}

export function generateReportHTML(type, cls, stu, sub, semIdx = "", gradeType = "all") {
  let html = "";
  let title = "";

  let filteredLessons = window.state.lessons.filter(l => l.class === cls);
  if (sub !== "all") filteredLessons = filteredLessons.filter(l => l.subject === sub);
  filteredLessons = filterBySemester(filteredLessons, semIdx);
  filteredLessons.sort((a, b) => new Date(a.date) - new Date(b.date));

  const semLabel = semIdx !== "" ? (window.state.settings.semesters || [])[parseInt(semIdx)]?.name || "" : "Весь рік";

  if (type === "student") {
    title = `Звіт успішності: ${stu} (${cls} клас)`;
    html += `<h3 style="margin-top:0; color:var(--accent);">${window.esc(title)}</h3>`;
    html += `<p><strong>Предмет:</strong> ${sub === 'all' ? 'Всі предмети' : window.esc(sub)} | <strong>Період:</strong> ${window.esc(semLabel)}</p>`;

    let lessonsCount = 0, gradesSum = 0, gradesCount = 0;
    let absences = { absent: 0, sick: 0, excused: 0, late: 0 };
    let tableRows = "";

    filteredLessons.forEach(l => {
      if (l.students && l.students[stu]) {
        lessonsCount++;
        const sData = l.students[stu];
        const dateObj = new Date(l.date);
        const dateStr = isNaN(dateObj) ? l.date : dateObj.toLocaleDateString("uk-UA");
        const presHtml = presenceLabel(sData.presence);
        if (sData.presence === "absent" || sData.presence === false) absences.absent++;
        else if (sData.presence === "sick") absences.sick++;
        else if (sData.presence === "excused") absences.excused++;
        else if (sData.presence === "late") absences.late++;

        const workHtml = sData.work ? "✓" : "-";
        const hwHtml = hwLabel(sData.hwStatus !== undefined ? sData.hwStatus : (sData.hw ? "done" : ""));

        let gradeHtml = "-";
        const sGradeType = sData.gradeType || "current";
        const showGrade = gradeType === "all" || sGradeType === gradeType;
        if (sData.grade && showGrade) {
          gradesSum += parseInt(sData.grade);
          gradesCount++;
          let gradeColor = "var(--text-primary)";
          if (sData.grade >= 10) gradeColor = "var(--grade-10)";
          else if (sData.grade >= 7) gradeColor = "var(--grade-7)";
          else if (sData.grade >= 4) gradeColor = "var(--grade-4)";
          else if (sData.grade > 0) gradeColor = "var(--danger)";
          gradeHtml = `<strong style="color:${gradeColor}">${sData.grade}</strong> <small style="color:var(--muted)">(${gradeTypeLabel(sGradeType)})</small>`;
        } else if (sData.grade && !showGrade) {
          gradeHtml = `<span style="color:var(--muted)">${sData.grade}</span>`;
        }

        tableRows += `
          <tr>
            <td>${dateStr}</td>
            <td>${window.esc(l.subject)}</td>
            <td style="text-align:center;">${presHtml}</td>
            <td style="text-align:center;">${workHtml}</td>
            <td style="text-align:center;">${hwHtml}</td>
            <td style="text-align:center;">${gradeHtml}</td>
            <td><small>${window.esc(sData.note || "")}</small></td>
          </tr>
        `;
      }
    });

    const avgGrade = gradesCount > 0 ? (gradesSum / gradesCount).toFixed(1) : "Немає";
    const totalAbsences = absences.absent + absences.sick + absences.excused;

    html += `
      <div style="display:flex; gap:15px; margin-bottom:15px; padding:10px; background:var(--panel); border-radius:6px; border:1px solid var(--border-color); flex-wrap: wrap;">
        <div><strong>Середній бал:</strong> <span style="color:var(--accent); font-size:16px;">${avgGrade}</span></div>
        <div><strong>Оцінок:</strong> ${gradesCount}</div>
        <div><strong>Пропусків:</strong> <span style="color:var(--danger);">${totalAbsences}</span>
          <small style="color:var(--muted);"> (н/б: ${absences.absent}, хв: ${absences.sick}, зв: ${absences.excused}, зп: ${absences.late})</small>
        </div>
      </div>
    `;

    if (tableRows === "") {
      html += `<p style="color: var(--muted)">Немає даних за обраними параметрами.</p>`;
    } else {
      html += `
        <table class="table">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Предмет</th>
              <th style="text-align:center;">Присутність</th>
              <th style="text-align:center;">Робота</th>
              <th style="text-align:center;">Д/З</th>
              <th style="text-align:center;">Оцінка</th>
              <th>Примітка</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      `;
    }

  } else if (type === "class") {
    title = `Загальний звіт: ${cls} клас`;
    html += `<h3 style="margin-top:0; color:var(--accent);">${window.esc(title)}</h3>`;
    html += `<p><strong>Предмет:</strong> ${sub === 'all' ? 'Всі предмети' : window.esc(sub)} | <strong>Період:</strong> ${window.esc(semLabel)}</p>`;

    const studentsMap = {};
    (window.state.students[cls] || []).forEach(st => {
      studentsMap[st] = { gradesSum: 0, gradesCount: 0, absences: 0, sick: 0, excused: 0, late: 0, hwDone: 0, hwTotal: 0 };
    });

    filteredLessons.forEach(l => {
      if (!l.students) return;
      Object.entries(l.students).forEach(([stName, sData]) => {
        if (!studentsMap[stName]) return;
        if (isAbsent(sData.presence)) {
          studentsMap[stName].absences++;
          if (sData.presence === "sick") studentsMap[stName].sick++;
          if (sData.presence === "excused") studentsMap[stName].excused++;
        }
        if (sData.presence === "late") studentsMap[stName].late++;

        const sGradeType = sData.gradeType || "current";
        const showGrade = gradeType === "all" || sGradeType === gradeType;
        if (sData.grade && showGrade) {
          studentsMap[stName].gradesSum += parseInt(sData.grade);
          studentsMap[stName].gradesCount++;
        }
        const hw = sData.hwStatus !== undefined ? sData.hwStatus : (sData.hw ? "done" : "");
        if (hw) { studentsMap[stName].hwTotal++; if (hw === "done") studentsMap[stName].hwDone++; }
      });
    });

    let tableRows = "";
    Object.entries(studentsMap).forEach(([stName, data]) => {
      const avg = data.gradesCount > 0 ? (data.gradesSum / data.gradesCount).toFixed(1) : "-";
      const hwPct = data.hwTotal > 0 ? Math.round(data.hwDone / data.hwTotal * 100) + "%" : "-";
      tableRows += `
        <tr>
          <td>${window.esc(stName)}</td>
          <td style="text-align:center;"><strong>${avg}</strong></td>
          <td style="text-align:center;">${data.gradesCount}</td>
          <td style="text-align:center; color:var(--danger);">${data.absences} <small style="color:var(--muted);">(хв:${data.sick} зв:${data.excused})</small></td>
          <td style="text-align:center;">${data.late}</td>
          <td style="text-align:center;">${hwPct}</td>
        </tr>
      `;
    });

    if (tableRows === "") {
      html += `<p style="color: var(--muted)">Немає даних за обраними параметрами.</p>`;
    } else {
      html += `
        <table class="table">
          <thead>
            <tr>
              <th>Учень</th>
              <th style="text-align:center;">Середній бал</th>
              <th style="text-align:center;">К-ть оцінок</th>
              <th style="text-align:center;">Пропуски</th>
              <th style="text-align:center;">Запізнення</th>
              <th style="text-align:center;">Д/З виконання</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      `;
    }

  } else if (type === "summary") {
    title = `Зведений звіт: ${cls} клас`;
    html += `<h3 style="margin-top:0; color:var(--accent);">${window.esc(title)}</h3>`;
    html += `<p><strong>Період:</strong> ${window.esc(semLabel)}</p>`;

    const subjects = [...new Set(filteredLessons.map(l => l.subject))].sort();
    const studentNames = (window.state.students[cls] || []);

    if (!subjects.length || !studentNames.length) {
      html += `<p style="color: var(--muted)">Немає даних.</p>`;
    } else {
      html += `<div style="overflow-x: auto;">`;
      html += `<table class="table"><thead><tr><th>Учень</th>`;
      subjects.forEach(sub2 => { html += `<th style="text-align:center;">${window.esc(sub2)}</th>`; });
      html += `<th style="text-align:center;"><strong>Загальний</strong></th></tr></thead><tbody>`;

      studentNames.forEach(stName => {
        html += `<tr><td>${window.esc(stName)}</td>`;
        let totalSum = 0, totalCount = 0;
        subjects.forEach(sub2 => {
          const subLessons = filteredLessons.filter(l => l.subject === sub2);
          let sum = 0, count = 0;
          subLessons.forEach(l => {
            const sd = l.students && l.students[stName];
            if (sd && sd.grade) {
              const gt = sd.gradeType || "current";
              if (gradeType === "all" || gt === gradeType) {
                sum += parseInt(sd.grade); count++;
              }
            }
          });
          const avg = count > 0 ? (sum / count).toFixed(1) : "-";
          totalSum += sum; totalCount += count;
          let color = "var(--text-primary)";
          const avgNum = parseFloat(avg);
          if (avgNum >= 10) color = "var(--grade-10)";
          else if (avgNum >= 7) color = "var(--grade-7)";
          else if (avgNum >= 4) color = "var(--grade-4)";
          else if (avgNum >= 1) color = "var(--danger)";
          html += `<td style="text-align:center; color:${color};"><strong>${avg}</strong></td>`;
        });
        const totalAvg = totalCount > 0 ? (totalSum / totalCount).toFixed(1) : "-";
        html += `<td style="text-align:center;"><strong>${totalAvg}</strong></td></tr>`;
      });

      html += `</tbody></table></div>`;
    }
  }

  return { html, title };
}

export function populateSavedReportsList() {
  const tbody = window.$("#saved-reports-table tbody");
  if (!tbody) return;

  tbody.innerHTML = "";
  const reports = window.state.reports || [];

  if (reports.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--muted)">Збережених звітів немає</td></tr>`;
    return;
  }

  const sortedReports = [...reports].sort((a, b) => new Date(b.date) - new Date(a.date));

  sortedReports.forEach(rep => {
    const tr = document.createElement("tr");
    const typeLabels = { student: 'По учню', class: 'По класу', summary: 'Зведений' };
    const repType = typeLabels[rep.type] || rep.type;
    const repDate = new Date(rep.date).toLocaleString("uk-UA", {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute:'2-digit'
    });

    tr.innerHTML = `
      <td>${repDate}</td>
      <td><strong>${window.esc(rep.title)}</strong></td>
      <td>${repType}</td>
      <td>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-open-report" data-id="${rep.id}">Відкрити</button>
          <button class="btn danger btn-del-report" data-id="${rep.id}">Видалити</button>
        </div>
      </td>
    `;

    window.$(".btn-open-report", tr).onclick = () => openSavedReport(rep.id);

    window.$(".btn-del-report", tr).onclick = async () => {
      const confirmed = await window.showCustomConfirm(
        "Видалення звіту",
        `Видалити збережений звіт "${window.esc(rep.title)}"?`,
        "Видалити", "Скасувати", true
      );
      if (confirmed) {
        window.state.reports = window.state.reports.filter(r => r.id !== rep.id);
        await window.tj.writeJSON(window.paths.reportsPath, window.state.reports);
        populateSavedReportsList();
      }
    };

    tbody.appendChild(tr);
  });
}

function openSavedReport(reportId) {
  const report = (window.state.reports || []).find(r => r.id === reportId);
  if (!report) return;

  const out = window.$("#report-output");
  if (out) {
    out.innerHTML = `
      <div style="margin-bottom: 10px; padding: 10px; background: var(--panel-dark); border-radius: 6px;">
        <span style="color: var(--muted); font-size: 13px;">📅 Це збережена копія звіту від ${new Date(report.date).toLocaleString("uk-UA")}</span>
      </div>
      ${window.sanitizeHTML(report.html)}
    `;
    out.scrollIntoView({ behavior: 'smooth' });
  }
}
