// === ФАЙЛ: module_export.js (Повністю оновлено) ===

export function renderExportPage() {
  const lessonsCount = window.state.lessons.length;
  const classesCount = Object.keys(window.state.students).length;
  const testsCount = window.state.tests.length;

  window.areaEl.innerHTML = `
    <div class="export-page">
      <div class="export-page-header">
        <div>
          <h2 style="margin-bottom:4px;">Експорт даних</h2>
          <p style="color:var(--text-secondary); margin:0;">Оберіть формат та налаштуйте параметри перед експортом</p>
        </div>
        <div class="export-stats">
          <div class="export-stat-chip"><span class="export-stat-icon">📚</span><span>${lessonsCount} уроків</span></div>
          <div class="export-stat-chip"><span class="export-stat-icon">👥</span><span>${classesCount} класів</span></div>
          <div class="export-stat-chip"><span class="export-stat-icon">📝</span><span>${testsCount} тестів</span></div>
        </div>
      </div>

      <div class="export-card">
        <div class="export-card-header">
          <div class="export-card-icon export-card-icon--excel">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          </div>
          <div class="export-card-title">
            <h3>Журнал Уроків</h3>
            <p>Окремий аркуш для кожного класу — учні по рядках, дати по стовпцях</p>
          </div>
        </div>
        <div class="export-card-body">
          <div class="export-filters-grid">
            <div class="form-group">
              <label for="export-journal-class">Клас</label>
              <select id="export-journal-class" class="input"></select>
            </div>
            <div class="form-group">
              <label for="export-journal-subject">Предмет</label>
              <select id="export-journal-subject" class="input"></select>
            </div>
            <div class="form-group">
              <label for="export-journal-date-from">Дата з</label>
              <input type="date" id="export-journal-date-from" class="input">
            </div>
            <div class="form-group">
              <label for="export-journal-date-to">Дата по</label>
              <input type="date" id="export-journal-date-to" class="input">
            </div>
          </div>
        </div>
        <div class="export-card-footer">
          <button class="btn btn-export btn-export--xlsx" id="btn-export-journal-xlsx">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Excel (.xlsx)
          </button>
          <button class="btn btn-export btn-export--csv" id="btn-export-journal-csv">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            CSV (.csv)
          </button>
        </div>
      </div>

      <div class="export-card">
        <div class="export-card-header">
          <div class="export-card-icon export-card-icon--report">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
          </div>
          <div class="export-card-title">
            <h3>Зведені Звіти</h3>
            <p>Середні бали учнів по класах та предметах</p>
          </div>
        </div>
        <div class="export-card-body">
          <div class="export-filters-grid">
            <div class="form-group">
              <label for="export-report-class">Клас</label>
              <select id="export-report-class" class="input"></select>
            </div>
            <div class="form-group">
              <label for="export-report-subject">Предмет</label>
              <select id="export-report-subject" class="input"></select>
            </div>
          </div>
        </div>
        <div class="export-card-footer">
          <button class="btn btn-export btn-export--xlsx" id="btn-export-report-xlsx">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Excel (.xlsx)
          </button>
        </div>
      </div>

      <div class="export-card">
        <div class="export-card-header">
          <div class="export-card-icon export-card-icon--word">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          </div>
          <div class="export-card-title">
            <h3>Тести (Word)</h3>
            <p>Експорт обраного тесту у форматований документ DOCX</p>
          </div>
        </div>
        <div class="export-card-body">
          <div class="export-filters-grid">
            <div class="form-group" style="grid-column: 1 / -1;">
              <label for="export-test-select">Оберіть тест</label>
              <select id="export-test-select" class="input"></select>
            </div>
            <div class="form-group">
              <label for="export-test-mode">Тип версії</label>
              <select id="export-test-mode" class="input">
                <option value="student">Для учня (без відповідей)</option>
                <option value="teacher">Для вчителя (з відповідями)</option>
              </select>
            </div>
          </div>
        </div>
        <div class="export-card-footer">
          <button class="btn btn-export btn-export--docx" id="btn-export-test-docx">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Word (.docx)
          </button>
        </div>
      </div>

      <div class="export-card">
        <div class="export-card-header">
          <div class="export-card-icon export-card-icon--calendar">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
          <div class="export-card-title">
            <h3>Google Calendar</h3>
            <p>Експорт уроків та розкладу у формат ICS для імпорту в будь-який календар</p>
          </div>
        </div>
        <div class="export-card-body">
          <div class="export-filters-grid">
            <div class="form-group">
              <label for="export-cal-type">Тип даних</label>
              <select id="export-cal-type" class="input">
                <option value="lessons">Проведені уроки</option>
                <option value="schedule">Тижневий розклад</option>
              </select>
            </div>
            <div class="form-group">
              <label for="export-cal-class">Клас</label>
              <select id="export-cal-class" class="input"></select>
            </div>
            <div class="form-group" id="export-cal-weeks-group">
              <label for="export-cal-weeks">Тижнів вперед</label>
              <select id="export-cal-weeks" class="input">
                <option value="1">1 тиждень</option>
                <option value="2">2 тижні</option>
                <option value="4" selected>4 тижні</option>
                <option value="8">8 тижнів</option>
                <option value="16">16 тижнів</option>
              </select>
            </div>
          </div>
        </div>
        <div class="export-card-footer">
          <button class="btn btn-export btn-export--ics" id="btn-export-calendar-ics">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Календар (.ics)
          </button>
        </div>
      </div>
    </div>
  `;
  
  populateExportFilters();
  bindExportLogic();
  bindCalendarExport();
}

/**
 * Заповнює всі випадаючі списки на сторінці
 */
function populateExportFilters() {
  const jClass = window.$("#export-journal-class");
  const jSubj = window.$("#export-journal-subject");
  const rClass = window.$("#export-report-class");
  const rSubj = window.$("#export-report-subject");
  const tSel = window.$("#export-test-select");
  const calClass = window.$("#export-cal-class");

  const classSelects = [jClass, rClass, calClass].filter(Boolean);
  const subjSelects = [jSubj, rSubj].filter(Boolean);

  classSelects.forEach(sel => {
    sel.innerHTML = "<option value=''>-- Всі класи --</option>";
    Object.keys(window.state.students).sort().forEach(className => {
      sel.innerHTML += `<option value="${window.esc(className)}">${window.esc(className)}</option>`;
    });
  });

  subjSelects.forEach(sel => {
    sel.innerHTML = "<option value=''>-- Всі предмети --</option>";
    window.state.subjects.sort().forEach(subjectName => {
      sel.innerHTML += `<option value="${window.esc(subjectName)}">${window.esc(subjectName)}</option>`;
    });
  });

  if (tSel) {
    tSel.innerHTML = "<option value=''>-- Оберіть тест --</option>";
    window.state.tests.forEach(test => {
      tSel.innerHTML += `<option value="${test.id}">${window.esc(test.title)} (${test.className || 'Загальний'})</option>`;
    });
  }

  const calType = window.$("#export-cal-type");
  const weeksGroup = window.$("#export-cal-weeks-group");
  if (calType && weeksGroup) {
    calType.onchange = () => {
      weeksGroup.style.display = calType.value === 'schedule' ? '' : 'none';
    };
    weeksGroup.style.display = calType.value === 'schedule' ? '' : 'none';
  }
}

/**
 * Прив'язує логіку до кнопок експорту
 */
function bindExportLogic() {
  
  // --- 1. Журнал ---
  
  // === ОНОВЛЕНО: Логіка для XLSX (Зберегти Як) ===
  window.$("#btn-export-journal-xlsx").onclick = async () => {
    const filters = {
      class: window.$("#export-journal-class").value,
      subject: window.$("#export-journal-subject").value,
      dateFrom: window.$("#export-journal-date-from").value,
      dateTo: window.$("#export-journal-date-to").value
    };
    const sheetsData = generateJournalExportDataXLSX(filters);
    
    if (!sheetsData || Object.keys(sheetsData).length === 0) { 
      return await window.showCustomAlert("Помилка", "Немає даних уроків для експорту за цими фільтрами."); 
    }
    
    try {
      const { canceled, filePath } = await window.tj.showSaveDialog({
        defaultPath: `Journal_Export_${Date.now()}.xlsx`,
        filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
      });
      if (canceled || !filePath) return;

      await window.tj.writeXLSX(filePath, sheetsData);
      await window.showCustomAlert("Експорт успішний", `Файл збережено:\n${filePath}`);
    } catch (e) { await window.showCustomAlert("Помилка експорту", e.message); }
  };
  
  // === ОНОВЛЕНО: Логіка для CSV (Зберегти Як) ===
  window.$("#btn-export-journal-csv").onclick = async () => {
    const filters = {
      class: window.$("#export-journal-class").value,
      subject: window.$("#export-journal-subject").value,
      dateFrom: window.$("#export-journal-date-from").value,
      dateTo: window.$("#export-journal-date-to").value
    };
    const rows = getExportRowsJournal(filters);
    if (!rows.length) { return await window.showCustomAlert("Помилка", "Немає даних уроків для експорту за цими фільтрами."); }
    
    try {
      const { canceled, filePath } = await window.tj.showSaveDialog({
        defaultPath: `Journal_Export_${Date.now()}.csv`,
        filters: [{ name: 'CSV Files', extensions: ['csv'] }]
      });
      if (canceled || !filePath) return;

      const csv = [Object.keys(rows[0]).join(",")].concat(rows.map(r=>Object.values(r).map(v=>String(v).replaceAll('"','""')).map(v=>v.includes(",")?`"${v}"`:v).join(","))).join("\n");
      await window.tj.writeCSV(filePath, csv);
      await window.showCustomAlert("Експорт успішний", `Файл збережено:\n${filePath}`);
    } catch (e) { await window.showCustomAlert("Помилка експорту", e.message); }
  };
  
  // --- 2. Звіти ---
  // === ОНОВЛЕНО: Логіка для Звітів (Зберегти Як) ===
  window.$("#btn-export-report-xlsx").onclick = async () => {
    const filters = {
      class: window.$("#export-report-class").value,
      subject: window.$("#export-report-subject").value
    };
    const rows = getExportRowsReports(filters);
    if (!rows.length) { return await window.showCustomAlert("Помилка", "Немає даних для звітів за цими фільтрами."); }
    
    const sheetsData = { "Зведені звіти": rows };
    
    try {
      const { canceled, filePath } = await window.tj.showSaveDialog({
        defaultPath: `Reports_Average_${Date.now()}.xlsx`,
        filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
      });
      if (canceled || !filePath) return;

      await window.tj.writeXLSX(filePath, sheetsData);
      await window.showCustomAlert("Експорт успішний", `Файл збережено:\n${filePath}`);
    } catch (e) { await window.showCustomAlert("Помилка експорту", e.message); }
  };
  
  // --- 3. Тести ---
  // === ОНОВЛЕНО: Логіка для Тестів (Зберегти Як) ===
  window.$("#btn-export-test-docx").onclick = async () => {
    const testId = window.$("#export-test-select").value;
    const mode = window.$("#export-test-mode").value; 
    
    if (!testId) { return await window.showCustomAlert("Помилка", "Будь ласка, оберіть тест зі списку."); }
    
    const test = window.state.tests.find(t => t.id == testId);
    if (!test) { return await window.showCustomAlert("Помилка", "Тест не знайдено."); }
    
    try {
      const safeTitle = (test.title || "test").replace(/[^a-z0-9_-]/gi, '_');
      const prefix = (mode === 'teacher') ? '[ВЧИТЕЛЬ]' : '[УЧЕНЬ]';
      
      const { canceled, filePath } = await window.tj.showSaveDialog({
        defaultPath: `${prefix} ${safeTitle}_${Date.now()}.docx`,
        filters: [{ name: 'Word Documents', extensions: ['docx'] }]
      });
      if (canceled || !filePath) return;

      await window.tj.exportTestDocx(filePath, test, mode);
      await window.showCustomAlert("Експорт успішний", `Файл (${prefix}) збережено:\n${filePath}`);
      
    } catch (e) { await window.showCustomAlert("Помилка експорту", e.message); }
  };
}


// --- Допоміжні функції ---

/**
 * ОНОВЛЕНА ФУНКЦІЯ: Генерує дані для "широкого" експорту в Excel
 * Тепер включає Д/З, Роботу та Примітки для кожної дати.
 */
function generateJournalExportDataXLSX(filters = {}) {
  // 1. Фільтруємо уроки
  const lessons = window.state.lessons.filter(l => {
    if (filters.class && l.class !== filters.class) return false;
    if (filters.subject && l.subject !== filters.subject) return false;
    const lessonDate = (l.date || "").split('T')[0];
    if (filters.dateFrom && lessonDate < filters.dateFrom) return false;
    if (filters.dateTo && lessonDate > filters.dateTo) return false;
    if (!l.class || !l.students) return false;
    return true;
  });

  if (lessons.length === 0) return {};

  // 2. Групуємо уроки по класах
  const lessonsByClass = lessons.reduce((acc, lesson) => {
    if (!acc[lesson.class]) {
      acc[lesson.class] = [];
    }
    acc[lesson.class].push(lesson);
    return acc;
  }, {});

  const sheetsData = {};

  // 3. Обробляємо кожен клас (кожен аркуш)
  for (const [className, classLessons] of Object.entries(lessonsByClass)) {
    const students = window.state.students[className] || [];
    if (students.length === 0) continue;

    // 4. Створюємо мапу даних
    // Ключ: "Ім'я Учня_Дата", Значення: { grade, hw, work, presence, note }
    const gradeMap = new Map();
    const allDates = new Set();
    
    for (const lesson of classLessons) {
      const date = lesson.date.split('T')[0];
      allDates.add(date);
      for (const [studentName, sData] of Object.entries(lesson.students)) {
        const key = `${studentName}_${date}`;
        // Зберігаємо повний об'єкт даних
        const pres = sData.presence;
        const isAbsent = pres === false || pres === "absent" || pres === "sick" || pres === "excused";
        const presLabel = isAbsent ? (pres === "sick" ? "хв" : pres === "excused" ? "зв" : "Н") : (pres === "late" ? "зп" : "");
        const hwVal = sData.hwStatus !== undefined ? sData.hwStatus : (sData.hw ? "done" : "");
        const hwLabel = hwVal === "done" ? "✓" : hwVal === "partial" ? "◐" : hwVal === "not_done" ? "✗" : hwVal === "late" ? "пізно" : "";
        gradeMap.set(key, {
          grade: sData.grade || "",
          hw: hwLabel,
          work: sData.work ? "✓" : "",
          presence: presLabel,
          note: sData.note || ""
        });
      }
    }

    const sortedDates = [...allDates].sort();
    const sheetRows = [];

    // 5. Формуємо рядки для Excel
    for (const studentName of students) { 
      const row = {
        "Учень": studentName
      };
      
      for (const date of sortedDates) {
        const key = `${studentName}_${date}`;
        const data = gradeMap.get(key);
        
        // Створюємо 4 нові колонки для кожної дати
        row[`${date} (Оцінка)`] = data ? (data.presence || data.grade) : ""; // Показуємо 'Н' або оцінку
        row[`${date} (Д/З)`] = data ? data.hw : "";
        row[`${date} (Робота)`] = data ? data.work : "";
        row[`${date} (Прим.)`] = data ? data.note : "";
      }
      sheetRows.push(row);
    }
    
    sheetsData[className] = sheetRows.sort((a,b) => a["Учень"].localeCompare(b["Учень"]));
  }
  
  return sheetsData;
}

/**
 * Стара функція: Генерує "довгий" список (використовується для CSV)
 */
function getExportRowsJournal(filters = {}) {
  const rows = [];
  const lessons = window.state.lessons.filter(l => {
    if (filters.class && l.class !== filters.class) return false;
    if (filters.subject && l.subject !== filters.subject) return false;
    const lessonDate = (l.date || "").split('T')[0];
    if (filters.dateFrom && lessonDate < filters.dateFrom) return false;
    if (filters.dateTo && lessonDate > filters.dateTo) return false;
    return true;
  });
  
  lessons.forEach(l=> {
    if (!l.students) return;
    Object.entries(l.students).forEach(([studentName, s]) => {
      const pres2 = s.presence;
      const presText = (pres2 === true || pres2 === "present") ? "так"
        : pres2 === "sick" ? "хв" : pres2 === "excused" ? "зв" : pres2 === "late" ? "зп" : "ні";
      const hwVal2 = s.hwStatus !== undefined ? s.hwStatus : (s.hw ? "done" : "");
      const hwText = hwVal2 === "done" ? "так" : hwVal2 === "partial" ? "частково" : hwVal2 === "not_done" ? "ні" : hwVal2 === "late" ? "пізно" : "ні";
      rows.push({
        "Дата": (l.date||"").split('T')[0], 
        "Клас": l.class, 
        "Предмет": l.subject, 
        "Учень": studentName, 
        "Присутність": presText, 
        "Роб. на уроці": s.work?"так":"ні", 
        "Д/З": hwText, 
        "Оцінка": s.grade, 
        "Тип оцінки": s.gradeType || "current",
        "Примітка": s.note||""
      });
    });
  });
  return rows;
}

/**
 * Генерує дані для звітів (середні бали)
 */
function getExportRowsReports(filters = {}) {
  const studentAverages = {};
  
  const lessons = window.state.lessons.filter(l => {
    if (filters.class && l.class !== filters.class) return false;
    if (filters.subject && l.subject !== filters.subject) return false;
    return true;
  });
  
  lessons.forEach(l => {
    if (!l.class || !l.subject || !l.students) return;
    
    Object.entries(l.students).forEach(([studentName, sData]) => {
      const grade = parseInt(sData.grade, 10);
      if (grade > 0) {
        const key = `${l.class} - ${studentName} - ${l.subject}`;
        if (!studentAverages[key]) {
          studentAverages[key] = {
            "Клас": l.class,
            "Учень": studentName,
            "Предмет": l.subject,
            grades: [],
            "Середній бал": 0
          };
        }
        studentAverages[key].grades.push(grade);
      }
    });
  });
  
  const rows = Object.values(studentAverages);
  rows.forEach(row => {
    const sum = row.grades.reduce((a, b) => a + b, 0);
    row["Середній бал"] = (sum / row.grades.length).toFixed(2);
    delete row.grades; 
  });
  
  return rows;
}


// --- Google Calendar / ICS Export ---

function icsDateFormat(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}${m}${d}T${h}${min}00`;
}

function icsEscape(text) {
  return String(text || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function generateLessonsICS(classFilter) {
  const lessons = window.state.lessons.filter(l => {
    if (classFilter && l.class !== classFilter) return false;
    return l.date && l.class && l.subject;
  });

  if (lessons.length === 0) return null;

  let events = '';
  for (const lesson of lessons) {
    const dateStr = lesson.date.split('T')[0];
    const [y, m, d] = dateStr.split('-').map(Number);
    const start = new Date(y, m - 1, d, 8, 30);
    const end = new Date(y, m - 1, d, 9, 15);

    const studentCount = lesson.students ? Object.keys(lesson.students).length : 0;
    const desc = `Клас: ${lesson.class}\\nПредмет: ${lesson.subject}\\nУчнів: ${studentCount}`;

    events += `BEGIN:VEVENT\r\n`;
    events += `DTSTART:${icsDateFormat(start)}\r\n`;
    events += `DTEND:${icsDateFormat(end)}\r\n`;
    events += `SUMMARY:${icsEscape(lesson.subject)} — ${icsEscape(lesson.class)}\r\n`;
    events += `DESCRIPTION:${desc}\r\n`;
    events += `UID:tj-lesson-${lesson.id || dateStr}@teacherjournal\r\n`;
    events += `END:VEVENT\r\n`;
  }

  return wrapICS(events);
}

function generateScheduleICS(classFilter, weeksAhead) {
  const schedule = (window.state.schedule || []).filter(s => {
    if (classFilter && s.class !== classFilter) return false;
    return s.subject && s.class;
  });

  if (schedule.length === 0) return null;

  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);

  let events = '';
  for (let week = 0; week < weeksAhead; week++) {
    for (const item of schedule) {
      const eventDate = new Date(monday);
      eventDate.setDate(monday.getDate() + week * 7 + item.dayOfWeek);

      const [startH, startM] = (item.startTime || '08:30').split(':').map(Number);
      const [endH, endM] = (item.endTime || '09:15').split(':').map(Number);

      const start = new Date(eventDate);
      start.setHours(startH, startM, 0, 0);
      const end = new Date(eventDate);
      end.setHours(endH, endM, 0, 0);

      const roomStr = item.room ? `\\nКабінет: ${item.room}` : '';
      const desc = `Клас: ${item.class}\\nУрок №${item.lessonNumber}${roomStr}`;

      events += `BEGIN:VEVENT\r\n`;
      events += `DTSTART:${icsDateFormat(start)}\r\n`;
      events += `DTEND:${icsDateFormat(end)}\r\n`;
      events += `SUMMARY:${icsEscape(item.subject)} — ${icsEscape(item.class)}\r\n`;
      events += `DESCRIPTION:${desc}\r\n`;
      events += `LOCATION:${icsEscape(item.room || '')}\r\n`;
      events += `UID:tj-sched-${item.id}-w${week}@teacherjournal\r\n`;
      events += `END:VEVENT\r\n`;
    }
  }

  return wrapICS(events);
}

function wrapICS(events) {
  return `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//TeacherJournal//Export//UK\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\nX-WR-CALNAME:Електронний журнал\r\nX-WR-TIMEZONE:Europe/Kyiv\r\n${events}END:VCALENDAR`;
}

function bindCalendarExport() {
  window.$("#btn-export-calendar-ics").onclick = async () => {
    const calType = window.$("#export-cal-type").value;
    const classFilter = window.$("#export-cal-class").value;

    let icsContent;
    if (calType === 'lessons') {
      icsContent = generateLessonsICS(classFilter);
    } else {
      const weeks = parseInt(window.$("#export-cal-weeks").value) || 4;
      icsContent = generateScheduleICS(classFilter, weeks);
    }

    if (!icsContent) {
      return await window.showCustomAlert("Помилка", "Немає даних для експорту в календар.");
    }

    try {
      const prefix = calType === 'lessons' ? 'Lessons' : 'Schedule';
      const { canceled, filePath } = await window.tj.showSaveDialog({
        defaultPath: `TeacherJournal_${prefix}_${Date.now()}.ics`,
        filters: [{ name: 'iCalendar Files', extensions: ['ics'] }]
      });
      if (canceled || !filePath) return;

      await window.tj.writeCSV(filePath, icsContent);
      await window.showCustomAlert("Експорт успішний", `Файл календаря збережено:\n${filePath}\n\nВідкрийте цей файл або імпортуйте його у Google Calendar, Outlook або Apple Calendar.`);
    } catch (e) {
      await window.showCustomAlert("Помилка експорту", e.message);
    }
  };
}