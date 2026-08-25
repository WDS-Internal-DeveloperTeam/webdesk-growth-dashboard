import type { ReviewComment, UserSummary } from "@webdesk/shared-types";
import { formatTimestamp } from "@/lib/format-timestamp";
import { AddReviewCommentForm } from "./add-review-comment-form";
import { SanitizedRichText } from "./sanitized-rich-text";
import styles from "./review-comments-section.module.css";

export interface ReviewCommentsSectionProps {
  readonly reviewId: string;
  readonly comments: readonly ReviewComment[];
  /** A pre-resolved `authorUserId -> UserSummary` map, built server-side by the detail page
   *  (`getUsersByIds()`). A resolution failure (a 403 — most roles lack `users_roles:view` — or a
   *  network error) degrades to showing the raw id, the same established fallback every sibling
   *  identity-resolution site in this app uses (e.g. the Projects Team roster). */
  readonly authors: ReadonlyMap<string, UserSummary>;
}

/**
 * Comments on a review — a Server Component, deliberately NOT a client component with local
 * optimistic state like `ClaimSourcesSection` (its established sub-resource precedent). Mirrors
 * the Website Strategy Center detail page's own "Version history" precedent instead: zero client
 * JS for the list itself, `SanitizedRichText` for real rich-text content. `SanitizedRichText` is
 * explicitly Node-only ("never import this from a 'use client' file" — its own doc comment), since
 * it's the one place `dangerouslySetInnerHTML` may run for rich-text content in this app, and this
 * project has already shipped one confirmed HIGH stored-XSS finding from an unenforced sanitize-
 * then-render pairing — duplicating a client-safe sanitizer to preserve the optimistic-append
 * pattern would reopen exactly that risk. The add-comment form (`AddReviewCommentForm`, a client
 * island rendered below the list) calls `router.refresh()` on success instead of appending
 * locally, which re-invokes this Server Component with a freshly-fetched, correctly
 * server-sanitized comment list — no raw HTML crosses the Server-to-Client boundary at any point.
 *
 * `review_comments` has no update/delete route (only `GET`/`POST` exist —
 * `apps/dashboard-api/src/review-and-approval-center/review-comments.controller.ts`) — this
 * section is genuinely append-only, matching the backend's own actual HTTP surface.
 */
export function ReviewCommentsSection({ reviewId, comments, authors }: ReviewCommentsSectionProps) {
  return (
    <div>
      {comments.length === 0 ? (
        <p className={styles.muted}>No comments yet.</p>
      ) : (
        <ul className={styles.list}>
          {comments.map((comment) => {
            const author = authors.get(comment.authorUserId);
            return (
              <li key={comment.id} className={styles.row}>
                {/* A <div>, not a <span> (code-review finding): SanitizedRichText renders a
                    block-level <div dangerouslySetInnerHTML>, which is invalid HTML content
                    nested inside an inline <span> — every sibling row (e.g.
                    ClaimSourcesSection's own .rowMain) only ever nests <span>/<a> children, so
                    this is the one row shape in this app that needs the block-level wrapper. */}
                <div className={styles.rowMain}>
                  <span className={styles.primaryText}>
                    {author?.displayName ?? comment.authorUserId}
                  </span>
                  <span className={styles.secondaryText}>{formatTimestamp(comment.createdAt)}</span>
                  <SanitizedRichText html={comment.body} className={styles.commentBody} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <AddReviewCommentForm reviewId={reviewId} />
    </div>
  );
}
