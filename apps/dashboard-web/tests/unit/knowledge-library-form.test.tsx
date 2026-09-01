import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { KnowledgeLibraryForm } from "../../components/knowledge-library-form.js";

const RECORD_ID = "11111111-1111-1111-1111-111111111111";

function successResponse(id: string): Response {
  return {
    ok: true,
    json: async () => ({ success: true, data: { id }, correlationId: "corr-1" }),
  } as Response;
}

describe("KnowledgeLibraryForm", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    pushMock.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("create mode: renders every non-redacted field and exactly one rich-text editor", () => {
    render(<KnowledgeLibraryForm mode="create" />);
    expect(screen.getByLabelText("Title")).toBeInTheDocument();
    expect(screen.getByLabelText("Source type")).toBeInTheDocument();
    expect(screen.getByLabelText("Location")).toBeInTheDocument();
    expect(screen.getByLabelText("Source date")).toBeInTheDocument();
    expect(screen.getByLabelText("Confidentiality")).toBeInTheDocument();
    expect(screen.getByLabelText("Approved for agent use")).toBeInTheDocument();
    expect(screen.getByLabelText("Related entities")).toBeInTheDocument();
    expect(screen.getByLabelText("Last reviewed at")).toBeInTheDocument();
    // RichTextEditor is a Tiptap contentEditable div, not a real form control — verified
    // structurally, not via getByLabelText/toHaveValue, matching this codebase's own established
    // convention for every RichTextEditor consumer's test suite.
    expect(document.querySelectorAll('[contenteditable="true"]')).toHaveLength(1);
    expect(screen.queryByText(/isn.t visible to you/)).not.toBeInTheDocument();
  });

  it("create mode: defaults confidentiality to internal", () => {
    render(<KnowledgeLibraryForm mode="create" />);
    expect(screen.getByLabelText("Confidentiality")).toHaveValue("internal");
  });

  it("create mode: submits a POST to /knowledge-library/records and redirects to the new record", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(RECORD_ID));
    global.fetch = fetchMock as typeof fetch;

    render(<KnowledgeLibraryForm mode="create" />);
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "New reference" } });
    fireEvent.click(screen.getByRole("button", { name: "Create record" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.com/knowledge-library/records");
    expect(options.method).toBe("POST");
    expect(options.credentials).toBe("include");
    const body = JSON.parse(options.body as string) as Record<string, unknown>;
    expect(body.title).toBe("New reference");
    expect(body.confidentiality).toBe("internal");
    expect(body.approvedForAgentUse).toBe(false);

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith(`/knowledge-library/${RECORD_ID}`));
  });

  it("create mode: omits notes/sourceType/location entirely when left blank", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(RECORD_ID));
    global.fetch = fetchMock as typeof fetch;

    render(<KnowledgeLibraryForm mode="create" />);
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Create record" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string) as Record<string, unknown>;
    expect(body).not.toHaveProperty("notes");
    expect(body).not.toHaveProperty("sourceType");
    expect(body).not.toHaveProperty("location");
    expect(body).not.toHaveProperty("relatedEntityIds");
    expect(body).not.toHaveProperty("lastReviewedAt");
  });

  it("shows the backend's error message when the submit fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        error: { code: "BadRequestException", message: "Title is required" },
        correlationId: "corr-1",
      }),
    } as Response) as typeof fetch;

    render(<KnowledgeLibraryForm mode="create" />);
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Create record" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Title is required");
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("edit mode: a redacted record (notes === undefined) hides sourceType/location/notes behind a notice, and omits them from the submit payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(RECORD_ID));
    global.fetch = fetchMock as typeof fetch;

    render(
      <KnowledgeLibraryForm
        mode="edit"
        recordId={RECORD_ID}
        initial={{
          title: "Restricted record",
          sourceType: undefined,
          location: undefined,
          ownerUserId: null,
          owner: null,
          sourceDate: null,
          confidentiality: "restricted",
          approvedForAgentUse: false,
          notes: undefined,
          relatedEntityIds: [],
          lastReviewedAt: null,
        }}
      />,
    );

    expect(screen.queryByLabelText("Source type")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Location")).not.toBeInTheDocument();
    expect(screen.getAllByText(/isn.t visible to you/).length).toBeGreaterThan(0);
    // No RichTextEditor is rendered for a redacted notes field.
    expect(document.querySelectorAll('[contenteditable="true"]')).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.example.com/knowledge-library/records/${RECORD_ID}/update`);
    const body = JSON.parse(options.body as string) as Record<string, unknown>;
    expect(body).not.toHaveProperty("sourceType");
    expect(body).not.toHaveProperty("location");
    expect(body).not.toHaveProperty("notes");
    expect(body.title).toBe("Restricted record");
  });

  it("edit mode: a visible record renders sourceType/location/notes as editable fields", () => {
    render(
      <KnowledgeLibraryForm
        mode="edit"
        recordId={RECORD_ID}
        initial={{
          title: "Visible record",
          sourceType: "internal_wiki",
          location: "https://wiki.internal.example",
          ownerUserId: null,
          owner: null,
          sourceDate: "2026-01-01",
          confidentiality: "internal",
          approvedForAgentUse: true,
          notes: "<p>Some notes</p>",
          relatedEntityIds: ["entity-1"],
          lastReviewedAt: null,
        }}
      />,
    );

    expect(screen.getByLabelText("Source type")).toHaveValue("internal_wiki");
    expect(screen.getByLabelText("Location")).toHaveValue("https://wiki.internal.example");
    expect(screen.getByLabelText("Source date")).toHaveValue("2026-01-01");
    expect(screen.getByLabelText("Approved for agent use")).toBeChecked();
    expect(document.querySelectorAll('[contenteditable="true"]')).toHaveLength(1);
  });
});
