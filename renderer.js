// === ФАЙЛ: renderer.js ===
import { debounce, showCustomAlert, showCustomConfirm, showTestStartDialog, createContextMenu, closeContextMenu, showTextEditContextMenu, showPasswordPrompt, sanitizeHTML, hashPassword, verifyPassword } from './utils.js';
import { openTab, setActive, closeTab } from './navigation.js';
import { renderHome, showCalendarContextMenu } from './module_home.js';
import { renderLesson, renderLessonsList, openOrCreateLesson, renderNewLessonDialog, showLessonListContextMenu } from './module_lessons.js';
import { renderEditorPage, populateEditorClasses, moveClassOrder, populateEditorSubjects, showEditorContextMenu, bindEditorPageLogic } from './module_students.js';
import { renderTests, renderTestResults, renderRunTest, calcScore, previewImage, refreshTestsIfOpen } from './module_tests.js';
import { renderReportPage, populateReportPageFilters, bindReportPageLogic, generateReportHTML } from './module_reports.js';
import { renderNotesPage } from './module_notes.js';
import { renderSettings, updateGoogleAuthStatusUI } from './settings_app/module_settings.js';
import { renderExportPage } from './module_export.js';
import { renderBoardPage, createNewBoard } from './board_app/module_board.js';
import { renderSchedulePage } from './module_schedule.js';
import { renderClassJournalPage } from './module_class_journal.js';
import { renderCurriculumPage } from './module_curriculum.js';

window.$ = (s,el=document) => el.querySelector(s);
window.$$ = (s,el=document) => Array.from(el.querySelectorAll(s));
window.esc = (str) => String(str || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
window.css = (str) => str.replace(/[^a-zA-Z0-9_-]/g, '_');

(function(){
  function overlay(msg, stack){
    const d=document.createElement("div");
    d.style.cssText="position:fixed;inset:0;background:#0b0c0f;color:#fff;font:14px Segoe UI,Arial;z-index:999999;overflow:auto;padding:18px";
    d.innerHTML = `<div style="font-size:24px;color:#e74c3c;margin-bottom:12px">Unhandled Error</div><div style="font-size:16px;margin-bottom:8px">${window.esc(msg)}</div><pre style="font:12px consolas,monospace;line-height:1.6;color:#cdd2d8">${window.esc(stack)}</pre>`;
    document.body.appendChild(d);
  }
  window.onerror = (msg, url, line, col, err) => overlay(msg, err? err.stack : `at ${url}:${line}:${col}`);
  window.onunhandledrejection = (e) => overlay(e.reason.message, e.reason.stack);
})();

window.mainHeader = null; window.tabsEl = null; window.areaEl = null; window.navBtns = [];
window.active = "home"; window.activeTimers = {}; window.state = {}; window.currentDisplayDate = new Date();
window.paths = {}; window.auth = { profile: null };

window.debounce = debounce; window.showCustomAlert = showCustomAlert; window.showCustomConfirm = showCustomConfirm;
window.showTestStartDialog = showTestStartDialog; window.createContextMenu = createContextMenu; window.closeContextMenu = closeContextMenu;
window.showTextEditContextMenu = showTextEditContextMenu; window.showPasswordPrompt = showPasswordPrompt;
window.openTab = openTab; window.setActive = setActive; window.closeTab = closeTab;
window.renderHome = renderHome; window.renderLesson = renderLesson; window.renderLessonsList = renderLessonsList;
window.openOrCreateLesson = openOrCreateLesson; window.renderNewLessonDialog = renderNewLessonDialog;
window.renderEditorPage = renderEditorPage; window.populateEditorClasses = populateEditorClasses; window.moveClassOrder = moveClassOrder;
window.populateEditorSubjects = populateEditorSubjects; window.showEditorContextMenu = showEditorContextMenu; window.bindEditorPageLogic = bindEditorPageLogic;
window.renderTests = renderTests; window.renderTestResults = renderTestResults; window.renderRunTest = renderRunTest; window.calcScore = calcScore; window.previewImage = previewImage; window.refreshTestsIfOpen = refreshTestsIfOpen;
window.renderReportPage = renderReportPage; window.populateReportPageFilters = populateReportPageFilters; window.bindReportPageLogic = bindReportPageLogic; window.generateReportHTML = generateReportHTML;
window.renderNotesPage = renderNotesPage; window.renderSettings = renderSettings; window.renderExportPage = renderExportPage;
window.renderBoardPage = renderBoardPage; window.createNewBoard = createNewBoard;
window.showCalendarContextMenu = showCalendarContextMenu; window.showLessonListContextMenu = showLessonListContextMenu;
window.sanitizeHTML = sanitizeHTML;
window.renderSchedulePage = renderSchedulePage;
window.renderClassJournalPage = renderClassJournalPage;
window.renderCurriculumPage = renderCurriculumPage;

// === "ЗАПОБІЖНИК" (Нова функція) ===
async function handleAutoSyncResult(res, isLoginAttempt = false) {
  if (res && res.error === "LOCAL_DATA_EMPTY") {
    console.warn("Auto-sync upload blocked: Local data is empty.");
    const cloudMeta = await window.tj.googleGetBackupMeta();
    
    if (cloudMeta && cloudMeta.id) {
      const confirmed = await window.showCustomConfirm(
        "Знайдено хмарну копію",
        `Ваші локальні дані порожні, але на Google Drive є резервна копія (від ${new Date(cloudMeta.modifiedTime).toLocaleString("uk-UA")}).\n\nБажаєте завантажити її і відновити дані?`,
        "Так, завантажити",
        "Ні, пропустити",
        false 
      );
      
      if (confirmed) {
        const downloadRes = await window.tj.cloudSyncDownload();
        if (downloadRes?.error) {
          await window.showCustomAlert("Помилка завантаження", downloadRes.error);
        }
      }
    } else if (isLoginAttempt) {
      await window.showCustomAlert("Синхронізація", "Новий акаунт. Ваші дані будуть вивантажені при наступній синхронізації.");
    }
  } else if (res && res.error === "CLOUD_IS_NEWER") {
    console.log("Auto-sync skipped: cloud copy is newer than local data.");
  } else if (res && res.error) {
    console.error("Auto-sync error:", res.error);
    if (isLoginAttempt) {
      await window.showCustomAlert("Помилка синхронізації", res.error);
    }
  } else if (res && res.success) {
    console.log("Auto-sync successful.");
    if (isLoginAttempt) {
       await window.showCustomAlert("Синхронізація", "Дані успішно вивантажено у хмару.");
    }
  }
}

document.addEventListener('DOMContentLoaded', init);

async function init(){
  console.log("Renderer init");
  window.mainHeader = window.$("#main-header-greeting");
  window.tabsEl = window.$("#tabs");
  window.areaEl = window.$("#area");
  window.paths = await window.tj.getPaths();
  
  const DEFAULT_SETTINGS = {
    teacherPassword: null,
    autoSync: true,
    navOrder: ['nav-lessons', 'nav-students', 'nav-reports', 'nav-tests', 'nav-board', 'nav-notes', 'nav-schedule', 'nav-classjournal', 'nav-curriculum'],
    schoolYear: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
    semesters: [
      { name: "I семестр", startDate: `${new Date().getFullYear()}-09-01`, endDate: `${new Date().getFullYear()}-12-31` },
      { name: "II семестр", startDate: `${new Date().getFullYear() + 1}-01-15`, endDate: `${new Date().getFullYear() + 1}-05-31` }
    ],
    gradingScale: "12",
    lockTimeout: 0,
    teacherProfile: {
      fullName: "", school: "", position: "Вчитель",
      category: "", title: "", experience: ""
    },
    telegramBotEnabled: false,
    telegramBotToken: ""
  };

  const loadedSettings = (await window.tj.readJSON(window.paths.settingsPath)) || {};
  const migratedSettings = { ...DEFAULT_SETTINGS, ...loadedSettings };
  if (!migratedSettings.semesters) migratedSettings.semesters = DEFAULT_SETTINGS.semesters;
  if (!migratedSettings.teacherProfile) migratedSettings.teacherProfile = DEFAULT_SETTINGS.teacherProfile;
  else migratedSettings.teacherProfile = { ...DEFAULT_SETTINGS.teacherProfile, ...migratedSettings.teacherProfile };
  const newNavIds = ['nav-schedule', 'nav-classjournal', 'nav-curriculum'];
  newNavIds.forEach(id => { if (!migratedSettings.navOrder.includes(id)) migratedSettings.navOrder.push(id); });
  if (migratedSettings.telegramBotEnabled === undefined) migratedSettings.telegramBotEnabled = DEFAULT_SETTINGS.telegramBotEnabled;
  if (migratedSettings.telegramBotToken === undefined) migratedSettings.telegramBotToken = DEFAULT_SETTINGS.telegramBotToken;

  window.state = {
    lessons: (await window.tj.readJSON(window.paths.lessonsPath)) || [],
    students: (await window.tj.readJSON(window.paths.studentsPath)) || {},
    subjects: (await window.tj.readJSON(window.paths.subjectsPath)) || [],
    settings: migratedSettings,
    tests: (await window.tj.readJSON(window.paths.testsPath)) || [],
    notes: (await window.tj.readJSON(window.paths.notesPath)) || {},
    classOrder: (await window.tj.readJSON(window.paths.classOrderPath)) || [],
    boards: (await window.tj.readJSON(window.paths.boardsPath)) || [],
    attempts: (await window.tj.readJSON(window.paths.attemptsPath)) || [],
    reports: (await window.tj.readJSON(window.paths.reportsPath)) || [],
    schedule: (await window.tj.readJSON(window.paths.schedulePath)) || [],
    curriculum: (await window.tj.readJSON(window.paths.curriculumPath)) || []
  };

  window.$("#win-min").onclick = ()=> window.tj.winMin();
  window.$("#win-max").onclick = ()=> window.tj.winMax();
  window.$("#win-close").onclick = ()=> window.tj.winClose();
  
  const syncClassOrder = () => {
    const classNames = Object.keys(window.state.students);
    const order = window.state.classOrder;
    let changed = false;
    for (const c of classNames) { if (!order.includes(c)) { order.push(c); changed = true; } }
    window.state.classOrder = order.filter(c => { const exists = classNames.includes(c); if (!exists) changed = true; return exists; });
    if (changed) window.saveClassOrder();
  };
  await syncClassOrder();
  
  // === ВАША ЛОГІКА СОРТУВАННЯ МЕНЮ ===
  window.reorderNav();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Доброго ранку" : hour < 18 ? "Доброго дня" : "Доброго вечора";
  const teacherName = window.state.settings.teacherProfile?.fullName;
  const displayName = teacherName ? `, ${teacherName.split(' ')[0]}` : ", вчителю";
  window.mainHeader.innerHTML = `<h1>${greeting}${displayName}!</h1>`;

  renderHome(); bindNav();

  document.addEventListener('mousedown', (e) => { if (window.activeContextMenu && !e.target.closest('.ctx-menu')) window.closeContextMenu(); });
  document.addEventListener("contextmenu", (e) => { if (!e.target.matches('textarea, input[type="text"], input[type="password"], input:not([type])') && !e.target.isContentEditable) e.preventDefault(); });
  window.tj.on("show-context-menu", (e) => {
    if (e.type === "spellcheck") window.createContextMenu(e, e.suggestions.map(s => ({ label: s, click: () => document.execCommand("insertText", false, s) })));
    else if (e.type === "edit") window.showTextEditContextMenu(e);
  });

  await checkGoogleLogin();

  window.tj.on("tj:data-changed", async (payload) => {
    if (!payload || payload.kind !== "attempts") return;
    window.state.attempts = (await window.tj.readJSON(window.paths.attemptsPath)) || [];
    refreshTestsIfOpen();
  });

  setInterval(async () => {
    if (window.auth.profile && window.state.settings.autoSync) {
       console.log("Performing background auto-sync...");
       // === "ЗАПОБІЖНИК" (Оновлено) ===
       const res = await window.tj.cloudSyncUpload();
       await handleAutoSyncResult(res, false); 
       // === КІНЕЦЬ ===
       if (window.active === 'settings') window.renderSettings();
    }
  }, 15 * 60 * 1000);
}

// === ВАША ФУНКЦІЯ СОРТУВАННЯ МЕНЮ ===
window.reorderNav = function() {
  const container = window.$("#nav-sidebar");
  const homeBtn = window.$("#nav-home");
  const order = window.state.settings.navOrder || ['nav-lessons', 'nav-students', 'nav-reports', 'nav-tests', 'nav-board', 'nav-notes'];
  
  let refNode = homeBtn;
  order.forEach(id => {
      const btn = window.$("#" + id);
      if (btn && container.contains(btn)) {
          container.insertBefore(btn, refNode.nextSibling);
          refNode = btn; 
      }
  });
};

function bindNav(){
  window.navBtns = window.$$(".nav-btn"); 
  window.$("#nav-home").onclick = () => renderHome();
  window.$("#nav-lessons").onclick = () => openTab("lessons", "Уроки", renderLessonsList);
  window.$("#nav-students").onclick = () => openTab("students", "Учні", renderEditorPage);
  window.$("#nav-reports").onclick = () => openTab("reports", "Звіти", renderReportPage);
  window.$("#nav-tests").onclick = () => openTab("tests", "Тести", renderTests);
  window.$("#nav-board").onclick = () => openTab("board", "Дошки", renderBoardPage);
  window.$("#nav-notes").onclick = () => openTab("notes", "Замітки", renderNotesPage);
  window.$("#nav-schedule").onclick = () => openTab("schedule", "Розклад", renderSchedulePage);
  window.$("#nav-classjournal").onclick = () => openTab("classjournal", "Класний журнал", renderClassJournalPage);
  window.$("#nav-curriculum").onclick = () => openTab("curriculum", "КТП", renderCurriculumPage);
  window.$("#nav-export-menu-btn").onclick = () => openTab("export", "Експорт", renderExportPage);
  window.$("#btn-settings").onclick = () => openTab("settings", "Налаштування", renderSettings);
  window.$("#nav-toggle-btn").onclick = () => window.$("#nav-sidebar").classList.toggle("collapsed");
  window.$("#nav-lock-btn").onclick = async (e) => {
    const btn = e.currentTarget;
    if (btn.classList.contains("locked")) return;
    if (!window.state.settings.teacherPassword) return await showCustomAlert("Помилка", "Пароль не встановлено.");
    btn.classList.add("locked"); btn.querySelector("span:first-child").textContent = "🔒"; btn.querySelector("span:last-child").textContent = "Розблокувати";
    const overlay = document.createElement("div"); overlay.className = "lock-overlay"; overlay.innerHTML = `<h1>🔒</h1><p>Натисніть, щоб розблокувати</p>`;
    document.body.appendChild(overlay);
    overlay.onclick = async () => { if (await window.showPasswordPrompt("Розблокування", window.state.settings.teacherPassword)) { overlay.remove(); btn.classList.remove("locked"); btn.querySelector("span:first-child").textContent = "🔓"; btn.querySelector("span:last-child").textContent = "Блокувати"; } };
  };
}

window.saveLessons = debounce(()=> window.tj.writeJSON(window.paths.lessonsPath, window.state.lessons));
window.saveStudents = debounce(()=> window.tj.writeJSON(window.paths.studentsPath, window.state.students));
window.saveSubjects = debounce(()=> window.tj.writeJSON(window.paths.subjectsPath, window.state.subjects));
window.saveSettings = debounce(()=> window.tj.writeJSON(window.paths.settingsPath, window.state.settings));
window.saveTests = debounce(()=> window.tj.writeJSON(window.paths.testsPath, window.state.tests));
window.saveNotes = debounce(()=> window.tj.writeJSON(window.paths.notesPath, window.state.notes));
window.saveClassOrder = debounce(()=> window.tj.writeJSON(window.paths.classOrderPath, window.state.classOrder));
window.saveReports = debounce(()=> window.tj.writeJSON(window.paths.reportsPath, window.state.reports));
window.saveAttempts = debounce(()=> window.tj.writeJSON(window.paths.attemptsPath, window.state.attempts));
window.saveBoards = debounce(()=> window.tj.writeJSON(window.paths.boardsPath, window.state.boards));
window.saveSchedule = debounce(()=> window.tj.writeJSON(window.paths.schedulePath, window.state.schedule));
window.saveCurriculum = debounce(()=> window.tj.writeJSON(window.paths.curriculumPath, window.state.curriculum));
window.saveSettingsSync = ()=> window.tj.writeJSON(window.paths.settingsPath, window.state.settings);
window.saveStudentsSync = ()=> window.tj.writeJSON(window.paths.studentsPath, window.state.students);
window.saveSubjectsSync = ()=> window.tj.writeJSON(window.paths.subjectsPath, window.state.subjects);
window.saveClassOrderSync = ()=> window.tj.writeJSON(window.paths.classOrderPath, window.state.classOrder);
window.saveTestsSync = ()=> window.tj.writeJSON(window.paths.testsPath, window.state.tests);

// === GOOGLE AUTH & SYNC ===
function updateAuthUI(profile) {
  window.auth.profile = profile;
  const el = window.$("#titlebar-profile");
  if (profile) {
    el.style.display = "flex"; el.classList.remove("logged-out"); el.onclick = null;
    el.innerHTML = `<span class="profile-name">${window.esc(profile.given_name||profile.name)}</span><img src="${window.esc(profile.picture)}" class="profile-avatar">`;
  } else {
    el.style.display = "flex"; el.classList.add("logged-out"); el.onclick = window.handleGoogleLogin;
    el.innerHTML = `Увійти`;
  }
  if (window.active === 'settings') updateGoogleAuthStatusUI();
}

async function checkGoogleLogin() {
  try {
    const profile = await window.tj.googleGetProfile();
    updateAuthUI(profile);
    if (profile && window.state.settings.autoSync) {
        console.log("Startup auto-sync...");
        // === "ЗАПОБІЖНИК" (Оновлено) ===
        const res = await window.tj.cloudSyncUpload();
        await handleAutoSyncResult(res, false); 
    }
  } catch (e) { updateAuthUI(null); }
}

window.handleGoogleLogin = async () => {
  try {
    const profile = await window.tj.googleAuthStart();
    if (profile) {
      updateAuthUI(profile);
      await window.showCustomAlert("Авторизація успішна", "Виконується первинна синхронізація (перевірка даних)...");
      
      // === "ЗАПОБІЖНИК" (Оновлено) ===
      const res = await window.tj.cloudSyncUpload();
      await handleAutoSyncResult(res, true);
      // === КІНЕЦЬ ===
      
      if (window.active === 'settings') {
         window.renderSettings();
      }
      
    } else throw new Error("Профіль не отримано.");
  } catch (e) {
    await showCustomAlert("Помилка авторизації", e.message);
    updateAuthUI(null);
  }
};

window.handleGoogleLogout = async () => {
  try { await window.tj.googleLogout(); updateAuthUI(null); } 
  catch (e) { await showCustomAlert("Помилка", "Не вдалося вийти."); }
};