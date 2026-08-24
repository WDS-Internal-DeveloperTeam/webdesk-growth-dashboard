import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Keyword } from "@webdesk/shared-types";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { KeywordForm } from "../../components/keyword-form.js";

const PROJECT_ID = "99999999-9999-9999-9999-999999999999";
const KEYWORD_ID = "11111111-1111-1111-1111-111111111111";

function successResponse(id: string): Response {
  return {
    ok: true,
    json: async () => ({ success: true, data: { id }, correlationId: "corr-1" }),
  } as Response;
}

function keywordFixture(overrides: Partial<Keyword> = {}): Keyword {
  return {
    id: KEYWORD_ID,
    projectId: PROJECT_ID,
    publicId: "KW-1",
    queryText: "best seo tools",
    keywordType: null,
    intent: null,
    funnelStage: null,
    country: null,
    searchVolume: null,
    difficultyScore: null,
    source: null,
    researchDate: null,
    cannibalizationNotes: null,
    confidence: null,
    approvalStatus: "draft",
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-08-24T00:00:00.000Z",
    updatedAt: "2026-08-24T00:00:00.000Z",
    ...overrides,
  };
}

describe("KeywordForm", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    pushMock.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("create mode: publicId/queryText are real HTML required fields", () => {
    render(<KeywordForm mode="create" projectId={PROJECT_ID} />);
    expect(screen.getByLabelText("Public ID")).toBeRequired();
    expect(screen.getByLabelText("Query text")).toBeRequired();
  });

  it("renders a rich-text editor (not a plain textarea) for cannibalizationNotes", () => {
    render(<KeywordForm mode="create" projectId={PROJECT_ID} />);
    expect(document.querySelectorAll("textarea")).toHaveLength(0);
    expect(document.querySelectorAll('[contenteditable="true"]')).toHaveLength(1);
  });

  it("edit mode: publicId is shown read-only, not as an editable field", () => {
    render(
      <KeywordForm
        mode="edit"
        projectId={PROJECT_ID}
        keywordId={KEYWORD_ID}
        initial={keywordFixture()}
      />,
    );
    expect(screen.queryByLabelText("Public ID")).not.toBeInTheDocument();
    expect(screen.getByText("KW-1")).toBeInTheDocument();
  });

  it("edit mode: no approval-status field is rendered — only the dedicated status-actions route may change it", () => {
    render(
      <KeywordForm
        mode="edit"
        projectId={PROJECT_ID}
        keywordId={KEYWORD_ID}
        initial={keywordFixture()}
      />,
    );
    expect(screen.queryByLabelText(/approval status/i)).not.toBeInTheDocument();
  });

  it("create mode: submits publicId/queryText, omitting untouched optional fields entirely, then navigates to the new keyword's detail route with projectId preserved", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(KEYWORD_ID));
    global.fetch = fetchMock as typeof fetch;

    render(<KeywordForm mode="create" projectId={PROJECT_ID} />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "KW-NEW" } });
    fireEvent.change(screen.getByLabelText("Query text"), { target: { value: "buy widgets" } });
    fireEvent.click(screen.getByRole("button", { name: "Create keyword" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      `https://api.example.com/keyword-and-entity-library/projects/${PROJECT_ID}/keywords`,
    );
    const body = JSON.parse(init.body as string);
    expect(body.publicId).toBe("KW-NEW");
    expect(body.queryText).toBe("buy widgets");
    expect(body).not.toHaveProperty("keywordType");
    expect(body).not.toHaveProperty("searchVolume");
    expect(body).not.toHaveProperty("confidence");
    expect(body).not.toHaveProperty("cannibalizationNotes");
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith(
        `/keyword-and-entity-library/${KEYWORD_ID}?projectId=${PROJECT_ID}`,
      ),
    );
  });

  it("edit mode: never sends publicId/approvalStatus, sends explicit null for a cleared optional field, then navigates using props.keywordId", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(KEYWORD_ID));
    global.fetch = fetchMock as typeof fetch;

    render(
      <KeywordForm
        mode="edit"
        projectId={PROJECT_ID}
        keywordId={KEYWORD_ID}
        initial={keywordFixture({ keywordType: "informational" })}
      />,
    );
    fireEvent.change(screen.getByLabelText("Keyword type"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      `https://api.example.com/keyword-and-entity-library/projects/${PROJECT_ID}/keywords/${KEYWORD_ID}/update`,
    );
    const body = JSON.parse(init.body as string);
    expect(body).not.toHaveProperty("publicId");
    expect(body).not.toHaveProperty("approvalStatus");
    expect(body.keywordType).toBeNull();
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith(
        `/keyword-and-entity-library/${KEYWORD_ID}?projectId=${PROJECT_ID}`,
      ),
    );
  });

  it("submits a filled-in searchVolume/difficultyScore as real numbers, and an empty one as omitted (create)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(KEYWORD_ID));
    global.fetch = fetchMock as typeof fetch;

    render(<KeywordForm mode="create" projectId={PROJECT_ID} />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "KW-NEW" } });
    fireEvent.change(screen.getByLabelText("Query text"), { target: { value: "buy widgets" } });
    fireEvent.change(screen.getByLabelText("Search volume"), { target: { value: "1200" } });
    fireEvent.click(screen.getByRole("button", { name: "Create keyword" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.searchVolume).toBe(1200);
    expect(body).not.toHaveProperty("difficultyScore");
  });

  it("submits the selected confidence value", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(KEYWORD_ID));
    global.fetch = fetchMock as typeof fetch;

    render(<KeywordForm mode="create" projectId={PROJECT_ID} />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "KW-NEW" } });
    fireEvent.change(screen.getByLabelText("Query text"), { target: { value: "buy widgets" } });
    fireEvent.change(screen.getByLabelText("Confidence"), { target: { value: "high" } });
    fireEvent.click(screen.getByRole("button", { name: "Create keyword" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.confidence).toBe("high");
  });

  it("shows the backend's error message without navigating on a failed submit", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        success: false,
        error: { code: "BadRequestException", message: "publicId already in use: KW-NEW" },
        correlationId: "corr-1",
      }),
    } as Response) as typeof fetch;

    render(<KeywordForm mode="create" projectId={PROJECT_ID} />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "KW-NEW" } });
    fireEvent.change(screen.getByLabelText("Query text"), { target: { value: "buy widgets" } });
    fireEvent.click(screen.getByRole("button", { name: "Create keyword" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("publicId already in use: KW-NEW");
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("cancel link (create) points back to the list page with projectId preserved", () => {
    render(<KeywordForm mode="create" projectId={PROJECT_ID} />);
    expect(screen.getByRole("link", { name: "Cancel" })).toHaveAttribute(
      "href",
      `/keyword-and-entity-library?projectId=${PROJECT_ID}`,
    );
  });

  it("cancel link (edit) points back to the detail page with projectId preserved", () => {
    render(
      <KeywordForm
        mode="edit"
        projectId={PROJECT_ID}
        keywordId={KEYWORD_ID}
        initial={keywordFixture()}
      />,
    );
    expect(screen.getByRole("link", { name: "Cancel" })).toHaveAttribute(
      "href",
      `/keyword-and-entity-library/${KEYWORD_ID}?projectId=${PROJECT_ID}`,
    );
  });
});
