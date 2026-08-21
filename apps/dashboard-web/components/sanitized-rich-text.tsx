import type { CSSProperties, ReactNode } from "react";
import { toSafeRichTextValue } from "@/lib/rich-text";
import { sanitizeRenderedHtml } from "@/lib/sanitize-html";

export interface SanitizedRichTextProps {
  readonly html: string;
  readonly style?: CSSProperties;
  readonly className?: string;
}

/**
 * The one place `dangerouslySetInnerHTML` may be used for rich-text field content in this app —
 * previously hand-duplicated at 3 independent detail-page call sites (Business Knowledge Center,
 * Projects, Service Library) with nothing enforcing the sanitize-before-render pairing
 * (code-review finding, `rich-text-editor-long-fields` branch). This project has already shipped
 * one confirmed HIGH stored-XSS finding from exactly that kind of unenforced rendering convention
 * (the Project Detail page's `environment.url` fix) — a shared component makes the same mistake
 * structurally harder to make again.
 *
 * `toSafeRichTextValue()` first escapes any value that doesn't already look like real rich-text
 * HTML (a value stored before its field switched to `RichTextEditor` — see that function's own
 * doc comment), then `sanitizeRenderedHtml()` runs the shared allowlist as defense-in-depth
 * alongside `dashboard-api`'s own write-time sanitization.
 *
 * Node-only (imports `sanitizeRenderedHtml`, which is server-only) — only ever render this from a
 * Server Component, never a `"use client"` file.
 */
export function SanitizedRichText({ html, style, className }: SanitizedRichTextProps): ReactNode {
  return (
    <div
      style={style}
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitizeRenderedHtml(toSafeRichTextValue(html)) }}
    />
  );
}
