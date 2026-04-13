## Good: Router modules + typed handlers

```python
from __future__ import annotations

from aiogram import Router
from aiogram.filters import CommandStart
from aiogram.types import Message

router = Router(name=__name__)


@router.message(CommandStart())
async def start(message: Message) -> None:
    await message.answer("Привіт! Я бот.")
```

## Good: CallbackQuery handler with strict types

```python
from __future__ import annotations

from aiogram import Router
from aiogram.types import CallbackQuery

router = Router(name=__name__)


@router.callback_query()
async def on_any_callback(callback: CallbackQuery) -> None:
    await callback.answer()
```

## Good: Dispatcher wiring (include routers)

```python
from __future__ import annotations

import asyncio

from aiogram import Bot, Dispatcher

from bot.routers.start import router as start_router
from bot.routers.students import router as students_router


async def main() -> None:
    bot = Bot(token="TOKEN")
    dp = Dispatcher()

    dp.include_router(start_router)
    dp.include_router(students_router)

    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
```

## Bad: Single-file “god bot” with mixed concerns

```python
from aiogram import Bot, Dispatcher
from aiogram.types import Message, CallbackQuery

bot = Bot("TOKEN")
dp = Dispatcher()

# handlers, db, keyboards, business logic, and wiring all in one file
```

## Bad: Blocking code inside async handler

```python
import time
import requests
from aiogram.types import Message


async def handler(message: Message) -> None:
    time.sleep(2)  # blocks event loop
    _ = requests.get("https://example.com").text  # blocking HTTP
    await message.answer("OK")
```

## Better: Async-friendly I/O (principle)

```python
from aiogram.types import Message


async def handler(message: Message) -> None:
    # use async HTTP client / async DB driver
    await message.answer("OK")
```

