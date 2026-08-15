---
tier: 2
load_when: ["webdesk-growth-dashboard", "code-production", "security-topic"]
description: "Private Vercel Blob file storage — upload limits, allowed/blocked formats, direct-upload thresholds, interim scan statuses (malware scanning deferred), and the object-storage adapter rule."
---

# 08 — Vercel Blob and File Handling

> Vercel Blob is behaviorally equivalent to the base skill's S3 default (`docs/implementation/architecture-validation.md` §11) — private authenticated storage, direct-upload authorization for large files, checksum verification, time-limited signed URLs. This file states the dashboard-specific limits and statuses on top of that equivalence.

---

## Storage

- **Private Vercel Blob, North America East Coast** — no public-bucket-equivalent access; every read goes through a time-limited, authenticated signed URL.
- File **metadata** lives in PostgreSQL (`asset_id`, checksum, MIME type, size, dimensions/duration where applicable, licence, consent, visibility, retention category, confidentiality, related-record links, scan status) — the Blob object itself is the binary only, per the base skill's own "object storage owns binaries, the database owns metadata" ownership split (`knowledge/10-data-ownership-and-audit.md`).

---

## Approved limits

| Category             | Maximum size |
| -------------------- | ------------ |
| Images and documents | 25 MB        |
| MP4 video            | 250 MB       |

## Allowed formats

```
JPEG, PNG, WebP, GIF, PDF, DOCX, XLSX, CSV, TXT, Markdown, MP4
```

## Blocked formats

```
Executables, SVG, archives, macro-enabled documents, any unapproved format
```

Both the client (for UX) and the server (authoritative) validate MIME type and extension before accepting an upload — server-side MIME sniffing, not trusting the client-declared `Content-Type` header, consistent with the base skill's boundary-validation rule (NODE-005) applied to file uploads specifically.

---

## Direct-upload threshold

Files above the Vercel Function request-body size limit use **direct-to-Blob authenticated upload** (the browser uploads directly to Blob using a short-lived, dashboard-issued upload authorization, never proxying the full file body through a Function) rather than a proxy-through-API upload. The exact threshold is set to Vercel Functions' actual current request-body limit at implementation time (verify at discovery — this number is a platform fact, not a design choice, and changes are outside this project's control) — record the confirmed number in the Asset Library module's implementation notes once set, rather than hardcoding an assumed figure in this knowledge file. Until confirmed, treat any file over a conservative default (e.g., 4 MB) as a direct-upload candidate, and revise once the platform limit is verified.

---

## Malware scanning — deferred, and the honesty rule

Malware-scanning integration is **deferred** for this project. This does not mean uploads are unchecked — it means the one specific check (malware scanning) is not yet wired to an external provider. What remains true regardless:

- Blocked file types remain blocked (format allowlist above is enforced regardless of scanning status).
- Server-verified MIME and extension checks run on every upload.
- A checksum (SHA-256) is recorded for every stored file.
- Administrators may disable upload categories entirely if needed, independent of scanning status.

**The dashboard must never describe an uploaded file as malware-free.** This is an absolute rule — restated in `knowledge/15-project-specific-forbidden-actions.md`. Use the interim status vocabulary below; none of them asserts "clean" or "safe."

### Interim file statuses

```
Uploaded            — accepted, format/size/MIME validated, checksum recorded; no scan performed
Validation Passed   — format/size/MIME checks passed (does not imply malware-free)
Validation Failed   — format/size/MIME checks failed; upload rejected
Scan Not Configured — the honest default state for every accepted file until a scanner is wired
Externally Approved — a human reviewer has explicitly vouched for the file through an approved
                       review process (not a substitute for automated scanning; a distinct,
                       auditable human judgment call)
Rejected            — blocked format, failed validation, or explicitly rejected by a reviewer
Deleted             — removed per retention/legal-hold rules or explicit deletion
```

When a malware-scanning provider is eventually configured (post-V1, tracked in `docs/skill-build/unresolved-items.md` as a deferred integration, not this build's concern), the transition behavior for **already-accepted** `Scan Not Configured` files (retroactive scan vs. scan-forward-only) is a decision for that future work, not resolved here.

---

## The object-storage adapter rule

All Vercel Blob calls go through `packages/integrations/vercel`'s object-storage adapter — never scattered `put()`/`get()`/signed-URL calls directly inside business services or controllers. This mirrors `knowledge/04-serverless-queues-workflows-and-cron.md`'s adapter-interface rule for Vercel Queues/Workflows, for the same reasons: a single choke point for checksum verification, MIME/format enforcement, and signed-URL TTL policy, and a single place to mock in tests (`nodejs/knowledge/testing/01-api-and-integration-tests.md`'s "mocks behind the adapter interface" pattern).

```text
ObjectStorageAdapter.getUploadAuthorization(fileMeta, { directUpload: boolean })
ObjectStorageAdapter.confirmUpload(assetId, checksum)
ObjectStorageAdapter.getSignedDownloadUrl(assetId, { ttl })
ObjectStorageAdapter.delete(assetId)
```

---

## What this file does not cover

- Retention periods for uploaded/rejected/deleted files by category → `knowledge/11-retention-backup-and-operations.md`.
- Confidentiality classification and who can access a given asset → `knowledge/12-dashboard-security-controls.md`.
- Concrete Vercel Blob SDK usage → `integrations/vercel/` (loaded only when implementing this integration).
