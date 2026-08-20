/**
 * The 10 "primary records" named verbatim in `03_Detailed_Module_Specifications.md §3` — see
 * `docs/task-packages/module-business-knowledge-center.md` D5. No field-level differentiation
 * between record types is stated anywhere in the canonical spec, so all ten share one uniform
 * shape (D2) rather than ten bespoke tables.
 */
export type BusinessKnowledgeRecordType =
  | "company_profile"
  | "persona_icp"
  | "marketing_profile"
  | "vto"
  | "service_taxonomy"
  | "engagement_model"
  | "approved_messaging"
  | "competitor"
  | "geographic_scope"
  | "strategic_priority";

/**
 * Verbatim from `03_Detailed_Module_Specifications.md §3`'s "Rules" text: "documents may be
 * Mandatory, Advisory, Draft, Deprecated, or Restricted." Doubles as both the lifecycle state and
 * the confidentiality classification — see the task package's D3/D4 for why no separate
 * confidentiality field exists.
 */
export type BusinessKnowledgeRecordStatus =
  "mandatory" | "advisory" | "draft" | "deprecated" | "restricted";

export interface BusinessKnowledgeRecordEntity {
  readonly id: string;
  readonly recordType: BusinessKnowledgeRecordType;
  readonly title: string;
  /** Optional since migration `00049` (`business-knowledge-center-rich-content-attachments.md`
   *  §5) — a record may now carry only file attachments, with no typed content at all. */
  readonly content: string | null;
  readonly status: BusinessKnowledgeRecordStatus;
  readonly notes: string | null;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * The interim, honest status vocabulary from
 * `knowledge/08-vercel-blob-and-file-handling.md` — malware scanning is deferred project-wide, so
 * none of these values ever asserts a file is malware-free.
 */
export type BusinessKnowledgeAttachmentScanStatus =
  | "uploaded"
  | "validation_passed"
  | "validation_failed"
  | "scan_not_configured"
  | "externally_approved"
  | "rejected"
  | "deleted";

export interface BusinessKnowledgeAttachmentEntity {
  readonly id: string;
  readonly recordId: string;
  readonly filename: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly checksumSha256: string;
  /** The Blob object's own key/pathname — never a raw public URL (`knowledge/08`'s "object
   *  storage owns binaries" split; a signed download URL is minted per-request, not stored). */
  readonly blobPathname: string;
  /** Cached DOCX/XLSX/Markdown-to-HTML conversion, computed once at upload-confirmation time —
   *  `null` for a PDF (rendered as the real file via a signed URL, not extracted; see the task
   *  package's D4) or before conversion has run. Already sanitized before being stored. */
  readonly extractedPreviewHtml: string | null;
  readonly scanStatus: BusinessKnowledgeAttachmentScanStatus;
  readonly uploadedBy: string | null;
  readonly createdAt: string;
}
