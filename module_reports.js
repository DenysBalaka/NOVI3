export function renderReportPage(){
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
        <select id="report-subject" class="input"></select>
      </div>
      
      <div class="form-buttons-group">
        <button id="report-generate-btn" class="btn">Сформувати</button>
        <button id="report-save-btn" class="btn">Зберегти</button>
      </div>
    </div>
    
    <div class="output-box" id="report-output">
      <p style="color: var(--muted)">Оберіть параметри та натисніть "Сформувати".</p>
    </div>
    
    <div class="output-box">
      <h3>Збережені звіти</h3>
      <table class="table" id="reports-table">
        <thead><tr><th>Дата</th><th>Назва</th><th>Тип</th><th style="width: 220px;">Дії</th></tr></thead>
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
  const studentGr = window.$("#report-student-group");
  const subjectSel = window.$("#report-subject");

  classSel.innerHTML = "<option value=''>-- Всі класи --</option>";
  Object.keys(window.state.students).sort().forEach(className => {
    classSel.innerHTML += `<option value="${window.esc(className)}">${window.esc(className)}</option>`;
  });
  
  subjectSel.innerHTML = "<option value=''>-- Всі предмети --</option>";
  window.state.subjects.sort().forEach(subjectName => {
    subjectSel.innerHTML += `<option value="${window.esc(subjectName)}">${window.esc(subjectName)}</option>`;
  });
  
  const updateStudentList = () => {
    const className = classSel.value;
    studentSel.innerHTML = "<option value=''>-- Всі учні --</option>";
    if (className && window.state.students[className]) {
      window.state.students[className].sort().forEach(studentName => {
        studentSel.innerHTML += `<option value="${window.esc(studentName)}">${window.esc(studentName)}</option>`;
      });
    }
  };
  
  const toggleStudentSelect = () => {
    studentGr.style.display = (typeSel.value === 'student') ? 'flex' : 'none';
  };

  classSel.onchange = updateStudentList;
  typeSel.onchange = toggleStudentSelect;
  
  updateStudentList();
  toggleStudentSelect();
}

export function bindReportPageLogic() {
  const btnGen = window.$("#report-generate-btn");
  const btnSave = window.$("#report-save-btn");
  const outputEl = window.$("#report-output");
  
  let currentReportData = null; // Зберігаємо дані для збереження

  btnGen.onclick = () => {
    const filters = {
      type: window.$("#report-type").value,
      className: window.$("#report-class").value,
      studentName: window.$("#report-student").value,
      subjectName: window.$("#report-subject").value
    };
    
    const { html, data } = generateReportHTML(filters);
    outputEl.innerHTML = html;
    currentReportData = data; // Зберігаємо дані
  };
  
  btnSave.onclick = async () => {
    if (!currentReportData) {
      await window.showCustomAlert("Помилка", "Спочатку потрібно сформувати звіт.");
      return;
    }
    
    const newReport = {
      id: "rep_" + Date.now(),
      date: new Date().toISOString(),
      ...currentReportData 
    };
    
    window.state.reports.push(newReport);
    window.saveReports(); 
    populateSavedReportsList(); 
    await window.showCustomAlert("Успіх", `Звіт "${newReport.title}" збережено.`);
  };
}

export function generateReportHTML(filters) {
  const { type, className, studentName, subjectName } = filters;
  
  let title = "";
  let reportDate = new Date().toLocaleString("uk-UA");
  let html = `<div class="report-header">
                <h3>Звіт (Попередній перегляд)</h3>
                <p>Дата формування: ${reportDate}</p>
              </div>`;
  
  const filteredLessons = window.state.lessons.filter(l => {
    if (className && l.class !== className) return false;
    if (subjectName && l.subject !== subjectName) return false;
    return true;
  });

  if (type === 'student') {
    if (!studentName) return { html: "<p style='color: #e74c3c'>Для звіту по учню необхідно обрати клас та учня.</p>", data: null };
    
    title = `Звіт по учню: ${studentName}`;
    html += `<h4>${title}</h4>`;
    if (subjectName) html += `<p><b>Предмет:</b> ${subjectName}</p>`;
    
    let gradeSum = 0, gradeCount = 0;
    const notes = [];
    
    filteredLessons.forEach(l => {
      const sData = l.students[studentName];
      if (!sData) return;
      
      const grade = parseInt(sData.grade, 10);
      if (grade > 0) { gradeSum += grade; gradeCount++; }
      if (sData.note) { notes.push(`<b>${l.date.split('T')[0]} (${l.subject}):</b> ${window.esc(sData.note)}`); }
    });
    
    if (notes.length > 0) {
      html += `<h5>Нотатки по уроках:</h5><ul class="report-list"><li>${notes.join('</li><li>')}</li></ul>`;
    } else {
      html += `<p><i>(Нотаток по уроках не знайдено)</i></p>`;
    }
    
    if (gradeCount > 0) {
      const avg = (gradeSum / gradeCount).toFixed(2);
      html += `<p style="margin-top: 8px;"><b>Середній бал: ${avg}</b> (на основі ${gradeCount} оцінок)</p>`;
    }
  } else { // type === 'class'
    if (!className) return { html: "<p style='color: #e74c3c'>Для звіту по класу необхідно обрати клас.</p>", data: null };
    
    title = `Звіт по класу: ${className}`;
    html += `<h4>${title}</h4>`;
    if (subjectName) html += `<p><b>Предмет:</b> ${subjectName}</p>`;
    
    const studentsInClass = (window.state.students[className] || []).sort();
    const studentAverages = {}; 
    html += `<table class="report-table"><thead><tr><th>Учень</th><th>Середній бал</th><th>Нотатки по уроках</th></tr></thead><tbody>`;
    
    studentsInClass.forEach(stud => {
      studentAverages[stud] = { sum: 0, n: 0, notes: [] };
      filteredLessons.forEach(l => {
        const sData = l.students[stud]; if (!sData) return;
        const grade = parseInt(sData.grade, 10);
        if (grade > 0) { studentAverages[stud].sum += grade; studentAverages[stud].n++; }
        if (sData.note) { studentAverages[stud].notes.push(`<b>${l.date.split('T')[0]}:</b> ${window.esc(sData.note)}`); }
      });
      const avg = studentAverages[stud].n > 0 ? (studentAverages[stud].sum / studentAverages[stud].n).toFixed(2) : '–';
      const notesHtml = studentAverages[stud].notes.length > 0 ? `<ul class="report-list small"><li>${studentAverages[stud].notes.join('</li><li>')}</li></ul>` : '–';
      html += `<tr><td>${window.esc(stud)}</td><td>${avg}</td><td>${notesHtml}</td></tr>`;
    });
    
    html += `</tbody></table>`;
  }
  
  // Повертаємо і HTML, і дані для збереження
  return { html, data: { title, type, className, studentName, subjectName, generatedHtml: html } };
}

export function populateSavedReportsList() {
  const tbody = window.$("#reports-table tbody");
  if (!tbody) return; 
  
  tbody.innerHTML = "";
  
  if (window.state.reports.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="color: var(--muted); text-align: center;">Збережених звітів немає.</td></tr>`;
    return;
  }
  
  // Сортуємо від новіших до старіших
  const sortedReports = [...window.state.reports].sort((a, b) => b.date.localeCompare(a.date));
  
  sortedReports.forEach(rep => {
    const tr = document.createElement("tr");
    const repType = rep.type === 'student' ? 'По учню' : 'По класу';
    const repDate = new Date(rep.date).toLocaleString("uk-UA");
    
    tr.innerHTML = `
      <td>${repDate}</td>
      <td>${window.esc(rep.title)}</td>
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
        `Видалити звіт "${window.esc(rep.title)}"?`,
        "Видалити", "Скасувати", true
      );
      if (confirmed) {
        window.state.reports = window.state.reports.filter(r => r.id !== rep.id);
        window.saveReports();
        populateSavedReportsList();
      }
    };
    
    tbody.appendChild(tr);
  });
}

function openSavedReport(reportId) {
  const report = window.state.reports.find(r => r.id === reportId);
  if (!report) return;
  
  const tabId = "report-" + report.id;
  const tabTitle = `Звіт: ${report.title.substring(0, 20)}...`;
  
  window.openTab(tabId, tabTitle, () => {
    window.areaEl.innerHTML = `
      <div class="output-box" style="margin-top: 0;">
        ${report.generatedHtml}
      </div>
    `;
  });
}