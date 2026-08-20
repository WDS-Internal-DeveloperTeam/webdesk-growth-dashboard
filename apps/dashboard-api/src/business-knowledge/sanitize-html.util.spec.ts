import { describe, expect, it } from "vitest";
import { sanitizeAttachmentPreviewHtml, sanitizeRecordContentHtml } from "./sanitize-html.util.js";

describe("sanitizeRecordContentHtml", () => {
  it("keeps allowlisted formatting tags a Tiptap starter-kit editor actually emits", () => {
    const input =
      "<h1>Title</h1><p><strong>bold</strong> <em>italic</em> <u>under</u></p>" +
      "<ul><li>one</li></ul><blockquote>quote</blockquote><pre><code>x = 1</code></pre>";
    expect(sanitizeRecordContentHtml(input)).toBe(input);
  });

  it("strips <script> tags and their content entirely", () => {
    const output = sanitizeRecordContentHtml("<p>safe</p><script>alert(document.cookie)</script>");
    expect(output).toBe("<p>safe</p>");
  });

  it("strips inline event-handler attributes (onerror, onclick) from an otherwise-allowed tag", () => {
    const output = sanitizeRecordContentHtml('<p onclick="alert(1)">text</p>');
    expect(output).not.toContain("onclick");
    expect(output).toContain("text");
  });

  it("keeps an http(s) href on an <a> tag", () => {
    const output = sanitizeRecordContentHtml('<a href="https://example.com">link</a>');
    expect(output).toBe('<a href="https://example.com">link</a>');
  });

  it("drops a javascript: href — the same bug class this project already fixed once for stored URLs", () => {
    const output = sanitizeRecordContentHtml(
      '<a href="javascript:alert(document.cookie)">link</a>',
    );
    expect(output).not.toContain("javascript:");
    expect(output).not.toContain("href");
  });

  it("drops a data: href", () => {
    const output = sanitizeRecordContentHtml(
      '<a href="data:text/html,<script>alert(1)</script>">link</a>',
    );
    expect(output).not.toContain("data:");
  });

  it("strips disallowed tags (img, iframe, style, svg) but keeps their safe inner text where applicable", () => {
    const output = sanitizeRecordContentHtml(
      '<img src="x.png"><iframe src="evil.example"></iframe><style>body{}</style><p>kept</p>',
    );
    expect(output).not.toContain("<img");
    expect(output).not.toContain("<iframe");
    expect(output).not.toContain("<style");
    expect(output).toContain("<p>kept</p>");
  });

  it("strips a class/id/style attribute from an allowed tag", () => {
    const output = sanitizeRecordContentHtml('<p class="x" id="y" style="color:red">text</p>');
    expect(output).toBe("<p>text</p>");
  });

  it("renders a table (the same shape an XLSX preview produces) using only allowed table tags", () => {
    const input = "<table><tbody><tr><td>a</td><td>b</td></tr></tbody></table>";
    expect(sanitizeRecordContentHtml(input)).toBe(input);
  });

  it("passes plain text with no HTML through unchanged", () => {
    expect(sanitizeRecordContentHtml("Just plain text.")).toBe("Just plain text.");
  });
});

describe("sanitizeAttachmentPreviewHtml", () => {
  it("applies the identical allowlist as sanitizeRecordContentHtml", () => {
    const input = "<script>alert(1)</script><p>preview</p>";
    expect(sanitizeAttachmentPreviewHtml(input)).toBe(sanitizeRecordContentHtml(input));
  });
});
