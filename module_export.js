// === ФАЙЛ: module_export.js (Повністю оновлено) ===

export function renderExportPage() {
  window.areaEl.innerHTML = `
    <h2>Експорт даних</h2>
    <p>Оберіть тип даних та налаштуйте фільтри перед експортом.</p>

    <div class="export-section">
      <div class="export-section-info">
        <h3>Журнал Уроків</h3>
        <p>Експорт відвідуваності та оцінок за уроки. Експорт в Excel створює окремі аркуші для кожного класу у "широкому" форматі (учні-рядки, дати-колонки).</p>
        
        <div class="export-filters">
          <div class="form-group">
            <label for="export-journal-class">Клас</label>
            <select id="export-journal-class" class="input"></select>
          </div>
          <div class="form-group">
            <label for="export-journal-subject">Предмет</label>
            <select id="export-journal-subject" class="input"></select>
          </div>
          <div class="form-group date-filter">
            <label for="export-journal-date-from">Дата з</label>
            <input type="date" id="export-journal-date-from" class="input">
          </div>
          <div class="form-group date-filter">
            <label for="export-journal-date-to">Дата по</label>
            <input type="date" id="export-journal-date-to" class="input">
          </div>
        </div>
        
        <div class="export-section-actions">
          <button class="btn" id="btn-export-journal-xlsx">Експорт в Excel (.xlsx)</button>
          <button class="btn" id="btn-export-journal-csv">Експорт в CSV (.csv)</button>
        </div>
      </div>
      </div>

    <div class="export-section">
      <div class="export-section-info">
        <h3>Зведені Звіти (Середні бали)</h3>
        <p>Середні бали учнів по класах/предметах.</p>
        <div class="export-filters">
          <div class="form-group">
            <label for="export-report-class">Клас</label>
            <select id="export-report-class" class="input"></select>
          </div>
          <div class="form-group">
            <label for="export-report-subject">Предмет</label>
            <select id="export-report-subject" class="input"></select>
          </div>
        </div>
        
        <div class="export-section-actions">
          <button class="btn" id="btn-export-report-xlsx">Експорт в Excel (.xlsx)</button>
        </div>
      </div>
      </div>

    <div class="export-section">
      <div class="export-section-info">
        <h3>Тести</h3>
        <p>Експорт обраного тесту у файл DOCX.</p>
        <div class="export-filters">
          <div class="form-group test-filter">
            <label for="export-test-select">Оберіть тест</label>
            <select id="export-test-select" class="input"></select>
          </div>
          
          <div class="form-group test-filter">
            <label for="export-test-mode">Тип версії</label>
            <select id="export-test-mode" class="input">
              <option value="student">Для учня (без відповідей)</option>
              <option value="teacher">Для вчителя (з відповідями)</option>
            </select>
          </div>
          
        </div>
        
        <div class="export-section-actions">
          <button class="btn" id="btn-export-test-docx">Експорт обраної версії</button>
        </div>
      </div>
      </div>
  `;
  
  populateExportFilters();
  bindExportLogic();
}

/**
 * Заповнює всі випадаючі списки на сторінці
 */
function populateExportFilters() {
  // Фільтри Журналу
  const jClass = window.$("#export-journal-class");
  const jSubj = window.$("#export-journal-subject");
  // Фільтри Звітів
  const rClass = window.$("#export-report-class");
  const rSubj = window.$("#export-report-subject");
  // Фільтри Тестів
  const tSel = window.$("#export-test-select");

  // Заповнення класів
  jClass.innerHTML = "<option value=''>-- Всі класи --</option>";
  rClass.innerHTML = "<option value=''>-- Всі класи --</option>";
  Object.keys(window.state.students).sort().forEach(className => {
    const opt = `<option value="${window.esc(className)}">${window.esc(className)}</option>`;
    jClass.innerHTML += opt;
    rClass.innerHTML += opt;
  });

  // Заповнення предметів
  jSubj.innerHTML = "<option value=''>-- Всі предмети --</option>";
  rSubj.innerHTML = "<option value=''>-- Всі предмети --</option>";
  window.state.subjects.sort().forEach(subjectName => {
    const opt = `<option value="${window.esc(subjectName)}">${window.esc(subjectName)}</option>`;
    jSubj.innerHTML += opt;
    rSubj.innerHTML += opt;
  });
  
  // Заповнення тестів
  tSel.innerHTML = "<option value=''>-- Оберіть тест --</option>";
  window.state.tests.forEach(test => {
    tSel.innerHTML += `<option value="${test.id}">${window.esc(test.title)} (${test.className || 'Загальний'})</option>`;
  });
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