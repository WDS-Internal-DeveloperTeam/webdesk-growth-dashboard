import { describe, expect, it } from "vitest";
import { sanitizeRenderedHtml } from "../../lib/sanitize-html.js";

describe("sanitizeRenderedHtml", () => {
  it("keeps allowlisted formatting tags", () => {
    const input = "<h1>Title</h1><p><strong>bold</strong></p><ul><li>one</li></ul>";
    expect(sanitizeRenderedHtml(input)).toBe(input);
  });

  it("strips a <script> tag — the render-time defense-in-depth pass", () => {
    expect(sanitizeRenderedHtml("<p>safe</p><script>alert(1)</script>")).toBe("<p>safe</p>");
  });

  it("drops a javascript: href", () => {
    const output = sanitizeRenderedHtml('<a href="javascript:alert(1)">link</a>');
    expect(output).not.toContain("javascript:");
  });

  it("keeps a real http(s) href", () => {
    expect(sanitizeRenderedHtml('<a href="https://example.com">link</a>')).toBe(
      '<a href="https://example.com">link</a>',
    );
  });
});
