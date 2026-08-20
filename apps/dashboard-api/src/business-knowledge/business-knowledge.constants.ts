/** NestJS DI tokens for the Business Knowledge Center module — same pattern as
 *  ../projects/projects.constants.ts. */
export const BUSINESS_KNOWLEDGE_RECORD_REPOSITORY = Symbol("BUSINESS_KNOWLEDGE_RECORD_REPOSITORY");
export const BUSINESS_KNOWLEDGE_ATTACHMENT_REPOSITORY = Symbol(
  "BUSINESS_KNOWLEDGE_ATTACHMENT_REPOSITORY",
);
export const BLOB_STORAGE_ADAPTER = Symbol("BLOB_STORAGE_ADAPTER");

/** Exactly the four formats requested for this task package — a strict subset of the org-wide
 *  approved Blob format list (`knowledge/08-vercel-blob-and-file-handling.md` also allows JPEG/
 *  PNG/WebP/GIF/CSV/TXT/MP4, none of which are in scope here). Enforced by Vercel Blob itself at
 *  token-mint time (`allowedContentTypes`) and re-checked server-side in `confirm()` as
 *  defense-in-depth. */
export const BUSINESS_KNOWLEDGE_ATTACHMENT_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/markdown",
] as const;

/** 25 MB — the "images and documents" ceiling from `knowledge/08`. */
export const BUSINESS_KNOWLEDGE_ATTACHMENT_MAX_SIZE_BYTES = 25 * 1024 * 1024;
