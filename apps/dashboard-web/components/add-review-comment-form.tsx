"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import type { ReviewComment } from "@webdesk/shared-types";
import { postMutation } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { findOverLongRichTextField, isEmptyRichTextHtml } from "@/lib/rich-text";
import { RichTextEditor } from "./rich-text-editor";
import styles from "./review-comments-section.module.css";

export interface AddReviewCommentFormProps {
  readonly reviewId: string;
}

// Mirrors apps/dashboard-api/src/review-and-approval-center/review-and-approval-center.dto.ts's
// COMMENT_BODY_MAX_LENGTH — kept in sync by hand, same approach every sibling module's own form
// uses for its own rich-text field's backend-mirrored constant.
const COMMENT_BODY_MAX_LENGTH = 4_000;

/**
 * The client half of `ReviewCommentsSection` (the sibling Server Component that renders the
 * existing comment list) — composes a new comment via `RichTextEditor` and submits it.
 *
 * Calls `router.refresh()` on success rather than appending the new comment to local state, unlike
 * `ClaimSourcesSection`'s own established sub-resource pattern: `SanitizedRichText` (the only place
 * `dangerouslySetInnerHTML` may run for rich-text content in this app) is explicitly Node-only —
 * "never import this from a 'use client' file," its own doc comment — so a genuinely safe
 * client-side render of the just-created comment's sanitized body isn't available here. Rather
 * than duplicate a client-safe sanitizer (reopening the exact "unenforced sanitize-then-render
 * pairing" risk this project has already shipped one confirmed HIGH stored-XSS finding from),
 * `router.refresh()` re-invokes `ReviewCommentsSection` with a freshly-fetched, correctly
 * server-sanitized comment list — no raw HTML ever crosses the Server-to-Client boundary.
 */
export function AddReviewCommentForm({ reviewId }: AddReviewCommentFormProps): ReactNode {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isEmpty = isEmptyRichTextHtml(body);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);

    if (isEmpty) {
      return;
    }
    const lengthError = findOverLongRichTextField([["Comment", body]], COMMENT_BODY_MAX_LENGTH);
    if (lengthError) {
      setError(lengthError);
      return;
    }

    setSubmitting(true);
    try {
      const result = await postMutation<ReviewComment>(
        `${getApiBaseUrl()}/reviews/${reviewId}/comments`,
        { body },
      );
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setBody("");
      router.refresh();
    } catch (err) {
      console.error("Failed to add review comment", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className={styles.addForm} onSubmit={(event) => void handleSubmit(event)}>
      <p className={styles.addFormTitle}>Add comment</p>
      <div className={styles.field}>
        <label htmlFor="new-comment-body" className={styles.label}>
          Comment
        </label>
        <RichTextEditor id="new-comment-body" value={body} onChange={setBody} />
      </div>
      <div className={styles.formActions}>
        <button type="submit" disabled={submitting || isEmpty} className={styles.submitButton}>
          {submitting ? "Adding…" : "Add comment"}
        </button>
      </div>
      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
    </form>
  );
}
