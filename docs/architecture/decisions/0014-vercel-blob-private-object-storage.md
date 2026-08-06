# ADR-0014 — Vercel Blob Private Object Storage

**Status:** Accepted (formalizing an already-resolved decision — see below)

## Context

The dashboard needs file storage for uploads (e.g., case-study assets, import files, generated reports). The base skill's documented default is S3; the Master Specification requires Vercel Blob to keep the entire hosting story on one platform.

## Decision

Use Vercel Blob, in private (not public) access mode by default, for all dashboard file storage. Public access is granted per-file only where a specific feature explicitly requires publicly-servable content (e.g., a public-facing asset), never as a default bucket-wide setting. This overrides the base skill's S3 default per the Master Specification's explicit requirement — recorded here as an approved override, not silently applied.

**Upload rules, per `01_Dashboard_Master_Specification.md §15` ("Upload rules") — approved, not open:**

- **Allowed file types:** JPEG, PNG, WebP, GIF, PDF, DOCX, XLSX, CSV, TXT, Markdown, MP4.
- **Maximum sizes:** images and documents — 25 MB; MP4 — 250 MB.
- **Blocked, always:** executables, SVG, archives, macro-enabled documents, and any unsupported or prohibited format.
- Files above the Vercel Function request-body size limit (a separate, platform-determined fact — see profile `knowledge/08-vercel-blob-and-file-handling.md`, confirmed at implementation time, not a design choice) use direct authenticated browser-to-Blob upload rather than proxying through a Function, per a one-time, short-lived, dashboard-issued upload authorization.
- Server-side MIME, extension, and checksum validation are required on every upload — file-extension trust alone is not sufficient.
- **Malware scanning is deferred** (Master Specification §16, "Version 1 exclusions" — mandatory malware-scanning integration is explicitly out of scope for V1). Until a scanning provider is configured, files are marked `Scan Not Configured`; the system must never claim or imply a file is malware-free.

## Alternatives considered

- **Amazon S3 (base skill default)** — overridden: no functional requirement favors S3 over Vercel Blob for this project, and Vercel Blob keeps storage on the same platform as hosting/compute, avoiding a second cloud provider's IAM and networking surface.
- **Storing files directly in PostgreSQL (bytea columns)** — rejected: inappropriate for file-sized binary data at any meaningful scale; conflates the relational database's role with object storage's role.

## Consequences

File-handling code is written against Vercel Blob's SDK/API rather than the S3-compatible API many other tools assume — any future third-party integration expecting S3 compatibility would need an adapter.

## Security considerations

Private-by-default access mode means every file requires an explicit, audited decision to make it public — accidental public exposure is not the default failure mode. Uploaded files are not claimed to be malware-free by this architecture; a malware-scanning provider is explicitly deferred to post-V1 per the dashboard pack's own scope (`knowledge/08-vercel-blob-and-file-handling.md`), not silently assumed handled.

## Operational considerations

Upload-flow UX (chunked uploads, progress reporting) is a Phase 1+ implementation concern. **Blob backup, per `09_Security_Backup_Retention_Operations.md §4` ("Blob") — approved, not open:** Vercel Blob files are copied daily to an independent, encrypted North America East Coast object store, checksum-verified, with daily versions retained 35 days and monthly copies retained 90 days (unless superseded by a later approved policy). This is distinct from, and in addition to, Vercel Blob's own platform durability.

## Validation method

Reviewed against profile `knowledge/08-vercel-blob-and-file-handling.md`.

## Approval gate

G-Contracts (formalized into `docs/contracts/vercel-blob-contract.md`).

## Related dashboard requirements

`01_Dashboard_Master_Specification.md §15` (Upload rules) and `§16` (V1 exclusions), `03_Detailed_Module_Specifications.md` (Asset Library), `09_Security_Backup_Retention_Operations.md §4` (Blob backup).

## Related skill rules

Profile `knowledge/08-vercel-blob-and-file-handling.md`.

## Open setup values

Only the Vercel Function request-body size limit (a platform fact, confirmed at implementation time, not a design choice — see profile `knowledge/08-vercel-blob-and-file-handling.md`) and the future malware-scanning provider (explicitly deferred to post-V1 by the Master Specification itself) remain open. **File type/size limits and Blob backup cadence are already approved — not open setup values** — this corrects an earlier draft of this ADR, which incorrectly listed the upload-size threshold as unresolved when it is in fact specified in `01_Dashboard_Master_Specification.md §15`.
