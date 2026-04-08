// === ФАЙЛ: module_home.js ===

// Список нерухомих державних свят (місяць-день)
// За новим календарем (з 01.09.2023)
const FIXED_HOLIDAYS = {
  "01-01": "Новий рік",
  "03-08": "Міжнародний жіночий день",
  "05-01": "День праці",
  "05-08": "День пам’яті та перемоги над нацизмом",
  "06-28": "День Конституції України",
  "07-15": "День Української Державності",
  "08-24": "День Незалежності України",
  "10-01": "День захисників і захисниць України",
  "12-25": "Різдво Христове"
};

/**
 * Функція для отримання всіх свят (фіксованих і рухомих) для конкретного року
 */
function getHolidaysForYear(year) {
  // Копіюємо фіксовані свята
  const holidays = { ...FIXED_HOLIDAYS };

  // === Розрахунок православного Великодня (алгоритм Міуса для Юліанського календаря + конвертація) ===
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const monthJulian = Math.floor((d + e + 114) / 31);
  const dayJulian = ((d + e + 114) % 31) + 1;
  
  const easterDate = new Date(year, monthJulian - 1, dayJulian);
  // Додаємо 13 днів для конвертації Юліанського в Григоріанський (актуально для 1900-2099 років)
  easterDate.setDate(easterDate.getDate() + 13);

  // === Розрахунок Трійці (50-й день, тобто +49 днів від Великодня) ===
  const trinityDate = new Date(easterDate);
  trinityDate.setDate(easterDate.getDate() + 49);

  // Допоміжна функція форматування дати у "MM-DD"
  const formatDate = (date) => {
    return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  // Додаємо рухомі свята до списку
  holidays[formatDate(easterDate)] = "Великдень";
  holidays[formatDate(trinityDate)] = "Трійця";

  return holidays;
}

export function renderHome(){
  window.areaEl.innerHTML = "";
  window.tabsEl.innerHTML = ""; 
  
  window.active = null; 
  window.mainHeader.style.display = "block";
  window.tabsEl.style.display = "none"; 

  window.navBtns.forEach(b => b.classList.remove("active"));
  window.$("#nav-home")?.classList.add("active");

  const year = window.currentDisplayDate.getFullYear();
  const month = window.currentDisplayDate.getMonth(); 
  const monthName = window.currentDisplayDate.toLocaleString('uk-UA', { month: 'long' });
  const weekDays = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'нд'];
  
  // Отримуємо свята саме для поточного року, що відображається
  const holidaysThisYear = getHolidaysForYear(year);

  const wrap = document.createElement("div");
  wrap.style.display = "flex";
  wrap.style.flexDirection = "column";
  wrap.style.height = "100%";
  wrap.innerHTML = `
    <div class="calendar-nav">
      <button id="cal-prev" class="nav-arrow">‹</button>
      <h3>${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}</h3>
      <button id="cal-next" class="nav-arrow">›</button>
    </div>
    <div class="grid" id="cal"></div>
  `; 
  window.areaEl.appendChild(wrap);
  
  window.$("#cal-prev").onclick = () => {
    window.currentDisplayDate.setDate(1); 
    window.currentDisplayDate.setMonth(window.currentDisplayDate.getMonth() - 1);
    window.renderHome();
  };
  window.$("#cal-next").onclick = () => {
    window.currentDisplayDate.setDate(1); 
    window.currentDisplayDate.setMonth(window.currentDisplayDate.getMonth() + 1);
    window.renderHome();
  };

  const cal = window.$("#cal");
  const today = new Date(); 
  const firstDayOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let firstDayWeekday = (firstDayOfMonth.getDay() + 6) % 7; 

  const daysInPrevMonth = new Date(year, month, 0).getDate();
  for (let i = 0; i < firstDayWeekday; i++) {
    const day = daysInPrevMonth - firstDayWeekday + 1 + i;
    const cell = document.createElement("div");
    cell.className = "cell other-month";
    cell.innerHTML = `
      <div class="date-header"><span class="date-day-of-week">${weekDays[i]}</span></div>
      <div class="date-number">${day}</div>`;
    cal.appendChild(cell);
  }

  for(let d = 1; d <= daysInMonth; d++){
    const cell = document.createElement("div");
    cell.className = "cell";
    const dateKey = `${year}-${String(month + 1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    // Ключ для пошуку свята (MM-DD)
    const monthDayKey = `${String(month + 1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    const currentDate = new Date(year, month, d);
    const dayOfWeek = weekDays[(currentDate.getDay() + 6) % 7];
    
    // === ПЕРЕВІРКА НА СВЯТО ===
    const holidayName = holidaysThisYear[monthDayKey];
    const monthClass = holidayName ? "date-month holiday" : "date-month";
    
    if (holidayName) {
      cell.title = holidayName; // Підказка при наведенні
    }

    cell.innerHTML = `
      <div class="date-header">
        <span class="date-day-of-week">${dayOfWeek}</span>
        <span class="${monthClass}">${monthName.slice(0, 3).toUpperCase()}</span>
      </div>
      <div class="date-number">${d}</div>
    `;
    
    if (d === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
      cell.classList.add("today");
    }
    
    // === ОНОВЛЕНИЙ БЛОК ЛОГІКИ ІНДИКАТОРІВ (З ПОПЕРЕДНЬОГО ПОВІДОМЛЕННЯ) ===
    
    const lessonsOnDay = window.state.lessons.filter(l => l.date && l.date.startsWith(dateKey));
    const lessonCount = lessonsOnDay.length;

    // ВИПРАВЛЕННЯ: Шукаємо замітки по полю 'date', а не по ключу
    const notesOnDay = Object.values(window.state.notes).filter(n => n.date === dateKey);
    const noteCount = notesOnDay.length;
    
    const dayIdx = (currentDate.getDay() + 6) % 7;
    const scheduleItems = (window.state.schedule || []).filter(s => s.dayOfWeek === dayIdx);
    const schedCount = scheduleItems.length;

    let indicatorHtml = '<div class="indicator-dots">';
    
    if (lessonCount > 0) {
      indicatorHtml += '<div class="indicator-dot lesson-dot"></div>';
      indicatorHtml += `<span class="lesson-count">(${lessonCount})</span>`;
    }
    
    if (noteCount > 0) {
      indicatorHtml += '<div class="indicator-dot note-dot"></div>';
      indicatorHtml += `<span class="lesson-count">(${noteCount})</span>`;
    }

    if (schedCount > 0 && dayIdx < 5) {
      indicatorHtml += '<div class="indicator-dot" style="background:var(--accent);"></div>';
    }
    
    if (lessonCount === 0 && noteCount === 0 && schedCount === 0) {
      indicatorHtml += '<div class="indicator-dot neutral-dot"></div>';
    }
    indicatorHtml += '</div>';
    cell.innerHTML += indicatorHtml;
    // === КІНЕЦЬ ОНОВЛЕНОГО БЛОКУ ===
    
    cell.ondblclick = () => {
      window.openTab(
        "new-lesson-" + dateKey, 
        `Створити урок ${dateKey}`, 
        () => window.renderNewLessonDialog(dateKey)
      );
    };
    
    // ВИПРАВЛЕННЯ: Передаємо 'noteCount' (кількість)
    cell.oncontextmenu = (e) => {
      e.preventDefault();
      window.showCalendarContextMenu(e, dateKey, noteCount);
    };
    cal.appendChild(cell);
  }
  
  const totalCells = firstDayWeekday + daysInMonth;
  const remainingCells = (7 - (totalCells % 7)) % 7;
  for (let d = 1; d <= remainingCells; d++) {
    const cell = document.createElement("div");
    cell.className = "cell other-month";
    const dayOfWeek = weekDays[(totalCells + d - 1) % 7];
    cell.innerHTML = `
      <div class="date-header"><span class="date-day-of-week">${dayOfWeek}</span></div>
      <div class="date-number">${d}</div>`;
    cal.appendChild(cell);
  }
}

/**
 * === ПОВНІСТЮ ОНОВЛЕНА ФУНКЦІЯ КОНТЕКСТНОГО МЕНЮ ===
 */
export async function showCalendarContextMenu(e, dateKey, noteCount) { // Змінено noteContent на noteCount
  const menuItems = [
    {
      // Оновлений лейбл
      label: noteCount > 0 ? "Перейти до заміток" : "Додати замітку",
      click: () => {
        // 'contextData' змусить сторінку нотаток відкритися на потрібній даті
        window.openTab("notes", "Замітки", window.renderNotesPage, { date: dateKey });
      }
    }
  ];
  
  // Оновлена логіка: показуємо кнопку, якщо є хоча б одна замітка
  if (noteCount > 0) { 
    menuItems.push({
      label: "Видалити всі замітки за цей день",
      click: async () => {
        const confirmed = await window.showCustomConfirm(
          "Видалення заміток", 
          `Видалити всі ${noteCount} замітки(ок) за ${dateKey}?`, 
          "Видалити", "Скасувати", true
        );
        if (confirmed) {
          // ВИПРАВЛЕННЯ: Фільтруємо state.notes, видаляючи ті, що збігаються з датою
          const allNotes = Object.values(window.state.notes);
          const notesToKeep = allNotes.filter(n => n.date !== dateKey);
          
          // Перетворюємо масив назад в об'єкт
          window.state.notes = notesToKeep.reduce((acc, note) => {
            acc[note.id] = note;
            return acc;
          }, {});
          
          window.saveNotes();
          window.renderHome(); // Оновлюємо календар
        }
      }
    });
  }
  window.createContextMenu(e, menuItems);
}