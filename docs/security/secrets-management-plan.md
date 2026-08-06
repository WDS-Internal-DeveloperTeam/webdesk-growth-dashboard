# Secrets Management Plan

**Status:** Draft. No secrets exist yet — every credential referenced across the ADRs and contracts is an unconfirmed setup-time input (`docs/project-state/setup-input-register.md`). This plan defines how they will be handled once they exist.

## Inventory of secrets this project will hold

- Database connection credentials (ADR-0006/0007, `docs/contracts/database-contract.md`)
- GitHub App private key + installation ID (ADR-0011, `docs/contracts/github-integration-contract.md`)
- Google Workspace OAuth client secret (ADR-0008, `docs/contracts/google-workspace-auth-contract.md`)
- Emergency-administrator TOTP secrets (ADR-0009)
- Google Workspace SMTP app-password (ADR-0015, `docs/contracts/google-workspace-smtp-contract.md`)
- WordPress Application Password credentials, per environment (ADR-0012, `docs/contracts/wordpress-integration-contract.md`)
- Vercel Blob read/write tokens (ADR-0014, `docs/contracts/vercel-blob-contract.md`)
- Job-queue/workflow credentials (ADR-0005, `docs/contracts/vercel-background-jobs-contract.md`)

## Handling rules

- **Storage:** environment variables managed through Vercel's own environment-variable configuration per environment (development, preview, staging, production) — never committed to any repository, never hardcoded, never stored in `project.json` or any other Git-tracked file (`.gitignore` at this project's root already excludes `.env*` proactively, per `docs/skill-build`'s packaging hygiene precedent).
- **Scope:** every credential is scoped to the narrowest permission that satisfies its integration contract's needs (e.g., WordPress Application Passwords are least-privilege, custom roles — never a full-admin account, per ADR-0012).
- **Rotation:** each credential is independently rotatable per environment — rotating a production credential must never require also rotating the corresponding development/staging credential, and vice versa.
- **Access:** who can view/set each environment's secrets in Vercel's dashboard is itself an access-control decision, aligned with the RBAC/separation-of-duties model (ADR-0010) — exact team member access is a Phase 1 setup task.

## What is explicitly out of scope for V1

A dedicated secrets-management service (e.g., HashiCorp Vault, AWS Secrets Manager) is not adopted — Vercel's own environment-variable mechanism is sufficient at this project's scale and keeps the "single hosting platform" story consistent with ADR-0003/0014. Revisit only if a concrete limitation of Vercel's mechanism is found.

## Incident response

A leaked or suspected-compromised credential is rotated immediately upon discovery, and the rotation itself is recorded as an audit event (ADR-0017) with the reason noted. A formal incident-response runbook is a Phase 1+ operational deliverable, not designed in full here.

## Validation method

Reviewed against `09_Security_Backup_Retention_Operations.md` and every integration contract's own "Secret handling" and "Environment separation" sections.

## Approval gate

G1, re-confirmed at G5.5 (pre-launch operational readiness) once real credentials actually exist.
