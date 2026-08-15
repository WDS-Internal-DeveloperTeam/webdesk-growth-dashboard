---
tier: 1
load_when: ["file-production", "script-execution", "tool-use", "code-production"]
description: "Claude tool-usage discipline: Write/Edit rules, no JS heredocs, pre-flight validation, tool whitelist. Binding on every agent."
---

# AI Tool Usage Rules

> These are CLAUDE TOOL behaviors, not source-code patterns (those live in the `forbidden` files). Tier 1 — load whenever an agent produces files or runs scripts. Binding, not optional.

---

## TOOL-001 — Write requires a prior Read for existing files (P1)

The Write tool tracks a per-session "seen files" list. Calling `Write` on a path that exists on disk but wasn't Read earlier this session errors: `File has not been read yet`. It guards against blind overwrites.

**Rule:** before `Write` on any path that may already exist, `Read` it first (any line range counts), then `Write`. Brand-new paths can be `Write`-ten directly. The `Edit` tool has its own handling. Shell `echo >` / `cp` bypass the guard — **do not** use them to dodge the rule.

---

## TOOL-002 — Never write JavaScript/TypeScript via Bash heredoc (P1)

Bash heredocs (`cat <<EOF ... EOF`) expand shell constructs in the body. JS/TS is full of them:

- template literals `` `${expr}` `` → Bash expands `${expr}` before the file is written,
- backticks `` ` `` → command substitution,
- `{ }` and `[ ]` → context-dependent interpretation.

Result: corrupted file → `SyntaxError` at runtime.

**Rule:** ALWAYS use the Write tool for `.js`, `.ts`, `.mjs`, `.cjs`, `.jsx`, `.tsx`, and for JSON with nested `${}`/template content. Write delivers bytes verbatim with no shell interpretation. This is the most common avoidable failure in a Node codebase — heredocs and JS do not mix.

Anti-pattern:

```bash
cat <<EOF > sync.js
const k = `${row.id}`;     # Bash eats ${row.id} -> writes `` -> SyntaxError
EOF
```

Correct: `Write sync.js` with the content as-is.

---

## TOOL-003 — Validate variable/scope before running a generated script (P2)

JS doesn't error at parse time on an undeclared reference inside a template literal — it silently emits `"undefined"`. Generated report/migration/seed scripts are the usual victims.

**Rule:** before running a generated script, confirm every variable used in a template literal has a `const`/`let`/`var`/param declaration in scope. `node --check` catches syntax but NOT undeclared refs — use ESLint `no-undef`. If `"undefined"` shows up in output, it's a script bug, not data.

---

## TOOL-004 — Prefer Edit over Write for small changes (P3)

`Edit` sends only the diff; `Write` re-emits the whole file (costly + risks corrupting the untouched 99%).

| Change                                                                        | Use     |
| ----------------------------------------------------------------------------- | ------- |
| One config line, add a function to a large file, rename a var (`replace_all`) | `Edit`  |
| New file, wholesale rewrite of a small (<50-line) file, >30% reorganization   | `Write` |

A 1-line change in a 1000-line `service.js` via `Write` wastes ~999 lines of output and risks all of them. Use `Edit`.

---

## TOOL-005 — Pre-flight validate generated scripts before execution (P2)

A broken script wastes a tool call and can leave half-written state (a partial migration is dangerous).

**Rule:** before executing a generated `.js`/`.ts`/script:

1. **Syntax:** `node --check script.js` (or `tsc --noEmit` for TS).
2. **Lint:** ESLint (`no-undef`, `no-unused-vars`) — catches TOOL-003 misses.
3. **Deps:** every `import`/`require` target is installed (`package.json` / `node_modules`).
4. **Paths:** referenced files exist or can be created.
5. **Migrations specifically:** run the migration **dry-run** (and confirm a `down`/reversal exists) before applying anywhere shared. Never apply a migration to a shared env before G-Schema passes.

Only then run it. Fix → re-run pre-flight → execute. One pass, not a round-trip loop.

---

## TOOL-006 — Tool fallback discipline (P2)

When a tool fails: read the error, identify the **root cause** ("I called Write without Reading", "I heredoc'd JS"), fix the cause, don't switch tools to bypass the rule. 3+ identical failures across projects → KB candidate.

Anti-pattern: `Write` fails (not read) → switch to `echo >` to dodge the guard. Correct: `Read` then `Write`.

---

## TOOL-007 — Honor each agent's `tools:` whitelist

Every SKILL.md frontmatter lists the tools that agent may call. Calling a tool not in the list is forbidden even if it's available.

Default whitelists:

| Agent             | `tools:`                                              |
| ----------------- | ----------------------------------------------------- |
| orchestrator      | Read, Glob, Grep, Bash                                |
| pm-agent          | Read, Write, Edit, Glob, Grep, Bash                   |
| architect-agent   | Read, Write, Edit, Glob, Grep, Bash                   |
| designer-agent    | Read, Write, Edit, Glob, Grep, Bash                   |
| qa-agent          | Read, Glob, Grep, Bash (Playwright added per project) |
| code-review-agent | Read, Glob, Grep, Bash                                |
| delivery-head     | Read, Glob, Grep, Bash                                |

The Backend/Frontend roles (via the `nodejs` arm) get Read/Write/Edit/Glob/Grep/Bash. **QA never edits code** — it logs a bug; the fix goes QA → bug report → dev role → Code Review. The orchestrator never writes code. Whitelist changes need a decision-log entry + a SKILL.md edit, not a silent mid-task expansion.

---

## How agents reference this file

Each agent SKILL.md "Critical rules" includes: "Respect AI tool rules (`ai-tool-rules.md`): Read-before-Write (TOOL-001), no JS heredocs (TOOL-002), pre-flight validate scripts/migrations (TOOL-005). Not optional."

Violations that cause a session failure are captured per-project in `failure-modes.md` with the rule ID; 3+ occurrences strengthen the rule.

---

Last reviewed: 2026-06-30 (initial Node.js build)
Next review due: 2026-09-30
