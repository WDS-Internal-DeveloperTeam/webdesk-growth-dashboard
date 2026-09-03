"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import type { HelpArticle, HelpArticleCategory } from "@webdesk/shared-types";
import { postMutation } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { CATEGORY_LABEL, CATEGORY_VALUES } from "@/lib/help-center-query";
import { findOverLongRichTextField, isEmptyRichTextHtml } from "@/lib/rich-text";
import { RichTextEditor } from "./rich-text-editor";
import styles from "./help-center-form.module.css";

// Mirrors apps/dashboard-api/src/help-center/help-center.dto.ts — kept in sync by hand, same
// approach ProjectForm/PersonaLibraryForm/ContentTemplateLibraryForm all use.
const TITLE_MAX_LENGTH = 255;
const CONTENT_MAX_LENGTH = 40_000;

export type HelpCenterFormProps =
  | { readonly mode: "create" }
  | { readonly mode: "edit"; readonly articleId: string; readonly initial: HelpArticle };

/**
 * Create/edit form for a help article — `03_Detailed_Module_Specifications.md §38`'s own topic
 * list is the only source (no approved wireframe/screen spec exists for this module, matching
 * every prior unsourced-screen module's own "smallest honest reading" precedent). `category` is
 * create-only (immutable, shown read-only on edit, matching every sibling module's discriminator-
 * field convention) — `updateHelpArticleSchema` never accepts it. `isPublished`/`publishedAt` are
 * deliberately never fields here either — this module has no dedicated publish/unpublish RBAC
 * action (`system_settings` carries no `P` letter), so toggling `isPublished` is handled by the
 * separate `HelpCenterPublishActions` island on the detail page, submitting to the same generic
 * update route this form uses, rather than folding a publish checkbox into this form's own submit.
 *
 * `content` uses `RichTextEditor` (Tiptap), per the 2026-08-22 standing rule requiring every
 * dashboard-web long-text field to use the rich-text editor going forward — wired to the backend's
 * own already-sanitizing `create()`/`update()` from day one (`help-articles.service.ts`'s
 * `sanitizeRichTextHtml()`), and again at render time on the detail page via the shared
 * `SanitizedRichText` component, the same double-sanitization pattern every other rich-text field
 * in this app already establishes. `content` is this module's one REQUIRED rich-text field —
 * checked client-side via `isEmptyRichTextHtml()` before submit (the backend's own `min(1)` would
 * also reject an empty value, but a clean client-side check avoids a wasted round trip), matching
 * `ProofAndClaimsLibraryForm`'s own `claim` field precedent for a required rich-text field.
 *
 * Submits via `postMutation()` (`lib/api-errors.ts`) — the shared `fetch()`-with-`credentials:
 * "include"` helper, required for `dashboard-api`'s `OriginCheckGuard` to see a real browser
 * `Origin` header, the same pattern every mutation form in this app already uses.
 */
export function HelpCenterForm(props: HelpCenterFormProps): ReactNode {
  const router = useRouter();
  const initial = props.mode === "edit" ? props.initial : null;

  const [category, setCategory] = useState<HelpArticleCategory>(
    initial?.category ?? CATEGORY_VALUES[0]!,
  );
  const [title, setTitle] = useState(initial?.title ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);

    // title is a real HTML `required` field — the browser's own constraint validation blocks a
    // submit event from ever firing while it's empty, so no redundant JS-level check is needed
    // here, matching ProjectForm/PersonaLibraryForm's own precedent. content is a RichTextEditor
    // (a contentEditable div, not a real form control), so it needs an explicit check.
    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();
    if (isEmptyRichTextHtml(trimmedContent)) {
      setError("Content is required.");
      return;
    }

    const lengthError = findOverLongRichTextField(
      [["Content", trimmedContent]],
      CONTENT_MAX_LENGTH,
    );
    if (lengthError) {
      setError(lengthError);
      return;
    }

    setSubmitting(true);
    try {
      // content is validated non-empty above, so it's always sent as itself — the
      // richTextFieldValue()/undefined-on-empty nullish contract that every optional rich-text
      // field in this app uses doesn't apply to a required field, matching
      // ProofAndClaimsLibraryForm's own "claim" field precedent (its one other required
      // rich-text field).
      const sharedFields = {
        title: trimmedTitle,
        content: trimmedContent,
      };

      const payload = props.mode === "create" ? { ...sharedFields, category } : sharedFields;

      const url =
        props.mode === "create"
          ? `${getApiBaseUrl()}/help-center/articles`
          : `${getApiBaseUrl()}/help-center/articles/${props.articleId}/update`;

      const result = await postMutation<{ id: string }>(url, payload);
      if (!result.ok) {
        setError(result.message);
        return;
      }

      router.push(`/help-center/${result.data.id}`);
    } catch (err) {
      console.error("Failed to save help article", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Identity</legend>

        {props.mode === "create" ? (
          <div className={styles.field}>
            <label htmlFor="category" className={styles.label}>
              Category
            </label>
            <select
              id="category"
              value={category}
              onChange={(event) => setCategory(event.target.value as HelpArticleCategory)}
              className={styles.select}
            >
              {CATEGORY_VALUES.map((value) => (
                <option key={value} value={value}>
                  {CATEGORY_LABEL[value]}
                </option>
              ))}
            </select>
            <span className={styles.helperText}>Never changeable once the article is created.</span>
          </div>
        ) : (
          <div className={styles.field}>
            <span className={styles.label}>Category</span>
            <span className={styles.readonlyValue}>{CATEGORY_LABEL[props.initial.category]}</span>
          </div>
        )}

        <div className={styles.field}>
          <label htmlFor="title" className={styles.label}>
            Title
          </label>
          <input
            id="title"
            type="text"
            required
            maxLength={TITLE_MAX_LENGTH}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className={styles.input}
          />
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Content</legend>

        <div className={styles.field}>
          <label htmlFor="content" className={styles.label}>
            Content
          </label>
          <RichTextEditor id="content" value={content} onChange={setContent} />
        </div>
      </fieldset>

      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}

      <div className={styles.actions}>
        <button type="submit" disabled={submitting} className={styles.submitButton}>
          {submitting ? "Saving…" : props.mode === "create" ? "Create article" : "Save changes"}
        </button>
        <a
          href={props.mode === "create" ? "/help-center" : `/help-center/${props.articleId}`}
          className={styles.cancelLink}
        >
          Cancel
        </a>
      </div>
    </form>
  );
}
