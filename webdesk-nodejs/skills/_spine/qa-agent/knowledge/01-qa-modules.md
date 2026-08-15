---
tier: 2
load_when: ["qa-active", "g4", "g5"]
description: The QA modules for middleware/API/sync — API contract, integration/contract vs sandboxes, webhook, security (OWASP-API), data-integrity/sync-parity, load+soak, chaos/fault-injection, cron-sync, dashboard-UI. What each tests, how, and what a finding looks like.
---

# QA Modules

> The middleware QA surface. Not every module runs every sprint — run the ones the sprint touched (and the ones the contracts say are at risk), and record any genuinely inapplicable module as "N/A — reason". At **G5** the full set runs, plus load/chaos and the capacity profile. Lighthouse/SEO are **not** on the critical path; they live only inside the dashboard-UI module.

---

## Module 1 — API contract testing (OpenAPI conformance)

**Goal:** every endpoint conforms to the OpenAPI spec — paths, methods, request/response schemas, and the **full status-code table** (including upstream-failure codes 502/503/504 for ERP/store outages).

- Validate responses against the OpenAPI schemas (e.g. Dredd / schemathesis / a jest+ajv harness).
- Assert correct status codes: 200/201/204; 400 (validation) with a consistent error envelope; 401 vs 403 (unauthenticated vs unauthorized); 404; 409 (conflict/duplicate); 422; 429 (rate limit, with `Retry-After`); 500; **502/503/504** when the upstream ERP/store is down or slow.
- Assert the **error response shape** is consistent across endpoints (one envelope, not per-route ad hoc).
- Negative + boundary inputs: oversized payloads, wrong content-type, missing required fields, type confusion.

**Finding example:** `GET /api/items returns 200 with an array but the spec declares 'items' wrapped in {data, page}; consumer dashboards will break. category: api-contract.`

## Module 2 — Integration / contract tests vs ERP + store (consumer-driven)

**Goal:** the middleware's expectations of the ERP and store match reality, against **sandboxes or recorded mocks** — never client production.

- Consumer-driven contract tests (Pact-style or recorded fixtures) for each external system: the request we send and the response shape we depend on.
- Run against the **store sandbox** (e.g. BigCommerce sandbox) where available; against a **mock** for the ERP when no sandbox exists (DDI Inform access is partner-gated — treat its surface as unverified until a sandbox is confirmed; test against documented + mocked behavior and flag the uncertainty).
- Verify auth flows (API key / token refresh), pagination handling, and rate-limit handling against the sandbox.
- Detect contract drift: if the external response no longer matches our recorded contract, fail loudly.

**Finding example:** `BigCommerce sandbox returns inventory as 'inventory_level' but the adapter reads 'available'; inventory sync silently zeroes stock. category: integration, affected_systems: ['bigcommerce'].`

## Module 3 — Webhook tests (HMAC / idempotency / replay / ordering)

**Goal:** webhook handlers are secure and exactly-once in effect.

- **HMAC signature** verification: a tampered or unsigned payload is rejected (401/403); a valid signature passes.
- **Idempotency:** the same webhook delivered twice produces one effect (idempotency key / dedupe on event id). Assert no duplicate order/inventory write.
- **Replay:** an old/duplicate delivery (provider retry) is handled safely; replay-attack windows are bounded.
- **Ordering:** out-of-order deliveries (update before create, or stale-after-fresh) don't corrupt state — either ordered processing or last-write-wins-by-timestamp, per the contract.

**Finding example:** `Duplicate BigCommerce order webhook processed twice → order synced to ERP twice. category: webhook, P1.`

## Module 4 — Security testing (OWASP-API)

**Goal:** the API and dashboard auth are sound.

- **OWASP API Top 10** pass: BOLA/object-level authz (a user can't read/modify another tenant's object by id), broken function-level authz, mass assignment, excessive data exposure, injection.
- **Authz per role** — exercise the per-module **VED** matrix: a Manager without Delete cannot delete; a per-client user cannot reach a master-only endpoint; cross-tenant access is denied at the API, not just hidden in the UI.
- **CVE scan** — `npm audit` + **OSV-Scanner**; 0 high/critical to pass (or a documented, accepted exception).
- **Secret scan** — gitleaks/trufflehog; no keys/tokens in the repo or logs.
- **SAST/DAST** — a static pass (e.g. semgrep/CodeQL) and a dynamic pass (e.g. ZAP baseline) against the running app on the local stack.

**Finding example:** `GET /api/users/:id returns any tenant's user when id is guessed (BOLA). category: auth-rbac/security, P1.`

## Module 5 — Data-integrity / sync parity

**Goal:** after sync, the two systems agree, with no duplicates and no drift.

- **Reconciliation:** for each entity (items, inventory, orders, customers, pricing), count + checksum on both sides after a sync window; assert parity within the contract's tolerance.
- **No duplicates:** unique-key assertions — a re-run, a webhook + a poll, or an overlapping run must not create a second row.
- **Conflict resolution:** for two-way sync, verify the contract's resolution rule (e.g. ERP-wins on price, store-wins on order status) actually applies under a simulated conflict.
- **Field-mapping fidelity:** spot-check that mapped fields land in the right place with the right transform (units, currency, rounding).

**Finding example:** `Pricing sync leaves 12 SKUs at the old price because the watermark advanced past a paginated batch that errored mid-page. category: data-integrity, P2.`

## Module 6 — Load + soak (capacity profile → SLO/SLA)

**Goal:** know the system's capacity and set defensible SLOs. Full method in `knowledge/04-load-and-chaos.md`.

- **Load** (k6 or Artillery): ramp request/job throughput to find the knee — where p95 latency or error rate breaks the budget.
- **Soak:** sustained run (e.g. 1–2h) to catch memory leaks, connection-pool exhaustion, and slow queue growth.
- Produce the **capacity profile**: max sustainable throughput, p50/p95/p99 latency at target load, error rate at load, soak memory/connection trend. This feeds the SLO/SLA the Delivery Head locks at G5.5.

## Module 7 — Chaos / fault-injection

**Goal:** the system degrades gracefully and recovers. Full method in `knowledge/04-load-and-chaos.md`.

- **Kill a dependency:** stop the ERP/store mock mid-sync → verify retry with backoff, circuit-breaker opens, and failed work lands in the **DLQ** rather than corrupting state.
- **Force 429 / timeout:** the external returns 429 or hangs → verify `Retry-After` honored, bounded retries, no thundering herd.
- **Drop the DB:** kill Postgres mid-write → verify the in-flight transaction rolls back, the job is retryable, and no partial write leaks.
- Assert recovery: after the dependency returns, the circuit closes, the DLQ is drainable, and a reconciliation shows no permanent divergence.

## Module 8 — Cron-sync tests

**Goal:** the scheduled sync engine is correct under real timing pathologies.

- **Missed-run:** the scheduler missed a tick (process was down) → the next run covers the gap from the watermark; no data skipped.
- **Overlapping-run:** a slow run is still going when the next tick fires → the second run **does not stack** (lock / skip-if-running / single-flight); the slow run finishes cleanly.
- **Watermark-resume:** kill the process mid-sync → on restart it resumes from the last committed watermark with no dupes and no gap. (Verify the watermark advances only after the batch commits — the classic ordering bug.)
- **Timezone correctness:** "nightly at 2am" fires at the _client's_ 2am per Settings → Timezone (stored UTC, scheduled local); changing the timezone reschedules.

## Module 9 — Dashboard-UI QA (the only place Lighthouse lives)

Runs only when the build has a dashboard and the sprint touched it.

- **axe-core** — 0 violations across pages, Light + Dark mode (hard gate).
- **Responsive** — Playwright at `mobile-375 / mobile-414 / tablet-768 / desktop-1280 / desktop-1920`; sidebar→drawer; no horizontal scroll.
- **Functional** — Playwright (scripted) + **Claude in Chrome** (exploratory): login/JWT expiry+refresh, Users CRUD gated by VED, Roles matrix edits, Settings save incl. timezone-reschedule confirm, theme customizer persistence, master-dashboard drill-in.
- **Lighthouse** — run against the dashboard only; treat as a **flag**, not a blocker (the operator dashboard's bar is correctness + a11y, not Core Web Vitals).

---

## Per-gate module map (quick reference)

| Module                  | G4 (sprint)                      | G5 (milestone)             |
| ----------------------- | -------------------------------- | -------------------------- |
| 1 API contract          | if API touched                   | full                       |
| 2 Integration/contract  | if integration touched           | full                       |
| 3 Webhook               | if webhook touched               | full                       |
| 4 Security (OWASP-API)  | authz + OSV + secret each sprint | full + SAST/DAST           |
| 5 Data-integrity/parity | if sync touched                  | full reconciliation        |
| 6 Load + soak           | —                                | **yes (capacity profile)** |
| 7 Chaos                 | —                                | **yes**                    |
| 8 Cron-sync             | if sync engine touched           | full                       |
| 9 Dashboard-UI          | if UI touched                    | full                       |

---

Last reviewed: 2026-06-30 by Claude (initial Node.js build)
Next review due: 2026-09-30
