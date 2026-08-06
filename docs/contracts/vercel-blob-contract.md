# Integration Contract — Vercel Blob

**Status:** Draft. No adapter code exists yet. This contract defines the intended shape so implementation can proceed against an agreed interface, not so integration can begin.

## Purpose

Provide private (default) object storage for dashboard file uploads, per ADR-0014.

## Trust boundary

`dashboard-api`'s Blob adapter (`packages/integrations`) is the only code that holds Blob storage tokens or makes upload/access-control decisions. Two upload paths exist, both authorized by `dashboard-api`:

- **Proxied upload** (files under the Vercel Function request-body limit): `dashboard-web` sends the file to `dashboard-api`, which validates and forwards it to Blob.
- **Direct authenticated browser upload** (required for files above the Function request-body limit, per ADR-0014 and `01_Dashboard_Master_Specification.md §15`): `dashboard-api` issues a one-time, short-lived upload authorization; the browser uploads directly to Blob using it. This is not an optional future optimization — it is required for any file the Function request limit would otherwise reject (which, given the approved 25 MB/250 MB maximums, is expected to include most MP4 uploads and some larger documents).

Either way, `dashboard-web` never holds a long-lived or broadly-scoped Blob credential — only a single-use authorization for one specific upload.

## Authentication

Vercel Blob read/write tokens, scoped per environment.

## Authorization

Every file's access mode (private vs. public) is an explicit, per-file decision made by the uploading module's business logic, checked against the uploading user's RBAC permissions (ADR-0010) — never a bucket-wide default that individual code paths must remember to override.

## Inputs and outputs

- **Inbound:** file upload requests (case-study assets, import files) from authenticated dashboard users.
- **Outbound:** signed, time-limited URLs for authorized access to private files; direct public URLs only for files explicitly marked public.

## Validation

Per `01_Dashboard_Master_Specification.md §15` — approved, not open:

- **Allowed types:** JPEG, PNG, WebP, GIF, PDF, DOCX, XLSX, CSV, TXT, Markdown, MP4.
- **Maximum sizes:** images and documents 25 MB; MP4 250 MB.
- **Always blocked:** executables, SVG, archives, macro-enabled documents, any unsupported/prohibited format.
- Validation is server-side: MIME type, file extension, and checksum are all checked — extension alone is never trusted, and client-reported MIME type is verified against actual file content.

Uploaded files are **not** claimed to be malware-free — no scanning is performed in V1, per the Master Specification's own explicit deferral (§16). Until a scanning provider is configured, uploads are marked `Scan Not Configured`.

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

Per `09_Security_Backup_Retention_Operations.md §4` ("Blob") — approved, not open: Vercel Blob files are copied daily to an independent, encrypted North America East Coast object store, checksum-verified. Daily versions are retained 35 days; monthly copies are retained 90 days, unless superseded by a later approved policy. This is a real, designed backup mechanism for V1 — not deferred, and not merely "standard Vercel Blob durability."

## Test requirements

Adapter tests against a non-production Blob store; access-mode enforcement specifically tested (a private file must not be reachable by an unauthorized/unauthenticated request).

## Production approval requirements

None beyond standard module-level review — file storage itself is not a separately gated action, though specific uploaded content may be subject to the relevant module's own approval workflow (e.g., a Case Study asset going through content approval).

## Open items

Only the Vercel Function request-body size limit (the threshold separating proxied vs. direct-to-Blob upload — a platform fact, confirmed at implementation time) and the future malware-scanning provider (explicitly deferred to post-V1) remain open — see `docs/project-state/setup-input-register.md`. File type/size limits (25 MB / 250 MB) and Blob backup cadence are approved, not open.
