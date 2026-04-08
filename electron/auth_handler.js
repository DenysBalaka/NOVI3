// === ФАЙЛ: electron/auth_handler.js ===
const { net, shell } = require("electron");
const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");
const crypto = require("crypto");
const { URLSearchParams } = require("url");

let GOOGLE_CLIENT_ID = "";
let GOOGLE_CLIENT_SECRET = "";

try {
  const configPath = path.join(__dirname, "auth_config.json");
  if (fs.existsSync(configPath)) {
    const cfg = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    GOOGLE_CLIENT_ID = cfg.GOOGLE_CLIENT_ID || "";
    GOOGLE_CLIENT_SECRET = cfg.GOOGLE_CLIENT_SECRET || "";
  }
} catch (e) {
  console.error("Failed to load auth_config.json:", e.message);
}

if (process.env.GOOGLE_CLIENT_ID) GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
if (process.env.GOOGLE_CLIENT_SECRET) GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

const GOOGLE_AUTH_PORT = 3000;
const GOOGLE_REDIRECT_URI = `http://localhost:${GOOGLE_AUTH_PORT}/auth/google/callback`;
const TOKEN_FILE_NAME = "google_token.json";
const BACKUP_FILE_NAME = "TeacherJournal_Backup.zip";

const AUTH_TIMEOUT_MS = 5 * 60 * 1000;

let appDataPath;
let tokenPath;
let authServerInstance = null;
let authTimeoutHandle = null;
let pendingAuthState = null;

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USER_INFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

const SCOPES = [
  "openid",
  "profile",
  "email",
  "https://www.googleapis.com/auth/drive.appdata"
];

const API_BASE_URL = "https://www.googleapis.com";

function init(rootPath) {
  appDataPath = rootPath;
  tokenPath = path.join(appDataPath, TOKEN_FILE_NAME);
}

async function googleApiRequest(url, method = "GET", headers = {}, body = null, isUpload = false) {
  return new Promise((resolve, reject) => {
    const options = {
      method: method,
      headers: {
        "Authorization": headers.Authorization,
        ...(!isUpload && { "Content-Type": "application/json" })
      }
    };

    if (isUpload) {
        if (Buffer.isBuffer(body)) {
            if (headers["Content-Type"]) {
                 options.headers["Content-Type"] = headers["Content-Type"];
            } else {
                 options.headers["Content-Type"] = "application/octet-stream";
            }
            options.headers["Content-Length"] = body.length;
        } else {
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
            resolve({});
          }
        } else {
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

async function saveTokens(tokens) {
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

  if (Date.now() >= tokens.expires_at - 60000) {
    try {
      const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: tokens.refresh_token,
        grant_type: "refresh_token"
      });
      const res = await net.fetch(TOKEN_URL, { method: "POST", body: params.toString(), headers: { "Content-Type": "application/x-www-form-urlencoded" } });
      if (!res.ok) throw new Error(`Token refresh failed: ${res.statusText}`);
      const newTokens = await res.json();

      tokens = { ...tokens, ...newTokens, refresh_token: tokens.refresh_token };

      await saveTokens(tokens);
    } catch (e) {
      logout();
      throw new Error(`Failed to refresh token: ${e.message}`);
    }
  }
  return tokens.access_token;
}

function logout() {
  if (fs.existsSync(tokenPath)) fs.unlinkSync(tokenPath);
}

function cleanupAuthServer(rejectFn, reason) {
  if (authTimeoutHandle) { clearTimeout(authTimeoutHandle); authTimeoutHandle = null; }
  pendingAuthState = null;
  if (authServerInstance) {
    try { authServerInstance.close(); } catch (e) {}
    authServerInstance = null;
  }
  if (rejectFn && reason) rejectFn(new Error(reason));
}

async function startAuth() {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error("Google OAuth не налаштовано. Створіть файл electron/auth_config.json з вашими ключами.");
  }

  return new Promise((resolve, reject) => {
    cleanupAuthServer(null, null);

    pendingAuthState = crypto.randomBytes(32).toString("hex");

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: GOOGLE_REDIRECT_URI,
        response_type: "code",
        scope: SCOPES.join(" "),
        access_type: "offline",
        prompt: "consent",
        state: pendingAuthState
      }).toString();

    authServerInstance = http.createServer(async (req, res) => {
      const url = new URL(req.url, `http://localhost:${GOOGLE_AUTH_PORT}`);
      if (url.pathname === "/auth/google/callback") {
        const code = url.searchParams.get("code");
        const returnedState = url.searchParams.get("state");

        if (returnedState !== pendingAuthState) {
          res.writeHead(403, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end("<html><body><h1>Помилка: невірний state-параметр</h1></body></html>");
          cleanupAuthServer(reject, "OAuth state mismatch — можлива CSRF-атака.");
          return;
        }

        if (code) {
          try {
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
            await saveTokens(tokens);

            const profile = await getUserInfo(USER_INFO_URL, tokens.access_token);

            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end("<html><body><h1>Авторизація успішна!</h1><p>Ви можете закрити це вікно.</p><script>window.close();</script></body></html>");

            cleanupAuthServer(null, null);
            resolve(profile);
          } catch (e) {
            res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end("<html><body><h1>Помилка авторизації</h1></body></html>");
            cleanupAuthServer(reject, e.message);
          }
        } else {
          res.end("<html><body><h1>Помилка: Код авторизації не знайдено</h1></body></html>");
          cleanupAuthServer(reject, "No code provided");
        }
      }
    });

    authServerInstance.on('error', (e) => {
      cleanupAuthServer(reject, "Порт 3000 зайнятий. Спробуйте ще раз через кілька секунд.");
    });

    authServerInstance.listen(GOOGLE_AUTH_PORT, '127.0.0.1', () => {
      shell.openExternal(authUrl);

      authTimeoutHandle = setTimeout(() => {
        cleanupAuthServer(reject, "Час очікування авторизації вичерпано (5 хвилин). Спробуйте ще раз.");
      }, AUTH_TIMEOUT_MS);
    });
  });
}

// === ЛОГІКА GOOGLE DRIVE ===

async function getUserInfo(url, token) { return googleApiRequest(url, "GET", { Authorization: `Bearer ${token}` }); }

async function findBackupFile(token) {
  const url = `${API_BASE_URL}/drive/v3/files?` +
    new URLSearchParams({
      spaces: 'appDataFolder',
      q: `name='${BACKUP_FILE_NAME}' and trashed=false`,
      fields: "files(id, name, modifiedTime)"
    }).toString();

  const headers = { Authorization: `Bearer ${token}` };
  const data = await googleApiRequest(url, "GET", headers);
  return data.files && data.files.length > 0 ? data.files[0] : null;
}

async function uploadFileToDrive(token, filePath) {
  const file = await findBackupFile(token);
  const fileMetadata = {
    name: BACKUP_FILE_NAME,
    parents: ['appDataFolder']
  };

  const fileContent = fs.readFileSync(filePath);
  let url;
  let method;
  let headers = { Authorization: `Bearer ${token}` };
  let body;
  let isMulti = false;

  if (file) {
    url = `${API_BASE_URL}/upload/drive/v3/files/${file.id}?uploadType=media`;
    method = "PATCH";
    headers["Content-Type"] = "application/octet-stream";
    body = fileContent;
    isMulti = true;
  } else {
    url = `${API_BASE_URL}/upload/drive/v3/files?uploadType=multipart`;
    method = "POST";

    const boundary = "----NodeJsGoogleDriveApiBoundary" + Date.now();
    headers["Content-Type"] = `multipart/related; boundary=${boundary}`;

    const metadataPart = JSON.stringify(fileMetadata);

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

async function downloadFileFromDrive(token, fileId, destPath) {
  const url = `${API_BASE_URL}/drive/v3/files/${fileId}?alt=media`;
  const headers = { Authorization: `Bearer ${token}` };

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
        fileStream.close(resolve);
      });
    }).on("error", (e) => {
      try { fs.unlinkSync(destPath); } catch(err) {}
      reject(e);
    });
  });
}

// === Експортовані функції ===

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
