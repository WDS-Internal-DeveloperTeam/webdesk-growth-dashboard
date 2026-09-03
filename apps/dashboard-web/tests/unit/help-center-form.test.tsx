import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HelpArticle } from "@webdesk/shared-types";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { HelpCenterForm } from "../../components/help-center-form.js";

const ARTICLE_ID = "11111111-1111-1111-1111-111111111111";

function successResponse(id: string): Response {
  return {
    ok: true,
    json: async () => ({ success: true, data: { id }, correlationId: "corr-1" }),
  } as Response;
}

function articleFixture(overrides: Partial<HelpArticle> = {}): HelpArticle {
  return {
    id: ARTICLE_ID,
    category: "faq",
    title: "How do I reset my password?",
    content: "<p>Use the sign-in page.</p>",
    isPublished: false,
    publishedAt: null,
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-09-03T00:00:00.000Z",
    updatedAt: "2026-09-03T00:00:00.000Z",
    ...overrides,
  };
}

describe("HelpCenterForm", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    pushMock.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("create mode: Title is a real HTML required field", () => {
    render(<HelpCenterForm mode="create" />);
    expect(screen.getByLabelText("Title")).toBeRequired();
  });

  it("renders a rich-text editor (not a plain textarea) for content", () => {
    render(<HelpCenterForm mode="create" />);
    expect(document.querySelectorAll("textarea")).toHaveLength(0);
    expect(document.querySelectorAll('[contenteditable="true"]')).toHaveLength(1);
  });

  it("create mode: shows a Category select with every canonical topic", () => {
    render(<HelpCenterForm mode="create" />);
    expect(screen.getByRole("option", { name: "FAQ" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Onboarding" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Version history" })).toBeInTheDocument();
  });

  it("edit mode: category is shown read-only, not as a select", () => {
    render(<HelpCenterForm mode="edit" articleId={ARTICLE_ID} initial={articleFixture()} />);
    expect(screen.queryByLabelText("Category")).not.toBeInTheDocument();
    expect(screen.getByText("FAQ")).toBeInTheDocument();
  });

  it("create mode: submitting with empty content shows an error and never calls fetch", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    render(<HelpCenterForm mode="create" />);
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "New article" } });
    fireEvent.click(screen.getByRole("button", { name: "Create article" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Content is required.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // RichTextEditor is a Tiptap contentEditable div, not a real form control — jsdom/RTL's
  // fireEvent doesn't drive Tiptap's own ProseMirror editing view, so content can't be typed in
  // via simulated events (the same lesson this codebase already documents for
  // `proof-and-claims-library-form.test.tsx`/`project-form.test.tsx`). The tests below use edit
  // mode with a non-empty `initial.content` instead, verifying rich-text content only via that
  // prop, never simulated typing.

  it("edit mode: never sends category, and submits the unchanged content as-is", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(ARTICLE_ID));
    global.fetch = fetchMock as typeof fetch;

    render(<HelpCenterForm mode="edit" articleId={ARTICLE_ID} initial={articleFixture()} />);
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "New title" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.example.com/help-center/articles/${ARTICLE_ID}/update`);
    const body = JSON.parse(init.body as string);
    expect(body).not.toHaveProperty("category");
    expect(body.title).toBe("New title");
    expect(body.content).toBe("<p>Use the sign-in page.</p>");
  });

  it("on success, navigates to the article's detail page", async () => {
    global.fetch = vi.fn().mockResolvedValue(successResponse(ARTICLE_ID)) as typeof fetch;

    render(<HelpCenterForm mode="edit" articleId={ARTICLE_ID} initial={articleFixture()} />);
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith(`/help-center/${ARTICLE_ID}`));
  });

  it("shows the backend's error message on a failed submit", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        error: { code: "NotFoundException", message: `Help article not found: ${ARTICLE_ID}` },
        correlationId: "corr-1",
      }),
    } as Response) as typeof fetch;

    render(<HelpCenterForm mode="edit" articleId={ARTICLE_ID} initial={articleFixture()} />);
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/not found/);
    expect(pushMock).not.toHaveBeenCalled();
  });
});
