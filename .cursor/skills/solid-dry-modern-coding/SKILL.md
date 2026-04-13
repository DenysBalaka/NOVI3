---
name: solid-dry-modern-coding
description: Enforces SOLID and DRY while implementing or refactoring code. Requires a brief execution plan before writing code, prefers modern language syntax/features, decomposes large functions into small modular/reusable units, and promotes self-documenting naming. Use when the user asks to write code, modify code, refactor, clean up, improve architecture, or “make it more maintainable/readable”.
---

# SOLID + DRY + Modern Coding

## Default behavior

When implementing changes:

1. **Before writing code**, output a brief execution plan (3–7 bullets).
2. Write **SOLID** code: single responsibility, clear boundaries, dependency inversion where it matters.
3. Stay **DRY**: remove duplication via helpers, shared abstractions, or data-driven structures (but don’t over-abstract).
4. Use **modern language syntax and features** appropriate for the project/runtime (avoid legacy patterns unless required).
5. Prefer **small, modular, reusable** functions. Split “do-everything” functions into focused units.
6. Write **self-documenting code**: meaningful names, clear data shapes, explicit invariants; avoid “comment-driven” clarity.

## Execution plan (required)

Before coding, provide a short plan that includes:

- What files/modules are likely to change
- What new functions/modules will be introduced (if any)
- How behavior will be verified (tests, manual steps, quick checks)

Keep it brief; it’s an execution plan, not a design doc.

## Practical guidelines

### SOLID in practice

- **Single Responsibility**: each function/module should have one reason to change; separate I/O from pure logic when feasible.
- **Open/Closed**: extend behavior via composition/configuration rather than branching on “type” or “mode” everywhere.
- **Liskov Substitution**: subtypes must be usable without special cases; avoid “if (isSubclass)” style code paths.
- **Interface Segregation**: prefer small, purpose-specific interfaces over “god interfaces”.
- **Dependency Inversion**: depend on abstractions at boundaries (e.g., pass repositories/clients in), avoid hard-wiring globals.

### DRY without over-engineering

- Extract duplication when it’s **semantic duplication** (same intent), not just similar syntax.
- Prefer **data-driven** solutions (maps/config tables) for repeated conditionals.
- Don’t introduce abstractions that obscure intent; optimize for clarity first.

### Function sizing heuristics

- If a function is hard to name precisely, it’s probably doing too much.
- If you need deep nesting or many flags/booleans, split responsibilities.
- Prefer “pipeline” composition of small functions over one large function.

## Examples

See [examples.md](examples.md) for concrete before/after patterns and plan templates.

