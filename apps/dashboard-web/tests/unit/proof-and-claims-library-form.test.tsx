import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProofClaim, Service } from "@webdesk/shared-types";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { ProofAndClaimsLibraryForm } from "../../components/proof-and-claims-library-form.js";

const CLAIM_ID = "11111111-1111-1111-1111-111111111111";
const SERVICE_ID = "22222222-2222-2222-2222-222222222222";

const services: readonly Service[] = [
  {
    id: SERVICE_ID,
    publicId: "SVC-1",
    canonicalName: "Headless Commerce",
    publicName: null,
    categoryId: "cat-1",
    parentServiceId: null,
    shortPublicDescription: null,
    audience: null,
    problems: null,
    capabilities: null,
    outcomes: null,
    exclusions: null,
    internalDescription: null,
    icpIds: [],
    relatedPageIds: [],
    relatedCaseStudyIds: [],
    confidentiality: "internal",
    publicationStatus: "draft",
    approvalStatus: "draft",
    ownerUserId: null,
    createdAt: "2026-08-21T00:00:00.000Z",
    updatedAt: "2026-08-21T00:00:00.000Z",
  },
];

function successResponse(id: string): Response {
  return {
    ok: true,
    json: async () => ({ success: true, data: { id }, correlationId: "corr-1" }),
  } as Response;
}

function claimFixture(overrides: Partial<ProofClaim> = {}): ProofClaim {
  return {
    id: CLAIM_ID,
    publicId: "PROOF-1",
    claim: "<p>99.9% uptime SLA</p>",
    claimType: null,
    beforeValue: null,
    afterValue: null,
    verificationStatus: "unverified",
    approvedWording: null,
    restrictions: null,
    expiryReviewDate: null,
    relatedServiceIds: [],
    relatedCaseStudyIds: [],
    relatedPageIds: [],
    approvalStatus: "draft",
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-08-23T00:00:00.000Z",
    updatedAt: "2026-08-23T00:00:00.000Z",
    ...overrides,
  };
}

describe("ProofAndClaimsLibraryForm", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    pushMock.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("create mode: Public ID is a real HTML required field", () => {
    render(<ProofAndClaimsLibraryForm mode="create" services={services} />);
    expect(screen.getByLabelText("Public ID")).toBeRequired();
  });

  it("renders a rich-text editor (not a plain textarea) for the 3 content fields", () => {
    render(<ProofAndClaimsLibraryForm mode="create" services={services} />);
    expect(document.querySelectorAll("textarea")).toHaveLength(0);
    expect(document.querySelectorAll('[contenteditable="true"]')).toHaveLength(3);
  });

  it("create mode: submitting with an empty claim shows an error and never calls fetch", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    render(<ProofAndClaimsLibraryForm mode="create" services={services} />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "PROOF-NEW" } });
    fireEvent.click(screen.getByRole("button", { name: "Create claim" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Claim is required.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("edit mode: never sends approvalStatus, and clears an emptied text field to null (not omitted)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(CLAIM_ID));
    global.fetch = fetchMock as typeof fetch;

    render(
      <ProofAndClaimsLibraryForm
        mode="edit"
        claimId={CLAIM_ID}
        initial={claimFixture({ claimType: "Was set" })}
        services={services}
      />,
    );
    fireEvent.change(screen.getByLabelText("Claim type"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.example.com/proof-and-claims-library/claims/${CLAIM_ID}/update`);
    const body = JSON.parse(init.body as string);
    expect(body.claimType).toBeNull();
    expect(body).not.toHaveProperty("approvalStatus");
    expect(body).not.toHaveProperty("publicId");
  });

  // RichTextEditor is a Tiptap contentEditable div, not a real form control — jsdom/RTL's
  // fireEvent.input() doesn't drive Tiptap's own ProseMirror editing view, so a claim value can't
  // be typed in via simulated events (the same lesson `rich-text-editor-long-fields.md` already
  // documents for `project-form.test.tsx`/`service-library-form.test.tsx`). The 3 tests below use
  // edit mode with a non-empty `initial.claim` instead, verifying rich-text content only via that
  // prop, never simulated typing.

  it("selecting a service via RelationshipPicker adds it to the submitted relatedServiceIds", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(CLAIM_ID));
    global.fetch = fetchMock as typeof fetch;

    render(
      <ProofAndClaimsLibraryForm
        mode="edit"
        claimId={CLAIM_ID}
        initial={claimFixture()}
        services={services}
      />,
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Related services" }), {
      target: { value: "Headless" },
    });
    fireEvent.click(screen.getByText("Headless Commerce"));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.relatedServiceIds).toEqual([SERVICE_ID]);
  });

  it("tag input: pressing Enter adds a related-case-study tag, and it's included in the submit", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(CLAIM_ID));
    global.fetch = fetchMock as typeof fetch;

    render(
      <ProofAndClaimsLibraryForm
        mode="edit"
        claimId={CLAIM_ID}
        initial={claimFixture()}
        services={services}
      />,
    );
    const tagInput = screen.getByLabelText("Related case studies");
    fireEvent.change(tagInput, { target: { value: "case-study-42" } });
    fireEvent.keyDown(tagInput, { key: "Enter" });
    expect(screen.getByText("case-study-42")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.relatedCaseStudyIds).toEqual(["case-study-42"]);
  });

  it("shows the backend's error message and does not navigate on a failed submit", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        success: false,
        error: { code: "BadRequestException", message: "relatedServiceIds not found: missing" },
        correlationId: "corr-1",
      }),
    } as Response) as typeof fetch;

    render(
      <ProofAndClaimsLibraryForm
        mode="edit"
        claimId={CLAIM_ID}
        initial={claimFixture()}
        services={services}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "relatedServiceIds not found: missing",
    );
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("edit mode: a rich-text field's initial HTML content loads into its editor", async () => {
    render(
      <ProofAndClaimsLibraryForm
        mode="edit"
        claimId={CLAIM_ID}
        initial={claimFixture({ claim: "<p>Ships in under 2 seconds</p>" })}
        services={services}
      />,
    );
    await waitFor(() => expect(screen.getByText("Ships in under 2 seconds")).toBeInTheDocument());
  });

  it("edit mode: a relatedServiceIds entry outside the fetched services list falls back to a raw-id chip instead of vanishing", () => {
    const OUT_OF_WINDOW_SERVICE_ID = "99999999-9999-9999-9999-999999999999";
    render(
      <ProofAndClaimsLibraryForm
        mode="edit"
        claimId={CLAIM_ID}
        initial={claimFixture({ relatedServiceIds: [SERVICE_ID, OUT_OF_WINDOW_SERVICE_ID] })}
        services={services}
      />,
    );
    // The known service resolves to its real display name; the unknown one still renders as its
    // own chip (the raw id), instead of being silently dropped from the "selected" list.
    expect(screen.getByText("Headless Commerce")).toBeInTheDocument();
    expect(screen.getByText(OUT_OF_WINDOW_SERVICE_ID)).toBeInTheDocument();
  });
});
