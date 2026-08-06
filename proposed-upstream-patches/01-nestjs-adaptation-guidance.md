# Proposed Patch 01 — Generic NestJS Adaptation Guidance

**Status:** Proposed. Not merged. Not applied to the base skill by this task.

## Reason

NestJS is already a schema-anticipated alternative (`_contracts/project-json.schema.json`'s `tech_stack.framework` enum includes `nest`), but every worked example in the base skill (`nodejs/knowledge/01-coding-standards.md`, `backend/01-runtime-and-frameworks.md`, `templates/service-skeleton/`) is Express-shaped. A project choosing Nest today has to independently re-derive the controller/service/repository mapping, middleware-order translation, and validation-pipe wiring — exactly what this project did in `profiles/webdesk-growth-dashboard/knowledge/03-nestjs-on-vercel.md`.

## Current gap

No `nodejs/knowledge/backend/03-nestjs-adaptation.md` (or equivalent) exists. `technology-selection.md` names Nest as an option but gives no adaptation guidance, unlike its treatment of the DB/ORM/storage layer choices, which each get a decision-support paragraph in `intelligence/database-intelligence.md`.

## Proposed files changed

- **New:** `nodejs/knowledge/backend/03-nestjs-adaptation.md` — the framework-agnostic portion of this project's `knowledge/03-nestjs-on-vercel.md` (the layering-mapping table, the Zod-pipe pattern, the exception-filter pattern), with the Vercel-Functions-specific cold-start material left out (that part is genuinely Vercel-specific — see Patch 03).
- **Edit:** `nodejs/SKILL.md` — add the new file to the "Files in this arm" index and "Critical reading order" §5 (alongside "Choosing a stack layer → technology-selection.md").

## Compatibility impact

Purely additive. No existing file's content changes; no forbidden pattern changes; no default changes (Express remains the default, Nest remains an explicitly-justified alternative).

## Regression risk

Low. New file only; the one edit to `SKILL.md` is an index-list addition, not a change to any rule or existing guidance.

## Reusability scope

**Generally reusable** — nothing in this proposed content is WebDesk-Dashboard-specific. Any future `custom-app-build` or `integration-middleware` project choosing NestJS benefits identically.
