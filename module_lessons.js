// === ФАЙЛ: module_lessons.js ===
import { createNewBoard } from './board_app/module_board.js';

const PRESENCE_OPTIONS = [
  { value: "present", label: "✓", title: "Присутній" },
  { value: "absent", label: "н/б", title: "Не був" },
  { value: "sick", label: "хв", title: "Хворів" },
  { value: "excused", label: "зв", title: "Звільнений" },
  { value: "late", label: "зп", title: "Запізнився" }
];

const GRADE_TYPES = [
  { value: "current", label: "Поточна" },
  { value: "thematic", label: "Тематична" },
  { value: "semester", label: "Семестрова" },
  { value: "annual", label: "Річна" }
];

const HW_STATUSES = [
  { value: "", label: "–" },
  { value: "done", label: "✓" },
  { value: "partial", label: "◐" },
  { value: "not_done", label: "✗" },
  { value: "late", label: "пізно" }
];

function normalizeStudentName(entry) {
  if (typeof entry === "string") return entry.trim();
  if (entry && typeof entry === "object") {
    if (entry.fullName != null) return String(entry.fullName).trim();
    if (entry.name != null) return String(entry.name).trim();
  }
  return "";
}

function migrateStudentData(s) {
  if (typeof s.presence === "boolean") {
    s.presence = s.presence ? "present" : "absent";
  }
  if (!s.presence) s.presence = "present";
  if (typeof s.hw === "boolean") {
    s.hwStatus = s.hw ? "done" : "";
    delete s.hw;
  }
  if (s.hwStatus === undefined) s.hwStatus = "";
  if (!s.gradeType) s.gradeType = "current";
  return s;
}

export function openOrCreateLesson(dateKey) {
  let les = window.state.lessons.find(l => l.date && l.date.startsWith(dateKey));
  if (!les) {
    window.openTab("new-lesson-" + dateKey, `Створити урок ${dateKey}`, () => window.renderNewLessonDialog(dateKey));
  } else {
    window.openTab("lesson-"+les.id, `Урок ${les.date.split('T')[0]}`, ()=> window.renderLesson(les.id));
  }
}

export function renderNewLessonDialog(dateKey, contextData = {}) {
  window.areaEl.innerHTML = `
    <h3>Створення нового уроку на ${dateKey}</h3>
    <div class="form-group" style="display: flex; flex-direction: column; gap: 10px; max-width: 400px;">
      <label for="new-lesson-class">Оберіть клас:</label>
      <select id="new-lesson-class" class="input"></select>
      <label for="new-lesson-subject">Оберіть предмет:</label>
      <select id="new-lesson-subject" class="input"></select>
      <button id="create-lesson-btn" class="btn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Створити урок</button>
    </div>
  `;
  const classSelect = window.$("#new-lesson-class");
  const subjectSelect = window.$("#new-lesson-subject");
  classSelect.innerHTML = "<option value=''>-- Оберіть клас --</option>";
  Object.keys(window.state.students).sort().forEach(className => {
    classSelect.innerHTML += `<option value="${window.esc(className)}">${window.esc(className)}</option>`;
  });
  if (contextData?.preselectedClass) classSelect.value = contextData.preselectedClass;
  subjectSelect.innerHTML = "<option value=''>-- Оберіть предмет --</option>";
  window.state.subjects.sort().forEach(subjectName => {
    subjectSelect.innerHTML += `<option value="${window.esc(subjectName)}">${window.esc(subjectName)}</option>`;
  });
  if (contextData?.preselectedSubject) subjectSelect.value = contextData.preselectedSubject;
  window.$("#create-lesson-btn").onclick = () => {
    const className = classSelect.value;
    const subjectName = subjectSelect.value;
    if (!className || !subjectName) {
      window.showCustomAlert("Помилка", "Будь ласка, оберіть клас та предмет.");
      return;
    }
    const newLesson = {
      id: "lesson_" + Date.now(),
      date: dateKey + "T00:00:00.000Z",
      title: "",
      class: className,
      subject: subjectName,
      homework: { description: "", dueDate: "" },
      teacherComment: "",
      students: {},
      files: []
    };
    const studentsInClass = (window.state.students[className] || []).map(normalizeStudentName).filter(Boolean);
    studentsInClass.forEach((studentName) => {
      newLesson.students[studentName] = {
        presence: "present", work: false, hwStatus: "", grade: "", gradeType: "current", note: ""
      };
    });
    window.state.lessons.unshift(newLesson);
    window.saveLessons();
    window.closeTab("new-lesson-" + dateKey);
    window.openTab("lesson-"+newLesson.id, `Урок ${dateKey}`, ()=> window.renderLesson(newLesson.id));
  };
}

export function renderLesson(id){
  const les = window.state.lessons.find(l=>l.id===id);
  if (!les) { window.areaEl.textContent="Урок не знайдено"; return; }

  if (!les.homework) les.homework = { description: "", dueDate: "" };

  const studentsInClass = (window.state.students[les.class] || []).map(normalizeStudentName).filter(Boolean);
  const lessonStudents = les.students || {};
  studentsInClass.forEach(name => {
    if (!lessonStudents[name]) {
      lessonStudents[name] = { presence: "present", work: false, hwStatus: "", grade: "", gradeType: "current", note: "" };
    } else {
      migrateStudentData(lessonStudents[name]);
    }
  });
  Object.keys(lessonStudents).forEach(name => {
    if (!studentsInClass.includes(name)) delete lessonStudents[name];
  });
  les.students = lessonStudents;

  window.areaEl.innerHTML = `
    <div class="lesson-header">
      <input class="input" id="l-date" type="date" value="${les.date.split('T')[0]}" style="width: 155px;">
      <select class="input" id="l-class" style="min-width: 100px; max-width: 200px;"></select>
      <select class="input" id="l-subj" style="min-width: 120px; max-width: 220px;"></select>
      <input class="input title-input" id="l-title" placeholder="Тема уроку" value="${window.esc(les.title)}">
      <button class="btn" id="l-createboard"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg> Створити дошку</button>
      <button class="btn" id="l-addfiles"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg> Файли</button>
    </div>

    <div class="config-box" style="margin-top: 12px;">
      <div class="form-group" style="flex: 2; min-width: 160px;">
        <label for="l-hw-desc">Домашнє завдання</label>
        <input class="input" id="l-hw-desc" placeholder="Опис завдання..." value="${window.esc(les.homework.description || "")}">
      </div>
      <div class="form-group" style="flex: 0 0 auto; min-width: 150px;">
        <label for="l-hw-due">Здати до</label>
        <input class="input" id="l-hw-due" type="date" value="${les.homework.dueDate || ''}" style="width: 100%;">
      </div>
      <div class="form-group" style="flex: 2; min-width: 160px;">
        <label for="l-comment">Коментар вчителя</label>
        <input class="input" id="l-comment" placeholder="Коментар до уроку..." value="${window.esc(les.teacherComment || "")}">
      </div>
    </div>

    <div class="lesson-table-container">
      <table class="lesson-table" style="table-layout: fixed; min-width: 760px;">
        <colgroup>
          <col style="width: 18%;">
          <col style="width: 12%;">
          <col style="width: 6%;">
          <col style="width: 10%;">
          <col style="width: 10%;">
          <col style="width: 16%;">
          <col>
        </colgroup>
        <thead>
          <tr>
            <th>Учень</th>
            <th>Присутн.</th>
            <th title="Робота на уроці">Роб.</th>
            <th>Д/З</th>
            <th>Оцінка</th>
            <th>Тип оцінки</th>
            <th>Примітка</th>
          </tr>
        </thead>
        <tbody id="l-tbody"></tbody>
      </table>
    </div>
    <div id="files" style="margin-top: 16px; display: none;"></div>
  `;

  const classSelect = window.$("#l-class");
  Object.keys(window.state.students).sort().forEach(c => {
    classSelect.innerHTML += `<option value="${window.esc(c)}" ${c === les.class ? "selected" : ""}>${window.esc(c)}</option>`;
  });
  const subjSelect = window.$("#l-subj");
  window.state.subjects.forEach(s => {
    subjSelect.innerHTML += `<option value="${window.esc(s)}" ${s === les.subject ? "selected" : ""}>${window.esc(s)}</option>`;
  });

  window.$("#l-title").oninput = e => { les.title = e.target.value; window.saveLessons(); };
  window.$("#l-date").onchange = e => { les.date = e.target.value + "T00:00:00.000Z"; window.saveLessons(); };
  window.$("#l-subj").onchange = e => { les.subject = e.target.value; window.saveLessons(); };
  window.$("#l-class").onchange = e => {
    les.class = e.target.value;
    les.students = {};
    window.saveLessons();
    window.renderLesson(id);
  };

  window.$("#l-hw-desc").oninput = e => { les.homework.description = e.target.value; window.saveLessons(); };
  window.$("#l-hw-due").onchange = e => { les.homework.dueDate = e.target.value; window.saveLessons(); };
  window.$("#l-comment").oninput = e => { les.teacherComment = e.target.value; window.saveLessons(); };

  window.$("#l-addfiles").onclick = async () => {
    const picked = await window.tj.chooseFiles(); if(!picked.length) return;
    const added = await window.tj.addFiles(picked); les.files = (les.files||[]).concat(added); window.saveLessons(); window.renderLesson(id);
  };

  window.$("#l-createboard").onclick = async () => {
    const lessonTitle = les.title || `Урок ${les.date.split('T')[0]}`;
    const boardTitle = `Дошка: ${les.class} - ${lessonTitle}`;
    const newBoard = await createNewBoard(boardTitle);
    if (newBoard) {
      les.files = (les.files || []);
      les.files.push({ name: newBoard.filePath.split('\\').pop(), saved_path: newBoard.filePath, type: 'board' });
      window.saveLessons();
      window.renderLesson(id);
      await window.tj.openBoardWindow(newBoard.filePath);
    }
  };

  const body = window.$("#l-tbody"); body.innerHTML = "";
  const sortedStudentNames = Object.keys(les.students).sort();
  sortedStudentNames.forEach(studentName => {
    const s = les.students[studentName];
    const tr = document.createElement("tr");

    let gradeOptions = `<option value="">–</option>`;
    for (let i = 1; i <= 12; i++) {
      gradeOptions += `<option value="${i}" ${String(s.grade) === String(i) ? "selected" : ""}>${i}</option>`;
    }

    let presOptions = PRESENCE_OPTIONS.map(o =>
      `<option value="${o.value}" ${s.presence === o.value ? "selected" : ""} title="${o.title}">${o.label}</option>`
    ).join('');

    let hwOptions = HW_STATUSES.map(o =>
      `<option value="${o.value}" ${s.hwStatus === o.value ? "selected" : ""}>${o.label}</option>`
    ).join('');

    let gradeTypeOptions = GRADE_TYPES.map(o =>
      `<option value="${o.value}" ${s.gradeType === o.value ? "selected" : ""}>${o.label}</option>`
    ).join('');

    tr.innerHTML = `
      <td>${window.esc(studentName)}</td>
      <td style="text-align: center;"><select class="input pres-input">${presOptions}</select></td>
      <td style="text-align: center;"><input type="checkbox" ${s.work?"checked":""}></td>
      <td style="text-align: center;"><select class="input hw-input">${hwOptions}</select></td>
      <td><select class="input grade-input">${gradeOptions}</select></td>
      <td><select class="input gt-input">${gradeTypeOptions}</select></td>
      <td><input class="input note-input" value="${window.esc(s.note||"")}" placeholder="..."></td>`;

    const presInput = window.$("select.pres-input", tr);
    const [workCb] = window.$$("input[type=checkbox]", tr);
    const hwInput = window.$("select.hw-input", tr);
    const gradeInput = window.$("select.grade-input", tr);
    const gtInput = window.$("select.gt-input", tr);
    const noteInput = window.$("input.note-input", tr);

    const stylePresence = (sel) => {
      sel.className = "input pres-input";
      const v = sel.value;
      if (v === "absent") sel.classList.add("pres-absent");
      else if (v === "sick") sel.classList.add("pres-sick");
      else if (v === "excused") sel.classList.add("pres-excused");
      else if (v === "late") sel.classList.add("pres-late");
    };

    const styleGrade = (selectElement) => {
      const val = parseInt(selectElement.value, 10);
      selectElement.className = "input grade-input";
      if (val >= 10) selectElement.classList.add("g10");
      else if (val >= 7) selectElement.classList.add("g7");
      else if (val >= 4) selectElement.classList.add("g4");
      else if (val >= 1) selectElement.classList.add("g1");
    };

    presInput.onchange = () => { s.presence = presInput.value; stylePresence(presInput); window.saveLessons(); };
    workCb.onchange = () => { s.work = workCb.checked; window.saveLessons(); };
    hwInput.onchange = () => { s.hwStatus = hwInput.value; window.saveLessons(); };
    gradeInput.onchange = () => { s.grade = gradeInput.value; styleGrade(gradeInput); window.saveLessons(); };
    gtInput.onchange = () => { s.gradeType = gtInput.value; window.saveLessons(); };
    noteInput.oninput = () => { s.note = noteInput.value; window.saveLessons(); };

    styleGrade(gradeInput);
    stylePresence(presInput);
    body.appendChild(tr);
  });

  const files = window.$("#files");
  if (les.files && les.files.length) {
    files.style.display = "block";
    files.innerHTML = "<h3>Файли уроку</h3>";
    const t = document.createElement("table"); t.className="table";
    t.innerHTML = "<thead><tr><th>Назва</th><th>Дія</th></tr></thead><tbody></tbody>";

    les.files.forEach((f,i)=>{
      const tr = document.createElement("tr");
      const fileName = f.name || f.original_name || "Без назви";
      const isBoard = (f.type === 'board' || fileName.endsWith('.tjboard'));
      const icon = isBoard ? '🎨' : '📄';

      tr.innerHTML = `<td>${icon} ${window.esc(fileName)}</td>
        <td><div style="display: flex; gap: 8px;"><button class="btn open"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg> Відкрити</button> <button class="btn danger del"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> Видалити</button></div></td>`;

      window.$(".open",tr).onclick = ()=> {
        if (isBoard) {
          const boardExists = window.state.boards.find(b => b.filePath === f.saved_path);
          if (boardExists) window.tj.openBoardWindow(f.saved_path);
          else window.showCustomAlert("Помилка", "Файл дошки існує, але запис про нього відсутній у базі.");
        } else {
          window.tj.openPath(f.saved_path);
        }
      };

      window.$(".del",tr).onclick = async ()=>{
        if (isBoard) {
           const board = window.state.boards.find(b => b.filePath === f.saved_path);
           if (board) {
             try { await window.tj.deletePath(f.saved_path); } catch {}
             window.state.boards = window.state.boards.filter(b => b.id !== board.id);
             window.saveBoards();
           }
        } else {
          try{ await window.tj.deletePath(f.saved_path); } catch {}
        }
        les.files.splice(i,1);
        window.saveLessons();
        window.renderLesson(id);
      };
      window.$("tbody",t).appendChild(tr);
    });
    files.appendChild(t);
  }
}

export function renderLessonsList(){
  window.areaEl.innerHTML = `
    <h3>Усі уроки</h3>
    <div class="lesson-filters">
      <div class="form-group">
        <label for="filter-class">КЛАС</label>
        <select id="filter-class" class="input"></select>
      </div>
      <div class="form-group">
        <label for="filter-subject">ПРЕДМЕТ</label>
        <select id="filter-subject" class="input"></select>
      </div>
      <div class="form-group">
        <label for="filter-semester">СЕМЕСТР</label>
        <select id="filter-semester" class="input">
          <option value="">-- Весь рік --</option>
        </select>
      </div>
      <div class="lesson-filters-buttons">
        <button id="create-lesson-quick-btn" class="btn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Створити урок</button>
        <button id="filter-btn" class="btn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg> Фільтрувати</button>
        <button id="filter-reset-btn" class="btn ghost">Скинути</button>
      </div>
    </div>
    <div id="lesson-list-container" class="lesson-table-container"></div>
  `;
  const classSelect = window.$("#filter-class");
  const subjectSelect = window.$("#filter-subject");
  const semesterSelect = window.$("#filter-semester");
  const container = window.$("#lesson-list-container");

  classSelect.innerHTML = "<option value=''>-- Всі класи --</option>";
  Object.keys(window.state.students).sort().forEach(className => {
    classSelect.innerHTML += `<option value="${window.esc(className)}">${window.esc(className)}</option>`;
  });
  subjectSelect.innerHTML = "<option value=''>-- Всі предмети --</option>";
  window.state.subjects.sort().forEach(subjectName => {
    subjectSelect.innerHTML += `<option value="${window.esc(subjectName)}">${window.esc(subjectName)}</option>`;
  });
  (window.state.settings.semesters || []).forEach((sem, idx) => {
    semesterSelect.innerHTML += `<option value="${idx}">${window.esc(sem.name)}</option>`;
  });

  function populateList() {
    const classFilter = classSelect.value;
    const subjectFilter = subjectSelect.value;
    const semFilter = semesterSelect.value;

    let filteredLessons = window.state.lessons.filter(l => {
      const classMatch = !classFilter || l.class === classFilter;
      const subjectMatch = !subjectFilter || l.subject === subjectFilter;
      let semMatch = true;
      if (semFilter !== "") {
        const sem = (window.state.settings.semesters || [])[parseInt(semFilter)];
        if (sem) {
          const ld = (l.date || "").split("T")[0];
          semMatch = ld >= sem.startDate && ld <= sem.endDate;
        }
      }
      return classMatch && subjectMatch && semMatch;
    });

    if (!filteredLessons.length) {
      container.innerHTML = "<p>Уроків за цими критеріями не знайдено.</p>";
      return;
    }
    const t = document.createElement("table");
    t.className = "table";
    t.innerHTML = "<thead><tr><th>Дата</th><th>Тема</th><th>Клас</th><th>Предмет</th><th>Д/З</th><th style='width: 220px;'>Дії</th></tr></thead><tbody></tbody>";
    const tbody = window.$("tbody", t);
    filteredLessons.sort((a,b)=> (a.date||"") > (b.date||"") ? -1 : 1);

    filteredLessons.forEach(l => {
      const tr = document.createElement("tr");
      tr.dataset.lessonId = l.id;
      const hwIcon = l.homework && l.homework.description ? '📝' : '';
      tr.innerHTML = `
        <td>${(l.date||"").split('T')[0]}</td>
        <td>${window.esc(l.title)}</td>
        <td>${window.esc(l.class)}</td>
        <td>${window.esc(l.subject)}</td>
        <td style="text-align:center;">${hwIcon}</td>
        <td>
          <div style="display: flex; gap: 8px;">
            <button class='btn btn-open-lesson'><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg> Відкрити</button>
            <button class='btn danger btn-del-lesson'><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> Видалити</button>
          </div>
        </td>`;

      window.$(".btn-open-lesson", tr).onclick = () => window.openTab("lesson-"+l.id, `Урок ${l.date.split('T')[0]}`, ()=> window.renderLesson(l.id));
      window.$(".btn-del-lesson", tr).onclick = (e) => {
        e.stopPropagation();
        window.showLessonListContextMenu(e, l.id, l.title, l.date, true);
      };

      tr.ondblclick = (e)=> {
        if (e.target.closest('button')) return;
        window.openTab("lesson-"+l.id, `Урок ${l.date.split('T')[0]}`, ()=> window.renderLesson(l.id));
      };

      tr.oncontextmenu = (e) => {
        if (e.target.closest('button')) return;
        e.preventDefault();
        window.showLessonListContextMenu(e, l.id, l.title, l.date, false);
      };
      tbody.appendChild(tr);
    });
    container.innerHTML = "";
    container.appendChild(t);
  }

  window.$("#filter-btn").onclick = populateList;

  const resetBtn = window.$("#filter-reset-btn");
  resetBtn.className = "btn ghost";
  resetBtn.onclick = () => {
    classSelect.value = "";
    subjectSelect.value = "";
    semesterSelect.value = "";
    populateList();
  };

  window.$("#create-lesson-quick-btn").onclick = async () => {
    const className = classSelect.value;
    const subjectName = subjectSelect.value;
    if (!className || !subjectName) {
      await window.showCustomAlert("Не обрані фільтри", "Будь ласка, оберіть клас та предмет у фільтрах, щоб швидко створити урок.");
      return;
    }
    const dateKey = new Date().toISOString().split('T')[0];
    const newLesson = {
      id: "lesson_" + Date.now(),
      date: dateKey + "T00:00:00.000Z",
      title: "",
      class: className,
      subject: subjectName,
      homework: { description: "", dueDate: "" },
      teacherComment: "",
      students: {},
      files: []
    };
    const studentsInClass = (window.state.students[className] || []).map(normalizeStudentName).filter(Boolean);
    studentsInClass.forEach((studentName) => {
      newLesson.students[studentName] = {
        presence: "present", work: false, hwStatus: "", grade: "", gradeType: "current", note: ""
      };
    });
    window.state.lessons.unshift(newLesson);
    window.saveLessons();
    if (window.active === 'lessons') populateList();
    window.openTab("lesson-"+newLesson.id, `Урок ${dateKey}`, ()=> window.renderLesson(newLesson.id));
  };

  populateList();
}

export async function showLessonListContextMenu(e, lessonId, lessonTitle, lessonDate, autoDelete = false) {
  const deleteAction = async () => {
    const date = (lessonDate||"").split('T')[0];
    const confirmed = await window.showCustomConfirm(
      "Видалення уроку",
      `Ви впевнені, що хочете видалити урок:\n"${lessonTitle}" (за ${date})?\n\nЦю дію неможливо скасувати.`,
      "Видалити", "Скасувати", true
    );
    if (confirmed) {
      const index = window.state.lessons.findIndex(l => l.id === lessonId);
      if (index > -1) window.state.lessons.splice(index, 1);
      window.saveLessons();
      const tabId = "lesson-" + lessonId;
      if (window.$("#tab-"+window.css(tabId))) window.closeTab(tabId);
      if (window.active === "lessons") window.renderLessonsList();
    }
  };

  if (autoDelete) {
    await deleteAction();
  } else {
    window.createContextMenu(e, [{ label: "Видалити урок...", click: deleteAction }]);
  }
}
