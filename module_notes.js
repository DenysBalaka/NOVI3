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
      <button id="btn-create-note" class="btn" style="height: 38px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Створити нову замітку</button>
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
            <button class="btn open-note"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Відкрити</button>
            <button class="btn danger delete-note"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> Видалити</button>
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

// === createNewNote (експортуємо для календаря) ===
export function createNewNote(date) {
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

export function showNotePopupEditor(date) {
  migrateNotesIfNeeded();

  const noteId = "note_" + Date.now();
  window.state.notes[noteId] = {
    id: noteId,
    date,
    content: "",
    createdAt: Date.now()
  };

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";

  const dialog = document.createElement("div");
  dialog.className = "modal-dialog";
  dialog.style.maxWidth = "900px";

  const formattedDate = new Date(date).toLocaleDateString("uk-UA", {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  dialog.innerHTML = `
    <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px;">
      <div>
        <h3 style="margin:0;">${window.esc(formattedDate)}</h3>
        <div style="font-size: 13px; color: var(--muted); margin-top: 4px;">Замітка</div>
      </div>
      <div style="display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end;">
        <button class="btn danger" id="note-popup-cancel">Скасувати</button>
        <button class="btn" id="note-popup-save">Зберегти</button>
      </div>
    </div>
    <div id="note-popup-toolbar-mount" style="margin-top: 14px;"></div>
    <div id="note-popup-rich-editor" class="rich-editor" contenteditable="true" style="min-height: 320px; margin-top: 10px;"></div>
  `;

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  const richEditor = window.$("#note-popup-rich-editor", dialog);
  const saveBtn = window.$("#note-popup-save", dialog);
  const cancelBtn = window.$("#note-popup-cancel", dialog);
  const toolbarMount = window.$("#note-popup-toolbar-mount", dialog);

  toolbarMount.appendChild(createEditorToolbar(richEditor));
  richEditor.innerHTML = '<p><br></p>';

  const cleanupEmptyDraftIfNeeded = () => {
    const current = window.state.notes[noteId];
    if (!current) return;
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = current.content || "";
    const hasText = (tempDiv.textContent || "").trim().length > 0;
    const hasImages = tempDiv.querySelector('img') !== null;
    if (!hasText && !hasImages) delete window.state.notes[noteId];
  };

  const close = () => {
    overlay.remove();
    window.renderHome && window.renderHome();
  };

  cancelBtn.onclick = () => {
    delete window.state.notes[noteId];
    window.saveNotes();
    close();
  };

  overlay.onclick = (e) => {
    if (e.target === overlay) {
      delete window.state.notes[noteId];
      window.saveNotes();
      close();
    }
  };

  saveBtn.onclick = () => {
    let newHtml = richEditor.innerHTML;
    const trimmedHtml = newHtml.trim();
    if (trimmedHtml === '<p><br></p>' || trimmedHtml === '<p><br/></p>') newHtml = "";

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
    cleanupEmptyDraftIfNeeded();
    close();
  };

  // фокус + курсор на старт
  setTimeout(() => {
    try {
      richEditor.focus();
      const range = document.createRange();
      const sel = window.getSelection();
      const firstChild = richEditor.firstChild || richEditor;
      range.setStart(firstChild, 0);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (_) {}
  }, 0);
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
          <button class="btn" id="note-tab-save"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Зберегти і закрити</button>
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
        richEditor.innerHTML = window.sanitizeHTML(note.content);
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