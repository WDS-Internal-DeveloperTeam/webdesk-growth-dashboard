import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UserSummary, WireframeRecord } from "@webdesk/shared-types";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { WireframeLibraryForm } from "../../components/wireframe-library-form.js";

const RECORD_ID = "11111111-1111-1111-1111-111111111111";
const ROW_ID = "22222222-2222-2222-2222-222222222222";
const FORKED_ROW_ID = "33333333-3333-3333-3333-333333333333";
const REVIEWER_ID = "44444444-4444-4444-4444-444444444444";
const UNRESOLVABLE_REVIEWER_ID = "55555555-5555-5555-5555-555555555555";

function createSuccessResponse(recordId: string): Response {
  return {
    ok: true,
    json: async () => ({
      success: true,
      data: { id: recordId, recordId },
      correlationId: "corr-1",
    }),
  } as Response;
}

function updateSuccessResponse(): Response {
  return {
    ok: true,
    json: async () => ({
      success: true,
      data: { id: ROW_ID, recordId: RECORD_ID },
      correlationId: "corr-1",
    }),
  } as Response;
}

function recordFixture(overrides: Partial<WireframeRecord> = {}): WireframeRecord {
  return {
    id: ROW_ID,
    recordId: RECORD_ID,
    publicId: "WF-1",
    pageOrModule: "Homepage",
    versionNumber: 1,
    isCurrent: true,
    viewport: "desktop",
    fileReference: null,
    annotations: null,
    interactionNotes: null,
    relatedTemplateId: null,
    reviewerUserId: null,
    approvalStatus: "draft",
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-08-31T00:00:00.000Z",
    updatedAt: "2026-08-31T00:00:00.000Z",
    ...overrides,
  };
}

const REVIEWER: UserSummary = {
  id: REVIEWER_ID,
  displayName: "Jamie Reviewer",
  email: "jamie@example.com",
};

describe("WireframeLibraryForm", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    pushMock.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("create mode: publicId/pageOrModule/viewport are real HTML required fields", () => {
    render(<WireframeLibraryForm mode="create" />);
    expect(screen.getByLabelText("Public ID")).toBeRequired();
    expect(screen.getByLabelText("Page / module")).toBeRequired();
    expect(screen.getByLabelText("Viewport")).toBeRequired();
  });

  it("renders a rich-text editor (not a plain textarea) for Annotations and Interaction notes", () => {
    render(<WireframeLibraryForm mode="create" />);
    expect(document.querySelectorAll("textarea")).toHaveLength(0);
    expect(document.querySelectorAll('[contenteditable="true"]')).toHaveLength(2);
  });

  it("edit mode: pageOrModule is shown read-only, not as an editable field", () => {
    render(
      <WireframeLibraryForm
        mode="edit"
        recordId={RECORD_ID}
        initial={recordFixture()}
        initialReviewer={null}
      />,
    );
    expect(screen.queryByLabelText("Page / module")).not.toBeInTheDocument();
    expect(screen.getByText("Homepage")).toBeInTheDocument();
  });

  it("edit mode: publicId is shown read-only, not as an editable field", () => {
    render(
      <WireframeLibraryForm
        mode="edit"
        recordId={RECORD_ID}
        initial={recordFixture()}
        initialReviewer={null}
      />,
    );
    expect(screen.queryByLabelText("Public ID")).not.toBeInTheDocument();
    expect(screen.getByText("WF-1")).toBeInTheDocument();
  });

  it("create mode: submits publicId/pageOrModule/viewport, omitting untouched optional fields entirely, then navigates using the response's recordId", async () => {
    const fetchMock = vi.fn().mockResolvedValue(createSuccessResponse(RECORD_ID));
    global.fetch = fetchMock as typeof fetch;

    render(<WireframeLibraryForm mode="create" />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "WF-NEW" } });
    fireEvent.change(screen.getByLabelText("Page / module"), {
      target: { value: "Pricing" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create record" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.com/wireframe-library/records");
    const body = JSON.parse(init.body as string);
    expect(body.publicId).toBe("WF-NEW");
    expect(body.pageOrModule).toBe("Pricing");
    // "mobile" is VIEWPORT_VALUES[0] — the form's own default when nothing is explicitly selected.
    expect(body.viewport).toBe("mobile");
    expect(body).not.toHaveProperty("fileReference");
    expect(body).not.toHaveProperty("annotations");
    expect(body).not.toHaveProperty("interactionNotes");
    expect(body).not.toHaveProperty("relatedTemplateId");
    expect(body).not.toHaveProperty("reviewerUserId");
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith(`/wireframe-library/${RECORD_ID}`));
  });

  it("edit mode: never sends pageOrModule/publicId/approvalStatus, and includes the current viewport", async () => {
    const fetchMock = vi.fn().mockResolvedValue(updateSuccessResponse());
    global.fetch = fetchMock as typeof fetch;

    render(
      <WireframeLibraryForm
        mode="edit"
        recordId={RECORD_ID}
        initial={recordFixture()}
        initialReviewer={null}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.example.com/wireframe-library/records/${RECORD_ID}/update`);
    const body = JSON.parse(init.body as string);
    expect(body).not.toHaveProperty("pageOrModule");
    expect(body).not.toHaveProperty("publicId");
    expect(body).not.toHaveProperty("approvalStatus");
    expect(body.viewport).toBe("desktop");
  });

  it("edit mode: an untouched reviewer preserves the current raw reviewerUserId on submit", async () => {
    const fetchMock = vi.fn().mockResolvedValue(updateSuccessResponse());
    global.fetch = fetchMock as typeof fetch;

    render(
      <WireframeLibraryForm
        mode="edit"
        recordId={RECORD_ID}
        // Reviewer resolution failed (e.g. a disabled account) — initialReviewer is null even
        // though reviewerUserId is still set.
        initial={recordFixture({ reviewerUserId: UNRESOLVABLE_REVIEWER_ID })}
        initialReviewer={null}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.reviewerUserId).toBe(UNRESOLVABLE_REVIEWER_ID);
  });

  it("edit mode: an already-assigned reviewer's display summary loads into the picker", () => {
    render(
      <WireframeLibraryForm
        mode="edit"
        recordId={RECORD_ID}
        initial={recordFixture({ reviewerUserId: REVIEWER_ID })}
        initialReviewer={REVIEWER}
      />,
    );
    expect(screen.getByText("Jamie Reviewer")).toBeInTheDocument();
    expect(screen.getByText("jamie@example.com")).toBeInTheDocument();
  });

  it("edit mode: navigates using the URL's own recordId, not the response's row id — matters when the edit forked a new version with a different id", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        // A forked-version response: a DIFFERENT row id, same recordId.
        data: { id: FORKED_ROW_ID, recordId: RECORD_ID },
        correlationId: "corr-1",
      }),
    } as Response);
    global.fetch = fetchMock as typeof fetch;

    render(
      <WireframeLibraryForm
        mode="edit"
        recordId={RECORD_ID}
        initial={recordFixture({ approvalStatus: "approved" })}
        initialReviewer={null}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith(`/wireframe-library/${RECORD_ID}`));
    expect(pushMock).not.toHaveBeenCalledWith(`/wireframe-library/${FORKED_ROW_ID}`);
  });

  it("edit mode: shows the fork notice when the current version is approved", () => {
    render(
      <WireframeLibraryForm
        mode="edit"
        recordId={RECORD_ID}
        initial={recordFixture({ approvalStatus: "approved" })}
        initialReviewer={null}
      />,
    );
    expect(screen.getByText(/creates a new draft version instead/)).toBeInTheDocument();
  });

  it("edit mode: shows no fork notice when the current version is not approved", () => {
    render(
      <WireframeLibraryForm
        mode="edit"
        recordId={RECORD_ID}
        initial={recordFixture({ approvalStatus: "draft" })}
        initialReviewer={null}
      />,
    );
    expect(screen.queryByText(/creates a new draft version instead/)).not.toBeInTheDocument();
  });

  it("shows the backend's error message and does not navigate on a failed submit", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        success: false,
        error: { code: "BadRequestException", message: "publicId already in use: WF-NEW" },
        correlationId: "corr-1",
      }),
    } as Response) as typeof fetch;

    render(<WireframeLibraryForm mode="create" />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "WF-NEW" } });
    fireEvent.change(screen.getByLabelText("Page / module"), { target: { value: "X" } });
    fireEvent.click(screen.getByRole("button", { name: "Create record" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("publicId already in use: WF-NEW");
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid file reference URL client-side, without submitting", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    render(<WireframeLibraryForm mode="create" />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "WF-NEW" } });
    fireEvent.change(screen.getByLabelText("Page / module"), { target: { value: "X" } });
    fireEvent.change(screen.getByLabelText("File reference"), {
      target: { value: "javascript:alert(1)" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create record" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "File reference must be a valid http:// or https:// URL.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("edit mode: a previously-set related template ID loads into the input", () => {
    render(
      <WireframeLibraryForm
        mode="edit"
        recordId={RECORD_ID}
        initial={recordFixture({ relatedTemplateId: "page-template-abc" })}
        initialReviewer={null}
      />,
    );
    expect(screen.getByLabelText("Related template ID")).toHaveValue("page-template-abc");
  });
});
