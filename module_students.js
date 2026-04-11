let activeClassForEditing = null;

export function renderEditorPage() {
  window.areaEl.innerHTML = `
    <h2>Учні</h2>
    <p>Керуйте вашими класами, учнями та предметами.</p>
    <div class="editor-layout">
      <div class="editor-column">
        <h3>Класи</h3>
        <div class="editor-list" id="editor-classes-list"></div>
        <div class="editor-actions">
          <input class="input" id="editor-new-class-name" placeholder="Назва нового класу">
          <button id="editor-add-class" class="btn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Додати</button>
        </div>
      </div>
      <div class="editor-column">
        <h3>Список учнів</h3>
        <textarea id="editor-students-textarea" class="editor-textarea" placeholder="Введіть список учнів, по одному на рядок..." disabled></textarea>
        <div class="editor-actions right">
          <button id="editor-save-students" class="btn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Зберегти учнів</button>
        </div>
      </div>
      <div class="editor-column">
        <h3>Предмети</h3>
        <div class="editor-list" id="editor-subjects-list"></div>
        <div class="editor-actions">
          <input class="input" id="editor-new-subject-name" placeholder="Назва нового предмету">
          <button id="editor-add-subject" class="btn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Додати</button>
        </div>
      </div>
    </div>
  `;
  activeClassForEditing = null;
  window.populateEditorClasses();
  window.populateEditorSubjects();
  window.bindEditorPageLogic();
}

export function populateEditorClasses() {
  const editorClassesList = window.$("#editor-classes-list");
  if (!editorClassesList) return;
  editorClassesList.innerHTML = "";
  window.state.classOrder.forEach((name, index) => {
    const item = document.createElement("div");
    item.className = "editor-list-item";
    item.dataset.className = name;
    if (name === activeClassForEditing) item.classList.add("selected");
    const nameSpan = document.createElement("span"); nameSpan.textContent = name;
    const controls = document.createElement("div"); controls.className = "item-controls";
    const upBtn = document.createElement("button"); upBtn.className = "order-btn"; upBtn.innerHTML = "↑";
    upBtn.disabled = (index === 0);
    upBtn.onclick = (e) => { e.stopPropagation(); window.moveClassOrder(index, index - 1); };
    const downBtn = document.createElement("button"); downBtn.className = "order-btn"; downBtn.innerHTML = "↓";
    downBtn.disabled = (index === window.state.classOrder.length - 1);
    downBtn.onclick = (e) => { e.stopPropagation(); window.moveClassOrder(index, index + 1); };
    controls.appendChild(upBtn); controls.appendChild(downBtn);
    item.appendChild(nameSpan); item.appendChild(controls);
    item.onclick = () => {
      activeClassForEditing = name;
      window.populateEditorClasses(); 
      window.$("#editor-students-textarea").value = (window.state.students[name] || []).join("\n");
      window.$("#editor-students-textarea").disabled = false;
    };
    item.oncontextmenu = (e) => { e.preventDefault(); window.showEditorContextMenu(e, 'class', name, item); };
    editorClassesList.appendChild(item);
  });
}

export async function moveClassOrder(fromIndex, toIndex) {
  if (toIndex < 0 || toIndex >= window.state.classOrder.length) return;
  const [item] = window.state.classOrder.splice(fromIndex, 1);
  window.state.classOrder.splice(toIndex, 0, item);
  try { await window.saveClassOrderSync(); } catch (e) { console.error("Failed to reorder class:", e); }
  window.populateEditorClasses();
}

export function populateEditorSubjects() {
  const editorSubjectsList = window.$("#editor-subjects-list");
  if (!editorSubjectsList) return;
  editorSubjectsList.innerHTML = "";
  [...window.state.subjects].sort().forEach(name => {
    const item = document.createElement("div");
    item.className = "editor-list-item";
    item.textContent = name;
    item.dataset.subjectName = name;
    item.oncontextmenu = (e) => { e.preventDefault(); window.showEditorContextMenu(e, 'subject', name, item); };
    editorSubjectsList.appendChild(item);
  });
}

export async function showEditorContextMenu(e, type, name, itemElement) {
  const isClass = type === 'class';
  const menuItems = [
    {
      label: isClass ? "Видалити клас..." : "Видалити предмет...",
      click: async () => {
        const confirmMessage = `Ви впевнені, що хочете видалити "${name}"?\n\nЦю дію неможливо скасувати.`;
        const confirmed = await window.showCustomConfirm("Підтвердження видалення", confirmMessage, "Видалити", "Скасувати", true);
        if (confirmed) {
          if (isClass) {
            delete window.state.students[name];
            const index = window.state.classOrder.indexOf(name);
            if (index > -1) window.state.classOrder.splice(index, 1);
            try { await window.saveStudentsSync(); await window.saveClassOrderSync(); } catch (e) { console.error("Failed to delete class:", e); }
            window.populateEditorClasses();
            if (activeClassForEditing === name) {
              activeClassForEditing = null;
              window.$("#editor-students-textarea").value = "";
              window.$("#editor-students-textarea").disabled = true;
            }
          } else {
            const index = window.state.subjects.indexOf(name);
            if (index > -1) window.state.subjects.splice(index, 1);
            try { await window.saveSubjectsSync(); } catch (e) { console.error("Failed to delete subject:", e); }
            window.populateEditorSubjects();
          }
        }
      }
    }
  ];
  window.createContextMenu(e, menuItems);
}

export function bindEditorPageLogic() {
  window.$("#editor-add-class").onclick = async () => {
    const input = window.$("#editor-new-class-name"), newName = input.value.trim();
    if (newName) {
      if (window.state.students[newName]) { 
        await window.showCustomAlert("Помилка", "Клас з такою назвою вже існує."); 
        return; 
      }
      window.state.students[newName] = [];
      window.state.classOrder.push(newName);
      try { await window.saveStudentsSync(); await window.saveClassOrderSync(); } catch (e) { console.error("Failed to add class:", e); }
      activeClassForEditing = newName; 
      window.populateEditorClasses();
      window.$("#editor-students-textarea").value = "";
      window.$("#editor-students-textarea").disabled = false;
      input.value = ""; 
    }
  };
  window.$("#editor-add-subject").onclick = async () => {
    const input = window.$("#editor-new-subject-name"), newName = input.value.trim();
    if (newName) {
      if (window.state.subjects.includes(newName)) { 
        await window.showCustomAlert("Помилка", "Предмет з такою назвою вже існує."); 
        return; 
      }
      window.state.subjects.push(newName);
      try { await window.saveSubjectsSync(); } catch (e) { console.error("Failed to add subject:", e); }
      window.populateEditorSubjects();
      input.value = ""; 
    }
  };
  window.$("#editor-save-students").onclick = async () => {
    if (activeClassForEditing) {
      const studentsList = window.$("#editor-students-textarea").value.split('\n').map(s => s.trim()).filter(Boolean); 
      window.state.students[activeClassForEditing] = [...new Set(studentsList)];
      try { 
        await window.saveStudentsSync(); 
        await window.showCustomAlert("Успіх", `Список учнів для класу "${activeClassForEditing}" збережено.`);
      } 
      catch (e) { 
        console.error("Failed to save students:", e); 
        await window.showCustomAlert("Помилка", "Помилка збереження учнів."); 
      }
    } else {
      await window.showCustomAlert("Увага", "Спочатку оберіть клас.");
    }
  };
}