# Data Classification

**Status:** Draft. Classifies the data categories already named across the dashboard documentation pack and this Phase 0's own architecture decisions; does not invent new data categories.

## Classification levels

- **Public** — safe to expose without authentication (e.g., published Case Study content once approved).
- **Internal** — requires authentication, no special sensitivity beyond normal RBAC (e.g., non-sensitive project metadata).
- **Confidential** — requires specific role/permission beyond basic authentication (e.g., client contact details, unpublished content).
- **Restricted** — highest sensitivity; access logged and reviewed, credentials/secrets themselves (never stored as application data at all — see `docs/security/secrets-management-plan.md`).

## Classification by data category

| Category | Level | Notes |
|---|---|---|
| Published dashboard content (approved Case Studies, Services) | Public | Only once through the module's own approval workflow |
| Unpublished/draft content | Confidential | Visible only to roles with content-authoring/review permission |
| User accounts (dashboard staff) | Internal | Identity comes from Google Workspace; dashboard stores role assignment, not credentials |
| Client contact details (`project.json.project.client`) | Confidential | |
| Audit events | Restricted | Append-only (ADR-0017); access to view is itself a permission, not universally readable |
| Emergency-administrator account list and TOTP state | Restricted | See ADR-0009 |
| Service/SEO Library workbook content | Confidential, Advisory-only | Never treated as approved business truth regardless of classification level, per WDS-014 — classification here is about who may *see* it, not whether it may be *acted on* automatically |
| WordPress integration credentials | Restricted (secret, not application data) | See `docs/security/secrets-management-plan.md` |
| GitHub App private key | Restricted (secret) | |
| SMTP credentials | Restricted (secret) | |
| Uploaded files (general) | Confidential by default | Per-file override to Public requires explicit action (ADR-0014) |
| Scan results | Internal to Confidential | Depends on module — a scan result referencing unpublished content inherits that content's classification |

## Handling rules

- Confidential and Restricted data must never be logged in plaintext in general application logs — audit events (ADR-0017) are the approved mechanism for recording access to sensitive data, not ad hoc `console.log`-style debugging output.
- No Confidential or Restricted data is ever included in a Claude Code task package's general context without specific, deliberate scoping — mirrors WDS-014's "never copy pricing/confidential fields into general agent context" rule, generalized to all Confidential/Restricted data, not just the workbook.

## Validation method

Reviewed against `04_Data_Model_and_Ownership.md`, `09_Security_Backup_Retention_Operations.md`, and `knowledge/00-scope-and-precedence.md §6`/WDS-014.

## Approval gate

G1, and re-reviewed at G-Schema once the concrete database schema exists to classify column-by-column.
