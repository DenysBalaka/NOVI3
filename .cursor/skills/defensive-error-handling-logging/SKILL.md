---
name: defensive-error-handling-logging
description: Enforces robust error handling for potentially failing operations (API calls, database queries, filesystem I/O). Requires wrapping risky calls in try/catch (or try/except), structured logging via standard libraries, and user-friendly error messages while keeping technical debugging details only in logs. Use when implementing endpoints, bot handlers, CLI commands, DB/query layers, integrations, migrations scripts, or whenever adding/modifying I/O and external calls.
---

# Defensive Error Handling + Logging

## Default behavior

When implementing or changing code that performs **I/O or external calls**, always:

1. **Wrap risky operations** in `try/catch` (JS/TS) or `try/except` (Python).
2. **Log technical details** using standard logging facilities:
   - Node.js: `console` (or the project’s existing logger if present)
   - Python: `logging`
3. **Return/show user-friendly messages** that avoid leaking sensitive/low-level details.
4. **Preserve debuggability**: logs must include enough context to reproduce and diagnose.

## What counts as “risky”

Treat these as potentially failing and wrap them:

- HTTP/API calls (`fetch`, `axios`, SDK clients)
- DB queries/transactions (ORM/repository, raw SQL, migrations)
- File I/O (read/write, uploads, temp files)
- Messaging/queue/bot APIs (Telegram, email, webhook calls)
- JSON parsing of untrusted input, decoding, decompression
- Any async boundary where rejection can happen (promises)

## Logging requirements (minimum bar)

Each caught error must be logged with:

- **Operation name**: stable string identifier (e.g. `students.create`, `telegram.sendMessage`, `db.students.insert`)
- **Safe context**: IDs and non-sensitive parameters (e.g. `studentId`, `teacherId`, `requestId`, `chatId`)
- **Error details**:
  - Node.js: `err.message`, `err.name`, `err.stack` when available
  - Python: `logger.exception(...)` (captures stack trace)

### Security and privacy

- **Never log secrets**: tokens, API keys, passwords, full auth headers, raw DB connection strings.
- **Redact sensitive payloads**: log only derived/safe fields (IDs, counts, booleans).

## User-facing error messages

User-facing output must be:

- **Actionable** when possible (what to try next)
- **Non-technical** (no stack traces, SQL, internal hostnames)
- **Stable** (don’t vary message wildly by low-level exception text)

If there is an HTTP surface, map failures to appropriate status codes where possible:

- **400** invalid input (validation/parsing errors)
- **401/403** auth/authz failures
- **404** missing resource
- **409** known conflict (unique constraint)
- **429** rate limits
- **500** unexpected/unknown failures (generic user message)

## Workflow (use this every time)

1. Identify I/O boundaries and external dependencies.
2. Define an **operation name** for each boundary.
3. Wrap boundary calls:
   - Keep `try/catch` as **narrow** as possible (wrap the failing call + immediate mapping).
   - Prefer small helper functions over giant try blocks.
4. Log once per failure at the boundary:
   - Include operation + safe context + error details.
5. Convert to user-facing response:
   - Return friendly message
   - Keep technical details only in logs
6. Ensure errors still propagate correctly:
   - In libraries: rethrow a typed/meaningful error after logging (or return an error result shape)
   - In handlers: return mapped HTTP/status/Telegram message

## Language patterns

### Node.js (async/await)

- Wrap awaited calls in `try/catch`.
- Log with structured objects when possible:
  - `console.error("op failed", { op, ...ctx, err: { name, message, stack } })`
- Preserve original error as `cause` when rethrowing (supported in modern Node):
  - `throw new Error("User-friendly summary", { cause: err })`

### Python

- Use `logging.getLogger(__name__)`.
- Use `logger.exception("...")` inside `except` to include stack traces.
- Re-raise typed exceptions or return safe error responses.

## Examples

See [examples.md](examples.md) for concrete patterns for API handlers, DB calls, and file I/O in Node/Python.

