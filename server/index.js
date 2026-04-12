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
      const base = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
      if (!base) {
        console.warn("PUBLIC_URL не задано — setWebhook пропущено");
        return;
      }
      try {
        await bot.telegram.setWebhook(`${base}${path}`);
        await bot.telegram.setMyCommands([
          { command: "start", description: "Обрати тест" },
          { command: "cancel", description: "Скасувати поточну дію" },
        ]);
        console.log("Telegram webhook встановлено");
      } catch (e) {
        console.error("setWebhook failed", e);
      }
    });
  } else {
    app.listen(port, () => {
      console.log(`API listening on ${port}`);
    });
    if (bot) {
      bot
        .launch()
        .then(() => {
          console.log("Telegram long polling");
          return bot.telegram.setMyCommands([
            { command: "start", description: "Обрати тест" },
            { command: "cancel", description: "Скасувати поточну дію" },
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
