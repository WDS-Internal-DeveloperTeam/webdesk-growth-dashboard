"use client";

import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { BusinessKnowledgeAttachment } from "@webdesk/shared-types";
import { EmptyState } from "@webdesk/ui";
import { parseApiErrorMessage } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { formatTimestamp } from "@/lib/format-timestamp";
import { usePendingIds } from "@/lib/use-pending-ids";
import styles from "./business-knowledge-attachments-section.module.css";

export interface BusinessKnowledgeAttachmentsSectionProps {
  readonly recordId: string;
  readonly initialAttachments: readonly BusinessKnowledgeAttachment[];
}

// Mirrors apps/dashboard-api/src/business-knowledge/business-knowledge.constants.ts's
// BUSINESS_KNOWLEDGE_ATTACHMENT_ALLOWED_MIME_TYPES/_MAX_SIZE_BYTES — kept in sync by hand, same
// approach every other backend-DTO-mirroring file in this app already uses. Server-enforced
// regardless (both at the Blob token level and again in confirm()); this is UX only.
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/markdown",
];
const ALLOWED_EXTENSIONS = ".pdf,.docx,.xlsx,.md";
const MAX_SIZE_BYTES = 25 * 1024 * 1024;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function contentUrl(recordId: string, attachmentId: string): string {
  return `${getApiBaseUrl()}/business-knowledge/records/${recordId}/attachments/${attachmentId}/content`;
}

/**
 * File attachments (DOCX/XLSX/PDF/Markdown) on a business knowledge record
 * (`business-knowledge-center-rich-content-attachments.md`). Direct-to-Blob upload via
 * `@vercel/blob/client`'s `upload()`, pointed at this record's own `upload-route` (real RBAC/
 * format/size checks happen server-side in that route's `onBeforeGenerateToken`, not here — this
 * client-side allowlist is UX only). Once `upload()` resolves (proving the raw PUT to Blob storage
 * actually completed), this component calls `confirm()` itself directly — the real "attachment
 * exists now" signal, not Vercel's own separate `onUploadCompleted` server-to-server webhook,
 * which this app's guarded route intentionally never relies on (see the backend's own doc comment
 * on `handleUploadRoute()`).
 *
 * Each attachment renders its real preview inline, not just a filename: a PDF embeds the actual
 * file via the content-proxy route (D4 — real rendering, not lossy text extraction); a DOCX/XLSX/
 * Markdown attachment renders its cached, server-sanitized `extractedPreviewHtml`. The initial
 * server-rendered list already passed through `dashboard-web`'s own render-time sanitization pass
 * (`lib/sanitize-html.ts`, called from `getBusinessKnowledgeAttachments()`) as defense-in-depth;
 * an attachment confirmed live, in this same session, renders the preview `confirm()` itself just
 * returned, trusting the backend's write-time sanitization alone for that one render (the same
 * fix would need a browser-safe HTML sanitizer to also double-sanitize here, which reproduces
 * `dashboard-api`'s own dependency for a marginal, same-session-only gain — deferred, not silently
 * skipped).
 */
export function BusinessKnowledgeAttachmentsSection({
  recordId,
  initialAttachments,
}: BusinessKnowledgeAttachmentsSectionProps): ReactNode {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] =
    useState<readonly BusinessKnowledgeAttachment[]>(initialAttachments);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { pendingIds, markPending } = usePendingIds();

  // Resync after router.refresh() delivers fresh server data (e.g. another tab/user changed
  // something) — same pattern ProjectTeamSection/ProjectApproversSection already established.
  useEffect(() => {
    setAttachments(initialAttachments);
  }, [initialAttachments]);

  async function handleFileSelected(file: File): Promise<void> {
    setError(null);

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setError("Only PDF, DOCX, XLSX, and Markdown files are supported.");
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError("Files must be 25 MB or smaller.");
      return;
    }

    setUploading(true);
    try {
      const pathname = `business-knowledge/${recordId}/${crypto.randomUUID()}-${file.name}`;
      const blob = await upload(pathname, file, {
        access: "private",
        handleUploadUrl: `${getApiBaseUrl()}/business-knowledge/records/${recordId}/attachments/upload-route`,
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
        setError(await parseApiErrorMessage(response));
        return;
      }
      const body = (await response.json()) as { data: BusinessKnowledgeAttachment };
      setAttachments((current) => [...current, body.data]);
      router.refresh();
    } catch (err) {
      console.error("Failed to upload attachment", err);
      setError("Something went wrong uploading the file. Please try again.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function handleDelete(attachmentId: string): Promise<void> {
    setError(null);
    markPending(attachmentId, true);
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/business-knowledge/records/${recordId}/attachments/${attachmentId}`,
        { method: "DELETE", credentials: "include" },
      );
      if (!response.ok) {
        setError(await parseApiErrorMessage(response));
        return;
      }
      setAttachments((current) => current.filter((attachment) => attachment.id !== attachmentId));
      router.refresh();
    } catch (err) {
      console.error("Failed to delete attachment", err);
      setError("Something went wrong deleting the attachment. Please try again.");
    } finally {
      markPending(attachmentId, false);
    }
  }

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <h2 className={styles.heading}>Attachments</h2>
        <label className={styles.uploadButton}>
          {uploading ? "Uploading…" : "Upload file"}
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_EXTENSIONS}
            disabled={uploading}
            className={styles.fileInput}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void handleFileSelected(file);
              }
            }}
          />
        </label>
      </div>
      <p className={styles.helperText}>PDF, DOCX, XLSX, or Markdown — up to 25 MB.</p>

      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}

      {attachments.length === 0 ? (
        <EmptyState
          title="No attachments"
          description="Upload a PDF, DOCX, XLSX, or Markdown file to attach it to this record."
        />
      ) : (
        <ul className={styles.list}>
          {attachments.map((attachment) => (
            <li key={attachment.id} className={styles.item}>
              <div className={styles.itemHeader}>
                <div>
                  <span className={styles.filename}>{attachment.filename}</span>
                  <span className={styles.meta}>
                    {formatSize(attachment.sizeBytes)} · Uploaded{" "}
                    {formatTimestamp(attachment.createdAt)}
                  </span>
                </div>
                <div className={styles.itemActions}>
                  <a
                    href={contentUrl(recordId, attachment.id)}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.downloadLink}
                  >
                    Open
                  </a>
                  <button
                    type="button"
                    disabled={pendingIds.has(attachment.id)}
                    onClick={() => void handleDelete(attachment.id)}
                    className={styles.deleteButton}
                  >
                    {pendingIds.has(attachment.id) ? "Removing…" : "Remove"}
                  </button>
                </div>
              </div>
              <AttachmentPreview recordId={recordId} attachment={attachment} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AttachmentPreview({
  recordId,
  attachment,
}: {
  readonly recordId: string;
  readonly attachment: BusinessKnowledgeAttachment;
}): ReactNode {
  if (attachment.mimeType === "application/pdf") {
    return (
      <embed
        src={contentUrl(recordId, attachment.id)}
        type="application/pdf"
        className={styles.pdfPreview}
      />
    );
  }
  if (attachment.extractedPreviewHtml) {
    return (
      <div
        className={styles.previewHtml}
        // Pre-sanitized server-side (write-time in dashboard-api, and again at render time for
        // the initial page load) — see this component's own doc comment for the one
        // deliberately-not-double-sanitized case (a same-session freshly-confirmed upload).
        dangerouslySetInnerHTML={{ __html: attachment.extractedPreviewHtml }}
      />
    );
  }
  return <p className={styles.noPreview}>No preview available for this file type.</p>;
}
