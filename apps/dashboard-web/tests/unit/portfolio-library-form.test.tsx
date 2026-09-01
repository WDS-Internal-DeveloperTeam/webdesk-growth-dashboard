import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PortfolioRecord } from "@webdesk/shared-types";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import {
  PortfolioLibraryForm,
  type PortfolioClaimOption,
} from "../../components/portfolio-library-form.js";

const RECORD_ID = "11111111-1111-1111-1111-111111111111";
const CLAIM_ID = "33333333-3333-3333-3333-333333333333";

const claims: readonly PortfolioClaimOption[] = [{ id: CLAIM_ID, publicId: "PROOF-1" }];

function successResponse(id: string): Response {
  return {
    ok: true,
    json: async () => ({ success: true, data: { id }, correlationId: "corr-1" }),
  } as Response;
}

function recordFixture(overrides: Partial<PortfolioRecord> = {}): PortfolioRecord {
  return {
    id: RECORD_ID,
    publicId: "PL-1",
    projectOrClientName: "Acme Corp",
    url: null,
    primaryCategory: null,
    additionalCategories: [],
    tags: [],
    industry: null,
    platform: null,
    serviceType: null,
    launchDate: null,
    relatedProofIds: [],
    visibility: "public",
    approvalStatus: "draft",
    isPublished: false,
    publishedAt: null,
    version: 1,
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("PortfolioLibraryForm", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    pushMock.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("create mode: publicId/projectOrClientName are real HTML required fields", () => {
    render(<PortfolioLibraryForm mode="create" claims={claims} />);
    expect(screen.getByLabelText("Public ID")).toBeRequired();
    expect(screen.getByLabelText("Project/client name")).toBeRequired();
  });

  it("renders no rich-text editor or textarea — every field on this module is a short, single-line value", () => {
    render(<PortfolioLibraryForm mode="create" claims={claims} />);
    expect(document.querySelectorAll("textarea")).toHaveLength(0);
    expect(document.querySelectorAll('[contenteditable="true"]')).toHaveLength(0);
  });

  it("create mode: submits publicId/projectOrClientName, omitting untouched optional fields entirely", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(RECORD_ID));
    global.fetch = fetchMock as typeof fetch;

    render(<PortfolioLibraryForm mode="create" claims={claims} />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "PL-NEW" } });
    fireEvent.change(screen.getByLabelText("Project/client name"), {
      target: { value: "New Client" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create record" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.com/portfolio-library/records");
    const body = JSON.parse(init.body as string);
    expect(body.publicId).toBe("PL-NEW");
    expect(body.projectOrClientName).toBe("New Client");
    expect(body).not.toHaveProperty("url");
    expect(body).not.toHaveProperty("primaryCategory");
    expect(body).not.toHaveProperty("additionalCategories");
    expect(body).not.toHaveProperty("tags");
    expect(body).not.toHaveProperty("industry");
    expect(body).not.toHaveProperty("platform");
    expect(body).not.toHaveProperty("serviceType");
    expect(body).not.toHaveProperty("launchDate");
    expect(body).not.toHaveProperty("visibility");
    expect(body.relatedProofIds).toEqual([]);
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith(`/portfolio-library/${RECORD_ID}`));
  });

  it("edit mode: never sends approvalStatus/version/isPublished/publishedAt/publicId", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(RECORD_ID));
    global.fetch = fetchMock as typeof fetch;

    render(
      <PortfolioLibraryForm
        mode="edit"
        recordId={RECORD_ID}
        initial={recordFixture({ projectOrClientName: "Was set" })}
        claims={claims}
      />,
    );
    fireEvent.change(screen.getByLabelText("Project/client name"), {
      target: { value: "Renamed" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.example.com/portfolio-library/records/${RECORD_ID}/update`);
    const body = JSON.parse(init.body as string);
    expect(body.projectOrClientName).toBe("Renamed");
    expect(body).not.toHaveProperty("approvalStatus");
    expect(body).not.toHaveProperty("version");
    expect(body).not.toHaveProperty("isPublished");
    expect(body).not.toHaveProperty("publishedAt");
    expect(body).not.toHaveProperty("publicId");
  });

  it("edit mode: clearing a previously-set URL sends an explicit null, not an empty string", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(RECORD_ID));
    global.fetch = fetchMock as typeof fetch;

    render(
      <PortfolioLibraryForm
        mode="edit"
        recordId={RECORD_ID}
        initial={recordFixture({ url: "https://example.com" })}
        claims={claims}
      />,
    );
    fireEvent.change(screen.getByLabelText("URL"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.url).toBeNull();
  });

  it("rejects an unsafe URL scheme client-side and never fires the request", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    render(<PortfolioLibraryForm mode="create" claims={claims} />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "PL-NEW" } });
    fireEvent.change(screen.getByLabelText("Project/client name"), { target: { value: "X" } });
    fireEvent.change(screen.getByLabelText("URL"), {
      target: { value: "javascript:alert(1)" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create record" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "URL must be a valid http:// or https:// URL.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("tag input: pressing Enter adds a tag, and it's included in the submitted tags", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(RECORD_ID));
    global.fetch = fetchMock as typeof fetch;

    render(<PortfolioLibraryForm mode="create" claims={claims} />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "PL-NEW" } });
    fireEvent.change(screen.getByLabelText("Project/client name"), { target: { value: "X" } });
    const tagsInput = screen.getByLabelText("Tags");
    fireEvent.change(tagsInput, { target: { value: "ecommerce" } });
    fireEvent.keyDown(tagsInput, { key: "Enter" });
    expect(screen.getByText("ecommerce")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Create record" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.tags).toEqual(["ecommerce"]);
  });

  it("selecting a claim via RelationshipPicker adds it to the submitted relatedProofIds", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(RECORD_ID));
    global.fetch = fetchMock as typeof fetch;

    render(<PortfolioLibraryForm mode="create" claims={claims} />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "PL-NEW" } });
    fireEvent.change(screen.getByLabelText("Project/client name"), { target: { value: "X" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Related proof claims" }), {
      target: { value: "PROOF" },
    });
    fireEvent.click(screen.getByText("PROOF-1"));
    fireEvent.click(screen.getByRole("button", { name: "Create record" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.relatedProofIds).toEqual([CLAIM_ID]);
  });

  it("falls back to showing the raw id as its own chip for a related proof claim outside the fetched claims list", () => {
    render(
      <PortfolioLibraryForm
        mode="edit"
        recordId={RECORD_ID}
        initial={recordFixture({ relatedProofIds: ["99999999-9999-9999-9999-999999999999"] })}
        claims={claims}
      />,
    );
    expect(screen.getByText("99999999-9999-9999-9999-999999999999")).toBeInTheDocument();
  });

  it("shows the backend's error message and does not navigate on a failed submit", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        success: false,
        error: { code: "BadRequestException", message: "publicId already in use: PL-NEW" },
        correlationId: "corr-1",
      }),
    } as Response) as typeof fetch;

    render(<PortfolioLibraryForm mode="create" claims={claims} />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "PL-NEW" } });
    fireEvent.change(screen.getByLabelText("Project/client name"), { target: { value: "X" } });
    fireEvent.click(screen.getByRole("button", { name: "Create record" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("publicId already in use: PL-NEW");
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("edit mode: publicId is shown read-only, not as an editable field", () => {
    render(
      <PortfolioLibraryForm
        mode="edit"
        recordId={RECORD_ID}
        initial={recordFixture({ publicId: "PL-READONLY" })}
        claims={claims}
      />,
    );
    expect(screen.queryByLabelText("Public ID")).not.toBeInTheDocument();
    expect(screen.getByText("PL-READONLY")).toBeInTheDocument();
  });
});
