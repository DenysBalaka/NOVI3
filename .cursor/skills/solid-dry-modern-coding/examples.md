# Приклади застосування

## Шаблон: короткий execution plan (перед кодом)

- Оглянути поточний код у `src/...` і знайти точки дублювання/відповідальності
- Винести чисту бізнес-логіку в `XService`/`utils` (без I/O)
- Розбити велику функцію `doThing()` на `parseInput()`, `validate()`, `buildPayload()`, `persist()`
- Додати/оновити тести для нового розбиття або зробити мінімальну ручну перевірку

## Приклад: DRY через “data-driven” замість повторюваних if/else

Погано (дублювання наміру в гілках):

```js
if (role === "admin") return can("read") && can("write");
if (role === "teacher") return can("read");
if (role === "student") return can("read") && withinGroup();
```

Краще (таблиця правил + одна точка застосування):

```js
const roleRules = {
  admin: ({ can }) => can("read") && can("write"),
  teacher: ({ can }) => can("read"),
  student: ({ can, withinGroup }) => can("read") && withinGroup(),
};

const rule = roleRules[role];
return rule ? rule({ can, withinGroup }) : false;
```

## Приклад: декомпозиція “великої” функції

Погано (змішано все: парсинг, валідація, I/O, форматування):

```js
async function handleRequest(req) {
  const input = JSON.parse(req.body);
  if (!input.name || input.name.length > 50) throw new Error("bad");
  const entity = await db.insert({ name: input.name.trim() });
  return { ok: true, id: entity.id };
}
```

Краще (SRP: чиста логіка окремо від I/O):

```js
function parseJsonBody(body) {
  return JSON.parse(body);
}

function validateName(name) {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) throw new Error("name_required");
  if (trimmed.length > 50) throw new Error("name_too_long");
  return trimmed;
}

async function createEntity({ db, name }) {
  const entity = await db.insert({ name });
  return entity.id;
}

async function handleRequest({ db, body }) {
  const input = parseJsonBody(body);
  const name = validateName(input.name);
  const id = await createEntity({ db, name });
  return { ok: true, id };
}
```

