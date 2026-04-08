// === ФАЙЛ: module_reports.js ===

export function renderReportPage() {
  window.areaEl.innerHTML = `
    <h2>Створення звіту</h2>
    
    <div class="config-box">
      <div class="form-group">
        <label for="report-type">Тип звіту</label>
        <select id="report-type" class="input">
          <option value="student">По учню</option>
          <option value="class">По класу</option>
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

  // Заповнення класів
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

  // Заповнення предметів
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
    if (typeSel.value === "student") {
      studentGroup.style.display = "block";
    } else {
      studentGroup.style.display = "none";
    }
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

    if (!cls) {
      out.innerHTML = `<p style="color: var(--danger)">Помилка: Не обрано клас.</p>`;
      return;
    }

    const reportData = generateReportHTML(type, cls, stu, sub);
    lastGeneratedHtml = reportData.html;
    lastGeneratedTitle = reportData.title;
    out.innerHTML = lastGeneratedHtml;
  };

  btnSave.onclick = async () => {
    if (!lastGeneratedHtml) {
      await window.showCustomAlert("Увага", "Спочатку сформуйте звіт.");
      return;
    }
    
    // Перевірка, чи існує масив збережених звітів
    if (!window.state.reports) window.state.reports = [];

    const newReport = {
      id: "rep_" + Date.now(),
      title: lastGeneratedTitle,
      type: window.$("#report-type").value,
      date: new Date().toISOString(),
      html: lastGeneratedHtml
    };

    window.state.reports.push(newReport);
    
    // Збереження у файл
    await window.tj.writeJSON(window.tj.getPaths().reportsPath, window.state.reports);
    
    await window.showCustomAlert("Успіх", "Звіт успішно збережено!");
    populateSavedReportsList();
  };
}

export function generateReportHTML(type, cls, stu, sub) {
  let html = "";
  let title = "";
  let lessonsCount = 0;
  let gradesSum = 0;
  let gradesCount = 0;
  let absenceCount = 0;

  // Фільтруємо уроки за класом і предметом (якщо обрано конкретний)
  let filteredLessons = window.state.lessons.filter(l => l.class === cls);
  if (sub !== "all") {
    filteredLessons = filteredLessons.filter(l => l.subject === sub);
  }

  // Сортуємо уроки за датою від найстарішого до найновішого
  filteredLessons.sort((a, b) => new Date(a.date) - new Date(b.date));

  if (type === "student") {
    title = `Звіт успішності: ${stu} (${cls} клас)`;
    html += `<h3 style="margin-top:0; color:var(--accent);">${window.esc(title)}</h3>`;
    html += `<p><strong>Предмет:</strong> ${sub === 'all' ? 'Всі предмети' : window.esc(sub)}</p>`;
    
    let tableRows = "";

    filteredLessons.forEach(l => {
      if (l.students && l.students[stu]) {
        lessonsCount++;
        const sData = l.students[stu];
        const dateObj = new Date(l.date);
        const dateStr = isNaN(dateObj) ? l.date : dateObj.toLocaleDateString("uk-UA");
        
        const presence = sData.presence ? "Так" : "<span style='color:var(--danger);font-weight:bold;'>Ні</span>";
        if (!sData.presence) absenceCount++;

        const work = sData.work ? "✓" : "-";
        const hw = sData.hw ? "✓" : "-";
        
        let gradeHtml = "-";
        if (sData.grade) {
          gradesSum += parseInt(sData.grade);
          gradesCount++;
          // Стилізація оцінки
          let gradeColor = "var(--text-primary)";
          if (sData.grade >= 10) gradeColor = "var(--grade-10)";
          else if (sData.grade >= 7) gradeColor = "var(--grade-7)";
          else if (sData.grade >= 4) gradeColor = "var(--grade-4)";
          else if (sData.grade > 0) gradeColor = "var(--danger)";
          gradeHtml = `<strong style="color:${gradeColor}">${sData.grade}</strong>`;
        }

        tableRows += `
          <tr>
            <td>${dateStr}</td>
            <td>${window.esc(l.subject)}</td>
            <td style="text-align:center;">${presence}</td>
            <td style="text-align:center;">${work}</td>
            <td style="text-align:center;">${hw}</td>
            <td style="text-align:center;">${gradeHtml}</td>
            <td><small>${window.esc(sData.note || "")}</small></td>
          </tr>
        `;
      }
    });

    // Блок статистики
    const avgGrade = gradesCount > 0 ? (gradesSum / gradesCount).toFixed(1) : "Немає";
    html += `
      <div style="display:flex; gap:15px; margin-bottom:15px; padding:10px; background:var(--panel); border-radius:6px; border:1px solid var(--border-color);">
        <div><strong>Середній бал:</strong> <span style="color:var(--accent); font-size:16px;">${avgGrade}</span></div>
        <div><strong>Всього оцінок:</strong> ${gradesCount}</div>
        <div><strong>Пропущених уроків:</strong> <span style="color:var(--danger);">${absenceCount}</span></div>
      </div>
    `;

    // Сама таблиця
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
              <th style="text-align:center;">Робота в класі</th>
              <th style="text-align:center;">Д/З</th>
              <th style="text-align:center;">Оцінка</th>
              <th>Примітка</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      `;
    }

  } else if (type === "class") {
    // ЗВІТ ПО КЛАСУ
    title = `Загальний звіт: ${cls} клас`;
    html += `<h3 style="margin-top:0; color:var(--accent);">${window.esc(title)}</h3>`;
    html += `<p><strong>Предмет:</strong> ${sub === 'all' ? 'Всі предмети' : window.esc(sub)}</p>`;
    html += `<p style="color: var(--muted); margin-bottom: 10px;">(Нижче наведено середні бали та кількість пропусків для кожного учня)</p>`;

    const studentsMap = {};
    (window.state.students[cls] || []).forEach(st => {
      studentsMap[st] = { gradesSum: 0, gradesCount: 0, absences: 0 };
    });

    filteredLessons.forEach(l => {
      if (!l.students) return;
      Object.entries(l.students).forEach(([stName, sData]) => {
        if (!studentsMap[stName]) return;
        if (!sData.presence) studentsMap[stName].absences++;
        if (sData.grade) {
          studentsMap[stName].gradesSum += parseInt(sData.grade);
          studentsMap[stName].gradesCount++;
        }
      });
    });

    let tableRows = "";
    Object.entries(studentsMap).forEach(([stName, data]) => {
      const avg = data.gradesCount > 0 ? (data.gradesSum / data.gradesCount).toFixed(1) : "-";
      tableRows += `
        <tr>
          <td>${window.esc(stName)}</td>
          <td style="text-align:center;"><strong>${avg}</strong></td>
          <td style="text-align:center;">${data.gradesCount}</td>
          <td style="text-align:center; color:var(--danger);">${data.absences}</td>
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
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      `;
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

  // Сортуємо від новіших до старіших
  const sortedReports = [...reports].sort((a, b) => new Date(b.date) - new Date(a.date));

  sortedReports.forEach(rep => {
    const tr = document.createElement("tr");
    const repType = rep.type === 'student' ? 'По учню' : 'По класу';
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
    
    window.$(".btn-open-report", tr).onclick = () => {
      openSavedReport(rep.id);
    };
    
    window.$(".btn-del-report", tr).onclick = async () => {
      const confirmed = await window.showCustomConfirm(
        "Видалення звіту",
        `Видалити збережений звіт "${window.esc(rep.title)}"?`,
        "Видалити", "Скасувати", true
      );
      if (confirmed) {
        window.state.reports = window.state.reports.filter(r => r.id !== rep.id);
        await window.tj.writeJSON(window.tj.getPaths().reportsPath, window.state.reports);
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
    // Прокрутка екрану до звіту
    out.scrollIntoView({ behavior: 'smooth' });
  }
}