import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Page, PageKeywordAssignment } from "@webdesk/shared-types";

import { KeywordPageAssignmentsSection } from "../../components/keyword-page-assignments-section.js";

const PROJECT_ID = "99999999-9999-9999-9999-999999999999";
const KEYWORD_ID = "11111111-1111-1111-1111-111111111111";
const PAGE_ID = "33333333-3333-3333-3333-333333333333";
const BASE_PATH = `https://api.example.com/keyword-and-entity-library/projects/${PROJECT_ID}/keywords/${KEYWORD_ID}/page-assignments`;

function pageFixture(id: string, overrides: Partial<Page> = {}): Page {
  return {
    id,
    projectId: PROJECT_ID,
    publicId: `PG-${id}`,
    pageName: "Pricing",
    pageType: null,
    existingOrProposed: "existing",
    indexStatus: "unknown",
    template: null,
    roadmapPhaseId: null,
    workflowStage: "draft",
    targetKeyword: null,
    designVersion: null,
    repositoryFiles: null,
    wordpressPageId: null,
    wordpressPostId: null,
    lastScanAt: null,
    lastDeploymentAt: null,
    classification: null,
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-08-24T00:00:00.000Z",
    updatedAt: "2026-08-24T00:00:00.000Z",
    ...overrides,
  };
}

function assignmentFixture(
  id: string,
  overrides: Partial<PageKeywordAssignment> = {},
): PageKeywordAssignment {
  return {
    id,
    keywordId: KEYWORD_ID,
    pageId: PAGE_ID,
    assignmentNote: null,
    createdBy: null,
    createdAt: "2026-08-24T00:00:00.000Z",
    ...overrides,
  };
}

describe("KeywordPageAssignmentsSection", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("renders 'No pages assigned yet.' when empty", () => {
    render(
      <KeywordPageAssignmentsSection
        projectId={PROJECT_ID}
        keywordId={KEYWORD_ID}
        initialAssignments={[]}
        pages={[]}
      />,
    );
    expect(screen.getByText("No pages assigned yet.")).toBeInTheDocument();
  });

  it("resolves an assigned page's name from the pages pool, and shows its assignmentNote", () => {
    render(
      <KeywordPageAssignmentsSection
        projectId={PROJECT_ID}
        keywordId={KEYWORD_ID}
        initialAssignments={[assignmentFixture("assign-1", { assignmentNote: "primary page" })]}
        pages={[pageFixture(PAGE_ID, { pageName: "Pricing" })]}
      />,
    );
    expect(screen.getByText("Pricing")).toBeInTheDocument();
    expect(screen.getByText(/primary page/)).toBeInTheDocument();
  });

  it("falls back to the raw pageId when an assigned page is outside the picker's fetch window", () => {
    render(
      <KeywordPageAssignmentsSection
        projectId={PROJECT_ID}
        keywordId={KEYWORD_ID}
        initialAssignments={[assignmentFixture("assign-1", { pageId: "outside-window" })]}
        pages={[]}
      />,
    );
    expect(screen.getByText("outside-window")).toBeInTheDocument();
  });

  it("assigns a page — attaches whatever note is currently typed to the assignment", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: assignmentFixture("assign-new", { assignmentNote: "landing page for this keyword" }),
        correlationId: "corr-1",
      }),
    } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <KeywordPageAssignmentsSection
        projectId={PROJECT_ID}
        keywordId={KEYWORD_ID}
        initialAssignments={[]}
        pages={[pageFixture(PAGE_ID, { pageName: "Pricing" })]}
      />,
    );

    fireEvent.change(screen.getByLabelText("Note (optional)"), {
      target: { value: "landing page for this keyword" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Assign a page" }), {
      target: { value: "Pricing" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Pricing" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        BASE_PATH,
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          body: JSON.stringify({
            pageId: PAGE_ID,
            assignmentNote: "landing page for this keyword",
          }),
        }),
      ),
    );
    expect(await screen.findByText(/landing page for this keyword/)).toBeInTheDocument();
    // The note field clears after a successful add, ready for the next assignment.
    expect(screen.getByLabelText("Note (optional)")).toHaveValue("");
  });

  it("assigns a page with no note as null, not an empty string", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: assignmentFixture("assign-new"),
        correlationId: "corr-1",
      }),
    } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <KeywordPageAssignmentsSection
        projectId={PROJECT_ID}
        keywordId={KEYWORD_ID}
        initialAssignments={[]}
        pages={[pageFixture(PAGE_ID, { pageName: "Pricing" })]}
      />,
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Assign a page" }), {
      target: { value: "Pricing" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Pricing" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.assignmentNote).toBeNull();
  });

  it("removes an assignment — posts to .../:id/delete (not the DELETE method) and removes the row", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 } as Response);
    global.fetch = fetchMock as typeof fetch;

    render(
      <KeywordPageAssignmentsSection
        projectId={PROJECT_ID}
        keywordId={KEYWORD_ID}
        initialAssignments={[assignmentFixture("assign-1")]}
        pages={[pageFixture(PAGE_ID, { pageName: "Pricing" })]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(`${BASE_PATH}/assign-1/delete`, {
        method: "POST",
        credentials: "include",
      }),
    );
    await waitFor(() => expect(screen.getByText("No pages assigned yet.")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
  });

  it("shows the backend's error message when assigning fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        success: false,
        error: { code: "BadRequestException", message: "pageId not found: gone" },
        correlationId: "corr-1",
      }),
    } as Response) as typeof fetch;

    render(
      <KeywordPageAssignmentsSection
        projectId={PROJECT_ID}
        keywordId={KEYWORD_ID}
        initialAssignments={[]}
        pages={[pageFixture(PAGE_ID, { pageName: "Pricing" })]}
      />,
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Assign a page" }), {
      target: { value: "Pricing" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Pricing" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("pageId not found: gone");
  });

  it("excludes an already-assigned page from the picker's own search results", () => {
    render(
      <KeywordPageAssignmentsSection
        projectId={PROJECT_ID}
        keywordId={KEYWORD_ID}
        initialAssignments={[assignmentFixture("assign-1", { pageId: PAGE_ID })]}
        pages={[
          pageFixture(PAGE_ID, { pageName: "Pricing" }),
          pageFixture("other-id", { pageName: "About" }),
        ]}
      />,
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Assign a page" }), {
      target: { value: "" },
    });
    expect(screen.queryByRole("button", { name: "Pricing" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "About" })).toBeInTheDocument();
  });
});
