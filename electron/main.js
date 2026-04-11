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
    boardsPath: path.join(root, "boards.json"),
    schedulePath: path.join(root, "schedule.json"),
    curriculumPath: path.join(root, "curriculum.json")
  };
}
const paths = ensureDirs();
auth.init(paths.root);

function isPathSafe(targetPath) {
  const resolved = path.resolve(targetPath);
  return resolved.startsWith(paths.root + path.sep) || resolved === paths.root;
}

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

      if (!isLocalDataEmpty()) {
        createSafetyBackup("before-exit");
        try {
          createZipBackup(CLOUD_BACKUP_PATH); 
          await auth.syncUpload(CLOUD_BACKUP_PATH); 
          try { fs.unlinkSync(CLOUD_BACKUP_PATH); } catch(e){} 
          console.log("Sync on exit successful.");
        } catch (syncErr) {
          console.error("Sync on exit failed, but safety backup exists:", syncErr.message);
        }
      } else {
        console.log("Local data empty, skipping sync on exit to preserve cloud data.");
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
    if (!isPathSafe(p)) { console.error(`Path rejected: ${p}`); return null; }
    if (!fs.existsSync(p)) return null;
    const data = await fs.promises.readFile(p, "utf-8");
    return JSON.parse(data);
  } catch (err) { console.error(`Failed to read ${p}:`, err); return null; }
});

ipcMain.handle("tj:write-json", async (e, p, d) => {
  try {
    if (!isPathSafe(p)) { console.error(`Path rejected: ${p}`); return false; }
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

ipcMain.handle("tj:open-path", (e, p) => {
  if (!isPathSafe(p)) { console.error(`Path rejected: ${p}`); return; }
  return shell.openPath(p);
});
ipcMain.handle("tj:delete-path", async (e, p) => {
  try {
    if (!isPathSafe(p)) { console.error(`Path rejected: ${p}`); return false; }
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

function isExportPathSafe(targetPath) {
  if (!targetPath || typeof targetPath !== "string") return false;
  const resolved = path.resolve(targetPath);
  const home = app.getPath("home");
  const desktop = app.getPath("desktop");
  const docs = app.getPath("documents");
  const downloads = app.getPath("downloads");
  return resolved.startsWith(paths.root + path.sep) || resolved === paths.root
    || resolved.startsWith(desktop + path.sep) || resolved.startsWith(docs + path.sep)
    || resolved.startsWith(downloads + path.sep);
}

ipcMain.handle("tj:write-base64-file", async (e, p, base64) => {
  try {
    if (!p || typeof p !== "string") return { error: "Invalid path" };
    if (!isExportPathSafe(p)) return { error: "Path rejected" };
    if (!base64 || typeof base64 !== "string") return { error: "Invalid data" };
    const cleaned = base64.replace(/^data:.*?;base64,/, "");
    const buf = Buffer.from(cleaned, "base64");
    await fs.promises.writeFile(p, buf);
    return true;
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle("tj:write-csv", async (e, p, txt) => {
  try {
    if (!isExportPathSafe(p)) return { error: "Path rejected" };
    await fs.promises.writeFile(p, "\uFEFF" + txt, "utf-8");
    return true;
  } catch (err) { return { error: err.message }; }
});

ipcMain.handle("tj:write-xlsx", async (e, p, data) => {
  try {
    if (!isExportPathSafe(p)) return { error: "Path rejected" };
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Електронний журнал';
    workbook.created = new Date();

    const formatSheet = (sheet, rows, sheetTitle) => {
      if (!rows || rows.length === 0) return;
      
      const keys = Object.keys(rows[0]);

      const maxContentWidths = {};
      keys.forEach(key => { maxContentWidths[key] = key.length; });
      rows.forEach(row => {
        keys.forEach(key => {
          const val = String(row[key] || '');
          if (val.length > maxContentWidths[key]) maxContentWidths[key] = val.length;
        });
      });

      const columns = keys.map(key => ({
        header: key,
        key: key,
        width: Math.min(Math.max(maxContentWidths[key] + 3, 10), 40)
      }));
      sheet.columns = columns;

      rows.forEach(row => sheet.addRow(row));

      const headerRow = sheet.getRow(1);
      headerRow.height = 28;
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Calibri' };
      headerRow.fill = {
        type: 'pattern', pattern: 'solid',
        fgColor: { argb: 'FF4472C4' }
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

      const thinBorder = {
        top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        right: { style: 'thin', color: { argb: 'FFD9D9D9' } }
      };
      const headerBorder = {
        top: { style: 'thin', color: { argb: 'FF2F5496' } },
        left: { style: 'thin', color: { argb: 'FF2F5496' } },
        bottom: { style: 'medium', color: { argb: 'FF2F5496' } },
        right: { style: 'thin', color: { argb: 'FF2F5496' } }
      };

      headerRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = headerBorder;
      });

      sheet.eachRow((row, rowNumber) => {
        if (rowNumber <= 1) return;
        const isEven = rowNumber % 2 === 0;
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          cell.border = thinBorder;
          cell.alignment = { vertical: 'middle', horizontal: colNumber === 1 ? 'left' : 'center', wrapText: true };
          cell.font = { size: 10, name: 'Calibri' };
          if (isEven) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F7FB' } };
          }
          const val = String(cell.value || '');
          if (val === 'Н' || val === 'ні') {
            cell.font = { size: 10, name: 'Calibri', color: { argb: 'FFDC2626' }, bold: true };
          } else if (val === '✓' || val === 'так') {
            cell.font = { size: 10, name: 'Calibri', color: { argb: 'FF16A34A' }, bold: true };
          }
        });
      });

      sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: keys.length } };
      sheet.views = [{ state: 'frozen', ySplit: 1 }];
    };

    if (Array.isArray(data)) {
      const sheet = workbook.addWorksheet("Експорт");
      formatSheet(sheet, data, "Експорт");
    } else if (typeof data === 'object') {
      for (const [sheetName, rows] of Object.entries(data)) {
        const safeName = String(sheetName).substring(0, 31);
        const sheet = workbook.addWorksheet(safeName);
        formatSheet(sheet, rows, safeName);
      }
    }

    await workbook.xlsx.writeFile(p);
    return true;
  } catch (err) {
    console.error("Помилка експорту Excel:", err);
    return false;
  }
});

ipcMain.handle("tj:export-test-docx", async (e, p, arg1, arg2) => {
  try {
    if (!isExportPathSafe(p)) return { error: "Path rejected" };
    const { AlignmentType, HeadingLevel, BorderStyle, PageNumber, Footer, Header, TabStopPosition, TabStopType } = require("docx");
    let testTitle = "Тест";
    let questionsList = [];
    let isTeacher = false;
    let testClassName = "";

    if (arg1 && typeof arg1 === 'object' && Array.isArray(arg1.questions)) {
        testTitle = arg1.title || "Тест";
        questionsList = arg1.questions;
        testClassName = arg1.className || "";
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

    questionsList = questionsList.filter(q => q && typeof q === 'object');
    const totalPoints = questionsList.reduce((sum, q) => sum + (parseInt(q.points, 10) || 1), 0);

    const docElements = [];

    docElements.push(new Paragraph({
      children: [new TextRun({ text: testTitle, bold: true, size: 36, font: 'Calibri' })],
      alignment: "center",
      spacing: { after: 100 },
      heading: HeadingLevel.HEADING_1
    }));

    if (testClassName) {
      docElements.push(new Paragraph({
        children: [new TextRun({ text: `Клас: ${testClassName}`, size: 22, color: '666666', font: 'Calibri' })],
        alignment: "center",
        spacing: { after: 80 }
      }));
    }

    docElements.push(new Paragraph({
      children: [new TextRun({ text: `Кількість питань: ${questionsList.length}    |    Максимальний бал: ${totalPoints}`, size: 20, color: '888888', font: 'Calibri' })],
      alignment: "center",
      spacing: { after: 100 }
    }));

    docElements.push(new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '4472C4' } },
      spacing: { after: 300 }
    }));

    if (!isTeacher) {
        docElements.push(new Paragraph({
          children: [
            new TextRun({ text: "Прізвище, ім'я: ", size: 24, font: 'Calibri', bold: true }),
            new TextRun({ text: "___________________________________________", size: 24, font: 'Calibri', color: 'AAAAAA' })
          ],
          spacing: { after: 120 }
        }));
        docElements.push(new Paragraph({
          children: [
            new TextRun({ text: "Клас: ", size: 24, font: 'Calibri', bold: true }),
            new TextRun({ text: "____________", size: 24, font: 'Calibri', color: 'AAAAAA' }),
            new TextRun({ text: "          Дата: ", size: 24, font: 'Calibri', bold: true }),
            new TextRun({ text: "____________", size: 24, font: 'Calibri', color: 'AAAAAA' })
          ],
          spacing: { after: 400 }
        }));
    } else {
        docElements.push(new Paragraph({
          children: [new TextRun({ text: "⚑ ВАРІАНТ ДЛЯ ВЧИТЕЛЯ (з відповідями)", bold: true, color: "CC0000", size: 26, font: 'Calibri' })],
          spacing: { after: 400 },
          alignment: "center"
        }));
    }

    questionsList.forEach((q, index) => {
      let rawText = q.text || q.question || q.title || "Питання без тексту";
      let cleanText = String(rawText).replace(/^\d+[\.\)]\s*/, '');
      const points = parseInt(q.points, 10) || 1;
      const pointsLabel = points === 1 ? 'бал' : (points < 5 ? 'бали' : 'балів');

      docElements.push(new Paragraph({
        children: [
          new TextRun({ text: `${index + 1}. `, bold: true, size: 24, font: 'Calibri', color: '4472C4' }),
          new TextRun({ text: cleanText, size: 24, font: 'Calibri' }),
          new TextRun({ text: `  (${points} ${pointsLabel})`, size: 20, font: 'Calibri', color: '999999', italics: true }),
        ],
        spacing: { before: 300, after: 120 }
      }));

      let imgDataUrl = q.image || q.img || q.picture || q.photo;
      if (imgDataUrl && typeof imgDataUrl === 'string' && imgDataUrl.includes('base64,')) {
         try {
           const base64Data = imgDataUrl.split('base64,')[1];
           const imageBuffer = Buffer.from(base64Data, 'base64');
           docElements.push(new Paragraph({
             children: [
               new ImageRun({ data: imageBuffer, transformation: { width: 350, height: 230 } })
             ],
             alignment: "center",
             spacing: { after: 120 }
           }));
         } catch(err) {
             console.error("Не вдалося обробити фото", err);
         }
      }

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

          const children = [];
          if (isTeacher && isCorrect) {
            children.push(new TextRun({ text: `    ${letter}) `, bold: true, size: 24, font: 'Calibri', color: '16A34A' }));
            children.push(new TextRun({ text: String(optText), bold: true, size: 24, font: 'Calibri', color: '16A34A' }));
            children.push(new TextRun({ text: "  ✓", bold: true, size: 24, font: 'Calibri', color: '16A34A' }));
          } else {
            children.push(new TextRun({ text: `    ${letter}) `, bold: true, size: 24, font: 'Calibri' }));
            children.push(new TextRun({ text: String(optText), size: 24, font: 'Calibri' }));
          }

          docElements.push(new Paragraph({ children, spacing: { after: 60 } }));
        });
      } else {
         docElements.push(new Paragraph({
            children: [new TextRun({ text: "    Відповідь: ___________________________________________________________", size: 24, font: 'Calibri', color: 'BBBBBB' })],
            spacing: { after: 120 }
         }));
         if (!isTeacher) {
             docElements.push(new Paragraph({
                children: [new TextRun({ text: "    ______________________________________________________________________", size: 24, font: 'Calibri', color: 'BBBBBB' })],
                spacing: { after: 200 }
             }));
         }
      }
    });

    const footerParagraph = new Paragraph({
      children: [
        new TextRun({ text: "Електронний журнал  •  Сторінка ", size: 16, color: 'AAAAAA', font: 'Calibri' }),
        new TextRun({ children: [PageNumber.CURRENT], size: 16, color: 'AAAAAA', font: 'Calibri' }),
        new TextRun({ text: " з ", size: 16, color: 'AAAAAA', font: 'Calibri' }),
        new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: 'AAAAAA', font: 'Calibri' }),
      ],
      alignment: "center"
    });

    const doc = new Document({
      sections: [{
        properties: {
          page: {
            margin: { top: 720, right: 720, bottom: 720, left: 720 }
          }
        },
        footers: { default: new Footer({ children: [footerParagraph] }) },
        children: docElements
      }]
    });

    const buffer = await Packer.toBuffer(doc);
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
    addFileIfExists(paths.schedulePath);
    addFileIfExists(paths.curriculumPath);

    if (fs.existsSync(paths.files)) {
      zip.addLocalFolder(paths.files, "files");
    }
    zip.writeZip(targetPath);
  } catch (err) {
    console.error("Failed to create ZIP backup:", err);
    throw err;
  }
}

ipcMain.handle("tj:create-backup", async () => {
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

ipcMain.handle("tj:restore-backup", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    properties: ["openFile"],
    filters: [{ name: "ZIP Archives", extensions: ["zip"] }]
  });
  if (canceled) return false;
  
  try {
    const zip = new AdmZip(filePaths[0]);
    const entries = zip.getEntries();
    for (const entry of entries) {
      const target = path.resolve(paths.root, entry.entryName);
      if (!target.startsWith(paths.root + path.sep) && target !== paths.root) {
        throw new Error("ZIP contains invalid path: " + entry.entryName);
      }
    }

    if (fs.existsSync(paths.files)) {
      fs.rmSync(paths.files, { recursive: true, force: true });
    }
    fs.mkdirSync(paths.files, { recursive: true });
    
    zip.extractAllTo(paths.root, true);
    
    app.relaunch();
    app.exit();
    return true;
  } catch (err) {
    return { error: err.message };
  }
});


// === IPC: Хмарна синхронізація ===
const CLOUD_BACKUP_PATH = path.join(paths.root, "cloud_backup.zip");
const SAFETY_BACKUP_DIR = path.join(paths.root, "safety_backups");

function ensureSafetyDir() {
  if (!fs.existsSync(SAFETY_BACKUP_DIR)) {
    fs.mkdirSync(SAFETY_BACKUP_DIR, { recursive: true });
  }
}

function createSafetyBackup(reason) {
  ensureSafetyDir();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safePath = path.join(SAFETY_BACKUP_DIR, `safety_${reason}_${stamp}.zip`);
  try {
    createZipBackup(safePath);
    console.log(`Safety backup created: ${safePath}`);
    pruneSafetyBackups();
    return safePath;
  } catch (e) {
    console.error("Failed to create safety backup:", e.message);
    return null;
  }
}

function pruneSafetyBackups() {
  try {
    const MAX_BACKUPS = 5;
    const files = fs.readdirSync(SAFETY_BACKUP_DIR)
      .filter(f => f.startsWith("safety_") && f.endsWith(".zip"))
      .map(f => ({ name: f, time: fs.statSync(path.join(SAFETY_BACKUP_DIR, f)).mtimeMs }))
      .sort((a, b) => b.time - a.time);
    for (let i = MAX_BACKUPS; i < files.length; i++) {
      fs.unlinkSync(path.join(SAFETY_BACKUP_DIR, files[i].name));
    }
  } catch (e) {
    console.warn("Prune safety backups warning:", e.message);
  }
}

function isLocalDataEmpty() {
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
  const emptyLessons = !Array.isArray(lessonsData) || lessonsData.length === 0;
  const emptyStudents = typeof studentsData !== 'object' || Object.keys(studentsData).length === 0;
  return emptyLessons && emptyStudents;
}

ipcMain.handle("tj:cloud-sync-upload", async () => {
  try {
    if (isLocalDataEmpty()) {
      console.warn("Upload blocked: Local data appears empty.");
      return { error: "LOCAL_DATA_EMPTY" };
    }

    let cloudMeta = null;
    try { cloudMeta = await auth.getBackupMetadata(); } catch(e) {}

    if (cloudMeta && cloudMeta.modifiedTime) {
      const cloudDate = new Date(cloudMeta.modifiedTime);
      const localModTimes = [
        paths.lessonsPath, paths.studentsPath, paths.settingsPath,
        paths.testsPath, paths.notesPath, paths.reportsPath
      ].filter(p => fs.existsSync(p)).map(p => fs.statSync(p).mtimeMs);
      const latestLocal = Math.max(...localModTimes, 0);

      if (latestLocal > 0 && cloudDate.getTime() > latestLocal + 60000) {
        return { error: "CLOUD_IS_NEWER", cloudDate: cloudMeta.modifiedTime };
      }
    }

    createSafetyBackup("before-upload");
    createZipBackup(CLOUD_BACKUP_PATH);
    await auth.syncUpload(CLOUD_BACKUP_PATH);
    try { fs.unlinkSync(CLOUD_BACKUP_PATH); } catch(e){}
    return { success: true, date: new Date().toISOString() };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle("tj:cloud-sync-upload-force", async () => {
  try {
    if (isLocalDataEmpty()) {
      return { error: "LOCAL_DATA_EMPTY" };
    }
    createSafetyBackup("before-force-upload");
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
    createSafetyBackup("before-download");

    await auth.syncDownload(CLOUD_BACKUP_PATH);
    const zip = new AdmZip(CLOUD_BACKUP_PATH);

    const entries = zip.getEntries();
    for (const entry of entries) {
      const target = path.resolve(paths.root, entry.entryName);
      if (!target.startsWith(paths.root + path.sep) && target !== paths.root) {
        throw new Error("ZIP contains invalid path: " + entry.entryName);
      }
    }

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