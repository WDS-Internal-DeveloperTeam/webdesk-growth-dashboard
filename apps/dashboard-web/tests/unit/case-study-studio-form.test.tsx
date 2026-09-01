import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CaseStudy, ProofClaim, Service } from "@webdesk/shared-types";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { CaseStudyStudioForm } from "../../components/case-study-studio-form.js";

const CASE_STUDY_ID = "11111111-1111-1111-1111-111111111111";
const SERVICE_ID = "22222222-2222-2222-2222-222222222222";
const CLAIM_ID = "33333333-3333-3333-3333-333333333333";

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

const claims: readonly ProofClaim[] = [
  {
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
  },
];

function successResponse(id: string): Response {
  return {
    ok: true,
    json: async () => ({ success: true, data: { id }, correlationId: "corr-1" }),
  } as Response;
}

function caseStudyFixture(overrides: Partial<CaseStudy> = {}): CaseStudy {
  return {
    id: CASE_STUDY_ID,
    publicId: "CS-1",
    clientName: "Acme Corp",
    projectTitle: "Headless migration",
    industry: null,
    platform: null,
    visibility: "public",
    embargoDate: null,
    challenge: null,
    solution: null,
    implementation: null,
    results: null,
    relatedServiceIds: [],
    relatedClaimIds: [],
    assignedReviewerUserId: null,
    clientApprovalRequired: false,
    status: "intake",
    scheduledPublishAt: null,
    publishedAt: null,
    unpublishReason: null,
    version: 1,
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-08-27T00:00:00.000Z",
    updatedAt: "2026-08-27T00:00:00.000Z",
    ...overrides,
  };
}

describe("CaseStudyStudioForm", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    pushMock.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("create mode: Public ID, Client name, and Project title are real HTML required fields", () => {
    render(<CaseStudyStudioForm mode="create" services={services} claims={claims} />);
    expect(screen.getByLabelText("Public ID")).toBeRequired();
    expect(screen.getByLabelText("Client name")).toBeRequired();
    expect(screen.getByLabelText("Project title")).toBeRequired();
  });

  it("renders a rich-text editor (not a plain textarea) for the 4 narrative fields", () => {
    render(<CaseStudyStudioForm mode="create" services={services} claims={claims} />);
    expect(document.querySelectorAll("textarea")).toHaveLength(0);
    expect(document.querySelectorAll('[contenteditable="true"]')).toHaveLength(4);
  });

  it("create mode: clientApprovalRequired is a real, enabled checkbox", () => {
    render(<CaseStudyStudioForm mode="create" services={services} claims={claims} />);
    const checkbox = screen.getByRole("checkbox", { name: /Client approval required/ });
    expect(checkbox).not.toBeDisabled();
  });

  it("edit mode: clientApprovalRequired renders disabled, reflecting the immutable stored value", () => {
    render(
      <CaseStudyStudioForm
        mode="edit"
        caseStudyId={CASE_STUDY_ID}
        initial={caseStudyFixture({ clientApprovalRequired: true })}
        services={services}
        claims={claims}
      />,
    );
    const checkbox = screen.getByRole("checkbox", { name: /Client approval required/ });
    expect(checkbox).toBeDisabled();
    expect(checkbox).toBeChecked();
  });

  // clientName/projectTitle are real HTML `required` inputs (see the first test above) — jsdom's
  // own native constraint validation blocks the submit event entirely before this component's own
  // handleSubmit ever runs when either is empty, the same lesson `dashboard-web-attachments-on-
  // create.md`/`dashboard-web-service-library.md` already document once for a required field. This
  // form's own client-side `!trimmedClientName || !trimmedProjectTitle` check is therefore only a
  // defense-in-depth backstop for a caller that bypasses native HTML validation, not something
  // exercisable via a normal simulated click in this test environment — the `.toBeRequired()`
  // assertions above already cover the real, reachable behavior.

  it("create mode: never sends clientApprovalRequired unless the checkbox is toggled — sends the checked value", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(CASE_STUDY_ID));
    global.fetch = fetchMock as typeof fetch;

    render(<CaseStudyStudioForm mode="create" services={services} claims={claims} />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "CS-NEW" } });
    fireEvent.change(screen.getByLabelText("Client name"), { target: { value: "Acme" } });
    fireEvent.change(screen.getByLabelText("Project title"), { target: { value: "Migration" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /Client approval required/ }));
    fireEvent.click(screen.getByRole("button", { name: "Create case study" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.com/case-study-studio/case-studies");
    const body = JSON.parse(init.body as string);
    expect(body.clientApprovalRequired).toBe(true);
    expect(body.publicId).toBe("CS-NEW");
  });

  it("edit mode: never sends status/publishedAt/unpublishReason/version/clientApprovalRequired/publicId", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(CASE_STUDY_ID));
    global.fetch = fetchMock as typeof fetch;

    render(
      <CaseStudyStudioForm
        mode="edit"
        caseStudyId={CASE_STUDY_ID}
        initial={caseStudyFixture({ industry: "Retail" })}
        services={services}
        claims={claims}
      />,
    );
    fireEvent.change(screen.getByLabelText("Industry"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      `https://api.example.com/case-study-studio/case-studies/${CASE_STUDY_ID}/update`,
    );
    const body = JSON.parse(init.body as string);
    expect(body.industry).toBeNull();
    expect(body).not.toHaveProperty("status");
    expect(body).not.toHaveProperty("publishedAt");
    expect(body).not.toHaveProperty("unpublishReason");
    expect(body).not.toHaveProperty("version");
    expect(body).not.toHaveProperty("clientApprovalRequired");
    expect(body).not.toHaveProperty("publicId");
  });

  it("selecting a service via RelationshipPicker adds it to the submitted relatedServiceIds", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(CASE_STUDY_ID));
    global.fetch = fetchMock as typeof fetch;

    render(
      <CaseStudyStudioForm
        mode="edit"
        caseStudyId={CASE_STUDY_ID}
        initial={caseStudyFixture()}
        services={services}
        claims={claims}
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

  it("selecting a claim via the independent second RelationshipPicker adds it to relatedClaimIds", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(CASE_STUDY_ID));
    global.fetch = fetchMock as typeof fetch;

    render(
      <CaseStudyStudioForm
        mode="edit"
        caseStudyId={CASE_STUDY_ID}
        initial={caseStudyFixture()}
        services={services}
        claims={claims}
      />,
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Related claims" }), {
      target: { value: "PROOF" },
    });
    fireEvent.click(screen.getByText("PROOF-1"));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.relatedClaimIds).toEqual([CLAIM_ID]);
    // relatedServiceIds must stay untouched by the independent claim picker.
    expect(body.relatedServiceIds).toEqual([]);
  });

  it("edit mode: a relatedServiceIds entry outside the fetched services list falls back to a raw-id chip instead of vanishing", () => {
    const OUT_OF_WINDOW_SERVICE_ID = "99999999-9999-9999-9999-999999999999";
    render(
      <CaseStudyStudioForm
        mode="edit"
        caseStudyId={CASE_STUDY_ID}
        initial={caseStudyFixture({ relatedServiceIds: [SERVICE_ID, OUT_OF_WINDOW_SERVICE_ID] })}
        services={services}
        claims={claims}
      />,
    );
    expect(screen.getByText("Headless Commerce")).toBeInTheDocument();
    expect(screen.getByText(OUT_OF_WINDOW_SERVICE_ID)).toBeInTheDocument();
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
      <CaseStudyStudioForm
        mode="edit"
        caseStudyId={CASE_STUDY_ID}
        initial={caseStudyFixture()}
        services={services}
        claims={claims}
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
      <CaseStudyStudioForm
        mode="edit"
        caseStudyId={CASE_STUDY_ID}
        initial={caseStudyFixture({ challenge: "<p>Legacy platform could not scale</p>" })}
        services={services}
        claims={claims}
      />,
    );
    await waitFor(() =>
      expect(screen.getByText("Legacy platform could not scale")).toBeInTheDocument(),
    );
  });
});
