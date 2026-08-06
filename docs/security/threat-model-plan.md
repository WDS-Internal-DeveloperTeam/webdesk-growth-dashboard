# Threat Model Plan

**Status:** Draft. This resolves the previously-deferred "formal threat-modelling procedure" gap (`gap-resolution-matrix.md` GAP-17, the one item that report marked "Still Blocked" and correctly did not fabricate) by defining the procedure and its required coverage — it does not itself constitute a completed threat model, since no implementation exists yet to model threats against in detail. A concrete, per-module threat model is a Phase 1+ deliverable, built against this plan's structure.

## Procedure

For each area listed under "Required coverage" below, at the point that area moves from Architecture Defined to actual implementation (per `docs/traceability/phase-0-requirements-traceability.md`), the owning Architect/Backend role produces a STRIDE-style pass (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege) covering that specific area, reviewed by a second role (never the author — separation of duties, ADR-0010) before the implementation is considered ready for its QA gate.

## Required coverage

- **Authentication** — Google Workspace SSO flow (ADR-0008, `docs/contracts/google-workspace-auth-contract.md`) and the emergency-administrator TOTP path (ADR-0009): token forgery, replay, and the emergency path's own compromise risk.
- **Session handling** — session cookie issuance, expiry, and invalidation in `dashboard-api`.
- **Authorization** — RBAC enforcement (ADR-0010): privilege escalation via a missing or incorrectly-scoped server-side check.
- **Confidential fields** — any dashboard data classified Confidential or Restricted per `docs/security/data-classification.md`.
- **File uploads** — Vercel Blob integration (`docs/contracts/vercel-blob-contract.md`): malicious file content (not scanned for malware in V1, per ADR-0014 — this is an accepted, documented risk, not an oversight), oversized uploads, path/access-mode confusion.
- **Webhooks** — GitHub webhook receiver (`docs/contracts/github-integration-contract.md`): forged events, replay, signature-verification bypass.
- **GitHub** — App credential compromise, installation-permission scope creep.
- **WordPress** — Application Password compromise, REST API injection via untrusted WordPress-side content.
- **SMTP** — credential compromise, notification content injection (e.g., untrusted data rendered into an email template).
- **Background jobs** — queue/workflow/cron trigger forgery (`docs/contracts/vercel-background-jobs-contract.md`), handler re-invocation abuse.
- **Queues and retries** — idempotency violations under retry, duplicate side effects.
- **Audit logs** — tampering resistance (ADR-0017's append-only design is the primary control; this pass verifies no code path violates it).
- **Imports and exports** — the Service/SEO Library workbook import path specifically: injection via untrusted spreadsheet content, and the standing rule that its data is never auto-imported as approved content (WDS-014).
- **Admin recovery** — emergency-administrator path (ADR-0009) as both a legitimate recovery mechanism and its own attack surface.
- **Release and rollback** — the branch/release plan's (`docs/repository-plan/branch-and-release-plan.md`) integrity: unauthorized production deploys, rollback-triggered data loss.
- **Cross-environment isolation** — every integration contract's environment-separation requirement, verified as actually enforced, not just documented.
- **Manual Claude task packages** — the Ready for Claude Queue's task-package content itself as a potential injection vector into what Claude Code is instructed to do (ADR-0018's manual-review gate is the primary control here).

## Explicit non-claims

This plan does not claim uploaded files are malware-free (ADR-0014) — that is an accepted, documented gap for V1, not resolved by this threat model. It does not claim any of the "still requires verification" WordPress environment facts (REST API availability, plugin installation status, etc.) are secure by default — those are unverified, not verified-safe.

## Validation method

Each per-area STRIDE pass, once produced at implementation time, is reviewed against this plan's coverage list to confirm nothing was skipped.

## Approval gate

This plan itself requires G1 sign-off; each per-area pass requires its own review before the corresponding implementation reaches its QA gate (G4).
