# ADR-0010 — RBAC and Separation of Duties

**Status:** Accepted (formalizing an already-resolved decision — see below)

## Context

The dashboard has multiple distinct roles (per `06_Roles_and_Permissions.md`) with materially different capabilities — e.g., the ability to approve a release must not rest with the same role that built it, mirroring the software-delivery skill's own separation-of-duties rule (`knowledge/12-dashboard-security-controls.md`) that was already applied once this session (the agent that built this skill overlay did not also approve it — see `docs/skill-build/approval-checklist.md`).

## Decision

Role-based access control is enforced centrally in `dashboard-api` (per ADR-0002, all authorization logic lives there, never duplicated into `dashboard-web`). Roles and their permitted actions are defined per `06_Roles_and_Permissions.md`, with the following separation-of-duties rules restated as hard requirements, not guidelines:

- The role that authors a release/change is never the same role authorized to approve it for production.
- Emergency-administrator access (ADR-0009) is logged and reviewed separately from normal role-based actions.
- Every authorization decision is checked server-side in `dashboard-api`; the UI hiding a button is a convenience, never the actual access-control mechanism.

## Alternatives considered

- **Attribute-based access control (ABAC) instead of RBAC** — not selected: `06_Roles_and_Permissions.md` already defines a role-based model, and no requirement calls for the added flexibility (and complexity) of ABAC at this project's scale.
- **Client-side-only permission checks (hiding UI elements)** — rejected outright as a security control; may still be used for UX purposes but never as the enforcement mechanism.

## Consequences

Every new dashboard feature must declare which role(s) may perform each action as part of its own spec, checked in `dashboard-api`, before implementation — a Phase 1+ requirement carried forward from this ADR.

## Security considerations

Centralized, server-side RBAC is the primary defense against privilege escalation; `docs/security/threat-model-plan.md` covers authorization as one of its explicit required-coverage areas.

## Operational considerations

Role assignment changes (who has what role) need an auditable change process — covered by the audit-event architecture (ADR-0017), not a separate mechanism.

## Validation method

Reviewed against `06_Roles_and_Permissions.md` and profile `knowledge/12-dashboard-security-controls.md`.

## Approval gate

G1 (architecture approval) and G-Contracts (once the RBAC model is expressed as part of the API's integration contracts).

## Related dashboard requirements

`06_Roles_and_Permissions.md`.

## Related skill rules

Profile `knowledge/12-dashboard-security-controls.md`.

## Open setup values

None — the role model itself is fully specified in the dashboard documentation pack; no unconfirmed setup value blocks this decision.
