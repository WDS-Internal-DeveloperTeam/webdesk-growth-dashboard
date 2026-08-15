---
tier: 1
load_when: ["webdesk-growth-dashboard", "security-topic", "code-review"]
description: "Deny-by-default RBAC with the dashboard's extended action vocabulary, the four permission axes (project/module/action/confidential-field), separation-of-duties enforcement, and OWASP-API controls applied to this project's specific surfaces."
---

# 12 — Dashboard Security Controls

> The base skill's RBAC mechanism (`nodejs/knowledge/security/02-authn-authz.md`) is reused unmodified in mechanism; this file states the project-specific configuration — the action vocabulary, the four permission axes, and separation-of-duties rules specific to this dashboard's workflows.

---

## Deny by default

Every module, every action, every confidential field starts with **zero access** for every role until explicitly granted. A role with no grants can view nothing. This is tested, not assumed — see `knowledge/13-testing-and-acceptance.md`.

---

## Permission axes (four, not two)

Permissions apply at:

1. **Project level** — a user's grants can be scoped to specific projects, not global by default.
2. **Module level** — the `role × module × action` matrix (base skill mechanism, unchanged).
3. **Action level** — the extended vocabulary below, per module.
4. **Confidential-field level** — a fifth, finer axis than the base skill's RBAC has modeled before: _view confidential fields_ and _edit confidential fields_ are their own grantable permissions, independent of a role's general view/edit grant on the module.

A grant at one axis never implies a grant at another. `view` on Business Knowledge Center does not imply `view confidential fields` on that same module's confidentiality-tiered records (`04_Data_Model_and_Ownership.md §6`: pricing, margin/internal cost, credentials, legal/security notes, confidential case-study sources, incident details).

---

## Action vocabulary

```
View, Create, Edit, Submit, Review, Approve, Reject, Publish, Unpublish,
Release, Roll back, Export, Execute, Configure,
View confidential fields, Edit confidential fields
```

This extends the base skill's seeded View/Edit/Delete-minimum, Create/Approve/Export/Import/Run/Configure/Manage-All-extended action model (`nodejs/knowledge/security/02-authn-authz.md`, `database/01-modeling-and-indexing.md`'s row-per-`(role,module,action)` schema) with `Submit`, `Review`, `Reject`, `Publish`, `Unpublish`, `Release`, `Rollback`, and the two confidential-field actions. The underlying schema — one row per granted `(role_id, module_id, action)`, VED-equivalent seeded minimum, any module can add any action it needs — is unchanged; only the vocabulary is project-specific.

Not every module needs every action. A module that has no publish concept (e.g., Business Knowledge Center) simply never grants `Publish`/`Unpublish` to any role for that module — the action existing in the global vocabulary does not mean every module exposes it.

---

## Field-level enforcement — server-side, never UI-only

Per `nodejs/knowledge/security/01-owasp-api.md` API3 (Broken Object Property Level Authorization): confidential and restricted fields are filtered **in the API response**, via an explicit DTO/serializer per confidentiality tier — never a raw Sequelize model serialized directly, and never "the frontend just doesn't render that field." The independent checks the API must enforce, per `06_Roles_and_Permissions.md §5`:

- View a confidential field
- Edit a confidential field
- Export a confidential field
- Include a confidential field in a Ready-for-Claude task package (per `Version 1 Claude execution boundary`, `SKILL.md §7` — a task package is itself a data export with its own confidentiality check, not exempt because it's "just for Claude")
- Include a confidential field in a Git artifact (an approved Markdown document or artifact that gets committed must not leak a restricted field into version-controlled history just because the artifact itself is approved for Git)

**Default is denied** on every one of these five checks independently — approving a record's general content does not implicitly approve exporting its confidential fields.

---

## Separation of duties

Restated as project-specific enforcement points, mirroring the base skill's own `_contracts/gate-format.md` "self-approval" rule and `_spine/orchestrator/SKILL.md` Critical Rule #2 (approver ≠ doer), applied to the dashboard's own workflows rather than to this delivery system's gates:

- **A developer cannot approve their own code review.**
- **A content author is not the sole final approver of the same content.**
- **Production release requires an approver distinct from the implementer** where practical.
- **Security exceptions require Security Owner or Super Admin authority** specifically — not any user with general "approve" permission on the Security/QA module.
- **Local emergency-admin account recovery requires a second authorized administrator** (`knowledge/05-google-workspace-sso-and-local-admin.md`).

Enforce this at the service layer (the approval service checks `approver_id != submitter_id` / `approver_id != implementer_id` before accepting an approval action), not merely by convention or UI hint — the base skill's "never rely on hiding for security" principle (`frontend/02-admin-dashboards.md`) applies here exactly: the UI can discourage self-approval, but the API is what actually prevents it.

---

## OWASP API Top 10 — project-specific hot spots

The base skill's baseline (`nodejs/knowledge/security/01-owasp-api.md`) applies system-wide; the highest-risk instances for this specific project:

| Risk                                           | Where it bites hardest here                                                                                                                                                                                                                                                  |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **API1 BOLA**                                  | Cross-project data leakage if `project_id` scoping (`knowledge/10`'s reinterpretation of NODE-104) is missed on any repository query — the single most damaging bug class carried over from the base skill's own framing, just with `project_id` substituted for `tenant_id` |
| **API3 Object Property Level Authorization**   | Confidential-field leakage (see above) — the dashboard's five-axis field-level check is a stricter instance of this risk than the base skill's baseline RBAC alone covers                                                                                                    |
| **API6 Sensitive Business Flows**              | Production release, security-exception approval, bulk export, and role/permission changes all need elevated-permission + audit protection beyond ordinary module access                                                                                                      |
| **API7 SSRF**                                  | Any dashboard feature that fetches a user-supplied URL (Design Reference Library's source URLs, for instance) must allowlist/validate the outbound host — never fetch an arbitrary operator-supplied URL server-side without validation                                      |
| **API10 Unsafe Consumption of 3rd-party APIs** | GitHub and WordPress responses are untrusted external input exactly like the base skill's ERP/store guidance — validated before use, never assumed to match an expected shape (NODE-005, NODE-008)                                                                           |

---

## Threat modelling and CSRF/token-storage — flagged, not resolved here

`docs/implementation/gap-analysis.md` item 17 identified two residual security decisions this profile does not resolve on its own: (1) formal threat modelling before production (no base-skill template for the _procedure_ exists to extend — the Architect role's architecture-review protocol covers architecture generally, not a threat-modelling method specifically), and (2) whether CSRF protection is in scope, which depends on whether refresh tokens end up in httpOnly cookies (CSRF-relevant) or held in-memory/bearer-only (typically CSRF-exempt) — a decision `knowledge/05-google-workspace-sso-and-local-admin.md` leaves to implementation per the base skill's own token-storage preference, not pre-decided here. Both remain G1.5-gated decisions, tracked in `docs/skill-build/unresolved-items.md`.

---

## What this file does not cover

- The Google Workspace SSO/TOTP mechanics that establish identity before any of this authorization logic runs → `knowledge/05-google-workspace-sso-and-local-admin.md`.
- Audit-event logging for every authorization decision covered here → `knowledge/10-data-ownership-and-audit.md`.
