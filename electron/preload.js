// === ФАЙЛ: electron/preload.js (Оновлено) ===
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("tj", {
  // Системні
  winMin: ()=>ipcRenderer.invoke("tj:win-min"),
  winMax: ()=>ipcRenderer.invoke("tj:win-max"),
  winClose: ()=>ipcRenderer.invoke("tj:win-close"),
  boardWinMin: ()=>ipcRenderer.invoke("tj:board-win-min"),
  boardWinMax: ()=>ipcRenderer.invoke("tj:board-win-max"),
  boardWinClose: ()=>ipcRenderer.invoke("tj:board-win-close"),

  // Файли
  getPaths: () => ipcRenderer.invoke("tj:get-paths"),
  getAppConfig: () => ipcRenderer.invoke("tj:get-app-config"),
  openExternal: (url) => ipcRenderer.invoke("tj:open-external", url),
  readJSON: (p) => ipcRenderer.invoke("tj:read-json", p),
  writeJSON: (p,d) => ipcRenderer.invoke("tj:write-json", p, d),
  chooseFiles: ()=>ipcRenderer.invoke("tj:choose-files"),
  chooseFolder: ()=>ipcRenderer.invoke("tj:choose-folder"),
  addFiles: (paths)=>ipcRenderer.invoke("tj:add-files", paths), 
  openPath: (p)=>ipcRenderer.invoke("tj:open-path", p),
  deletePath: (p)=>ipcRenderer.invoke("tj:delete-path", p),
  readFileAsDataUrl: (p)=>ipcRenderer.invoke("tj:read-file-as-dataurl", p),
  
  // Експорт
  showSaveDialog: (options) => ipcRenderer.invoke("tj:show-save-dialog", options), // <-- ДОДАНО
  writeBase64File: (p, base64) => ipcRenderer.invoke("tj:write-base64-file", p, base64),
  writeCSV: (p,txt)=>ipcRenderer.invoke("tj:write-csv", p, txt),
  writeXLSX: (p,rows)=>ipcRenderer.invoke("tj:write-xlsx", p, rows),
  exportTestDocx: (p,t,m)=>ipcRenderer.invoke("tj:export-test-docx", p, t, m),

  // Дошка
  openBoardWindow: (p) => ipcRenderer.invoke("tj:open-board-window", p),
  
  // Google Auth & Cloud Sync
  googleAuthStart: () => ipcRenderer.invoke("tj:google-auth-start"),
  googleLogout: () => ipcRenderer.invoke("tj:google-logout"),
  googleGetProfile: () => ipcRenderer.invoke("tj:google-get-profile"),
  googleGetBackupMeta: () => ipcRenderer.invoke("tj:google-get-backup-meta"), // Отримати дату останнього бекапу
  cloudSyncUpload: () => ipcRenderer.invoke("tj:cloud-sync-upload"),
  cloudSyncUploadForce: () => ipcRenderer.invoke("tj:cloud-sync-upload-force"),
  cloudSyncDownload: () => ipcRenderer.invoke("tj:cloud-sync-download"),

  telegramReload: () => ipcRenderer.invoke("tj:telegram-reload"),
  cloudApi: (opts) => ipcRenderer.invoke("tj:cloud-api", opts),
  cloudRegister: (payload) => ipcRenderer.invoke("tj:cloud-register", payload),

  // Локальне резервне копіювання
  createBackup: () => ipcRenderer.invoke("tj:create-backup"),
  restoreBackup: () => ipcRenderer.invoke("tj:restore-backup"),

  on: (channel, func) => {
    if (["show-context-menu", "board-init-data", "tj:data-changed"].includes(channel)) {
      ipcRenderer.removeAllListeners(channel);
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  },
});