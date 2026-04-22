// === Новий модуль "Дошка" (Керування) ===

export function renderBoardPage() {
  window.areaEl.innerHTML = `
    <div class="config-box" style="justify-content: space-between; align-items: center;">
      <h2 style="margin: 0;">Керування дошками</h2>
      <div class="form-buttons-group">
        <button id="board-create-new" class="btn">Створити нову дошку</button>
      </div>
    </div>
    
    <div class="output-box">
      <h3>Всі дошки</h3>
      <table class="table" id="boards-table">
        <thead><tr><th>Назва</th><th>Дата створення</th><th>Файл</th><th style="width: 220px;">Дії</th></tr></thead>
        <tbody></tbody>
      </table>
    </div>
  `;
  
  populateBoardsList();
  bindBoardPageLogic();
}

/**
 * Заповнює список усіх дошок
 */
export function populateBoardsList() {
  const tbody = window.$("#boards-table tbody");
  if (!tbody) return; 
  
  tbody.innerHTML = "";
  
  if (window.state.boards.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="color: var(--muted); text-align: center;">Дошок ще не створено.</td></tr>`;
    return;
  }
  
  // Сортуємо від новіших до старіших
  const sortedBoards = [...window.state.boards].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  
  sortedBoards.forEach(board => {
    const tr = document.createElement("tr");
    const boardDate = new Date(board.createdAt || 0).toLocaleString("uk-UA");
    const fileName = board.filePath.split('\\').pop();
    
    tr.innerHTML = `
      <td>${window.esc(board.title)}</td>
      <td>${boardDate}</td>
      <td style="font-size: 12px; color: var(--muted);">${window.esc(fileName)}</td>
      <td>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-open-board" data-id="${board.id}">Відкрити</button>
          <button class="btn danger btn-del-board" data-id="${board.id}">Видалити</button>
        </div>
      </td>
    `;
    
    window.$(".btn-open-board", tr).onclick = () => {
      window.tj.openBoardWindow(board.filePath);
    };
    
    window.$(".btn-del-board", tr).onclick = () => {
      handleBoardDelete(board.id);
    };
    
    tbody.appendChild(tr);
  });
}

/**
 * Логіка для кнопок сторінки
 */
export function bindBoardPageLogic() {
  window.$("#board-create-new").onclick = async () => {
    const newBoard = await createNewBoard("Нова дошка (без назви)");
    if (newBoard) {
      populateBoardsList();
      window.tj.openBoardWindow(newBoard.filePath);
    }
  };
}

/**
 * Логіка видалення дошки
 */
async function handleBoardDelete(boardId) {
  const board = window.state.boards.find(b => b.id === boardId);
  if (!board) return;

  const confirmed = await window.showCustomConfirm(
    "Видалення дошки",
    `Ви впевнені, що хочете видалити дошку "${window.esc(board.title)}"?\n\nЦю дію неможливо скасувати. Файл буде видалено з диску.`,
    "Видалити", "Скасувати", true
  );

  if (confirmed) {
    // 1. Видаляємо файл з диска
    try {
      await window.tj.deletePath(board.filePath);
    } catch (e) {
      console.error("Не вдалося видалити файл дошки:", e);
      await window.showCustomAlert("Помилка", "Не вдалося видалити файл дошки з диска, але запис про нього буде видалено з програми.");
    }
    
    // 2. Видаляємо запис з boards.json
    window.state.boards = window.state.boards.filter(b => b.id !== boardId);
    window.saveBoards();
    
    // 3. Видаляємо посилання на цю дошку з УСІХ уроків
    let lessonsModified = false;
    window.state.lessons.forEach(lesson => {
      if (lesson.files && lesson.files.length > 0) {
        const initialCount = lesson.files.length;
        lesson.files = lesson.files.filter(f => f.saved_path !== board.filePath);
        if (lesson.files.length !== initialCount) {
          lessonsModified = true;
        }
      }
    });
    
    if (lessonsModified) {
      window.saveLessons();
    }
    
    // 4. Оновлюємо UI
    populateBoardsList();
  }
}

/**
 * Універсальна функція для створення нової дошки (використовується і в module_lessons)
 * @param {string} title - Назва для нової дошки
 * @returns {object | null} - Об'єкт нової дошки або null у разі помилки
 */
export async function createNewBoard(title) {
  try {
    const p = await window.tj.getPaths();
    const boardFileName = `board_${Date.now()}.tjboard`;
    const boardSavePath = p.files + "\\" + boardFileName;
    
    // 1. Створюємо початковий файл .tjboard
    const initialBoardData = {
      version: 1,
      template: "grid", // "blank", "grid", "lines", "dark"
      strokes: [], // { tool, color, width, points: [[x,y], [x,y]] }
      images: [],  // <-- ДОДАНО
      texts: [],   // <-- ДОДАНО
      shapes: []   // <-- ДОДАНО (фігури)
    };
    
    const success = await window.tj.writeJSON(boardSavePath, initialBoardData);
    if (!success) throw new Error("Failed to write initial board file");

    // 2. Створюємо запис в boards.json
    const newBoard = {
      id: "board_" + Date.now(),
      title: title,
      filePath: boardSavePath,
      createdAt: Date.now()
    };
    
    window.state.boards.push(newBoard);
    await window.saveBoards(); // Використовуємо await для надійності
    
    return newBoard;

  } catch (e) {
    console.error("Failed to create new board:", e);
    await window.showCustomAlert("Помилка", "Не вдалося створити нову дошку: " + e.message);
    return null;
  }
}