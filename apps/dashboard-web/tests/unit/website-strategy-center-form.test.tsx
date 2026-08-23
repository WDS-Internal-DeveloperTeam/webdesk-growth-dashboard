import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WebsiteStrategyRecord } from "@webdesk/shared-types";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { WebsiteStrategyCenterForm } from "../../components/website-strategy-center-form.js";

const RECORD_ID = "11111111-1111-1111-1111-111111111111";
const ROW_ID = "22222222-2222-2222-2222-222222222222";
const FORKED_ROW_ID = "33333333-3333-3333-3333-333333333333";

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

function recordFixture(overrides: Partial<WebsiteStrategyRecord> = {}): WebsiteStrategyRecord {
  return {
    id: ROW_ID,
    recordId: RECORD_ID,
    publicId: "WSC-1",
    recordType: "navigation_plan",
    versionNumber: 1,
    isCurrent: true,
    title: "Primary Navigation Plan",
    content: null,
    notes: null,
    approvalStatus: "draft",
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-08-23T00:00:00.000Z",
    updatedAt: "2026-08-23T00:00:00.000Z",
    ...overrides,
  };
}

describe("WebsiteStrategyCenterForm", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    pushMock.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("create mode: publicId/recordType/title are real HTML required fields", () => {
    render(<WebsiteStrategyCenterForm mode="create" />);
    expect(screen.getByLabelText("Public ID")).toBeRequired();
    expect(screen.getByLabelText("Record type")).toBeRequired();
    expect(screen.getByLabelText("Title")).toBeRequired();
  });

  it("renders a rich-text editor (not a plain textarea) for both Content and Notes fields", () => {
    render(<WebsiteStrategyCenterForm mode="create" />);
    expect(document.querySelectorAll("textarea")).toHaveLength(0);
    expect(document.querySelectorAll('[contenteditable="true"]')).toHaveLength(2);
  });

  it("edit mode: recordType is shown read-only, not as an editable field", () => {
    render(
      <WebsiteStrategyCenterForm mode="edit" recordId={RECORD_ID} initial={recordFixture()} />,
    );
    expect(screen.queryByLabelText("Record type")).not.toBeInTheDocument();
    expect(screen.getByText("Navigation plan")).toBeInTheDocument();
  });

  it("edit mode: publicId is shown read-only, not as an editable field", () => {
    render(
      <WebsiteStrategyCenterForm mode="edit" recordId={RECORD_ID} initial={recordFixture()} />,
    );
    expect(screen.queryByLabelText("Public ID")).not.toBeInTheDocument();
    expect(screen.getByText("WSC-1")).toBeInTheDocument();
  });

  it("create mode: submits publicId/recordType/title, omitting untouched content/notes entirely, then navigates using the response's recordId", async () => {
    const fetchMock = vi.fn().mockResolvedValue(createSuccessResponse(RECORD_ID));
    global.fetch = fetchMock as typeof fetch;

    render(<WebsiteStrategyCenterForm mode="create" />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "WSC-NEW" } });
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Primary Navigation Plan" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create record" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.com/website-strategy-center/records");
    const body = JSON.parse(init.body as string);
    expect(body.publicId).toBe("WSC-NEW");
    expect(body.recordType).toBe("navigation_plan");
    expect(body.title).toBe("Primary Navigation Plan");
    expect(body).not.toHaveProperty("content");
    expect(body).not.toHaveProperty("notes");
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith(`/website-strategy-center/${RECORD_ID}`),
    );
  });

  it("edit mode: never sends recordType/publicId/approvalStatus, and clears an emptied title is impossible since it's required (title stays whatever it was)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(updateSuccessResponse());
    global.fetch = fetchMock as typeof fetch;

    render(
      <WebsiteStrategyCenterForm mode="edit" recordId={RECORD_ID} initial={recordFixture()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.example.com/website-strategy-center/records/${RECORD_ID}/update`);
    const body = JSON.parse(init.body as string);
    expect(body).not.toHaveProperty("recordType");
    expect(body).not.toHaveProperty("publicId");
    expect(body).not.toHaveProperty("approvalStatus");
    expect(body.title).toBe("Primary Navigation Plan");
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
      <WebsiteStrategyCenterForm
        mode="edit"
        recordId={RECORD_ID}
        initial={recordFixture({ approvalStatus: "approved" })}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith(`/website-strategy-center/${RECORD_ID}`),
    );
    expect(pushMock).not.toHaveBeenCalledWith(`/website-strategy-center/${FORKED_ROW_ID}`);
  });

  it("edit mode: shows the fork notice when the current version is approved", () => {
    render(
      <WebsiteStrategyCenterForm
        mode="edit"
        recordId={RECORD_ID}
        initial={recordFixture({ approvalStatus: "approved" })}
      />,
    );
    expect(screen.getByText(/creates a new draft version instead/)).toBeInTheDocument();
  });

  it("edit mode: shows no fork notice when the current version is not approved", () => {
    render(
      <WebsiteStrategyCenterForm
        mode="edit"
        recordId={RECORD_ID}
        initial={recordFixture({ approvalStatus: "draft" })}
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
        error: { code: "BadRequestException", message: "publicId already in use: WSC-NEW" },
        correlationId: "corr-1",
      }),
    } as Response) as typeof fetch;

    render(<WebsiteStrategyCenterForm mode="create" />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "WSC-NEW" } });
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "X" } });
    fireEvent.click(screen.getByRole("button", { name: "Create record" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("publicId already in use: WSC-NEW");
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("edit mode: a rich-text field's initial HTML content loads into its editor", async () => {
    render(
      <WebsiteStrategyCenterForm
        mode="edit"
        recordId={RECORD_ID}
        initial={recordFixture({ content: "<p>Consolidate the top-level nav</p>" })}
      />,
    );
    await waitFor(() =>
      expect(screen.getByText("Consolidate the top-level nav")).toBeInTheDocument(),
    );
  });
});
