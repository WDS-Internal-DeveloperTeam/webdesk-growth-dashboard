import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReviewComment, UserSummary } from "@webdesk/shared-types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { ReviewCommentsSection } from "../../components/review-comments-section.js";

const REVIEW_ID = "11111111-1111-1111-1111-111111111111";
const AUTHOR_ID = "22222222-2222-2222-2222-222222222222";
const UNRESOLVED_AUTHOR_ID = "33333333-3333-3333-3333-333333333333";

const AUTHOR: UserSummary = { id: AUTHOR_ID, displayName: "Jane Doe", email: "jane@example.com" };

function commentFixture(overrides: Partial<ReviewComment> = {}): ReviewComment {
  return {
    id: "comment-1",
    reviewId: REVIEW_ID,
    authorUserId: AUTHOR_ID,
    body: "<p>Looks good so far</p>",
    createdAt: "2026-08-24T00:00:00.000Z",
    ...overrides,
  };
}

describe("ReviewCommentsSection", () => {
  it("shows an empty-state message when there are no comments yet", () => {
    render(<ReviewCommentsSection reviewId={REVIEW_ID} comments={[]} authors={new Map()} />);
    expect(screen.getByText("No comments yet.")).toBeInTheDocument();
  });

  it("renders a comment's resolved author, timestamp, and sanitized body", () => {
    const authors = new Map<string, UserSummary>([[AUTHOR_ID, AUTHOR]]);
    render(
      <ReviewCommentsSection
        reviewId={REVIEW_ID}
        comments={[commentFixture()]}
        authors={authors}
      />,
    );
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("Looks good so far")).toBeInTheDocument();
  });

  it("falls back to the raw author id when resolution failed (a missing map entry)", () => {
    render(
      <ReviewCommentsSection
        reviewId={REVIEW_ID}
        comments={[commentFixture({ authorUserId: UNRESOLVED_AUTHOR_ID })]}
        authors={new Map()}
      />,
    );
    expect(screen.getByText(UNRESOLVED_AUTHOR_ID)).toBeInTheDocument();
  });

  it("strips a nested disallowed tag from a comment's rendered body via SanitizedRichText (defense-in-depth)", () => {
    // Starts with a real rich-text tag (<p>), matching what an actual RichTextEditor-produced
    // (and already write-time-sanitized) value always looks like — toSafeRichTextValue()'s own
    // "doesn't look like real rich text, treat as legacy plain text and escape wholesale" branch
    // deliberately does NOT apply here (see its own doc comment in lib/rich-text.ts), so this
    // fixture actually exercises sanitizeRenderedHtml()'s tag-stripping, not the escape path.
    render(
      <ReviewCommentsSection
        reviewId={REVIEW_ID}
        comments={[commentFixture({ body: "<p><script>alert(1)</script>Safe content</p>" })]}
        authors={new Map()}
      />,
    );
    expect(screen.getByText("Safe content")).toBeInTheDocument();
    expect(document.querySelector("script")).not.toBeInTheDocument();
  });

  it("renders the add-comment form (RichTextEditor, not a plain textarea) below the list", () => {
    render(
      <ReviewCommentsSection
        reviewId={REVIEW_ID}
        comments={[commentFixture()]}
        authors={new Map()}
      />,
    );
    expect(screen.getByRole("button", { name: "Add comment" })).toBeInTheDocument();
    expect(document.querySelectorAll("textarea")).toHaveLength(0);
    expect(document.querySelectorAll('[contenteditable="true"]')).toHaveLength(1);
  });
});
