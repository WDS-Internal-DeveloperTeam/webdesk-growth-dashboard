import { upload } from "@vercel/blob/client";
import type { BusinessKnowledgeAttachment } from "@webdesk/shared-types";
import { parseApiErrorMessage } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";

/**
 * Shared file-attachment vocabulary and upload flow for the Business Knowledge Center — used by
 * both `BusinessKnowledgeAttachmentsSection` (the detail page's own upload control) and
 * `BusinessKnowledgeRecordForm`'s create-mode file picker. Extracted so the two don't each
 * hand-maintain their own copy of the same MIME/size allowlist and the same
 * `upload()`-then-`confirm()` sequence.
 *
 * Mirrors apps/dashboard-api/src/business-knowledge/business-knowledge.constants.ts's
 * BUSINESS_KNOWLEDGE_ATTACHMENT_ALLOWED_MIME_TYPES/_MAX_SIZE_BYTES — kept in sync by hand, same
 * approach every other backend-DTO-mirroring file in this app already uses. Server-enforced
 * regardless (both at the Blob token level and again in confirm()); the client-side checks here
 * are UX only.
 */
export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/markdown",
];
export const ALLOWED_ATTACHMENT_EXTENSIONS = ".pdf,.docx,.xlsx,.md";
export const MAX_ATTACHMENT_SIZE_BYTES = 25 * 1024 * 1024;

/** Thrown by `uploadAttachment()` only for a well-formed non-OK response from `confirm()` — its
 *  `message` is already the safe, curated string `parseApiErrorMessage()` produced (real backend
 *  detail for an allowlisted error code, a generic fallback otherwise), so a caller may show it to
 *  the user directly. Any other failure (the Blob PUT itself, a network-level fetch rejection, a
 *  malformed response body) throws a plain `Error` instead — callers must not show *that* message
 *  verbatim, matching this project's standing rule of never surfacing a raw, uncurated error to
 *  the user. */
export class AttachmentUploadApiError extends Error {}

export function formatAttachmentSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Returns a human-readable error, or `null` when the file is acceptable to try uploading. */
export function validateAttachmentFile(file: File): string | null {
  if (!ALLOWED_ATTACHMENT_MIME_TYPES.includes(file.type)) {
    return "Only PDF, DOCX, XLSX, and Markdown files are supported.";
  }
  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    return "Files must be 25 MB or smaller.";
  }
  return null;
}

/**
 * Uploads one file to a record's attachments: direct-to-Blob `upload()` (via the record's own
 * same-origin `upload-route` proxy — `@vercel/blob/client` has no way to attach the session
 * cookie to a cross-origin request, so this proxies server-to-server instead, see that route's own
 * doc comment) followed by this app calling `confirm()` itself directly — the real "attachment
 * exists now" signal, not Vercel's own separate `onUploadCompleted` webhook. Throws with a message
 * safe to show the user on any failure.
 */
export async function uploadAttachment(
  recordId: string,
  file: File,
): Promise<BusinessKnowledgeAttachment> {
  const pathname = `business-knowledge/${recordId}/${crypto.randomUUID()}-${file.name}`;
  const blob = await upload(pathname, file, {
    access: "private",
    handleUploadUrl: `/business-knowledge-center/${recordId}/attachments/upload-route`,
  });

  const response = await fetch(
    `${getApiBaseUrl()}/business-knowledge/records/${recordId}/attachments/confirm`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pathname: blob.pathname, filename: file.name }),
    },
  );
  if (!response.ok) {
    throw new AttachmentUploadApiError(await parseApiErrorMessage(response));
  }
  const body = (await response.json()) as { data: BusinessKnowledgeAttachment };
  return body.data;
}
