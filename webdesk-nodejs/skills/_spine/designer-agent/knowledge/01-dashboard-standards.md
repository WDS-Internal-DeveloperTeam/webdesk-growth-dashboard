---
tier: 2
load_when: ["designer-active", "design", "mockup-production"]
description: The SOW-driven minimum dashboard standard. Every dashboard is built from the SOW — modules, fields, KPIs, health items, alerts, and permission modules come ONLY from what the SOW defines. JWT auth, per-client + master tenancy, per-module RBAC (VED minimum, extended per module), and Settings-driven timezone are the fixed system contracts. Points to per-module criteria in dashboard-modules/.
---

# Dashboard Standard — SOW-Driven (minimum design criteria)

> This is the **minimum design criteria** for ANY dashboard-design project in the Node.js delivery system. The dashboard is **SOW-driven**: you analyze the SOW first and include ONLY the modules, fields, KPIs, charts, health items, activity, alerts, and permission-modules the SOW defines. You do **not** hard-code platform-specific items — ERP, BigCommerce, ecommerce, CRM, sync, inventory, pricing, orders, bookings, cron — unless the SOW names them. What the dashboard _contains_ is derived from the SOW; only the platform contracts in §3 are fixed system-wide.
>
> Reference admin themes for layout/interaction vocabulary: **wowdash** (`https://wowdash.wowtheme7.com/php/demo/index.html`) and **upbond** (`https://themesdesign.in/upbond/layouts/index.html`). Borrow structure and component patterns, not pixels.

This file is the source of truth for the Designer Agent's mockup at G2 and for the Frontend role's React/Next build after G2. Read the relevant `dashboard-modules/*` file for the module you are designing.

---

## 1. The SOW-first rule (do this before any UI)

Before designing anything, analyze the SOW and identify:

1. Main business workflows
2. Core modules
3. Admin screens
4. Background processes
5. Integrations
6. Reports
7. User types
8. Operational metrics
9. Health monitoring areas
10. Alerts / exception scenarios

Then build **only** from those SOW items:

- **KPIs / charts** — from the SOW's metrics, workflows, and modules.
- **System health items** — from the SOW's systems, integrations, services, and workflows.
- **Recent activity / alerts** — from the SOW's events and exception scenarios.
- **Permission modules** — from the SOW's functional modules, admin screens, reports, settings, integration areas, approval flows, and logs.

**Never hard-code** examples like ERP API Status, BigCommerce API Status, Inventory Synced, Pricing Synced, Orders Synced, Cron Jobs, Store Connection, ERP Connection, SMTP, Client Secret / Access Token / API Path, Failed Sync Alert — **unless the SOW clearly defines that project type.** A different SOW yields a different dashboard. The final design must not look ERP/ecommerce/CRM/sync/booking-specific unless the SOW says so.

The full procedure and the "output the analysis section before the UI" rule live in `dashboard-modules/00-sow-analysis-first.md`. **Every module** emits its short SOW-analysis section before its UI (each module's "Final Output Rule").

---

## 2. Cross-cutting minimum criteria (every module must have all of these)

Regardless of what the SOW defines, every module you design must include:

1. **SOW-analysis output section before UI** — the module's "Final Output Rule": list what was identified from the SOW (KPIs / fields / statuses / actions / permissions / assumptions) _before_ generating the UI.
2. **Permission-awareness** — distinguish **view** vs **edit/manage**; render a clear **no-access** state for users without permission. UI gating is convenience; the server still enforces (§3).
3. **States: Empty / Loading / Error / No-Access / Read-Only** — every data surface handles all five (skeletons on load, clear empty CTA, retry on error, no-access message, read-only view for view-only users).
4. **Audit trail where the module changes data** — record action, performed by, date/time, changed field, previous value, new value, result. Sensitive values are never shown in full.
5. **Responsive** — define desktop / tablet / mobile behavior (tables become cards or horizontal scroll on mobile; filters collapse; drawers go full-screen).
6. **Toasts + confirmation dialogs** — success/error toasts after actions; confirmation before destructive or critical changes; unsaved-changes warnings on forms.
7. **Masked sensitive fields** — credentials/secrets masked by default, reveal only with permission, show-last-4 after save, never echoed in full or logged.

---

## 3. Fixed platform contracts (system-wide — NOT per-SOW)

These four are the same on every build regardless of SOW. The SOW drives module _content_; these drive the platform.

### 3.1 Auth — JWT

- JWT **access + refresh** tokens (short-lived access, longer-lived refresh).
- **Refresh-token rotation** — each refresh issues a new refresh token and invalidates the prior one.
- **Server-side revocation** — logout / "revoke sessions" add the token (jti) to a revocation list the API checks; JWTs are not trusted blindly to expiry.
- Login UX models show/hide password and generic failed-login messaging (no "user not found" vs "wrong password" leak). See `dashboard-modules/08-login.md`.

### 3.2 Tenancy — per-client instance + Master dashboard

- **Per-client instance** — one dashboard per client install, every query tenant-scoped; a user in client A can never see client B.
- **Master dashboard (super-admin)** — the only cross-tenant scope: cross-client oversight with per-instance **health scores**, aggregated status, and alert rollup, drill-in to a per-client instance in read context. Not a re-skin of the per-client home. No per-client role can reach it.

### 3.3 RBAC — per-module permission matrix (VED minimum, extended per module)

The permission model is a **matrix**: `role × module × {permissions}`.

- **View / Edit / Delete is the minimum permission set** every module carries.
- Modules **extend** the set with the SOW/MD dynamic permission types **where the module needs them**: **Create, Approve, Export, Import, Run / Execute, Configure, Manage All**. Not every module needs every type — a permission that does not apply is shown disabled / N/A / omitted.
- Modules (matrix rows) come **only from the SOW** — never hard-code a fixed module list (Dashboard, Users, Settings, Reports, Orders, Products, Logs, Integrations, Cron Jobs, Sync History, Email Templates) unless the SOW names them.
- **View** gates module visibility + read; **Edit** gates create/update; **Delete** gates destructive actions; extended types gate their specific action (e.g. Run/Execute gates "run a job", Approve gates approvals).
- **DROP "Role Status / Active-Inactive"** entirely (per the MD): no role status field, no Active/Inactive dropdown or badge, no status filter, no deactivate-role option. Roles are managed only through Create / Edit / Clone / Delete / Reassign-before-delete / protected-role rules.
- The backend enforces RBAC server-side on every endpoint regardless of the UI. See `dashboard-modules/02-roles-permissions.md`.

### 3.4 Timezone — lives in Settings, drives everything operational

- The **Settings → Timezone** value is the system clock: all cron schedules / background windows are computed in it, and all displayed timestamps render in it.
- **Storage is UTC; display is the configured timezone.** The scheduler reads the configured tz, never the server's local tz. Changing the timezone reschedules background jobs (a confirm step). See `dashboard-modules/03-settings.md`.

---

## 4. Per-module criteria (read the one for the module you're designing)

Each file is the de-escaped, faithful distillation of that module's SOW-driven criteria — fields, states, rules, permission types, responsive behavior, and the analysis-first "Final Output Rule". A module appears in a given dashboard **only if the SOW calls for it**.

```
dashboard-modules/
  00-sow-analysis-first.md   ← universal SOW-analysis procedure + "analysis section before UI" rule
  01-dashboard-home.md       ← KPIs, charts, system health, recent activity, alerts (all SOW-derived)
  02-roles-permissions.md    ← roles + dynamic permission matrix (VED min), no role-status
  03-settings.md             ← SOW-driven settings sections; timezone; masked credentials; audit
  04-notification-settings.md← web-dashboard + email notification prefs (SOW events only)
  05-scheduled-jobs.md       ← scheduled/background jobs (only if SOW defines them)
  06-process-history.md      ← process/sync/activity history (only if SOW defines processes)
  07-email-templates.md      ← system communication templates (SOW templates only)
  08-login.md                ← JWT login page + demo credentials + states
  09-forgot-password.md      ← account-recovery request page
```

---

## 5. Mockup acceptance checklist (for G2)

The Designer Agent's mockup is G2-ready only when:

- [ ] The SOW-analysis section was produced first, and **every module present is justified by a SOW item** (no hard-coded ERP/ecommerce/sync/CRM/booking module unless the SOW named it).
- [ ] Each module carries the §2 cross-cutting minimums (states, permission-awareness, audit where it mutates, responsive, toasts/confirm, masked secrets).
- [ ] JWT login screen with show/hide password and a sensible error state.
- [ ] Master dashboard with per-instance health score, aggregated status, alert rollup, drill-in.
- [ ] RBAC is permission-driven in the shell (nav + actions toggle with the sample role); matrix uses VED as the minimum, extended per module; **no Role Status / Active-Inactive anywhere**.
- [ ] Timestamps are timezone-aware (display configured tz, store UTC); Settings explains the reschedule effect.
- [ ] Secret fields masked with reveal; show-last-4 after save.
- [ ] WCAG AA passes in both Light and Dark modes; responsive at all defined viewports.

## 4. System criterion — Milestone QA modal (delivery oversight)

Separate from the SOW-driven modules above, every dashboard the system generates carries one fixed **delivery** feature: a **Milestone QA modal** (popup) that surfaces each milestone's QA result. This closes pilot feedback #1 (the milestone QA popup was missing).

- **Where it lives:** the **Master / delivery-oversight** dashboard (§3.2), alongside health scores and delivery status. On a **per-client** dashboard it appears **only if that SOW includes delivery/milestone visibility for the client** — a client's operational dashboard is not required to show internal delivery QA.
- **Trigger:** opens when a milestone closes, and on demand from the delivery-status/milestone list (a "View QA" action per milestone).
- **Data source:** the delivery record — `qa-reports/milestone-[id]-qa.md` and `project.json` — **never** client operational data. If no milestone QA report exists yet, the modal shows "Milestone QA not run" (it never fabricates a pass).
- **Contents:** milestone id + name, QA **status** (PASS / PASS_WITH_FLAGS / FAIL) as a colored badge, the QA summary (regression, fitness, load/chaos, security, open bugs P1/P2/P3), flags carried forward, and a link to the milestone summary MD. FAIL shows the fix plan.
- **Consistency:** the modal reads the same `milestone-[id]-qa.md` the PM Agent embeds in the milestone summary MD (`_spine/pm-agent/knowledge/05-milestone-framework.md`) — one source, two surfaces. It never hand-copies status (same single-source-of-truth rule as gates).
- **Permission:** gated by the delivery/oversight module's **View** (and a "re-run QA" action, if offered, by **Run/Execute**) — per the extensible RBAC model in §3.3.

---

Last reviewed: 2026-07-08 by Claude (SOW-driven rewrite — corrects the hard-coded ERP/store overfitting defect)
Next review due: 2026-10-08
