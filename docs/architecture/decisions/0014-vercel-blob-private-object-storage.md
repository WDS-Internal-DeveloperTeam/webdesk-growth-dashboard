# ADR-0014 — Vercel Blob Private Object Storage

**Status:** Accepted (formalizing an already-resolved decision — see below)

## Context

The dashboard needs file storage for uploads (e.g., case-study assets, import files, generated reports). The base skill's documented default is S3; the Master Specification requires Vercel Blob to keep the entire hosting story on one platform.

## Decision

Use Vercel Blob, in private (not public) access mode by default, for all dashboard file storage. Public access is granted per-file only where a specific feature explicitly requires publicly-servable content (e.g., a public-facing asset), never as a default bucket-wide setting. This overrides the base skill's S3 default per the Master Specification's explicit requirement — recorded here as an approved override, not silently applied.

## Alternatives considered

- **Amazon S3 (base skill default)** — overridden: no functional requirement favors S3 over Vercel Blob for this project, and Vercel Blob keeps storage on the same platform as hosting/compute, avoiding a second cloud provider's IAM and networking surface.
- **Storing files directly in PostgreSQL (bytea columns)** — rejected: inappropriate for file-sized binary data at any meaningful scale; conflates the relational database's role with object storage's role.

## Consequences

File-handling code is written against Vercel Blob's SDK/API rather than the S3-compatible API many other tools assume — any future third-party integration expecting S3 compatibility would need an adapter.

## Security considerations

Private-by-default access mode means every file requires an explicit, audited decision to make it public — accidental public exposure is not the default failure mode. Uploaded files are not claimed to be malware-free by this architecture; a malware-scanning provider is explicitly deferred to post-V1 per the dashboard pack's own scope (`knowledge/08-vercel-blob-and-file-handling.md`), not silently assumed handled.

## Operational considerations

File-size limits and upload-flow UX (chunked uploads, progress reporting) are Phase 1+ implementation concerns; the upload-size threshold itself is flagged in the compatibility review's gap analysis as needing a concrete number before the upload flow is built.

## Validation method

Reviewed against profile `knowledge/08-vercel-blob-and-file-handling.md`.

## Approval gate

G-Contracts (formalized into `docs/contracts/vercel-blob-contract.md`).

## Related dashboard requirements

`03_Detailed_Module_Specifications.md`, `09_Security_Backup_Retention_Operations.md`.

## Related skill rules

Profile `knowledge/08-vercel-blob-and-file-handling.md`.

## Open setup values

Upload-size threshold and future malware-scanning provider — both explicitly deferred, tracked in `docs/project-state/setup-input-register.md`, not blocking Phase 0.
