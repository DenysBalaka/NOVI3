# Examples: Suggest Unit Tests

## Example A: Python (Pytest) — pure function with validation

**Change**: Implemented `normalize_phone(phone: str) -> str` that:
- trims whitespace
- accepts `+` and digits
- rejects empty/too-long input by raising `ValueError`

### Suggested unit tests

1. **normalize_phone** (file: `tests/test_normalize_phone.py`)
   - **Happy path**:
     - returns canonical form for `"+380 67 123 45 67"`
   - **Edge cases**:
     - strips whitespace: `"  +380671234567  "`
     - accepts digits-only: `"380671234567"`
   - **Errors**:
     - raises `ValueError` on empty string / whitespace-only
     - raises `ValueError` on invalid chars: `"+380-67-abc"`
   - **Boundaries**:
     - min length accepted (exact)
     - max length accepted (exact) and one char over max rejected
   - **Mocks/stubs**: none (pure)

**Pytest snippet**

```python
import pytest

from app.phone import normalize_phone


@pytest.mark.parametrize(
    "raw, expected",
    [
        ("+380 67 123 45 67", "+380671234567"),
        ("  +380671234567  ", "+380671234567"),
        ("380671234567", "+380671234567"),
    ],
)
def test_normalize_phone_happy_paths(raw, expected):
    assert normalize_phone(raw) == expected


@pytest.mark.parametrize("raw", ["", "   ", "+380-67-abc"])
def test_normalize_phone_rejects_invalid(raw):
    with pytest.raises(ValueError):
        normalize_phone(raw)
```

## Example B: Node.js (Jest) — service with dependency mock

**Change**: Implemented `sendInvite(email)` that:
- validates email format
- writes invite to repository
- sends email via `mailer.send()`
- throws typed error for invalid email

### Suggested unit tests

1. **sendInvite** (file: `__tests__/sendInvite.test.js`)
   - **Happy path**:
     - creates invite and calls `mailer.send` once with correct payload
   - **Edge cases**:
     - lower/upper-case emails normalized (if supported)
     - duplicate invite behavior (idempotent vs error) — assert chosen behavior
   - **Errors**:
     - invalid email → rejects with `InvalidInputError` (or expected message/code)
     - repo failure → rejects; mailer not called
   - **Boundaries**:
     - minimal valid email length
     - very long but valid email (if your validator supports it), otherwise assert rejection
   - **Mocks/stubs**:
     - mock repository + mailer (no network)

**Jest snippet**

```javascript
const { sendInvite } = require("../src/invites/sendInvite");

test("sendInvite creates invite and sends email", async () => {
  const repo = { createInvite: jest.fn().mockResolvedValue({ id: "inv_1" }) };
  const mailer = { send: jest.fn().mockResolvedValue(undefined) };

  await sendInvite({ email: "user@example.com", repo, mailer });

  expect(repo.createInvite).toHaveBeenCalledWith({ email: "user@example.com" });
  expect(mailer.send).toHaveBeenCalledTimes(1);
});

test("sendInvite rejects invalid email", async () => {
  const repo = { createInvite: jest.fn() };
  const mailer = { send: jest.fn() };

  await expect(
    sendInvite({ email: "not-an-email", repo, mailer })
  ).rejects.toThrow(/invalid email/i);

  expect(repo.createInvite).not.toHaveBeenCalled();
  expect(mailer.send).not.toHaveBeenCalled();
});
```

## Example C: API handler — status codes + authz + dependency failures

**Change**: Added endpoint handler `POST /v1/students` that:
- requires teacher auth
- validates body (`name`, optional `telegramId`)
- writes to DB
- returns 201 with created student

### Suggested unit tests

1. **Auth** (file: `server/tests/students.create.test.js`)
   - **Happy path**: authorized teacher → 201
   - **Errors**: missing/invalid API key → 401/403 (whichever your app uses)

2. **Validation** (same file)
   - **Edge cases**:
     - missing `name`
     - empty `name`
     - `telegramId` missing vs present vs empty string
   - **Boundaries**:
     - name length exactly min/max accepted; one over max rejected
     - telegramId format boundaries (min/max digits) if constrained

3. **DB failures** (same file)
   - **Errors**:
     - unique constraint (e.g., telegramId) → 409 (or expected mapping)
     - unexpected DB error → 500 (no sensitive details in message)
   - **Mocks/stubs**:
     - stub DB layer to throw deterministic errors

## Quick checklist (copy/paste)

- [ ] At least 1 test per new/changed branch
- [ ] Parametrize input matrices (valid/invalid/boundary)
- [ ] Assert error shape (type/status/message/code)
- [ ] Mock external dependencies at module boundary
- [ ] No network/real DB; deterministic time/randomness
