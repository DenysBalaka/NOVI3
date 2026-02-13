// === ФАЙЛ: module_notes.js ===

// === Допоміжна функція для тулбару (Без змін) ===
function createEditorToolbar(editorElement) {
  const toolbar = document.createElement("div");
  toolbar.className = "editor-toolbar";
  
  const buttons = [
    { cmd: 'undo', label: '↺', title: 'Скасувати (Ctrl+Z)' },
    { cmd: 'redo', label: '↻', title: 'Повторити (Ctrl+Y)' },
    { separator: true },
    { cmd: 'formatBlock', value: 'H3', label: '<b>Заг.</b>', title: 'Заголовок (H3)' },
    { cmd: 'formatBlock', value: 'P', label: '<b>Пар.</b>', title: 'Параграф (P)' },
    { separator: true },
    { cmd: 'bold', label: '<b>B</b>', title: 'Жирний' },
    { cmd: 'italic', label: '<i>I</i>', title: 'Курсив' },
    { cmd: 'underline', label: '<u>U</u>', title: 'Підкреслений' },
    { cmd: 'strikeThrough', label: '<s>S</s>', title: 'Закреслений' },
    { separator: true },
    { cmd: 'justifyLeft', label: 'Лів.', title: 'Вирівн. ліворуч' },
    { cmd: 'justifyCenter', label: 'Центр', title: 'Вирівн. по центру' },
    { cmd: 'justifyRight', label: 'Прав.', title: 'Вирівн. праворуч' },
    { separator: true },
    { cmd: 'insertUnorderedList', label: '•', title: 'Маркований список' },
    { cmd: 'insertOrderedList', label: '1.', title: 'Нумерований список' },
  ];
  
  const btnElements = []; 

  buttons.forEach(btn => {
    if (btn.separator) {
      const sep = document.createElement("hr");
      toolbar.appendChild(sep);
    } else {
      const button = document.createElement("button");
      button.className = "btn ghost"; 
      button.innerHTML = btn.label; 
      button.title = btn.title; 
      button.dataset.cmd = btn.cmd; 
      
      button.onmousedown = (e) => { 
        e.preventDefault(); 
        const value = btn.value || null;
        document.execCommand(btn.cmd, false, value);
        updateToolbarState(); 
        editorElement.focus(); 
      };
      
      toolbar.appendChild(button);
      btnElements.push(button);
    }
  });

  const updateToolbarState = () => {
    btnElements.forEach(btn => {
      const cmd = btn.dataset.cmd;
      
      if (cmd === 'formatBlock') {
        try {
          const currentBlock = document.queryCommandValue(cmd).toUpperCase();
          if (currentBlock === btn.value.toUpperCase()) {
            btn.classList.add('active');
          } else {
            btn.classList.remove('active');
          }
        } catch (e) { btn.classList.remove('active'); }
      } 
      else {
        try {
          if (document.queryCommandState(cmd)) {
            btn.classList.add('active');
          } else {
            btn.classList.remove('active');
          }
        } catch (e) { btn.classList.remove('active'); }
      }
    });
  };


  if (editorElement) {
    editorElement.addEventListener('keyup', updateToolbarState);
    editorElement.addEventListener('mouseup', updateToolbarState);
    editorElement.addEventListener('click', updateToolbarState);
    editorElement.addEventListener('focus', updateToolbarState);
  }

  return toolbar;
}

// === МІГРАЦІЯ ДАНИХ (Без змін) ===
function migrateNotesIfNeeded() {
  let migrated = false;
  for (const key of Object.keys(window.state.notes)) {
    if (typeof window.state.notes[key] === 'string') {
      const newId = "note_" + Date.now() + Math.random().toString(36).substr(2, 5);
      window.state.notes[newId] = {
        id: newId,
        date: key,
        content: window.state.notes[key],
        createdAt: Date.now()
      };
      delete window.state.notes[key];
      migrated = true;
    }
  }
  if (migrated) {
    window.saveNotes();
    console.log("Notes migrated to new format with unique IDs");
  }
}

// === renderNotesPage (Без змін) ===
export function renderNotesPage(contextData) {
  migrateNotesIfNeeded();

  window.areaEl.innerHTML = `
    <h2>Замітки</h2>
    <div class="config-box" style="align-items: flex-end; gap: 12px; flex-wrap: wrap;"> 
      <div class="form-group" style="margin: 0; min-width: 200px;">
        <label for="note-date-picker">Оберіть дату для нової замітки</label>
        <input type="date" id="note-date-picker" class="input">
      </div>
      <button id="btn-create-note" class="btn" style="height: 38px;">Створити нову замітку</button>
    </div>
    
    <div class="output-box">
      <h3>Всі збережені замітки</h3>
      <table class="table" id="notes-table">
        <thead><tr><th>Дата і час</th><th>Замітка (уривок)</th><th style="width: 150px;">Дії</th></tr></thead>
        <tbody></tbody>
      </table>
    </div>
  `;

  const datePicker = window.$("#note-date-picker");
  const notesTbody = window.$("#notes-table tbody");
  
  datePicker.value = contextData?.date || new Date().toISOString().split('T')[0];

  function populateNotesList() {
    notesTbody.innerHTML = "";
    const notesList = Object.values(window.state.notes);
    
    notesList.sort((a, b) => {
      if (b.date !== a.date) return b.date.localeCompare(a.date);
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
    
    if (notesList.length === 0) {
      notesTbody.innerHTML = `<tr><td colspan="3" style="color: var(--muted); text-align: center;">Заміток немає.</td></tr>`;
      return;
    }
    
    notesList.forEach(note => {
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = note.content || "";
      const plainText = tempDiv.textContent || tempDiv.innerText || "";
      const previewText = plainText.length > 60 ? plainText.substring(0, 60) + "..." : plainText;
      
      const dateObj = new Date(note.createdAt || Date.now());
      const timeStr = dateObj.toLocaleTimeString("uk-UA", { hour: '2-digit', minute: '2-digit' });
      const dateTimeDisplay = `${note.date} <span style="color: var(--muted); font-size: 0.9em;">(${timeStr})</span>`;

      const tr = document.createElement("tr");
      tr.dataset.noteId = note.id;
      tr.innerHTML = `
        <td>${dateTimeDisplay}</td>
        <td>${window.esc(previewText)}</td>
        <td>
          <div style="display: flex; gap: 8px;">
            <button class="btn open-note">Відкрити</button>
            <button class="btn danger delete-note">Видалити</button>
          </div>
        </td>
      `;
      notesTbody.appendChild(tr);
    });
  }
  
  notesTbody.onclick = async (e) => {
    const target = e.target;
    if (!target.closest('button')) return; 
    const noteId = target.closest('tr').dataset.noteId;
    if (!noteId) return;

    if (target.classList.contains("open-note")) {
      openNoteEditorTab(noteId);
    }
    if (target.classList.contains("delete-note")) {
      if (await window.showCustomConfirm("Видалення", "Видалити цю замітку?", "Видалити", "Скасувати", true)) {
        delete window.state.notes[noteId];
        window.saveNotes();
        populateNotesList(); 
      }
    }
  };
  
  window.$("#btn-create-note").onclick = () => {
    const date = datePicker.value;
    if (!date) {
       window.showCustomAlert("Увага", "Будь ласка, оберіть дату.");
       return;
    }
    createNewNote(date);
  };
  
  populateNotesList();
}

// === createNewNote (Без змін) ===
function createNewNote(date) {
  const newId = "note_" + Date.now();
  window.state.notes[newId] = {
    id: newId,
    date: date,
    content: "", // Створюємо з порожнім контентом
    createdAt: Date.now()
  };
  window.saveNotes();
  openNoteEditorTab(newId);
}

// === openNoteEditorTab (ОНОВЛЕНО) ===
function openNoteEditorTab(noteId) {
  const note = window.state.notes[noteId];
  if (!note) return;

  const tabId = "note-edit-" + noteId;
  
  window.openTab(tabId, `Замітка: ${note.date}`, () => {
    const formattedDate = new Date(note.date).toLocaleDateString("uk-UA", {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    window.areaEl.innerHTML = `
      <div style="height: 100%; display: flex; flex-direction: column; max-width: 900px; margin: 0 auto;">
        <div style="border-bottom: 1px solid var(--border-color); padding-bottom: 16px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
          <div>
             <h2 style="margin: 0;">${formattedDate}</h2>
             <div style="font-size: 13px; color: var(--muted);">ID: ${noteId}</div>
          </div>
          <button class="btn" id="note-tab-save">Зберегти і закрити</button>
        </div>
        <div id="note-full-toolbar-mount"></div>
        
        <div id="note-tab-rich-editor" class="rich-editor" contenteditable="true" style="flex: 1;"></div>
      
      </div>
    `;

    const richEditor = window.$("#note-tab-rich-editor");
    const saveBtn = window.$("#note-tab-save");

    // Передаємо сам редактор у функцію створення тулбару, щоб прив'язати події
    window.$("#note-full-toolbar-mount").appendChild(createEditorToolbar(richEditor));
    
    // === Встановлюємо вміст і фокус (Без змін) ===
    if (note.content) {
        richEditor.innerHTML = note.content;
    } else {
        richEditor.innerHTML = '<p><br></p>'; 
    }
    
    richEditor.focus();

    // === ФІКС: Примусово ставимо курсор (Без змін) ===
    try {
        const range = document.createRange();
        const sel = window.getSelection();
        const firstChild = richEditor.firstChild || richEditor;
        range.setStart(firstChild, 0); 
        range.collapse(true); 
        sel.removeAllRanges(); 
        sel.addRange(range);   
    } catch (e) {
        console.warn("Не вдалося програмно встановити курсор.", e);
    }
    
    // === Фікс для 'Enter' (вирівнювання + прокрутка) (Без змін) ===
    let alignmentBeforeEnter = null;
    richEditor.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        try {
          if (document.queryCommandState('justifyCenter')) { alignmentBeforeEnter = 'justifyCenter'; } 
          else if (document.queryCommandState('justifyRight')) { alignmentBeforeEnter = 'justifyRight'; } 
          else if (document.queryCommandState('justifyLeft')) { alignmentBeforeEnter = 'justifyLeft'; } 
          else { alignmentBeforeEnter = null; }
        } catch(e) { alignmentBeforeEnter = null; }
      }
    });
    richEditor.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') {
        if (alignmentBeforeEnter) {
          try { document.execCommand(alignmentBeforeEnter, false, null); } catch (err) {}
          alignmentBeforeEnter = null; 
        }
        try {
          const selection = window.getSelection();
          if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const container = range.commonAncestorContainer; 
            let elementToScroll = (container.nodeType === Node.TEXT_NODE) ? container.parentElement : container;
            if (elementToScroll && typeof elementToScroll.scrollIntoView === 'function') {
              elementToScroll.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); 
            }
          }
        } catch (scrollErr) {}
        richEditor.focus();
      }
    });
    // === КІНЕЦЬ ФІКСУ ===

    // === Логіка збереження (Без змін) ===
    saveBtn.onclick = async () => {
        let newHtml = richEditor.innerHTML;
        
        const trimmedHtml = newHtml.trim();
        if (trimmedHtml === '<p><br></p>' || trimmedHtml === '<p><br/></p>') {
            newHtml = "";
        }
        
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = newHtml;
        const hasText = (tempDiv.textContent || "").trim().length > 0;
        const hasImages = tempDiv.querySelector('img') !== null; 

        if (hasText || hasImages) {
            window.state.notes[noteId].content = newHtml;
            window.state.notes[noteId].createdAt = Date.now(); 
        } else {
            delete window.state.notes[noteId];
        }
        window.saveNotes();
        window.closeTab(tabId);
        window.openTab("notes", "Замітки", window.renderNotesPage);
    };
  });
}