export const tabRenders = {};
let draggedTab = null; // Змінна для відстеження вкладки, яку тягнуть

export function openTab(id, title, renderFn, contextData = null){ 
  window.mainHeader.style.display = "none";
  window.tabsEl.style.display = "flex"; 
  
  // === НОВЕ: Ініціалізація контейнера для перетягування (лише один раз) ===
  if (!window.tabsEl.dataset.dragInit) {
    window.tabsEl.dataset.dragInit = "true";
    
    // Додаємо слухача на весь контейнер вкладок
    window.tabsEl.addEventListener('dragover', (e) => {
      e.preventDefault(); // Це дозволяє відбутися 'drop'
      if (!draggedTab) return;

      const targetTab = e.target.closest('.tab');
      
      // Знаходимо найближчу вкладку, над якою ми знаходимось
      if (targetTab && targetTab !== draggedTab) {
        // Визначаємо, вставити до чи після
        const targetRect = targetTab.getBoundingClientRect();
        const targetMiddleX = targetRect.left + targetRect.width / 2;
        
        // Рухаємо вкладку в DOM
        if (e.clientX < targetMiddleX) {
          targetTab.parentNode.insertBefore(draggedTab, targetTab);
        } else {
          targetTab.parentNode.insertBefore(draggedTab, targetTab.nextSibling);
        }
      }
    });
  }
  // === КІНЕЦЬ НОВОГО БЛОКУ ===

  if (!window.$("#tab-"+window.css(id))) {
    const el = document.createElement("div");
    el.className="tab"; el.id="tab-"+window.css(id);
    el.innerHTML = `${title} <span class="x">×</span>`;
    el.onclick = ()=>window.setActive(id);
    window.$(".x", el).onclick = (e)=>{ e.stopPropagation(); window.closeTab(id); };

    // === НОВЕ: Додаємо логіку перетягування для КОЖНОЇ вкладки ===
    el.draggable = true;
    
    el.addEventListener('dragstart', (e) => {
      // Не дозволяємо перетягувати, якщо клікнули на 'x'
      if (e.target.classList.contains('x')) {
        e.preventDefault();
        return;
      }
      draggedTab = el;
      e.dataTransfer.effectAllowed = 'move';
      // Використовуємо setTimeout, щоб браузер встиг "сфотографувати" елемент
      setTimeout(() => {
        el.classList.add('dragging');
      }, 0);
    });
    
    el.addEventListener('dragend', () => {
      el.classList.remove('dragging');
      draggedTab = null;
    });
    // === КІНЕЦЬ НОВОГО БЛОКУ ===

    window.tabsEl.appendChild(el);
  }
  tabRenders[id] = { fn: renderFn, ctx: contextData }; 
  window.setActive(id);
}

export function setActive(id){
  window.active = id;
  window.$$(".tab", window.tabsEl).forEach(t=>t.classList.remove("active"));
  const t = window.$("#tab-"+window.css(id)); if (t) t.classList.add("active");
  window.areaEl.innerHTML = ""; 
  try {
    if (tabRenders[id]) {
      tabRenders[id].fn(tabRenders[id].ctx); 
    } else {
      // Якщо вкладка з якоїсь причини не знайдена, рендеримо Головну
      console.warn(`Не знайдено рендер для вкладки ${id}, повертаємось на Головну`);
      window.renderHome();
    }
  } catch (e) {
    console.error(e);
    window.areaEl.innerHTML = `<h3 style="color:#e74c3c">Помилка рендеру вкладки</h3><pre>${e.stack}</pre>`;
  }
}

export function closeTab(id){ 
  const el = window.$("#tab-"+window.css(id)); if (el) el.remove(); 
  delete tabRenders[id];
  
  if (window.activeTimers[id]) { 
    clearInterval(window.activeTimers[id].intervalId);
    delete window.activeTimers[id];
  }
  
  if (window.active === id) { 
    window.active=null; 
    window.areaEl.innerHTML=""; 
    
    // === ОНОВЛЕНО: Переключаємось на останню вкладку або на Головну ===
    const allTabs = window.$$(".tab", window.tabsEl);
    if (allTabs.length > 0) {
      // Активуємо останню вкладку у списку
      const lastTabId = allTabs[allTabs.length - 1].id.replace("tab-", "");
      window.setActive(lastTabId);
    } else {
      // Якщо вкладок не лишилось, показуємо Головну
      window.renderHome();
    }
  } 
}