// === ФАЙЛ: electron/auth_handler.js (Фінальна, 100% правильна версія) ===
const { net, shell } = require("electron");
const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https"); // Виправлено 'httpssa'
const { URLSearchParams } = require("url");

// !!! =============================================================== !!!
const GOOGLE_CLIENT_ID = "593634695043-n8jumb3j3dkq43r3u3e4hnd1or17h2vt.apps.googleusercontent.com";
const GOOGLE_CLIENT_SECRET = "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";
// !!! =============================================================== !!!

const GOOGLE_AUTH_PORT = 3000;
const GOOGLE_REDIRECT_URI = `http://localhost:${GOOGLE_AUTH_PORT}/auth/google/callback`;
const TOKEN_FILE_NAME = "google_token.json";
const BACKUP_FILE_NAME = "TeacherJournal_Backup.zip";

let appDataPath;
let tokenPath;
let authServerInstance = null;

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USER_INFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

// === ЦЕ ПЕРШИЙ ВАЖЛИВИЙ РЯДОК ===
const SCOPES = [
  "openid",
  "profile",
  "email",
  "https://www.googleapis.com/auth/drive.appdata" // <-- Використовуємо приховану папку
];

const API_BASE_URL = "https://www.googleapis.com";

// Ініціалізація
function init(rootPath) {
  appDataPath = rootPath;
  tokenPath = path.join(appDataPath, TOKEN_FILE_NAME);
}

// Функція-обгортка для всіх API-запитів до Google
async function googleApiRequest(url, method = "GET", headers = {}, body = null, isUpload = false) {
  return new Promise((resolve, reject) => {
    const options = {
      method: method,
      headers: {
        "Authorization": headers.Authorization,
        ...(!isUpload && { "Content-Type": "application/json" })
      }
    };
    
    // Спеціальний заголовок для multipart (створення) або media (оновлення)
    if (isUpload) {
        // Якщо тіло - це Buffer (тобто ми завантажуємо медіа або multipart)
        if (Buffer.isBuffer(body)) {
            if (headers["Content-Type"]) {
                 options.headers["Content-Type"] = headers["Content-Type"];
            } else {
                 options.headers["Content-Type"] = "application/octet-stream";
            }
            options.headers["Content-Length"] = body.length;
        } else {
             // Для звичайних PATCH/POST JSON-тіл
             options.headers["Content-Type"] = "application/json";
             body = JSON.stringify(body);
        }
    }

    const req = https.request(url, options, (res) => {
      let rawData = "";
      res.on("data", (chunk) => { rawData += chunk; });
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(rawData ? JSON.parse(rawData) : {});
          } catch (e) {
            resolve({}); // Для 204 (No Content)
          }
        } else {
          // Форматуємо помилку для показу у showCustomAlert
          let errorMsg = `API Error: ${res.statusCode} ${res.statusMessage}.`;
          try {
            const errJson = JSON.parse(rawData);
            if (errJson.error && errJson.error.message) {
              errorMsg = `API Error: ${errJson.error.code} ${errJson.error.message}. Response: ${rawData}`;
            } else {
              errorMsg += ` Response: ${rawData}`;
            }
          } catch(e) {
             errorMsg += ` Response: ${rawData}`;
          }
          reject(new Error(errorMsg));
        }
      });
    });
    req.on("error", (e) => reject(e));
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

// Робота з токенами
async function saveTokens(tokens) {
  // Додаємо час "протухання"
  tokens.expires_at = Date.now() + tokens.expires_in * 1000;
  fs.writeFileSync(tokenPath, JSON.stringify(tokens));
}

function loadTokens() {
  if (fs.existsSync(tokenPath)) {
    try { return JSON.parse(fs.readFileSync(tokenPath, "utf-8")); } catch (e) { return null; }
  }
  return null;
}

async function getValidAccessToken() {
  let tokens = loadTokens();
  if (!tokens) throw new Error("Not authenticated");

  // Перевіряємо, чи токен не прострочений (з запасом в 1 хв)
  if (Date.now() >= tokens.expires_at - 60000) {
    // Токен прострочений, оновлюємо
    try {
      const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: tokens.refresh_token,
        grant_type: "refresh_token"
      });
      // Використовуємо net.fetch, як це було в коді авторизації
      const res = await net.fetch(TOKEN_URL, { method: "POST", body: params.toString(), headers: { "Content-Type": "application/x-www-form-urlencoded" } });
      if (!res.ok) throw new Error(`Token refresh failed: ${res.statusText}`);
      const newTokens = await res.json();
      
      // Зберігаємо новий токен, АЛЕ ЗБЕРІГАЄМО СТАРИЙ REFRESH_TOKEN
      tokens = { ...tokens, ...newTokens, refresh_token: tokens.refresh_token }; 
      
      await saveTokens(tokens);
    } catch (e) {
      logout(); // Якщо не вдалося оновити, виходимо
      throw new Error(`Failed to refresh token: ${e.message}`);
    }
  }
  return tokens.access_token;
}

function logout() {
  if (fs.existsSync(tokenPath)) fs.unlinkSync(tokenPath);
}

// Логіка автентифікації
async function startAuth() {
  return new Promise((resolve, reject) => {
    if (authServerInstance) {
      try { authServerInstance.close(); } catch (e) {}
      authServerInstance = null;
    }
    
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: GOOGLE_REDIRECT_URI,
        response_type: "code",
        scope: SCOPES.join(" "),
        access_type: "offline",
        prompt: "consent" // Завжди запитуємо згоду (для refresh_token)
      }).toString();

    authServerInstance = http.createServer(async (req, res) => {
      const url = new URL(req.url, `http://localhost:${GOOGLE_AUTH_PORT}`);
      if (url.pathname === "/auth/google/callback") {
        const code = url.searchParams.get("code");
        if (code) {
          try {
            // Обмін коду на токен
            const params = new URLSearchParams({
              code: code,
              client_id: GOOGLE_CLIENT_ID,
              client_secret: GOOGLE_CLIENT_SECRET,
              redirect_uri: GOOGLE_REDIRECT_URI,
              grant_type: "authorization_code"
            });
            const tokenRes = await net.fetch(TOKEN_URL, { method: "POST", body: params.toString(), headers: { "Content-Type": "application/x-www-form-urlencoded" } });
            if (!tokenRes.ok) throw new Error(`Token exchange failed: ${tokenRes.statusText}`);
            const tokens = await tokenRes.json();
            await saveTokens(tokens); // Зберігаємо повний набір токенів

            // Отримання профілю
            const profile = await getUserInfo(USER_INFO_URL, tokens.access_token);
            
            // === ВИПРАВЛЕННЯ КОДУВАННЯ (З ПОПЕРЕДНЬОГО КРОКУ) ===
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end("<html><body><h1>Авторизація успішна!</h1><p>Ви можете закрити це вікно.</p><script>window.close();</script></body></html>");
            
            if (authServerInstance) { authServerInstance.close(); authServerInstance = null; }
            resolve(profile);
          } catch (e) {
            reject(e);
            
             // === ... і тут також ===
            res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end("<html><body><h1>Помилка авторизації</h1></body></html>");
            
            if (authServerInstance) { authServerInstance.close(); authServerInstance = null; }
          }
        } else {
          reject(new Error("No code provided"));
          res.end("<html><body><h1>Помилка: Код авторизації не знайдено</h1></body></html>");
          if (authServerInstance) { authServerInstance.close(); authServerInstance = null; }
        }
      }
    });

    authServerInstance.on('error', (e) => {
      if (authServerInstance) { authServerInstance.close(); authServerInstance = null; }
      reject(new Error("Порт 3000 зайнятий. Спробуйте ще раз через кілька секунд."));
    });

    authServerInstance.listen(GOOGLE_AUTH_PORT, () => shell.openExternal(authUrl));
  });
}

// === ЛОГІКА GOOGLE DRIVE (ВАЖЛИВІ ЗМІНИ) ===

async function getUserInfo(url, token) { return googleApiRequest(url, "GET", { Authorization: `Bearer ${token}` }); }

/**
 * Знаходить файл бекапу (лише у прихованій папці AppData)
 */
async function findBackupFile(token) {
  // === ЦЕ ДРУГИЙ ВАЖЛИВИЙ РЯДОК ===
  const url = `${API_BASE_URL}/drive/v3/files?` +
    new URLSearchParams({
      spaces: 'appDataFolder', // <-- ШУКАЄМО ЛИШЕ ТУТ
      q: `name='${BACKUP_FILE_NAME}' and trashed=false`,
      fields: "files(id, name, modifiedTime)"
    }).toString();

  const headers = { Authorization: `Bearer ${token}` };
  const data = await googleApiRequest(url, "GET", headers);
  return data.files && data.files.length > 0 ? data.files[0] : null;
}

/**
 * Завантажує/Оновлює файл бекапу (лише у приховану папку AppData)
 */
async function uploadFileToDrive(token, filePath) {
  const file = await findBackupFile(token); // Перевіряємо, чи файл вже існує
  const fileMetadata = {
    name: BACKUP_FILE_NAME,
    // === ЦЕ ТРЕТІЙ ВАЖЛИВИЙ РЯДОК ===
    parents: ['appDataFolder'] // <-- ВКАЗУЄМО, КУДИ ЗБЕРІГАТИ
  };

  const fileContent = fs.readFileSync(filePath);
  let url;
  let method;
  let headers = { Authorization: `Bearer ${token}` };
  let body;
  let isMulti = false;

  if (file) {
    // Файл існує, оновлюємо його (PATCH)
    url = `${API_BASE_URL}/upload/drive/v3/files/${file.id}?uploadType=media`;
    method = "PATCH";
    headers["Content-Type"] = "application/octet-stream";
    body = fileContent;
    isMulti = true; // Використовуємо isUpload=true для googleApiRequest
  } else {
    // Файл не існує, створюємо новий (POST)
    url = `${API_BASE_URL}/upload/drive/v3/files?uploadType=multipart`;
    method = "POST";
    
    const boundary = "----NodeJsGoogleDriveApiBoundary" + Date.now();
    headers["Content-Type"] = `multipart/related; boundary=${boundary}`;
    
    const metadataPart = JSON.stringify(fileMetadata);
    
    // Формуємо multipart тіло
    body = Buffer.concat([
      Buffer.from(`--${boundary}\r\n`),
      Buffer.from("Content-Type: application/json; charset=UTF-8\r\n\r\n"),
      Buffer.from(`${metadataPart}\r\n`),
      Buffer.from(`--${boundary}\r\n`),
      Buffer.from(`Content-Type: application/octet-stream\r\n\r\n`),
      fileContent,
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);
    isMulti = true;
  }

  return googleApiRequest(url, method, headers, body, isMulti);
}

/**
 * Скачує файл бекапу
 */
async function downloadFileFromDrive(token, fileId, destPath) {
  const url = `${API_BASE_URL}/drive/v3/files/${fileId}?alt=media`;
  const headers = { Authorization: `Bearer ${token}` };
  
  // Використовуємо 'https' напряму для скачування файлу, бо це надійніше
  return new Promise((resolve, reject) => {
    const fileStream = fs.createWriteStream(destPath);
    https.get(url, { headers }, (res) => {
      if (res.statusCode !== 200) {
        let errorData = '';
        res.on('data', chunk => errorData += chunk);
        res.on('end', () => {
            reject(new Error(`Failed to download file: ${res.statusCode} ${res.statusMessage} ${errorData}`));
        });
        return;
      }
      res.pipe(fileStream);
      fileStream.on("finish", () => {
        fileStream.close(resolve); // Передаємо resolve як колбек
      });
    }).on("error", (e) => {
      try { fs.unlinkSync(destPath); } catch(err) {} // Видалити частковий файл
      reject(e);
    });
  });
}

// === Експортовані функції (без змін) ===

async function getUserProfile() {
  try {
    const token = await getValidAccessToken();
    return await getUserInfo(USER_INFO_URL, token);
  } catch (e) { return null; }
}

async function syncUpload(filePath) {
    const token = await getValidAccessToken();
    return await uploadFileToDrive(token, filePath);
}

async function syncDownload(destPath) {
    const token = await getValidAccessToken();
    const file = await findBackupFile(token);
    if (!file) throw new Error("Резервну копію не знайдено в Google Drive.");
    await downloadFileFromDrive(token, file.id, destPath);
    return file;
}

async function getBackupMetadata() {
    const token = await getValidAccessToken();
    return await findBackupFile(token);
}

module.exports = {
  init,
  startAuth,
  logout,
  getUserProfile,
  getBackupMetadata,
  syncUpload,
  syncDownload
};