require("dotenv").config();
const express = require("express");
const cors = require("cors");
const v1 = require("./src/routes/v1");
const { createBot } = require("./src/bot/handlers");

const app = express();
app.use(cors({ origin: true }));
app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/v1", v1);

const port = Number(process.env.PORT || 3000);

function getPublicBaseUrl() {
  const raw = process.env.RENDER_EXTERNAL_URL || process.env.PUBLIC_URL || "";
  return raw ? raw.replace(/\/$/, "") : "";
}

function startKeepAlive() {
  const base = getPublicBaseUrl();
  if (!base) return;

  const minutes = Number(process.env.KEEPALIVE_INTERVAL_MIN || 10);
  const intervalMs = Number.isFinite(minutes) && minutes > 0 ? minutes * 60_000 : 10 * 60_000;

  const url = `${base}/health`;
  const doPing = async () => {
    try {
      const r = await fetch(url, { method: "GET", headers: { "user-agent": "teacherjournal-cloud-keepalive" } });
      if (!r.ok) console.warn("keepalive non-200", r.status);
    } catch (e) {
      console.warn("keepalive failed", e?.message || e);
    }
  };

  // перший пінг швидко після старту, далі — інтервал
  setTimeout(() => void doPing(), 5_000);
  setInterval(() => void doPing(), intervalMs).unref?.();
  console.log(`Keep-alive enabled: ${url} every ~${Math.round(intervalMs / 60_000)} min`);
}

async function main() {
  let bot = null;
  if (process.env.TELEGRAM_BOT_TOKEN) {
    try {
      bot = createBot();
    } catch (e) {
      console.error("Bot init failed:", e.message);
    }
  }

  const useWebhook = process.env.TELEGRAM_USE_WEBHOOK === "true" && bot;

  if (useWebhook) {
    const path = "/telegram/webhook";
    app.use(bot.webhookCallback(path));
    app.listen(port, async () => {
      console.log(`Listening on ${port}, webhook ${path}`);
      const base = getPublicBaseUrl();
      if (!base) {
        console.warn("PUBLIC_URL не задано — setWebhook пропущено");
        return;
      }
      try {
        await bot.telegram.setWebhook(`${base}${path}`);
        await bot.telegram.setMyCommands([
          { command: "start", description: "Обрати тест" },
          { command: "cancel", description: "Скасувати поточну дію" },
          { command: "ping", description: "Перевірка, що бот активний" },
        ]);
        console.log("Telegram webhook встановлено");
      } catch (e) {
        console.error("setWebhook failed", e);
      }

      startKeepAlive();
    });
  } else {
    app.listen(port, () => {
      console.log(`API listening on ${port}`);
      startKeepAlive();
    });
    if (bot) {
      bot
        .launch()
        .then(() => {
          console.log("Telegram long polling");
          return bot.telegram.setMyCommands([
            { command: "start", description: "Обрати тест" },
            { command: "cancel", description: "Скасувати поточну дію" },
            { command: "ping", description: "Перевірка, що бот активний" },
          ]);
        })
        .catch((e) => console.error("Bot launch failed", e));
    }
  }

  const shutdown = () => {
    if (bot) bot.stop("SIGTERM");
    process.exit(0);
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
