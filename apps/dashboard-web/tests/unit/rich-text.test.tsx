import { describe, expect, it } from "vitest";
import {
  EMPTY_RICH_TEXT_HTML,
  findOverLongRichTextField,
  isEmptyRichTextHtml,
  richTextFieldValue,
  toSafeRichTextValue,
} from "@/lib/rich-text";

describe("isEmptyRichTextHtml", () => {
  it("treats a blank string as empty", () => {
    expect(isEmptyRichTextHtml("")).toBe(true);
    expect(isEmptyRichTextHtml("   ")).toBe(true);
  });

  it("treats Tiptap's own empty-document output as empty", () => {
    expect(isEmptyRichTextHtml(EMPTY_RICH_TEXT_HTML)).toBe(true);
    expect(isEmptyRichTextHtml("  <p></p>  ")).toBe(true);
  });

  it("does not treat real content as empty", () => {
    expect(isEmptyRichTextHtml("<p>Hello</p>")).toBe(false);
    expect(isEmptyRichTextHtml("plain text")).toBe(false);
  });
});

describe("toSafeRichTextValue", () => {
  it("passes an empty string through unchanged", () => {
    expect(toSafeRichTextValue("")).toBe("");
  });

  it("passes real rich-text HTML through unchanged", () => {
    expect(toSafeRichTextValue("<p>Hello <strong>world</strong></p>")).toBe(
      "<p>Hello <strong>world</strong></p>",
    );
    expect(toSafeRichTextValue("<ul><li>One</li></ul>")).toBe("<ul><li>One</li></ul>");
  });

  it("escapes and wraps legacy plain text that isn't already rich-text HTML", () => {
    expect(toSafeRichTextValue("Just some plain text")).toBe("<p>Just some plain text</p>");
  });

  it("escapes angle brackets in legacy plain text instead of letting them parse as tags", () => {
    // A real bug this closes: legacy plain text containing something that happens to look like a
    // tag (e.g. pasted code, or "5 < 10 > 3") must never be reinterpreted as real markup once it's
    // loaded into a RichTextEditor or rendered via dangerouslySetInnerHTML.
    expect(toSafeRichTextValue("5 < 10 > 3")).toBe("<p>5 &lt; 10 &gt; 3</p>");
    expect(toSafeRichTextValue("<script>alert(1)</script>")).toBe(
      "<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>",
    );
  });

  it("escapes ampersands in legacy plain text", () => {
    expect(toSafeRichTextValue("Ships & handles")).toBe("<p>Ships &amp; handles</p>");
  });

  it("converts embedded newlines to <br> instead of silently collapsing them (code-review finding: a legacy multi-line value used to render as one run-on line once the old textarea's pre-wrap styling was removed)", () => {
    expect(toSafeRichTextValue("- Grow revenue\n- Reduce churn\n- Improve retention")).toBe(
      "<p>- Grow revenue<br>- Reduce churn<br>- Improve retention</p>",
    );
  });
});

describe("richTextFieldValue", () => {
  it("create mode: omits an empty field entirely (undefined), matching plain-text fields' own create-mode contract", () => {
    expect(richTextFieldValue("", "create")).toBeUndefined();
    expect(richTextFieldValue(EMPTY_RICH_TEXT_HTML, "create")).toBeUndefined();
  });

  it("edit mode: sends an explicit null for an emptied field, so it actually clears rather than being left unchanged", () => {
    expect(richTextFieldValue("", "edit")).toBeNull();
    expect(richTextFieldValue(EMPTY_RICH_TEXT_HTML, "edit")).toBeNull();
  });

  it("returns the trimmed value verbatim when real content is present, in either mode", () => {
    expect(richTextFieldValue("  <p>Hello</p>  ", "create")).toBe("<p>Hello</p>");
    expect(richTextFieldValue("  <p>Hello</p>  ", "edit")).toBe("<p>Hello</p>");
  });
});

describe("findOverLongRichTextField", () => {
  it("returns null when every field is within the limit", () => {
    expect(findOverLongRichTextField([["Description", "short"]], 100)).toBeNull();
  });

  it("returns the first offending field's message, in order", () => {
    expect(
      findOverLongRichTextField(
        [
          ["First", "ok"],
          ["Second", "toolong"],
          ["Third", "alsotoolong"],
        ],
        5,
      ),
    ).toBe("Second is too long (max 5 characters).");
  });
});
