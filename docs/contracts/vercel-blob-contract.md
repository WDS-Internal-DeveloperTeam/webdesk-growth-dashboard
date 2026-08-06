# Integration Contract — Vercel Blob

**Status:** Draft. No adapter code exists yet. This contract defines the intended shape so implementation can proceed against an agreed interface, not so integration can begin.

## Purpose

Provide private (default) object storage for dashboard file uploads, per ADR-0014.

## Trust boundary

`dashboard-api`'s Blob adapter (`packages/integrations`) is the only code that holds Blob storage tokens or makes upload/access-control decisions. `dashboard-web` uploads through `dashboard-api`, not directly to Blob with a client-side token, unless a specific feature's performance needs later justify a signed-upload-URL pattern — not assumed by default.

## Authentication

Vercel Blob read/write tokens, scoped per environment.

## Authorization

Every file's access mode (private vs. public) is an explicit, per-file decision made by the uploading module's business logic, checked against the uploading user's RBAC permissions (ADR-0010) — never a bucket-wide default that individual code paths must remember to override.

## Inputs and outputs

- **Inbound:** file upload requests (case-study assets, import files) from authenticated dashboard users.
- **Outbound:** signed, time-limited URLs for authorized access to private files; direct public URLs only for files explicitly marked public.

## Validation

Uploaded file type and size are validated before storage; the exact size threshold is an open setup value (see below). Uploaded files are **not** claimed to be malware-free — no scanning is performed in V1, per the dashboard pack's own explicit deferral of malware scanning to post-V1.

## Error handling

Upload failures (size exceeded, storage quota, transient error) return a clear, distinguishable error to the uploading user — never a silent partial upload.

## Retry and idempotency

Uploads are not automatically retried server-side (retry is a client-side concern for interactive uploads); the adapter does not create duplicate Blob objects on a client-initiated retry of a failed upload, achieved via a stable client-generated upload identifier.

## Rate limits

Vercel Blob's own storage and bandwidth limits apply; not expected to be a practical constraint at this project's scale for V1.

## Audit events

File uploads and any access-mode changes (private → public) are recorded as audit events per ADR-0017 — a file being made public is a security-relevant event.

## Secret handling

Blob read/write tokens managed per `docs/security/secrets-management-plan.md`, per environment.

## Environment separation

Separate Blob stores (or clearly namespaced paths) per environment — a development upload must never be reachable through a production URL.

## Failure recovery

Standard Vercel Blob durability applies; no separate dashboard-side backup of Blob contents is designed for V1 beyond what `knowledge/11-retention-backup-and-operations.md` already establishes for the project generally.

## Test requirements

Adapter tests against a non-production Blob store; access-mode enforcement specifically tested (a private file must not be reachable by an unauthorized/unauthenticated request).

## Production approval requirements

None beyond standard module-level review — file storage itself is not a separately gated action, though specific uploaded content may be subject to the relevant module's own approval workflow (e.g., a Case Study asset going through content approval).

## Open items

Upload-size threshold and future malware-scanning provider are both explicitly deferred — see `docs/project-state/setup-input-register.md`, not blocking Phase 0.
