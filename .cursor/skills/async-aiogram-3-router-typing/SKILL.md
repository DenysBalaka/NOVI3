---
name: async-aiogram-3-router-typing
description: Enforces async/await-first style across the codebase. For Telegram bots using aiogram 3.x, prefers Router/Dispatcher-based structure over single-file bots. Requires strict type hints for aiogram handlers, including Message and CallbackQuery, and typed state/context where applicable. Use when implementing or refactoring Python async code, Telegram bot handlers, aiogram routers, middleware, filters, callbacks, FSM, or when the user mentions aiogram 3.x, Telegram bot, Router, Dispatcher, Message, CallbackQuery, or type hints.
---

# Async + aiogram 3.x Router + strict typing

## Default rules

- **Async everywhere**: prefer async APIs and `async def` functions; avoid sync wrappers that block the event loop.
- **No blocking I/O in handlers**: do not call blocking libraries in handlers (file I/O, HTTP, DB drivers) unless executed via an async library or offloaded to an executor.
- **aiogram 3.x structure**: organize bot logic with multiple `Router`s and include them into a `Dispatcher`; avoid a single monolithic file with all handlers.
- **Strict typing**: add type hints for every handler signature and relevant objects (`Message`, `CallbackQuery`, `Bot`, `FSMContext`, etc.). Prefer explicit return types (`-> None`) for handlers.
- **Typing-friendly DI**: if using dependencies (db session, services), pass them via typed parameters/middleware/context consistently so handler signatures stay type-checkable.

## Implementation checklist

When adding or changing bot code:

- [ ] Handler is `async def` and awaits every async call.
- [ ] No `time.sleep`, `requests`, sync DB calls, or other blocking operations in the event loop.
- [ ] New handlers go into an appropriate `Router` module (by feature/domain), not dumped into a single file.
- [ ] The router is included into the main `Dispatcher` (or into a root router that is included).
- [ ] Handler parameters are typed (`message: Message`, `callback: CallbackQuery`, etc.).
- [ ] Return type is explicit (`-> None`).
- [ ] Callback data is parsed/validated with a typed approach (aiogram callback data factory or clearly typed parser).

## Preferred project layout (example)

Use a router-first structure:

- `bot/`
  - `main.py` (or `__main__.py`): creates `Bot` + `Dispatcher`, includes routers, starts polling/webhook
  - `routers/`
    - `start.py`
    - `admin.py`
    - `students.py`
    - `teacher.py`
  - `middlewares/`
  - `services/`
  - `keyboards/`

## Handler typing rules (aiogram 3.x)

- Use aiogram types in signatures:
  - `from aiogram.types import Message, CallbackQuery`
  - `from aiogram.fsm.context import FSMContext` (if using FSM)
- Prefer naming parameters for clarity:
  - `message: Message`
  - `callback: CallbackQuery`
- Avoid untyped `*args, **kwargs` in handlers; use typed objects and explicit dependencies instead.

## Examples

See [examples.md](examples.md) for good/bad snippets (handlers, routers, dispatcher setup, callback typing, and common pitfalls like blocking I/O).

