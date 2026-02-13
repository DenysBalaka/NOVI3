// === ФАЙЛ: module_tests.js ===

// === 1. ГОЛОВНА СТОРІНКА (СПИСОК ТЕСТІВ) ===

export function renderTests(){
  // Скидаємо стани (вони тепер керуються у вкладці редактора)
  
  window.areaEl.innerHTML = `
    <h2>Керування тестами</h2>
    
    <div class="config-box">
      <div class="form-group" style="min-width: 200px;">
        <label for="t-new-class-select">Клас</label>
        <select id="t-new-class-select" class="input"></select>
      </div>
      <div class="form-group" style="min-width: 200px;">
        <label for="t-new-subject-select">Предмет</label>
        <select id="t-new-subject-select" class="input"></select>
      </div>
      <div class="form-buttons-group">

        <button class="btn" id="t-create-new-btn" style="height: 38px;">Створити новий тест</button>
        </div>
    </div>
    
    <div class="output-box" id="t-run-output" style="display: none;">
      </div>

    <div class="output-box" id="t-saved-output">
      <div class="output-box-header">
        <h3>Збережені тести</h3>
        <div class="form-group" style="min-width: 250px;">
          <label for="t-filter-input">Фільтр за назвою</label>
          <input class="input" id="t-filter-input" placeholder="Почніть вводити назву...">
        </div>
      </div>
      <table class="table" id="t-saved-table">
        <thead>
          <tr>
            <th>Назва тесту</th>
            <th>Клас</th>
            <th>Предмет</th>
            <th>Питань</th>
            <th style="width: 260px;">Дії</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>
  `;
  
  // Заповнюємо фільтри для СТВОРЕННЯ
  populateTestFilters(window.$("#t-new-class-select"), window.$("#t-new-subject-select"), true);
  
  // Заповнюємо список тестів
  populateSavedTestsList();
  
  // Логіка кнопки "Створити"
  window.$("#t-create-new-btn").onclick = () => {
    const classSel = window.$("#t-new-class-select");
    const subjectSel = window.$("#t-new-subject-select");
    
    const newTest = {
      id: "test_" + Date.now(),
      title: "Новий тест (без назви)",
      className: classSel.value || "",
      subjectName: subjectSel.value || "",
      questions: []
    };
    
    window.state.tests.push(newTest);
    
    // Негайно зберігаємо, щоб тест мав ID
    window.saveTests(); 
    
    // Відкриваємо редактор для цього нового тесту
    openTestEditorTab(newTest.id);
  };
}

/**
 * Заповнює список збережених тестів (Тепер це основна функція)
 */
function populateSavedTestsList() {
  const tbody = window.$("#t-saved-table tbody");
  const filterInput = window.$("#t-filter-input");
  if (!tbody) return;

  const filterText = (filterInput?.value || "").toLowerCase();

  const render = () => {
    tbody.innerHTML = "";
    const sortedTests = [...window.state.tests].sort((a, b) => (b.title || "").localeCompare(a.title));
    let itemsRendered = 0;
    
    sortedTests.forEach(test => {
      if (filterText && !(test.title || "").toLowerCase().includes(filterText)) {
        return; // Пропускаємо, якщо не відповідає фільтру
      }
      
      itemsRendered++;
      const tr = document.createElement("tr");
      tr.dataset.id = test.id;
      tr.innerHTML = `
        <td>${window.esc(test.title)}</td>
        <td>${window.esc(test.className) || "<i>(всі)</i>"}</td>
        <td>${window.esc(test.subjectName) || "<i>(всі)</i>"}</td>
        <td>${(test.questions || []).length}</td>
        <td>
          <div class="form-buttons-group" style="gap: 5px;">
            <button class="btn btn-start-test" style="padding: 6px 10px; font-size: 13px;">Запустити</button>
            <button class="btn ghost btn-edit-test" style="padding: 6px 10px; font-size: 13px;">Редагувати</button>
            <button class="btn danger btn-del-test" style="padding: 6px 10px; font-size: 13px;">Видалити</button>
          </div>
        </td>
      `;
      
      window.$(".btn-edit-test", tr).onclick = () => {
        openTestEditorTab(test.id); 
      };
      
      window.$(".btn-start-test", tr).onclick = async () => {
        const result = await window.showTestStartDialog(
          test.title,
          window.state.students,
          test.className
        );
        
        if (!result.canceled) {
          window.renderRunTest(test.id, result.studentName, result.timeLimitInMinutes);
        }
      };

      window.$(".btn-del-test", tr).onclick = async () => {
        if (await window.showCustomConfirm("Видалення", `Видалити тест "${test.title}"?`, "Видалити", "Скасувати", true)) {
          window.state.tests = window.state.tests.filter(t => t.id !== test.id);
          window.saveTests();
          render(); 
        }
      };
      
      tbody.appendChild(tr);
    });
    
    if (itemsRendered === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--muted);">
        ${filterText ? 'Тестів за фільтром не знайдено.' : 'Збережених тестів немає.'}
      </td></tr>`;
    }
  };
  
  if (filterInput) {
    filterInput.oninput = window.debounce(render, 300);
  }
  render();
}

/**
 * Універсальний заповнювач фільтрів
 */
function populateTestFilters(classSelect, subjectSelect, allowAll = false) {
  if (classSelect) {
    classSelect.innerHTML = allowAll ? "<option value=''>-- Всі класи --</option>" : "";
    Object.keys(window.state.students).sort().forEach(className => {
      classSelect.innerHTML += `<option value="${window.esc(className)}">${window.esc(className)}</option>`;
    });
  }
  if (subjectSelect) {
    subjectSelect.innerHTML = allowAll ? "<option value=''>-- Всі предмети --</option>" : "";
    window.state.subjects.sort().forEach(subjectName => {
      subjectSelect.innerHTML += `<option value="${window.esc(subjectName)}">${window.esc(subjectName)}</option>`;
    });
  }
}


// === 2. НОВА ВКЛАДКА "РЕДАКТОР ТЕСТУ" ===

/**
 * Відкриває вкладку редактора тесту (Нова функція)
 */
export function openTestEditorTab(testId) {
  const testIndex = window.state.tests.findIndex(t => t.id === testId);
  if (testIndex === -1) {
    window.showCustomAlert("Помилка", "Тест не знайдено.");
    return;
  }
  
  // Створюємо ГЛИБОКУ копію, щоб редагувати "чернетку"
  let testDraft = JSON.parse(JSON.stringify(window.state.tests[testIndex]));
  
  const tabId = "test-edit-" + testId;
  const tabTitle = `Тест: ${testDraft.title.substring(0, 20)}...`;
  
  window.openTab(tabId, tabTitle, () => {
    // === РЕНДЕР HTML РЕДАКТОРА ===
    window.areaEl.innerHTML = `
      <div class="config-box tests-config-box">
        <div class="form-group" style="flex: 1; min-width: 300px;">
          <label for="t-title">Назва тесту</label>
          <input class="input" id="t-title" placeholder="Введіть назву тесту..." value="${window.esc(testDraft.title === 'Новий тест (без назви)' ? '' : testDraft.title)}">
        </div>
        <div class="form-group">
          <label for="t-class-select">Клас</label>
          <select id="t-class-select" class="input" style="width: 200px;"></select>
        </div>
        <div class="form-group">
          <label for="t-subject-select">Предмет</label>
          <select id="t-subject-select" class="input" style="width: 200px;"></select>
        </div>
        <div class="form-buttons-group" id="t-form-buttons">
          <button class="btn" id="t-addq">+ Питання</button>
          <button class="btn" id="t-save">Зберегти і Закрити</button>
        </div>
      </div>
      
      <div class="test-creator-box" id="t-questions-box" 
           style="max-height: none; height: calc(100% - 120px); background: var(--bg);">
        </div>
    `;

    // === ЛОГІКА РЕДАКТОРА ===
    
    const titleInput = window.$("#t-title");
    const classSel = window.$("#t-class-select");
    const subjectSel = window.$("#t-subject-select");
    const questionsBox = window.$("#t-questions-box");

    // 1. Заповнюємо фільтри та дані
    populateTestFilters(classSel, subjectSel, true);
    
    classSel.value = testDraft.className || "";
    subjectSel.value = testDraft.subjectName || "";

    // 2. Відмальовуємо питання
    renderTestCreatorQuestions(testDraft, questionsBox);
    
    // 3. Біндимо логіку кнопок
    
    // Збереження змін у чернетці при вводі
    titleInput.oninput = () => {
        let val = titleInput.value.trim();
        testDraft.title = val === "" ? "Новий тест (без назви)" : val;
    };
    classSel.onchange = () => testDraft.className = classSel.value;
    subjectSel.onchange = () => testDraft.subjectName = subjectSel.value;

    // Додати питання
    window.$("#t-addq").onclick = () => {
      // === ОНОВЛЕНО: Тексти порожні, щоб працювали placeholders ===
      testDraft.questions.push({
        type: 'radio',
        text: '', 
        image: null,
        options: [
          { text: '', correct: true },  // Порожній текст
          { text: '', correct: false }  // Порожній текст
        ],
        points: 1
      });
      renderTestCreatorQuestions(testDraft, questionsBox);
      // Прокручуємо до нового питання
      questionsBox.scrollTop = questionsBox.scrollHeight;
    };
    
    // Зберегти і закрити
    window.$("#t-save").onclick = async () => {
      // Знаходимо оригінальний тест і замінюємо його
      const originalTestIndex = window.state.tests.findIndex(t => t.id === testId);
      if (originalTestIndex > -1) {
        window.state.tests[originalTestIndex] = testDraft;
      } else {
        window.state.tests.push(testDraft);
      }
      
      await window.saveTests();
      await window.showCustomAlert("Збережено", `Тест "${testDraft.title}" оновлено.`);
      
      window.closeTab(tabId);
      
      if (window.active === 'tests') {
        window.renderTests();
      }
    };
  });
}

/**
 * Рендерить список питань у редакторі (оновлено)
 * @param {object} testDraft - Об'єкт "чернетки" тесту
 * @param {HTMLElement} questionsBox - Контейнер для питань
 */
function renderTestCreatorQuestions(testDraft, questionsBox) {
  questionsBox.innerHTML = ""; 
  
  if (testDraft.questions.length === 0) {
    questionsBox.innerHTML = `<p style="text-align: center; color: var(--muted); padding-top: 20px;">Натисніть "+ Питання", щоб додати перше питання.</p>`;
    return;
  }
  
  testDraft.questions.forEach((q, qi) => {
    const qBlock = document.createElement("div");
    qBlock.className = "question-block";
    qBlock.style.background = "var(--bg-light)";
    
    // === ХЕДЕР ПИТАННЯ ===
    let optionsHTML = "";
    const types = [
      { val: 'radio', label: 'Один варіант' },
      { val: 'check', label: 'Декілька варіантів' },
      { val: 'text', label: 'Текстова відповідь' }
    ];
    
    types.forEach(t => {
      optionsHTML += `<option value="${t.val}" ${q.type === t.val ? 'selected' : ''}>${t.label}</option>`;
    });

    // === ЗОБРАЖЕННЯ ===
    const imagePreviewHTML = q.image ? `
      <div style="position: relative; margin-top: 8px;">
        <img src="${q.image}" style="max-width: 200px; max-height: 100px; border-radius: 4px; border: 1px solid var(--border-color); cursor: zoom-in;">
        <button class="btn danger" data-action="delete-image" style="position: absolute; top: 4px; right: 4px; padding: 2px 6px;">✕</button>
      </div>
    ` : '';

    qBlock.innerHTML = `
      <div class="question-header">
        <h4 style="margin: 0; min-width: 90px;">Питання #${qi + 1}</h4>
        
        <textarea class="input q-text-input" placeholder="Введіть текст питання сюди..." 
                  style="width: 250px; min-width: 250px; height: 36px;">${window.esc(q.text || "")}</textarea>
        
        <div class="form-group" style="max-width: 180px;">
          <label>Тип питання</label>
          <select class="input q-type-select">${optionsHTML}</select>
        </div>
        
        <div class="form-group" style="width: 70px;">
          <label for="q-points-${qi}">Бали</label>
          <input type="number" id="q-points-${qi}" min="1" class="input points-input q-points-input" value="${q.points || 1}" style="padding: 8px 4px; text-align: center;">
        </div>
        
        <button class="btn ghost" data-action="add-image" title="Додати зображення">🖼️</button>
        <button class="btn danger" data-action="delete-q" title="Видалити питання">Видалити</button>
      </div>
      
      ${imagePreviewHTML}
      
      <div class="options-list" style="display: ${q.type === 'text' ? 'none' : 'block'};">
        </div>
      <button class="btn ghost" data-action="add-option" style="margin-left: 28px; margin-top: 8px; display: ${q.type === 'text' ? 'none' : 'block'};">
        + Додати варіант
      </button>
    `;
    
    // === РЕНДЕР ВАРІАНТІВ ВІДПОВІДЕЙ ===
    const optionsList = window.$(".options-list", qBlock);
    if (q.type === 'radio' || q.type === 'check') {
      (q.options || []).forEach((opt, opti) => {
        const optRow = document.createElement("div");
        optRow.className = "option-row";
        optRow.style.display = "flex";
        optRow.style.gap = "6px";
        optRow.style.alignItems = "center";
        
        const inputType = q.type === 'radio' ? 'radio' : 'checkbox';
        
        // ДОДАНО PLACEHOLDER ДЛЯ ВАРІАНТІВ
        optRow.innerHTML = `
          <label style="display: flex; flex: 1; align-items: center; gap: 4px;">
            <input type="${inputType}" name="q-correct-${qi}" ${opt.correct ? 'checked' : ''} data-opt-index="${opti}">
            <input type="text" class="input opt-text-input" placeholder="Введіть текст варіанту..." value="${window.esc(opt.text || "")}" style="width: 100%;">
          </label>
          <button class="btn danger ghost" data-action="delete-opt" data-opt-index="${opti}" style="min-width: 32px; padding: 4px 8px;">✕</button>
        `;
        
        window.$(".opt-text-input", optRow).oninput = (e) => {
          testDraft.questions[qi].options[opti].text = e.target.value;
        };
        window.$(`input[type="${inputType}"]`, optRow).onchange = (e) => {
          if (q.type === 'radio') {
            testDraft.questions[qi].options.forEach((o, i) => o.correct = (i === opti));
          } else { 
            testDraft.questions[qi].options[opti].correct = e.target.checked;
          }
        };
        
        optionsList.appendChild(optRow);
      });
    }

    // === ЛОГІКА КНОПОК ПИТАННЯ ===
    window.$(".q-type-select", qBlock).onchange = (e) => {
      const newType = e.target.value;
      testDraft.questions[qi].type = newType;
      if (newType === 'radio' && testDraft.questions[qi].options.length > 0) {
        testDraft.questions[qi].options.forEach((o, i) => o.correct = (i === 0));
      } else {
        testDraft.questions[qi].options.forEach(o => o.correct = false);
      }
      renderTestCreatorQuestions(testDraft, questionsBox); 
    };
    
    window.$(".q-text-input", qBlock).oninput = (e) => {
      testDraft.questions[qi].text = e.target.value;
    };
    
    window.$(".q-points-input", qBlock).oninput = (e) => {
      testDraft.questions[qi].points = parseInt(e.target.value, 10) || 1;
    };

    window.$('[data-action="add-image"]', qBlock).onclick = async () => {
      const dataUrl = await window.tj.readFileAsDataUrl();
      if (dataUrl && dataUrl.error) {
        window.showCustomAlert("Помилка", dataUrl.error);
        return;
      }
      if (dataUrl) {
        testDraft.questions[qi].image = dataUrl;
        renderTestCreatorQuestions(testDraft, questionsBox);
      }
    };
    
    const delImgBtn = window.$('[data-action="delete-image"]', qBlock);
    if (delImgBtn) {
      delImgBtn.onclick = () => {
        testDraft.questions[qi].image = null;
        renderTestCreatorQuestions(testDraft, questionsBox);
      };
      window.$('img', qBlock).onclick = () => {
        window.previewImage(q.image);
      };
    }

    window.$('[data-action="delete-q"]', qBlock).onclick = () => {
      testDraft.questions.splice(qi, 1);
      renderTestCreatorQuestions(testDraft, questionsBox); 
    };
    
    window.$('[data-action="add-option"]', qBlock).onclick = () => {
      if (!testDraft.questions[qi].options) testDraft.questions[qi].options = [];
      // ДОДАНО ПОРОЖНІЙ ТЕКСТ ДЛЯ НОВОГО ВАРІАНТУ
      testDraft.questions[qi].options.push({ text: '', correct: false });
      renderTestCreatorQuestions(testDraft, questionsBox);
    };
    
    qBlock.onclick = (e) => {
      if (e.target.dataset.action === 'delete-opt') {
        const optIndex = parseInt(e.target.dataset.optIndex, 10);
        testDraft.questions[qi].options.splice(optIndex, 1);
        renderTestCreatorQuestions(testDraft, questionsBox);
      }
    };

    questionsBox.appendChild(qBlock);
  });
}


// === 3. ЛОГІКА ЗАПУСКУ ТЕСТУ (ОНОВЛЕНИЙ ДИЗАЙН + ФІКС ТАЙМЕРА І ПАРОЛЮ) ===

export function renderRunTest(testId, studentName, timeLimitInMinutes = 0) {
  const test = window.state.tests.find(t => t.id === testId);
  if (!test) return;

  const tabId = `test-run-${testId}-${studentName.replace(/ /g, '_')}`;
  const tabTitle = `Тест: ${studentName.split(' ')[0]}...`;
  
  const timerDuration = (timeLimitInMinutes || 0) * 60; // в секундах

  // === ВИПРАВЛЕННЯ: Збереження стану таймера ===
  let timerState = window.activeTimers[tabId];
  if (!timerState && timerDuration > 0) {
    // Створюємо стан, лише якщо його немає (перший запуск)
    timerState = {
      intervalId: null,
      timeLeft: timerDuration,
      timerDuration: timerDuration
    };
    window.activeTimers[tabId] = timerState;
  }
  // === КІНЕЦЬ ВИПРАВЛЕННЯ ===

  window.openTab(tabId, tabTitle, () => {
    
    // === ВИПРАВЛЕННЯ: Зупиняємо старий інтервал при пере-рендері ===
    let timerState = window.activeTimers[tabId];
    if (timerState && timerState.intervalId) {
      clearInterval(timerState.intervalId);
      timerState.intervalId = null;
    }
    // === КІНЕЦЬ ВИПРАВЛЕННЯ ===

    // Готуємо HTML
    let questionsHTML = "";
    test.questions.forEach((q, qi) => {
      questionsHTML += `<div class="question-block" style="background: var(--bg-light); margin-bottom: 16px; padding: 16px; border-radius: 8px; border: 1px solid var(--border-color);">`;
      questionsHTML += `<div class="question-text" style="font-size: 1.1em; font-weight: 600; margin-bottom: 12px; color: var(--text-primary);">`;
      questionsHTML += `<b>Питання ${qi + 1}:</b> ${window.esc(q.text)}`;
      questionsHTML += `</div>`;
      
      if (q.image) {
        questionsHTML += `<img src="${q.image}" style="max-width: 400px; max-height: 300px; border-radius: 4px; margin-bottom: 12px; cursor: zoom-in; border: 1px solid var(--border-color);" onclick="window.previewImage('${q.image}')">`;
      }
      
      questionsHTML += `<div class="options-list" style="display: flex; flex-direction: column; gap: 8px;">`;
      if (q.type === 'radio' || q.type === 'check') {
        q.options.forEach((opt, opti) => {
          const inputType = q.type === 'radio' ? 'radio' : 'checkbox';
          questionsHTML += `
            <label class="test-option-label">
              <input type="${inputType}" name="q-${qi}" value="${opti}" data-q-index="${qi}">
              <span>${window.esc(opt.text)}</span>
            </label>
          `;
        });
      } else if (q.type === 'text') {
        questionsHTML += `<textarea class="input" data-q-index="${qi}" placeholder="Введіть вашу відповідь..." style="min-height: 100px;"></textarea>`;
      }
      questionsHTML += `</div></div>`;
    });

    // Рендеримо сторінку
    window.areaEl.innerHTML = `
      <style>
        .test-run-layout { display: flex; flex-direction: column; height: 100%; background: var(--bg); }
        .test-run-content { flex: 1; overflow-y: auto; padding: 16px; }
        .test-run-header, .test-run-footer { flex-shrink: 0; background: var(--panel); padding: 12px 16px; }
        .test-run-header { border-bottom: 1px solid var(--border-color); }
        .test-run-footer { border-top: 1px solid var(--border-color); text-align: right; display: flex; justify-content: flex-end; align-items: center; gap: 10px; }
        .test-option-label { display: flex; align-items: center; padding: 12px; border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; transition: background-color 0.1s, border-color 0.1s; }
        .test-option-label:hover { background: var(--bg); border-color: var(--accent); }
        .test-option-label input { margin-right: 12px; transform: scale(1.2); accent-color: var(--accent); }
        .test-option-label input:checked + span { color: var(--accent); font-weight: 600; }
      </style>
    
      <div class="test-run-layout">
        
        <div class="test-run-header">
          <h3>Тест: ${window.esc(test.title)}</h3>
          <p style="margin: 0; color: var(--muted);"><b>Учень:</b> ${window.esc(studentName)}</p>
        </div>
        
        ${timerDuration > 0 ? `
          <div class="test-timer-bar">
            <div class="test-timer-progress g-100" id="test-timer-progress"></div>
            <div class="test-timer-text" id="test-timer-text">Завантаження...</div>
          </div>
        ` : ''}
        
        <div class="test-run-content" id="test-questions-area">
          ${questionsHTML}
        </div>
        
        <div class="test-run-footer" id="test-run-footer-area">
          <button class="btn" id="test-finish-btn" style="min-width: 200px; height: 40px;">Завершити тест</button>
        </div>
        
      </div>
    `;

    // Логіка таймера
    if (timerDuration > 0) {
      const timerTextEl = window.$("#test-timer-text");
      const timerProgressEl = window.$("#test-timer-progress");
      const questionsArea = window.$("#test-questions-area");
      const footerArea = window.$("#test-run-footer-area");

      let localIntervalId = null; // Локальна змінна для інтервалу

      // === ВИПРАВЛЕНО: Функція таймера з ВІДНОВЛЕНОЮ логікою паролю ===
      const updateTimer = async () => {
        let currentState = window.activeTimers[tabId];
        
        if (!currentState) {
            clearInterval(localIntervalId); 
            return;
        }

        currentState.timeLeft--;
        
        // === ВІДНОВЛЕНА ЛОГІКА ЗІ СТАРОГО ФАЙЛУ ===
        if (currentState.timeLeft < 0) {
          clearInterval(localIntervalId);
          currentState.intervalId = null;
          
          timerTextEl.textContent = "Час вийшов!";
          timerProgressEl.style.width = `0%`;
          timerProgressEl.className = "test-timer-progress g-25";
          
          // 1. Блокуємо всі поля вводу
          window.$$("input, textarea", questionsArea).forEach(inp => inp.disabled = true);
          
          // 2. Додаємо кнопку "Дати більше часу"
          if (footerArea && !window.$("#add-time-btn")) {
            const addTimeBtn = document.createElement("button");
            addTimeBtn.className = "btn ghost"; // 'ghost' або інший стиль
            addTimeBtn.id = "add-time-btn";
            addTimeBtn.textContent = "Дати більше часу";
            
            // Вставляємо її перед кнопкою "Завершити"
            footerArea.prepend(addTimeBtn);

            // 3. Логіка кнопки
            addTimeBtn.onclick = async () => {
              
              // === ОСЬ ГОЛОВНЕ ВИПРАВЛЕННЯ ===
              const password = window.state.settings?.teacherPassword;
              // === КІНЕЦЬ ГОЛОВНОГО ВИПРАВЛЕННЯ ===

              if (!password) {
                await window.showCustomAlert("Помилка", "Пароль вчителя не встановлено в Налаштуваннях.");
                return;
              }
              
              const success = await window.showPasswordPrompt("Підтвердження", password);
              
              if (success) {
                // 4. Розблокування
                window.$$("input, textarea", questionsArea).forEach(inp => inp.disabled = false);
                
                const timerBar = window.$(".test-timer-bar");
                if (timerBar) timerBar.remove();
                
                addTimeBtn.remove();
                
                delete window.activeTimers[tabId]; 
                
                await window.showCustomAlert("Тест розблоковано", "Тест розблоковано. Таймер вимкнено.");
              }
            };
          }
          // Кнопка "Завершити" залишається активною
          return; 
        }
        // === КІНЕЦЬ ВІДНОВЛЕНОЇ ЛОГІКИ ===

        // Оновлюємо UI (якщо час ще є)
        const minutes = Math.floor(currentState.timeLeft / 60);
        const seconds = currentState.timeLeft % 60;
        timerTextEl.textContent = `Залишилось часу: ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        
        const percent = (currentState.timeLeft / currentState.timerDuration) * 100;
        timerProgressEl.style.width = `${percent}%`;
        timerProgressEl.className = "test-timer-progress " + (percent > 75 ? 'g-100' : percent > 50 ? 'g-75' : percent > 25 ? 'g-50' : 'g-25');
      };
      
      // === ВИПРАВЛЕННЯ: Запуск/відновлення таймера ===
      
      // 1. Малюємо поточний стан (на випадок перемикання вкладок)
      const minutes = Math.floor(timerState.timeLeft / 60);
      const seconds = timerState.timeLeft % 60;
      timerTextEl.textContent = `Залишилось часу: ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      const percent = (timerState.timeLeft / timerState.timerDuration) * 100;
      timerProgressEl.style.width = `${percent}%`;
      timerProgressEl.className = "test-timer-progress " + (percent > 75 ? 'g-100' : percent > 50 ? 'g-75' : percent > 25 ? 'g-50' : 'g-25');
      
      // 2. Запускаємо *новий* інтервал, якщо час ще є
      if (timerState.timeLeft > 0) {
        localIntervalId = setInterval(updateTimer, 1000);
        timerState.intervalId = localIntervalId; // Зберігаємо ID нового інтервалу
      } else {
        // Час вже вийшов (поки ми були на іншій вкладці або повернулись)
        // Ми не можемо викликати updateTimer() з `await` тут,
        // тому просто викликаємо її, щоб вона відпрацювала синхронну частину
        // (блокування полів і показ кнопки).
        updateTimer();
      }
      // === КІНЕЦЬ ВИПРАВЛЕННЯ ===
      
    } else {
      window.$(".test-run-header").style.marginBottom = "0";
    }

    // Логіка збору відповідей
    window.$("#test-finish-btn").onclick = async () => {
      let timerState = window.activeTimers[tabId];
      if (timerState && timerState.intervalId) {
        clearInterval(timerState.intervalId);
        timerState.intervalId = null;
      }
      
      const confirmed = await window.showCustomConfirm("Завершення", "Ви впевнені, що хочете завершити тест?", "Завершити", "Ні", false);
      if (!confirmed) {
        // Користувач передумав. Запускаємо таймер знову.
        if (timerState && timerState.timeLeft > 0) {
           // 'updateTimer' визначено у цій області видимості (openTab)
           const newIntervalId = setInterval(updateTimer, 1000);
           timerState.intervalId = newIntervalId;
        }
        return;
      }

      // Збираємо відповіді
      const answers = {};
      test.questions.forEach((q, qi) => {
        if (q.type === 'radio') {
          const checked = window.$(`input[name="q-${qi}"]:checked`);
          answers[qi] = checked ? parseInt(checked.value, 10) : null;
        } 
        else if (q.type === 'check') {
          answers[qi] = [];
          window.$$(`input[name="q-${qi}"]:checked`).forEach(chk => {
            answers[qi].push(parseInt(chk.value, 10));
          });
        } 
        else if (q.type === 'text') {
          const textarea = window.$(`textarea[data-q-index="${qi}"]`);
          answers[qi] = textarea ? textarea.value : "";
        }
      });
      
      processTestResults(test, studentName, answers, tabId);
    };
  });
}

/**
 * Обробляє результати тесту (без змін)
 */
async function processTestResults(test, studentName, answers, tabId) {
  const score = window.calcScore(test, answers);
  
  // === ВИПРАВЛЕНО: 'student' -> 'studentName' у об'єкті 'attempts' ===
  window.state.attempts.push({ 
    testId: test.id, 
    testTitle: test.title, 
    studentName: studentName, // <--- ВИПРАВЛЕНО (було 'student:')
    date: new Date().toLocaleString("uk-UA"), 
    score, 
    answers 
  });
  window.saveAttempts(); 
  
  const message = `Результат для \"${window.esc(studentName)}\":\n\n` +
                  `Правильних відповідей: ${score.correctCount} / ${score.totalQuestions}\n` +
                  `Набрано балів: ${score.earnedPoints} / ${score.maxPoints}`;
  
  await window.showCustomAlert("Тест завершено", message); 
  
  // Видаляємо таймер перед закриттям вкладки
  if (window.activeTimers[tabId]) {
    clearInterval(window.activeTimers[tabId].intervalId);
    delete window.activeTimers[tabId];
  }
  
  window.closeTab(tabId);
}

/**
 * Рахує бали (без змін)
 */
export function calcScore(test, answers){
  let correctCount = 0;
  let totalQuestions = 0;
  let earnedPoints = 0;
  let maxPoints = 0;

  test.questions.forEach((q,qi)=>{
    totalQuestions++;
    const points = q.points || 1;
    maxPoints += points;
    let isCorrect = false;

    if (q.type==="text"){ 
      isCorrect = (answers[qi] && String(answers[qi]).trim()? true: false); 
    } else { 
      const right = new Set((q.options||[]).map((o,i)=> o.correct? i: null).filter(x=>x!==null));
      const given = new Set(Array.isArray(answers[qi])? answers[qi] : (answers[qi]!=null?[answers[qi]]:[]));
      
      if (right.size === given.size && [...right].every(i => given.has(i))) {
        isCorrect = true;
      }
    }
    
    if (isCorrect) {
      correctCount++;
      earnedPoints += points;
    }
  });

  return { correctCount, totalQuestions, earnedPoints, maxPoints };
}

/**
 * Попередній перегляд зображення (без змін)
 */
export function previewImage(dataUrl) {
  // === ВИПРАВЛЕННЯ: Перевірка, чи dataUrl не є об'єктом помилки ===
  // (Це виправлення з попередніх кроків, яке тут теж важливе)
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image')) {
    console.warn("Invalid dataUrl for previewImage:", dataUrl);
    return;
  }
  // === КІНЕЦЬ ВИПРАВЛЕННЯ ===

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.style.cursor = "zoom-out";
  overlay.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; padding: 20px;">
      <img src="${dataUrl}" style="max-width: 90vw; max-height: 90vh; object-fit: contain; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
    </div>
  `;
  overlay.onclick = () => overlay.remove();
  document.body.appendChild(overlay);
}