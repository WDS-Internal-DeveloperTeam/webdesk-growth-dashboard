import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DesignReferenceRecord } from "@webdesk/shared-types";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { DesignReferenceLibraryForm } from "../../components/design-reference-library-form.js";

const RECORD_ID = "11111111-1111-1111-1111-111111111111";

function successResponse(id: string): Response {
  return {
    ok: true,
    json: async () => ({ success: true, data: { id }, correlationId: "corr-1" }),
  } as Response;
}

function recordFixture(overrides: Partial<DesignReferenceRecord> = {}): DesignReferenceRecord {
  return {
    id: RECORD_ID,
    publicId: "DRL-1",
    title: "Homepage hero",
    sourceUrl: null,
    screenshotUrl: null,
    pageSectionType: null,
    likes: null,
    dislikes: null,
    desktopBehavior: null,
    mobileBehavior: null,
    motionNotes: null,
    accessibilityConcerns: null,
    performanceConcerns: null,
    tags: [],
    approvalStatus: "draft",
    version: 1,
    isPublished: false,
    publishedAt: null,
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-08-27T00:00:00.000Z",
    updatedAt: "2026-08-27T00:00:00.000Z",
    ...overrides,
  };
}

describe("DesignReferenceLibraryForm", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    pushMock.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("create mode: publicId/title are real HTML required fields", () => {
    render(<DesignReferenceLibraryForm mode="create" />);
    expect(screen.getByLabelText("Public ID")).toBeRequired();
    expect(screen.getByLabelText("Title")).toBeRequired();
  });

  it("renders a rich-text editor (not a plain textarea) for likes/dislikes/motion notes/accessibility concerns/performance concerns, and plain textareas for desktop/mobile behavior", () => {
    render(<DesignReferenceLibraryForm mode="create" />);
    expect(document.querySelectorAll("textarea")).toHaveLength(2);
    expect(document.querySelectorAll('[contenteditable="true"]')).toHaveLength(5);
  });

  it("create mode: submits publicId/title, omitting untouched optional fields entirely", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(RECORD_ID));
    global.fetch = fetchMock as typeof fetch;

    render(<DesignReferenceLibraryForm mode="create" />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "DRL-NEW" } });
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Pricing table" } });
    fireEvent.click(screen.getByRole("button", { name: "Create record" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.com/design-reference-library/records");
    const body = JSON.parse(init.body as string);
    expect(body.publicId).toBe("DRL-NEW");
    expect(body.title).toBe("Pricing table");
    expect(body).not.toHaveProperty("sourceUrl");
    expect(body).not.toHaveProperty("screenshotUrl");
    expect(body).not.toHaveProperty("pageSectionType");
    expect(body).not.toHaveProperty("likes");
    expect(body).not.toHaveProperty("dislikes");
    expect(body).not.toHaveProperty("desktopBehavior");
    expect(body).not.toHaveProperty("mobileBehavior");
    expect(body).not.toHaveProperty("motionNotes");
    expect(body).not.toHaveProperty("accessibilityConcerns");
    expect(body).not.toHaveProperty("performanceConcerns");
    expect(body.tags).toEqual([]);
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith(`/design-reference-library/${RECORD_ID}`),
    );
  });

  it("edit mode: never sends approvalStatus/version/isPublished/publishedAt/publicId", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(RECORD_ID));
    global.fetch = fetchMock as typeof fetch;

    render(
      <DesignReferenceLibraryForm
        mode="edit"
        recordId={RECORD_ID}
        initial={recordFixture({ title: "Was set" })}
      />,
    );
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Renamed" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      `https://api.example.com/design-reference-library/records/${RECORD_ID}/update`,
    );
    const body = JSON.parse(init.body as string);
    expect(body.title).toBe("Renamed");
    expect(body).not.toHaveProperty("approvalStatus");
    expect(body).not.toHaveProperty("version");
    expect(body).not.toHaveProperty("isPublished");
    expect(body).not.toHaveProperty("publishedAt");
    expect(body).not.toHaveProperty("publicId");
  });

  it("edit mode: clearing a previously-set source URL sends an explicit null, not an empty string", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(RECORD_ID));
    global.fetch = fetchMock as typeof fetch;

    render(
      <DesignReferenceLibraryForm
        mode="edit"
        recordId={RECORD_ID}
        initial={recordFixture({ sourceUrl: "https://example.com/pricing" })}
      />,
    );
    fireEvent.change(screen.getByLabelText("Source URL"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.sourceUrl).toBeNull();
  });

  it("rejects an unsafe source URL scheme client-side and never fires the request", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    render(<DesignReferenceLibraryForm mode="create" />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "DRL-NEW" } });
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "X" } });
    fireEvent.change(screen.getByLabelText("Source URL"), {
      target: { value: "javascript:alert(1)" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create record" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Source URL must be a valid http:// or https:// URL.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an unsafe screenshot URL scheme client-side and never fires the request", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    render(<DesignReferenceLibraryForm mode="create" />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "DRL-NEW" } });
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "X" } });
    fireEvent.change(screen.getByLabelText("Screenshot URL"), {
      target: { value: "data:text/html,<script>alert(1)</script>" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create record" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Screenshot URL must be a valid http:// or https:// URL.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("tag input: pressing Enter adds a tag, and it's included in the submitted tags", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(RECORD_ID));
    global.fetch = fetchMock as typeof fetch;

    render(<DesignReferenceLibraryForm mode="create" />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "DRL-NEW" } });
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "X" } });
    const tagsInput = screen.getByLabelText("Tags");
    fireEvent.change(tagsInput, { target: { value: "hero" } });
    fireEvent.keyDown(tagsInput, { key: "Enter" });
    expect(screen.getByText("hero")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Create record" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.tags).toEqual(["hero"]);
  });

  it("shows the backend's error message and does not navigate on a failed submit", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        success: false,
        error: { code: "BadRequestException", message: "publicId already in use: DRL-NEW" },
        correlationId: "corr-1",
      }),
    } as Response) as typeof fetch;

    render(<DesignReferenceLibraryForm mode="create" />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "DRL-NEW" } });
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "X" } });
    fireEvent.click(screen.getByRole("button", { name: "Create record" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("publicId already in use: DRL-NEW");
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("edit mode: a rich-text field's initial HTML content loads into its editor", async () => {
    render(
      <DesignReferenceLibraryForm
        mode="edit"
        recordId={RECORD_ID}
        initial={recordFixture({ likes: "<p>Clean use of whitespace</p>" })}
      />,
    );
    await waitFor(() => expect(screen.getByText("Clean use of whitespace")).toBeInTheDocument());
  });

  it("edit mode: publicId is shown read-only, not as an editable field", () => {
    render(
      <DesignReferenceLibraryForm
        mode="edit"
        recordId={RECORD_ID}
        initial={recordFixture({ publicId: "DRL-READONLY" })}
      />,
    );
    expect(screen.queryByLabelText("Public ID")).not.toBeInTheDocument();
    expect(screen.getByText("DRL-READONLY")).toBeInTheDocument();
  });
});
