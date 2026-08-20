import ExcelJS from "exceljs";
import { describe, expect, it, vi } from "vitest";

const convertToHtmlMock = vi.fn();
vi.mock("mammoth", () => ({
  default: { convertToHtml: (...args: unknown[]) => convertToHtmlMock(...args) },
}));

import { generateAttachmentPreviewHtml } from "./preview-generation.util.js";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const MARKDOWN_MIME = "text/markdown";
const PDF_MIME = "application/pdf";

describe("generateAttachmentPreviewHtml", () => {
  it("returns null for PDF — rendered as the real file, never extracted (task package D4)", async () => {
    const result = await generateAttachmentPreviewHtml(PDF_MIME, Buffer.from("%PDF-1.4"));
    expect(result).toBeNull();
  });

  it("returns null for an unrecognized mime type", async () => {
    const result = await generateAttachmentPreviewHtml("application/zip", Buffer.from("x"));
    expect(result).toBeNull();
  });

  it("converts Markdown to sanitized HTML", async () => {
    const result = await generateAttachmentPreviewHtml(
      MARKDOWN_MIME,
      Buffer.from("# Heading\n\n**bold** text"),
    );
    expect(result).toContain("<h1>Heading</h1>");
    expect(result).toContain("<strong>bold</strong>");
  });

  it("strips raw HTML embedded in Markdown source (markdown-it's own html:false, plus the sanitizer as defense-in-depth)", async () => {
    const result = await generateAttachmentPreviewHtml(
      MARKDOWN_MIME,
      Buffer.from("<script>alert(1)</script>\n\nReal text"),
    );
    expect(result).not.toContain("<script>");
    expect(result).toContain("Real text");
  });

  it("delegates DOCX conversion to mammoth and sanitizes its output", async () => {
    convertToHtmlMock.mockResolvedValue({
      value: "<p>From Word</p><script>alert(1)</script>",
      messages: [],
    });
    const result = await generateAttachmentPreviewHtml(DOCX_MIME, Buffer.from("fake docx"));
    expect(convertToHtmlMock).toHaveBeenCalledWith({ buffer: Buffer.from("fake docx") });
    expect(result).toBe("<p>From Word</p>");
  });

  it("renders a real XLSX workbook's first sheet as a sanitized HTML table", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Sheet1");
    sheet.addRow(["Name", "Score"]);
    sheet.addRow(["Ada", 100]);
    sheet.addRow(["<script>alert(1)</script>", 0]);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    const result = await generateAttachmentPreviewHtml(XLSX_MIME, buffer);

    expect(result).toContain("<table>");
    expect(result).toContain("Name");
    expect(result).toContain("Ada");
    expect(result).toContain("100");
    // The cell's literal text is HTML-escaped before ever reaching the sanitizer, so the string
    // "<script>" never appears as real markup, only as escaped, inert text.
    expect(result).not.toContain("<script>alert(1)</script>");
    expect(result).toContain("&lt;script&gt;");
  });

  it("truncates a spreadsheet past the row cap and says so in the rendered output", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Sheet1");
    for (let i = 0; i < 250; i += 1) {
      sheet.addRow([`row-${i}`]);
    }
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    const result = await generateAttachmentPreviewHtml(XLSX_MIME, buffer);

    expect(result).toContain("row-0");
    expect(result).toContain("Showing the first 200 rows");
    expect(result).not.toContain("row-249");
  });

  it("returns a friendly message for a workbook with no worksheets", async () => {
    const workbook = new ExcelJS.Workbook();
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    const result = await generateAttachmentPreviewHtml(XLSX_MIME, buffer);

    expect(result).toContain("no sheets");
  });
});
