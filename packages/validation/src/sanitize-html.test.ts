import { describe, expect, it } from "vitest";
import { sanitizeRichTextHtml } from "./sanitize-html.js";

describe("sanitizeRichTextHtml", () => {
  it("keeps allowed tags and attributes", () => {
    const result = sanitizeRichTextHtml(
      '<p><strong>Bold</strong> and <a href="https://example.com">a link</a></p>',
    );
    expect(result).toBe(
      '<p><strong>Bold</strong> and <a href="https://example.com">a link</a></p>',
    );
  });

  it("strips a disallowed tag but keeps its text content", () => {
    const result = sanitizeRichTextHtml("<script>alert(1)</script><p>Safe</p>");
    expect(result).toBe("<p>Safe</p>");
  });

  it("drops a javascript: scheme href", () => {
    const result = sanitizeRichTextHtml('<a href="javascript:alert(1)">click</a>');
    expect(result).not.toContain("javascript:");
  });

  it("forces a safe rel onto a link that carries a target, overriding a missing or unsafe rel", () => {
    const noRel = sanitizeRichTextHtml(
      '<a href="https://attacker.example" target="_blank">click</a>',
    );
    expect(noRel).toContain('rel="noopener noreferrer nofollow"');

    const unsafeRel = sanitizeRichTextHtml(
      '<a href="https://attacker.example" target="_blank" rel="opener">click</a>',
    );
    expect(unsafeRel).toContain('rel="noopener noreferrer nofollow"');
    expect(unsafeRel).not.toContain('rel="opener"');
  });

  it("leaves a link with no target untouched (no rel forced onto it)", () => {
    const result = sanitizeRichTextHtml('<a href="https://example.com">plain link</a>');
    expect(result).toBe('<a href="https://example.com">plain link</a>');
  });
});
