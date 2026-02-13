// === ФАЙЛ: electron/main.js (Оновлено) ===
const { app, BrowserWindow, ipcMain, dialog, shell, net } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const ExcelJS = require("exceljs");
const { Document, Packer, Paragraph, TextRun, ImageRun } = require("docx");
const AdmZip = require("adm-zip");

const auth = require("./auth_handler.js");

let win;
function ensureDirs(){
  const root = path.join(app.getPath("appData"), "TeacherJournalPortable");
  const files = path.join(root, "files");
  if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive:true });
  if (!fs.existsSync(files)) fs.mkdirSync(files, { recursive:true });
  return { 
    root, 
    files, 
    lessonsPath: path.join(root, "lessons.json"),
    studentsPath: path.join(root, "students.json"),
    subjectsPath: path.join(root, "subjects.json"),
    settingsPath: path.join(root, "settings.json"),
    testsPath: path.join(root, "tests.json"),
    notesPath: path.join(root, "notes.json"),
    classOrderPath: path.join(root, "classOrder.json"),
    reportsPath: path.join(root, "reports.json"),
    attemptsPath: path.join(root, "attempts.json"),
    boardsPath: path.join(root, "boards.json")
  };
}
const paths = ensureDirs();
auth.init(paths.root); 

// === Керування вікном Дошки ===
let boardWindow = null;
async function createBoardWindow(boardPath) {
  if (boardWindow) {
    boardWindow.focus();
    return;
  }
  
  boardWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"), 
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  boardWindow.loadFile(path.join(__dirname, "../board_app/board.html"));
  
  boardWindow.webContents.on('did-finish-load', () => {
    boardWindow.webContents.send('board-init-data', boardPath);
  });

  boardWindow.on("close", (e) => {});

  boardWindow.on("closed", () => {
    boardWindow = null;
  });
}
// === КІНЕЦЬ БЛОКУ ДОШКИ ===


// === Головне вікно ===
function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 940,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: false, 
    icon: path.join(__dirname, "../assets/icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true
    },
  });

  win.loadFile("index.html");
  // win.webContents.openDevTools();

  win.webContents.on('context-menu', (event, params) => {
    if (params.dictionarySuggestions && params.dictionarySuggestions.length > 0) {
      win.webContents.send("show-context-menu", { 
        type: "spellcheck", 
        suggestions: params.dictionarySuggestions,
        x: params.x,
        y: params.y
      });
    } else if (params.isEditable) {
      win.webContents.send("show-context-menu", { 
        type: "edit",
        x: params.x,
        y: params.y
      });
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// === IPC: Системні ===
ipcMain.handle("tj:win-min", () => win.minimize());
ipcMain.handle("tj:win-max", () => (win.isMaximized() ? win.unmaximize() : win.maximize()));

ipcMain.handle("tj:win-close", async () => {
  try {
    const profile = await auth.getUserProfile();
    if (profile) {
      console.log("Hiding window and syncing data before exit...");
      if (win) win.hide();
      if (boardWindow) boardWindow.hide(); 
      try {
        createZipBackup(CLOUD_BACKUP_PATH); 
        await auth.syncUpload(CLOUD_BACKUP_PATH); 
        try { fs.unlinkSync(CLOUD_BACKUP_PATH); } catch(e){} 
        console.log("Sync on exit successful.");
      } catch (syncErr) {
        console.error("Sync on exit failed, but quitting anyway:", syncErr.message);
      }
      app.quit();
    } else {
      console.log("User not logged in, closing normally.");
      app.quit(); 
    }
  } catch (authErr) {
    console.log("User not logged in (auth error), closing normally.");
    app.quit(); 
  }
});


// === IPC: Дошка ===
ipcMain.handle("tj:board-win-min", () => boardWindow?.minimize());
ipcMain.handle("tj:board-win-max", () => (boardWindow?.isMaximized() ? boardWindow.unmaximize() : boardWindow.maximize()));
ipcMain.handle("tj:board-win-close", () => boardWindow?.close());
ipcMain.handle("tj:open-board-window", (e, boardPath) => createBoardWindow(boardPath));

// === IPC: Файли ===
ipcMain.handle("tj:get-paths", () => paths);

ipcMain.handle("tj:read-json", async (e, p) => {
  try {
    if (!fs.existsSync(p)) return null;
    const data = await fs.promises.readFile(p, "utf-8");
    return JSON.parse(data);
  } catch (err) { console.error(`Failed to read ${p}:`, err); return null; }
});

ipcMain.handle("tj:write-json", async (e, p, d) => {
  try {
    await fs.promises.writeFile(p, JSON.stringify(d, null, 2), "utf-8");
    return true;
  } catch (err) { console.error(`Failed to write ${p}:`, err); return false; }
});

ipcMain.handle("tj:choose-files", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    properties: ["openFile", "multiSelections"]
  });
  if (canceled) return []; return filePaths;
});

ipcMain.handle("tj:choose-folder", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    properties: ["openDirectory"]
  });
  if (canceled) return null; return filePaths[0];
});

ipcMain.handle("tj:add-files", async (e, filePaths) => {
  const added = [];
  for (const p of filePaths) {
    const fn = `file_${Date.now()}_${path.basename(p)}`;
    const dest = path.join(paths.files, fn);
    try {
      await fs.promises.copyFile(p, dest);
      added.push({ original_path: p, original_name: path.basename(p), saved_path: dest, type:"file" });
    } catch (err) { console.error("Failed to add file:", err); }
  }
  return added;
});

ipcMain.handle("tj:open-path", (e, p) => shell.openPath(p));
ipcMain.handle("tj:delete-path", async (e, p) => {
  try {
    if (fs.existsSync(p)) await fs.promises.unlink(p);
    return true;
  } catch (err) { console.error("Failed to delete file:", err); return false; }
});

ipcMain.handle("tj:read-file-as-dataurl", async (e) => {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    properties: ["openFile"],
    filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp"] }]
  });
  if (canceled) return null;
  
  try {
    const data = await fs.promises.readFile(filePaths[0]);
    const ext = path.extname(filePaths[0]).toLowerCase();
    let mime = "image/jpeg";
    if (ext === ".png") mime = "image/png";
    else if (ext === ".gif") mime = "image/gif";
    else if (ext === ".webp") mime = "image/webp";
    return `data:${mime};base64,${data.toString("base64")}`;
  } catch (err) {
    return { error: err.message };
  }
});

// === IPC: Експорт ===

// === ЗМІНА №1: Додано діалог збереження ===
ipcMain.handle("tj:show-save-dialog", async (e, options) => {
  return await dialog.showSaveDialog(win, options);
});
// =======================================

ipcMain.handle("tj:write-csv", async (e, p, txt) => {
  try {
    await fs.promises.writeFile(p, "\uFEFF" + txt, "utf-8");
    return true;
  } catch (err) { return { error: err.message }; }
});

// === ЗМІНА №2: Оновлено логіку ширини колонок для XLSX ===
ipcMain.handle("tj:write-xlsx", async (e, p, sheetsData) => {
  const workbook = new ExcelJS.Workbook();
  
  for (const [sheetName, rows] of Object.entries(sheetsData)) {
    if (!rows || rows.length === 0) continue; 
    
    const sheet = workbook.addWorksheet(sheetName);
    
    // Нова логіка ширини
    sheet.columns = Object.keys(rows[0]).map(key => ({ 
      header: key, 
      key: key, 
      width: (key === "Учень" ? 30 : (key.includes("(Прим.)") ? 25 : 12))
    }));
    
    sheet.addRows(rows);
  }
  
  try {
    await workbook.xlsx.writeFile(p);
    return true;
  } catch (err) { return { error: err.message }; }
});

// Експорт Тестів (DOCX) (без змін, помилку дублювання виправлено минулого разу)
ipcMain.handle("tj:export-test-docx", async (e, p, arg1, arg2) => {
  try {
    let testTitle = "Тест";
    let questionsList = [];
    let isTeacher = false;

    // 1. РОЗУМНИЙ ПАРСЕР ДАНИХ (вгадуємо, що саме передав додаток)
    if (arg1 && typeof arg1 === 'object' && Array.isArray(arg1.questions)) {
        // Додаток передав весь об'єкт тесту повністю + режим
        testTitle = arg1.title || "Тест";
        questionsList = arg1.questions;
        isTeacher = arg2 === true || arg2 === "teacher";
    } else if (typeof arg1 === 'string') {
        testTitle = arg1;
        if (Array.isArray(arg2)) {
            questionsList = arg2; 
        } else if (arg2 && typeof arg2 === 'object') {
            questionsList = arg2.questions || Object.values(arg2);
        } else if (typeof arg2 === 'string') {
            try {
                let parsed = JSON.parse(arg2);
                questionsList = Array.isArray(parsed) ? parsed : (parsed.questions || []);
            } catch(err) {}
        }
    }

    // Відсіюємо порожні елементи
    questionsList = questionsList.filter(q => q && typeof q === 'object');

    const docElements = [];

    // 2. Шапка тесту
    docElements.push(new Paragraph({
      children: [new TextRun({ text: testTitle, bold: true, size: 32 })],
      alignment: "center",
      spacing: { after: 300 }
    }));

    // 3. Поля ПІБ або Позначка для вчителя
    if (!isTeacher) {
        docElements.push(new Paragraph({
          children: [
            new TextRun({ text: "ПІБ: ________________________________________   Клас: _______   Дата: ________", size: 24 })
          ],
          spacing: { after: 600 }
        }));
    } else {
        docElements.push(new Paragraph({
          children: [
            new TextRun({ text: "ВАРІАНТ ДЛЯ ВЧИТЕЛЯ (з відповідями)", bold: true, color: "FF0000", size: 24 })
          ],
          spacing: { after: 600 },
          alignment: "center"
        }));
    }

    // 4. Формуємо список питань
    questionsList.forEach((q, index) => {
      let rawText = q.text || q.question || q.title || "Питання без тексту";
      let cleanText = String(rawText).replace(/^\d+[\.\)]\s*/, '');

      // Текст питання
      docElements.push(new Paragraph({
        children: [
          new TextRun({ text: `${index + 1}. `, bold: true, size: 24 }),
          new TextRun({ text: cleanText, size: 24 })
        ],
        spacing: { before: 240, after: 120 }
      }));

      // ФОТОГРАФІЯ (якщо є)
      let imgDataUrl = q.image || q.img || q.picture || q.photo;
      if (imgDataUrl && typeof imgDataUrl === 'string' && imgDataUrl.includes('base64,')) {
         try {
           const base64Data = imgDataUrl.split('base64,')[1];
           const imageBuffer = Buffer.from(base64Data, 'base64');
           docElements.push(new Paragraph({
             children: [
               new ImageRun({
                 data: imageBuffer,
                 transformation: { width: 300, height: 200 } // Стандартний розмір фото в Word
               })
             ],
             alignment: "center",
             spacing: { after: 120 }
           }));
         } catch(err) {
             console.error("Не вдалося обробити фото", err);
         }
      }

      // Варіанти відповідей
      let options = q.options || q.answers || q.variants || [];
      if (Array.isArray(options) && options.length > 0) {
        const letters = ["А", "Б", "В", "Г", "Д", "Е", "Є", "Ж", "З", "И", "І"];

        options.forEach((opt, optIndex) => {
          const letter = letters[optIndex] || "-";

          let optText = "";
          let isCorrect = false;

          if (typeof opt === 'string') {
              optText = opt;
          } else if (typeof opt === 'object') {
              optText = opt.text || opt.value || opt.answer || "";
              isCorrect = opt.correct === true || opt.isCorrect === true;
          }

          let runProps = { size: 24 };
          let bulletText = `    ${letter}) `;

          // Якщо режим вчителя і це правильна відповідь - виділяємо!
          if (isTeacher && isCorrect) {
              runProps.bold = true;
              runProps.color = "008000"; // Зелений колір
              optText += "  ✓ Правильна";
          }

          docElements.push(new Paragraph({
            children: [
              new TextRun({ text: bulletText, bold: true, size: 24 }),
              new TextRun({ text: String(optText), ...runProps })
            ],
            spacing: { after: 80 }
          }));
        });
      } else {
         // Лінії для відкритих питань (якщо немає варіантів відповідей)
         docElements.push(new Paragraph({
            children: [new TextRun({ text: "    Відповідь: _________________________________________________________", size: 24 })],
            spacing: { after: 200 }
         }));
         if (!isTeacher) {
             docElements.push(new Paragraph({
                children: [new TextRun({ text: "    ____________________________________________________________________", size: 24 })],
                spacing: { after: 200 }
             }));
         }
      }
    });

    const doc = new Document({ sections: [{ properties: {}, children: docElements }] });
    const buffer = await Packer.toBuffer(doc);
    const fs = require('fs');
    fs.writeFileSync(p, buffer);

    return true;
  } catch (err) {
    console.error("Помилка експорту Docx:", err);
    return false;
  }
});


// === IPC: Google Auth & Cloud Sync ===
ipcMain.handle("tj:google-auth-start", async () => auth.startAuth());
ipcMain.handle("tj:google-logout", async () => auth.logout());
ipcMain.handle("tj:google-get-profile", async () => auth.getUserProfile());
ipcMain.handle("tj:google-get-backup-meta", async () => auth.getBackupMetadata());

// Функція для створення ZIP-архіву
function createZipBackup(targetPath) {
  try {
    const zip = new AdmZip();
    const addFileIfExists = (filePath) => {
      if (fs.existsSync(filePath)) {
        zip.addLocalFile(filePath);
      } else {
        console.warn(`Warning: File not found during backup, skipping: ${filePath}`);
      }
    };
    
    addFileIfExists(paths.lessonsPath);
    addFileIfExists(paths.studentsPath);
    addFileIfExists(paths.subjectsPath);
    addFileIfExists(paths.settingsPath);
    addFileIfExists(paths.testsPath);
    addFileIfExists(paths.notesPath);
    addFileIfExists(paths.classOrderPath);
    addFileIfExists(paths.reportsPath);
    addFileIfExists(paths.attemptsPath);
    addFileIfExists(paths.boardsPath);

    if (fs.existsSync(paths.files)) {
      zip.addLocalFolder(paths.files, "files");
    }
    zip.writeZip(targetPath);
  } catch (err) {
    console.error("Failed to create ZIP backup:", err);
    throw err;
  }
}

ipcMain.handle("tj:backup-create", async () => {
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    defaultPath: `TeacherJournal_Backup_${new Date().toISOString().split('T')[0]}.zip`,
    filters: [{ name: "ZIP Archives", extensions: ["zip"] }]
  });
  if (canceled) return false;
  
  try {
    createZipBackup(filePath);
    shell.showItemInFolder(filePath);
    return true;
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle("tj:backup-restore", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    properties: ["openFile"],
    filters: [{ name: "ZIP Archives", extensions: ["zip"] }]
  });
  if (canceled) return false;
  
  try {
    const zip = new AdmZip(filePaths[0]);
    if (fs.existsSync(paths.files)) {
      fs.rmSync(paths.files, { recursive: true, force: true });
    }
    fs.mkdirSync(paths.files, { recursive: true });
    
    zip.extractAllTo(paths.root, true /* overwrite */);
    
    app.relaunch();
    app.exit();
    return true;
  } catch (err) {
    return { error: err.message };
  }
});


// === IPC: Хмарна синхронізація ===
const CLOUD_BACKUP_PATH = path.join(paths.root, "cloud_backup.zip");

ipcMain.handle("tj:cloud-sync-upload", async () => {
  try {
    
    let lessonsData = [];
    let studentsData = {};
    try {
      if (fs.existsSync(paths.lessonsPath)) {
        const content = fs.readFileSync(paths.lessonsPath, "utf-8");
        if (content) lessonsData = JSON.parse(content);
      }
      if (fs.existsSync(paths.studentsPath)) {
        const content = fs.readFileSync(paths.studentsPath, "utf-8");
        if (content) studentsData = JSON.parse(content);
      }
    } catch (e) {
      console.warn("Could not parse local data for safety check:", e.message);
    }

    const isLessonsEmpty = !Array.isArray(lessonsData) || lessonsData.length === 0;
    const isStudentsEmpty = typeof studentsData !== 'object' || Object.keys(studentsData).length === 0;

    if (isLessonsEmpty && isStudentsEmpty) {
      console.warn("Upload blocked: Local data appears empty. Aborting to prevent data loss.");
      return { error: "LOCAL_DATA_EMPTY" };
    }

    createZipBackup(CLOUD_BACKUP_PATH);
    await auth.syncUpload(CLOUD_BACKUP_PATH);
    try { fs.unlinkSync(CLOUD_BACKUP_PATH); } catch(e){}
    return { success: true, date: new Date().toISOString() };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle("tj:cloud-sync-download", async () => {
  try {
    await auth.syncDownload(CLOUD_BACKUP_PATH);
    const zip = new AdmZip(CLOUD_BACKUP_PATH);
    
    if (fs.existsSync(paths.files)) {
      fs.rmSync(paths.files, { recursive: true, force: true });
    }
    fs.mkdirSync(paths.files, { recursive: true });
    zip.extractAllTo(paths.root, true);
    
    try { fs.unlinkSync(CLOUD_BACKUP_PATH); } catch(e){}

    app.relaunch();
    app.exit();
    return { success: true };
  } catch (err) {
    return { error: err.message };
  }
});