---
tier: 2
load_when: ["code-production", "frontend-active", "design"]
description: "Building the admin dashboard against the SOW-driven dashboard standard — implement only SOW-defined modules; RBAC-gated UI, theme customizer, master vs per-client; JWT + per-module RBAC + timezone are fixed contracts."
---

# Frontend 02 — Admin Dashboards

> How to build the dashboard the Frontend role implements from the HTML mockups approved at G2. The canonical spec is the **SOW-driven** `_spine/designer-agent/knowledge/01-dashboard-standards.md` (and the per-module criteria in `_spine/designer-agent/knowledge/dashboard-modules/*`). Dashboard content is **SOW-driven**: build only the modules/fields/KPIs the SOW defines — do not hard-code ERP/ecommerce/CRM/sync modules or Store-Name/API-Key/Access-Token settings unless the SOW named them. The fixed system contracts (JWT auth, per-client + master tenancy, per-module RBAC, Settings-driven timezone) apply on every build. This file is the React/Next implementation guidance. Reference designs: **wowdash**, **upbond** (linked in the spec).

---

## Two dashboard scopes

| Scope                    | Who                    | What it shows                                                                                                                    |
| ------------------------ | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Per-client instance**  | one install per client | that client's stores/ERP only — every query tenant-scoped                                                                        |
| **Master (super-admin)** | WebDesk                | cross-client oversight: all instances, each instance's **Project Health Score** (§14), sync status, error/alert rollup, drill-in |

The master role is the **only** cross-tenant scope. Everything else is scoped to one `tenant_id` (NODE-104). Build the per-client dashboard first; the master dashboard reuses the same components with the tenant scope widened for the super-admin role only.

---

## Modules — implement only what the SOW defines

Build modules as a shared module set so a new module inherits standard monitoring/reporting and only defines its own metrics (the **centralized KPI/metrics framework**). Which modules exist is **SOW-driven** — the designer's SOW analysis at G2 determines the set. Common SOW-derived modules (see the corresponding `dashboard-modules/*` criteria), each present only if the SOW calls for it:

- **Dashboard home** — SOW-derived KPI cards, charts, system-health items, recent activity, and alerts. New modules plug their metric into the same framework.
- **Roles & Permissions** — Add/Edit Role: name + **per-module permission matrix**. **View/Edit/Delete is the minimum**; extend per module with Create/Approve/Export/Import/Run/Configure/Manage All where the module needs them. No Role Status / Active-Inactive.
- **Settings** — only the sections the SOW requires (company info, generalized platform/integration connections, email, webhooks, data-processing, business rules, security). Do not hard-code Store-Name/API-Key/Access-Token/Client-Secret/API-Path unless the SOW names them. **Timezone** always drives cron/activity — surface it clearly; changing it reschedules server-side jobs.
- **Other SOW modules** — e.g. Notification Settings, Scheduled Jobs, Process History, Email Templates, plus any project-specific module the SOW defines.
- **Theme Customizer** — Skin (Default/Bordered), Mode (Light/Dark/Semi-Dark), Primary color (swatches + hex); Layout (Content Full/Boxed), AppBar (Fixed/Static/Hidden), Footer (Fixed/Static/Hidden).

Any timestamp/activity surface displays in the configured timezone (store UTC, display configured tz).

---

## RBAC-gated UI

Permissions come from the server (the `role × module × {permissions}` matrix — VED minimum, extended per module). The client uses them to render, the server enforces them on every request.

```jsx
const { can } = usePermissions(); // hydrated from /api/v1/me
{
  can("users", "view") && <UsersMenuItem />;
} // hide the whole module if no view
<Button disabled={!can("users", "edit")}>Edit</Button>;
{
  can("users", "delete") && <DeleteAction />;
}
```

Rules:

- **Hide modules** the role can't `view`; **disable/omit actions** the role can't `edit`/`delete`.
- **Never rely on hiding for security** — the corresponding API route checks the same permission (`security/02-authn-authz.md`). The UI gate prevents confusion; the server gate prevents access.
- Render the menu from the permission set so adding a module + its permissions automatically surfaces it for roles that have it.

---

## Theme customizer (implementation)

Drive theming from **CSS variables** set on a root attribute, persisted per user (or per instance default). This makes Skin/Mode/Primary swaps a class/variable change, not a re-render of styled components.

```jsx
<html data-skin={skin} data-mode={mode} style={{ '--primary': primaryHex }}>
```

- **Mode** (Light/Dark/Semi-Dark) toggles a `data-mode` attribute; respect `prefers-color-scheme` as the initial default.
- **Primary color** swatches set `--primary`; the hex input validates as a color.
- **Layout/AppBar/Footer** options map to layout-class modifiers on the shell.
- Persist the choice (server-side per user) so it survives reload; the master dashboard can set an instance default.

---

## Master vs per-client implementation notes

- Same component library, two data scopes. Guard the master routes behind the super-admin role and a distinct, audited cross-tenant API surface — not the per-client API with the tenant filter removed ad hoc.
- The master **health rollup** consumes the Health Score (`§14`) and the sync/observability data (`integration/04-observability.md`) per instance. It's a read/monitoring surface — drill-in opens the instance in (scoped) read mode.
- Don't fetch all tenants' raw data into the master client; aggregate server-side and send summaries, then lazy-load detail on drill-in (keeps payloads and blast radius small).

---

## Hand-off from design

The mockups are **HTML, approved at G2** (D-DES-01: HTML mockups only). Implement faithfully against them and the dashboard-standards file; flag any divergence back to the Design lead rather than improvising layout. Aligns with QA's dashboard-UI tests (`testing/03`).

## Milestone QA modal (delivery acceptance criterion)

Every generated dashboard implements a **Milestone QA modal**, per `_spine/designer-agent/knowledge/01-dashboard-standards.md` §4. Acceptance criteria for the build:

- Rendered in the **master / delivery-oversight** dashboard (per-client only if the SOW asks for client milestone visibility).
- A milestone list/timeline with a **View QA** action per milestone opens the modal.
- The modal reads the milestone QA record (delivery API backed by `qa-reports/milestone-[id]-qa.md` + `project.json`), shows the **status badge** (PASS / PASS_WITH_FLAGS / FAIL), the QA summary, carried flags, and a link to the milestone summary MD; FAIL shows the fix plan.
- **Empty/loading/error/no-access** states apply like any module: if no QA report exists, show "Milestone QA not run yet" — do **not** render a green/pass state by default.
- Status is **read live** from the delivery record, never cached or hand-set in the UI (mirrors the gate-status single-source-of-truth rule).
- Permission-gated by the delivery/oversight module (View to see; Run/Execute if a re-run action is exposed).
- QA covers it: the dashboard-UI test suite (`testing/03-dashboard-ui-tests.md`) includes the modal's states.
