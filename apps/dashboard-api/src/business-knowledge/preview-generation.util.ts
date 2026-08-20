import MarkdownIt from "markdown-it";
import mammoth from "mammoth";
import ExcelJS from "exceljs";
import { sanitizeAttachmentPreviewHtml } from "./sanitize-html.util.js";

const DOCX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const MARKDOWN_MIME_TYPE = "text/markdown";

// Bounds how much of a real spreadsheet gets rendered into cached preview HTML — a genuine
// workbook can be far larger than is sensible to inline into one Postgres TEXT column and re-send
// on every page view. Truncation is stated in the rendered output itself, never silent.
const XLSX_MAX_ROWS = 200;
const XLSX_MAX_COLUMNS = 50;

const markdown = new MarkdownIt({ html: false, linkify: true, breaks: true });

/**
 * The task package's D4: DOCX/XLSX/Markdown are converted to sanitized HTML once, at
 * upload-confirmation time, and cached on the attachment row. PDF (and anything else) returns
 * `null` deliberately — rendered as the real file via the content-proxy route, not extracted;
 * real PDF→HTML text extraction is lossy and unreliable across authoring tools, so embedding the
 * actual file is both more honest and materially less work (task package D4).
 */
export async function generateAttachmentPreviewHtml(
  mimeType: string,
  buffer: Buffer,
): Promise<string | null> {
  switch (mimeType) {
    case DOCX_MIME_TYPE:
      return generateDocxPreview(buffer);
    case XLSX_MIME_TYPE:
      return generateXlsxPreview(buffer);
    case MARKDOWN_MIME_TYPE:
      return generateMarkdownPreview(buffer);
    default:
      return null;
  }
}

async function generateDocxPreview(buffer: Buffer): Promise<string> {
  // No `convertImage` override — mammoth's own default embeds images as base64 `data:` URIs,
  // which the shared sanitizer already strips outright (`img` isn't an allowed tag, and `data:`
  // isn't an allowed scheme even where it would be) — simpler than wiring a no-op converter.
  const { value } = await mammoth.convertToHtml({ buffer });
  return sanitizeAttachmentPreviewHtml(value);
}

async function generateXlsxPreview(buffer: Buffer): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  // exceljs's own bundled @types/node resolves `Buffer`'s generic parameter differently than this
  // project's own — a real cross-package type-declaration mismatch (confirmed via the TS error
  // itself, not a runtime issue: both are genuinely `Buffer` instances at runtime), so `load()`'s
  // parameter type is asserted through `unknown` rather than narrowed structurally.
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    return "<p>This spreadsheet has no sheets.</p>";
  }

  const rowsHtml: string[] = [];
  let rowCount = 0;
  let truncatedRows = false;
  worksheet.eachRow((row) => {
    rowCount += 1;
    if (rowCount > XLSX_MAX_ROWS) {
      truncatedRows = true;
      return;
    }
    const cellsHtml: string[] = [];
    let colCount = 0;
    let truncatedColumns = false;
    row.eachCell({ includeEmpty: true }, (cell) => {
      colCount += 1;
      if (colCount > XLSX_MAX_COLUMNS) {
        truncatedColumns = true;
        return;
      }
      cellsHtml.push(`<td>${escapeHtml(cell.text ?? "")}</td>`);
    });
    if (truncatedColumns) {
      cellsHtml.push(`<td>&hellip;</td>`);
    }
    rowsHtml.push(`<tr>${cellsHtml.join("")}</tr>`);
  });

  const truncationNotice = truncatedRows
    ? `<p><em>Showing the first ${XLSX_MAX_ROWS} rows of a larger sheet.</em></p>`
    : "";
  return sanitizeAttachmentPreviewHtml(
    `<table><tbody>${rowsHtml.join("")}</tbody></table>${truncationNotice}`,
  );
}

async function generateMarkdownPreview(buffer: Buffer): Promise<string> {
  return sanitizeAttachmentPreviewHtml(markdown.render(buffer.toString("utf-8")));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
