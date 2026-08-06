# Proposed Patch 10 — `project-json.schema.json`: Add `vercel-blob` to `tech_stack.storage` Enum

**Status:** Proposed. Not merged. Not applied to the base skill by this task.

## Reason

`_contracts/project-json.schema.json`'s `tech_stack.storage` enum is `["s3", "cloudinary", "gcs", "none"]`. Vercel Blob is behaviorally equivalent to S3 (private authenticated storage, direct-upload authorization, checksum verification, signed URLs — `docs/implementation/architecture-validation.md` §11) but isn't a named option. Same category of gap as Patch 09, same workaround used (project-local schema extension).

## Current gap

A project using Vercel Blob cannot validate against the unmodified base schema without a project-local extension.

## Proposed files changed

- **Edit:** `webdesk-nodejs/skills/_contracts/project-json.schema.json` — one-line change: `"storage": { "enum": ["s3", "cloudinary", "gcs", "vercel-blob", "none"], ... }`.
- **Edit (optional, companion):** `nodejs/knowledge/intelligence/database-intelligence.md`'s object-storage decision table — add a `vercel-blob` row alongside S3/Cloudinary/GCS: "Vercel Blob | deploy target is Vercel and Blob's direct-upload/signed-URL model fits the product's needs."

## Compatibility impact

**Fully backward compatible**, same reasoning as Patch 09 — additive enum value, no existing `project.json` invalidated.

## Regression risk

**Very low**, same class of change as Patch 09. The optional companion edit to `database-intelligence.md` is a documentation table addition, not a change to the existing S3/Cloudinary/GCS guidance.

## Reusability scope

**Generally reusable** — recommend bundling this with Patch 09 (both are single-enum-value additions to the same file, natural to review and apply together) rather than as two separate review cycles.
