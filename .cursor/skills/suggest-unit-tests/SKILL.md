---
name: suggest-unit-tests
description: Suggests corresponding unit tests after any implementation or logic change (feature, bug fix, refactor). Uses standard frameworks (Pytest for Python, Jest for Node.js) and ensures coverage of happy paths, edge cases, error handling, and boundary conditions.
---

# Suggest Unit Tests

## When to use

Apply this after **any** change that affects behavior, logic, data validation, branching, error handling, IO boundaries, or external integrations, including:
- New features, endpoints, commands, handlers, queries
- Bug fixes
- Refactors that change control flow or inputs/outputs
- Adding config flags, permissions/roles, auth rules
- Changing database constraints/migrations that affect app behavior

## Goal

Always propose a **minimal but sufficient** set of unit tests that:
- Proves the intended behavior (happy paths)
- Protects against regressions (branch coverage)
- Covers error handling and boundary conditions
- Uses industry-standard libraries (default):
  - Python: **Pytest**
  - Node.js: **Jest**

## Output format (use this template)

### Suggested unit tests

1. **[Test group name]** (file: `...`)
   - **Happy path**: ...
   - **Edge cases**: ...
   - **Errors**: ...
   - **Boundaries**: ...
   - **Mocks/stubs**: ...

### Notes
- **What changed**: one sentence mapping changes → tests
- **What to mock**: DB/network/clock/randomness/filesystem/env
- **Determinism**: freeze time / seed randomness if relevant

## How to derive tests (workflow)

1. **Identify behavior changes**
   - Inputs accepted/rejected
   - New/changed branches
   - New/changed outputs (return values, HTTP status, messages)
   - Side effects (DB writes, notifications, logs, events)

2. **Map each behavior to at least one assertion**
   - For each branch/guard clause, write a test that reaches it
   - Prefer small, focused tests with one primary assertion

3. **Cover the “test quadrants”**
   - **Happy paths**: valid inputs, expected success output
   - **Edge cases**: null/empty, missing fields, special characters, unusual but valid formats
   - **Errors**: invalid inputs, authorization failures, dependency failures
   - **Boundaries**: min/max length, numeric ranges, time windows, list sizes, pagination edges

4. **Pick the framework & style**
   - Python: `pytest` + `pytest.mark.parametrize` for input matrices
   - Node.js: `jest` + `describe/it` + `test.each` for matrices

5. **Isolate dependencies**
   - Mock at the boundary (DB client, HTTP client, queue, Telegram/Email, filesystem)
   - Avoid “mocking internals” unless unavoidable; prefer mocking modules/services

6. **Add negative tests for security/robustness when relevant**
   - Authz rules (role/ownership)
   - Rate limits/quotas (if present)
   - Injection-like inputs (SQL-ish strings) only as unit validation tests

## Language-specific defaults

### Python (Pytest)
- Prefer `pytest` fixtures for shared setup.
- Use `monkeypatch` to replace environment variables or module functions.
- Use `freezegun` only if the project already uses it; otherwise suggest deterministic time injection.

### Node.js (Jest)
- Prefer `jest.mock()` for external modules.
- Use fake timers only when needed; restore timers after.
- Use `expect(...).rejects` for async failures.

## Quality bar (what “good” looks like)
- Tests are **deterministic** and do not require network/real DB.
- Names reflect behavior: `it('rejects empty telegramId', ...)`.
- Edge cases include **boundary conditions** (min/max) and **missing/undefined** inputs.
- Error tests assert both **error type/status** and **message/code** when meaningful.

## Examples

See [examples.md](examples.md) for concrete Pytest/Jest suggestions and snippets.
