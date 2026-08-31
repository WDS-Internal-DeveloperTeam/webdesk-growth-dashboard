import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DesignTokenRecord } from "@webdesk/shared-types";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { DesignTokenLibraryForm } from "../../components/design-token-library-form.js";

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

function tokenFixture(overrides: Partial<DesignTokenRecord> = {}): DesignTokenRecord {
  return {
    id: ROW_ID,
    recordId: RECORD_ID,
    publicId: "DTL-1",
    group: "colors",
    versionNumber: 1,
    isCurrent: true,
    name: "Primary Brand Blue",
    value: "#1D4ED8",
    unit: null,
    semanticPurpose: null,
    responsiveVariation: null,
    themeVariation: null,
    usageReferences: [],
    approvalStatus: "draft",
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-08-23T00:00:00.000Z",
    updatedAt: "2026-08-23T00:00:00.000Z",
    ...overrides,
  };
}

describe("DesignTokenLibraryForm", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    pushMock.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("create mode: publicId/group/name/value are real HTML required fields", () => {
    render(<DesignTokenLibraryForm mode="create" />);
    expect(screen.getByLabelText("Public ID")).toBeRequired();
    expect(screen.getByLabelText("Group")).toBeRequired();
    expect(screen.getByLabelText("Name")).toBeRequired();
    expect(screen.getByLabelText("Value")).toBeRequired();
  });

  it("renders plain textareas (not a rich-text editor) for Semantic purpose and Responsive variation", () => {
    render(<DesignTokenLibraryForm mode="create" />);
    expect(document.querySelectorAll("textarea")).toHaveLength(2);
    expect(document.querySelectorAll('[contenteditable="true"]')).toHaveLength(0);
  });

  it("edit mode: group is shown read-only, not as an editable field", () => {
    render(<DesignTokenLibraryForm mode="edit" recordId={RECORD_ID} initial={tokenFixture()} />);
    expect(screen.queryByLabelText("Group")).not.toBeInTheDocument();
    expect(screen.getByText("Colors")).toBeInTheDocument();
  });

  it("edit mode: publicId is shown read-only, not as an editable field", () => {
    render(<DesignTokenLibraryForm mode="edit" recordId={RECORD_ID} initial={tokenFixture()} />);
    expect(screen.queryByLabelText("Public ID")).not.toBeInTheDocument();
    expect(screen.getByText("DTL-1")).toBeInTheDocument();
  });

  it("create mode: submits publicId/group/name/value, omitting untouched optional fields entirely, then navigates using the response's recordId", async () => {
    const fetchMock = vi.fn().mockResolvedValue(createSuccessResponse(RECORD_ID));
    global.fetch = fetchMock as typeof fetch;

    render(<DesignTokenLibraryForm mode="create" />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "DTL-NEW" } });
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Primary Brand Blue" },
    });
    fireEvent.change(screen.getByLabelText("Value"), { target: { value: "#1D4ED8" } });
    fireEvent.click(screen.getByRole("button", { name: "Create token" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.com/design-token-library/tokens");
    const body = JSON.parse(init.body as string);
    expect(body.publicId).toBe("DTL-NEW");
    expect(body.group).toBe("colors");
    expect(body.name).toBe("Primary Brand Blue");
    expect(body.value).toBe("#1D4ED8");
    expect(body).not.toHaveProperty("unit");
    expect(body).not.toHaveProperty("semanticPurpose");
    expect(body).not.toHaveProperty("responsiveVariation");
    expect(body).not.toHaveProperty("themeVariation");
    expect(body).not.toHaveProperty("usageReferences");
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith(`/design-token-library/${RECORD_ID}`),
    );
  });

  it("edit mode: never sends group/publicId/approvalStatus, and includes the current name/value", async () => {
    const fetchMock = vi.fn().mockResolvedValue(updateSuccessResponse());
    global.fetch = fetchMock as typeof fetch;

    render(<DesignTokenLibraryForm mode="edit" recordId={RECORD_ID} initial={tokenFixture()} />);
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.example.com/design-token-library/tokens/${RECORD_ID}/update`);
    const body = JSON.parse(init.body as string);
    expect(body).not.toHaveProperty("group");
    expect(body).not.toHaveProperty("publicId");
    expect(body).not.toHaveProperty("approvalStatus");
    expect(body.name).toBe("Primary Brand Blue");
    expect(body.value).toBe("#1D4ED8");
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
      <DesignTokenLibraryForm
        mode="edit"
        recordId={RECORD_ID}
        initial={tokenFixture({ approvalStatus: "approved" })}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith(`/design-token-library/${RECORD_ID}`),
    );
    expect(pushMock).not.toHaveBeenCalledWith(`/design-token-library/${FORKED_ROW_ID}`);
  });

  it("edit mode: shows the fork notice when the current version is approved", () => {
    render(
      <DesignTokenLibraryForm
        mode="edit"
        recordId={RECORD_ID}
        initial={tokenFixture({ approvalStatus: "approved" })}
      />,
    );
    expect(screen.getByText(/creates a new draft version instead/)).toBeInTheDocument();
  });

  it("edit mode: shows no fork notice when the current version is not approved", () => {
    render(
      <DesignTokenLibraryForm
        mode="edit"
        recordId={RECORD_ID}
        initial={tokenFixture({ approvalStatus: "draft" })}
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
        error: { code: "BadRequestException", message: "publicId already in use: DTL-NEW" },
        correlationId: "corr-1",
      }),
    } as Response) as typeof fetch;

    render(<DesignTokenLibraryForm mode="create" />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "DTL-NEW" } });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "X" } });
    fireEvent.change(screen.getByLabelText("Value"), { target: { value: "1px" } });
    fireEvent.click(screen.getByRole("button", { name: "Create token" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("publicId already in use: DTL-NEW");
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("tag input: pressing Enter adds a usage reference tag, and it's included in the submitted usageReferences", async () => {
    const fetchMock = vi.fn().mockResolvedValue(createSuccessResponse(RECORD_ID));
    global.fetch = fetchMock as typeof fetch;

    render(<DesignTokenLibraryForm mode="create" />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "DTL-NEW" } });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "X" } });
    fireEvent.change(screen.getByLabelText("Value"), { target: { value: "1px" } });
    const usageInput = screen.getByLabelText("Usage references");
    fireEvent.change(usageInput, { target: { value: "Button padding" } });
    fireEvent.keyDown(usageInput, { key: "Enter" });
    expect(screen.getByText("Button padding")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Create token" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.usageReferences).toEqual(["Button padding"]);
  });

  it("edit mode: a previously-set theme variation loads into the select", () => {
    render(
      <DesignTokenLibraryForm
        mode="edit"
        recordId={RECORD_ID}
        initial={tokenFixture({ themeVariation: "dark" })}
      />,
    );
    expect(screen.getByLabelText("Theme variation")).toHaveValue("dark");
  });
});
