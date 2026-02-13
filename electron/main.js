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
ipcMain.handle("tj:write-xlsx", async (e, p, data) => {
  try {
    const workbook = new ExcelJS.Workbook();

    // Допоміжна функція для стилізації аркуша
    const formatSheet = (sheet, rows) => {
      if (!rows || rows.length === 0) return;
      
      // 1. Створюємо колонки з автошириною (на основі назв)
      const columns = Object.keys(rows[0]).map(key => ({
        header: key,
        key: key,
        width: Math.max(key.length + 5, 12) 
      }));
      sheet.columns = columns;

      // 2. Додаємо дані
      rows.forEach(row => sheet.addRow(row));

      // 3. Стилізуємо заголовок (перший рядок)
      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }; // Білий жирний текст
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4F81BD' } // Приємний синій фон
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

      // 4. Додаємо рамки для всіх клітинок та вирівнювання
      sheet.eachRow((row, rowNumber) => {
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          // Рамки
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
          // Вирівнювання для даних
          if (rowNumber > 1) {
             cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
          }
        });
      });
    };

    // Перевіряємо, чи дані це масив (один аркуш) чи об'єкт (багато аркушів по класах)
    if (Array.isArray(data)) {
      const sheet = workbook.addWorksheet("Експорт");
      formatSheet(sheet, data);
    } else if (typeof data === 'object') {
      for (const [sheetName, rows] of Object.entries(data)) {
        // Назва аркуша в Excel не може перевищувати 31 символ
        const safeName = String(sheetName).substring(0, 31);
        const sheet = workbook.addWorksheet(safeName);
        formatSheet(sheet, rows);
      }
    }

    await workbook.xlsx.writeFile(p);
    return true;
  } catch (err) {
    console.error("Помилка експорту Excel:", err);
    return false;
  }
});

// Експорт Тестів (DOCX) (без змін, помилку дублювання виправлено минулого разу)
ipcMain.handle("tj:export-test-docx", async (e, p, test, mode) => {
  try {
    const children = [];
    children.push(new Paragraph({ text: test.title, heading: "Heading1" }));

    for (const [qi, q] of test.questions.entries()) {
      children.push(new Paragraph({ text: q.text, style: "ListParagraph" }));
      
      if (q.image) {
        try {
          const base64Data = q.image.split(",")[1];
          children.push(new Paragraph({
            children: [ImageRun.fromBase64(base64Data, {
              transformation: { width: 300, height: 200 },
            })]
          }));
        } catch (imgErr) { console.error("Failed to add image to DOCX", imgErr); }
      }

      if (q.type === 'text') {
        children.push(new Paragraph({ text: "\n\n____________________________________", style: "Body" }));
      } else if (q.type === 'radio' || q.type === 'check') {
        for (const [opti, opt] of q.options.entries()) {
          const prefix = (mode === 'answers' && opt.correct) ? "[X]" : "[ ]";
          children.push(new Paragraph({ text: `    ${prefix} ${opt.text}`, style: "Body" }));
        }
      }
    }

    const doc = new Document({ sections: [{ children }] });
    const buffer = await Packer.toBuffer(doc);
    await fs.promises.writeFile(p, buffer);
    return true;
  } catch (err) {
    console.error(err);
    return { error: err.message };
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