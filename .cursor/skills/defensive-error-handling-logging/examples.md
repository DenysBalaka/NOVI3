# Examples: Defensive Error Handling + Logging

## Example A: Node.js — API handler (fetch + friendly HTTP errors)

```javascript
function serializeErr(err) {
  if (!err || typeof err !== "object") return { message: String(err) };
  return {
    name: err.name,
    message: err.message,
    stack: err.stack,
  };
}

async function getProfileHandler(req, res) {
  const op = "profile.fetch";
  const requestId = req.headers["x-request-id"] || undefined;
  const userId = req.params.userId;

  try {
    const r = await fetch(`https://api.example.com/users/${encodeURIComponent(userId)}`);

    if (r.status === 404) {
      return res.status(404).json({ ok: false, message: "Користувача не знайдено." });
    }

    if (!r.ok) {
      console.error("external api non-ok", { op, requestId, userId, status: r.status });
      return res.status(502).json({ ok: false, message: "Сервіс тимчасово недоступний. Спробуйте пізніше." });
    }

    const data = await r.json();
    return res.json({ ok: true, data });
  } catch (err) {
    console.error("op failed", { op, requestId, userId, err: serializeErr(err) });
    return res.status(500).json({ ok: false, message: "Сталася помилка. Спробуйте ще раз." });
  }
}
```

## Example B: Node.js — DB boundary (typed error mapping + redaction)

```javascript
function safeCtx(ctx) {
  const { apiKey, token, authorization, password, ...rest } = ctx || {};
  return rest;
}

function isUniqueViolation(err) {
  // Adapt to your DB driver/ORM. Examples:
  // - Postgres (node-postgres): err.code === "23505"
  // - SQLite: /UNIQUE constraint failed/.test(err.message)
  return err && (err.code === "23505" || /unique/i.test(err.message));
}

async function createStudent({ db, teacherId, name, telegramId }) {
  const op = "db.students.insert";
  try {
    return await db.students.insert({ teacherId, name, telegramId });
  } catch (err) {
    console.error("db error", {
      op,
      ctx: safeCtx({ teacherId, telegramId: telegramId ? String(telegramId) : undefined }),
      err: { name: err?.name, message: err?.message, stack: err?.stack },
    });

    if (isUniqueViolation(err)) {
      const e = new Error("Telegram ID вже використовується.");
      e.code = "STUDENT_TELEGRAM_CONFLICT";
      throw e;
    }
    throw err;
  }
}
```

## Example C: Node.js — Telegram bot handler (friendly reply + technical logs)

```javascript
async function onCommand(ctx, deps) {
  const op = "telegram.command";
  const chatId = ctx.chat?.id;
  const fromId = ctx.from?.id;

  try {
    await deps.telegram.sendMessage(chatId, "Готово!");
  } catch (err) {
    console.error("telegram send failed", {
      op,
      chatId,
      fromId,
      err: { name: err?.name, message: err?.message, stack: err?.stack },
    });

    // Keep the user-facing message generic.
    try {
      await deps.telegram.sendMessage(chatId, "Не вдалося надіслати повідомлення. Спробуйте пізніше.");
    } catch {
      // Avoid infinite loops: if even the fallback fails, only log once above.
    }
  }
}
```

## Example D: Python — file I/O + logging.exception

```python
import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)


def load_config(path: str) -> dict:
    op = "config.load"
    p = Path(path)

    try:
        raw = p.read_text(encoding="utf-8")
        return json.loads(raw)
    except FileNotFoundError:
        logger.info("%s missing", op, extra={"path": str(p)})
        raise ValueError("Файл конфігурації не знайдено.")
    except json.JSONDecodeError:
        logger.warning("%s invalid json", op, extra={"path": str(p)})
        raise ValueError("Некоректний формат конфігурації.")
    except Exception:
        logger.exception("%s failed", op, extra={"path": str(p)})
        raise ValueError("Не вдалося прочитати конфігурацію. Спробуйте пізніше.")
```

## Quick checklist (copy/paste)

- [ ] I/O boundary is wrapped in try/catch (or try/except)
- [ ] Log includes `op` + safe context + stack trace
- [ ] No secrets in logs (tokens, keys, passwords)
- [ ] User-facing message is friendly and non-technical
- [ ] Error mapping is consistent (400/401/403/404/409/429/500 where applicable)

