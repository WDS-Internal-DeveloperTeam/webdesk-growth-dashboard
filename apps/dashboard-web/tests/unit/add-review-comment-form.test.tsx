import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import { AddReviewCommentForm } from "../../components/add-review-comment-form.js";

const REVIEW_ID = "11111111-1111-1111-1111-111111111111";

// RichTextEditor is a Tiptap contentEditable div, not a real form control — jsdom/RTL's
// fireEvent.input() doesn't drive Tiptap's own ProseMirror editing view, so a comment body can't
// be typed in via simulated events (the same lesson `rich-text-editor-long-fields.md` and
// `proof-and-claims-library-form.test.tsx` already document). Unlike every sibling rich-text form
// in this app, `AddReviewCommentForm` has no `initial`/edit-mode prop to load a non-empty value
// through instead — it's a pure "always blank, compose new" form. What's left honestly testable
// without simulated typing: structural rendering, the empty-body guard (both the disabled button
// and the internal submit-time check), and that the guard blocks a real network call.

describe("AddReviewCommentForm", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    refreshMock.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("renders a rich-text editor (not a plain textarea) for the comment field", () => {
    render(<AddReviewCommentForm reviewId={REVIEW_ID} />);
    expect(document.querySelectorAll("textarea")).toHaveLength(0);
    expect(document.querySelectorAll('[contenteditable="true"]')).toHaveLength(1);
  });

  it("the submit button starts disabled while the comment is empty", () => {
    render(<AddReviewCommentForm reviewId={REVIEW_ID} />);
    expect(screen.getByRole("button", { name: "Add comment" })).toBeDisabled();
  });

  it("submitting the form's own submit event while empty never calls fetch or router.refresh (the internal guard, independent of the button's disabled attribute)", () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    const { container } = render(<AddReviewCommentForm reviewId={REVIEW_ID} />);
    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form!);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
