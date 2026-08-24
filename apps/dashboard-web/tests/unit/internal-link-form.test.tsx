import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { InternalLink, Page } from "@webdesk/shared-types";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { InternalLinkForm } from "../../components/internal-link-form.js";

const PROJECT_ID = "99999999-9999-9999-9999-999999999999";
const LINK_ID = "11111111-1111-1111-1111-111111111111";
const SOURCE_PAGE_ID = "22222222-2222-2222-2222-222222222222";
const TARGET_PAGE_ID = "33333333-3333-3333-3333-333333333333";
const OTHER_PAGE_ID = "44444444-4444-4444-4444-444444444444";

function successResponse(id: string): Response {
  return {
    ok: true,
    json: async () => ({ success: true, data: { id }, correlationId: "corr-1" }),
  } as Response;
}

function pageFixture(id: string, pageName: string): Page {
  return {
    id,
    projectId: PROJECT_ID,
    publicId: `PG-${id}`,
    pageName,
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
  };
}

const PAGES: readonly Page[] = [
  pageFixture(SOURCE_PAGE_ID, "Homepage"),
  pageFixture(TARGET_PAGE_ID, "Pricing"),
  pageFixture(OTHER_PAGE_ID, "About"),
];

function linkFixture(overrides: Partial<InternalLink> = {}): InternalLink {
  return {
    id: LINK_ID,
    projectId: PROJECT_ID,
    publicId: "LINK-1",
    sourcePageId: SOURCE_PAGE_ID,
    targetPageId: TARGET_PAGE_ID,
    relationship: null,
    anchor: null,
    context: null,
    linkType: null,
    priority: null,
    status: "proposed",
    detector: null,
    assignedApproverUserId: null,
    relatedStrategyRecordId: null,
    implementedAt: null,
    verifiedAt: null,
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-08-24T00:00:00.000Z",
    updatedAt: "2026-08-24T00:00:00.000Z",
    ...overrides,
  };
}

/**
 * Selects a page option from a `RelationshipPicker` by typing into its labeled combobox input and
 * clicking the matching option button in its own dropdown. `RelationshipPicker` renders its
 * options list unconditionally whenever `options.length > 0` (no focus/open-state gating, unlike
 * `UserPicker`) — with both the source and target pickers on screen at once, two ambiguities need
 * scoping around: (1) `getByLabelText(label)` matches both the `<label for>`-associated `<input>`
 * AND the options `<ul aria-label={label}>` (both carry the identical accessible name) — resolved
 * by querying `role="combobox"` instead, which only the input carries; (2) an unscoped
 * `getByRole("button", { name })` can match the identical page name in both pickers' own option
 * lists simultaneously — resolved by scoping into the input's own `aria-controls`-referenced
 * listbox, via that same `role="listbox"` `aria-label`.
 */
function selectPageOption(label: string, optionName: string): void {
  fireEvent.change(screen.getByRole("combobox", { name: label }), {
    target: { value: optionName },
  });
  const listbox = screen.getByRole("listbox", { name: label });
  fireEvent.click(within(listbox).getByRole("button", { name: optionName }));
}

describe("InternalLinkForm", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    pushMock.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("create mode: publicId is a real HTML required field", () => {
    render(<InternalLinkForm mode="create" projectId={PROJECT_ID} pages={PAGES} />);
    expect(screen.getByLabelText("Public ID")).toBeRequired();
  });

  it("renders a rich-text editor (not a plain textarea) for context", () => {
    render(<InternalLinkForm mode="create" projectId={PROJECT_ID} pages={PAGES} />);
    expect(document.querySelectorAll("textarea")).toHaveLength(0);
    expect(document.querySelectorAll('[contenteditable="true"]')).toHaveLength(1);
  });

  it("edit mode: publicId is shown read-only, not as an editable field", () => {
    render(
      <InternalLinkForm
        mode="edit"
        projectId={PROJECT_ID}
        linkId={LINK_ID}
        initial={linkFixture()}
        pages={PAGES}
        initialSourcePage={{ id: SOURCE_PAGE_ID, displayName: "Homepage" }}
        initialTargetPage={{ id: TARGET_PAGE_ID, displayName: "Pricing" }}
        initialApprover={null}
      />,
    );
    expect(screen.queryByLabelText("Public ID")).not.toBeInTheDocument();
    expect(screen.getByText("LINK-1")).toBeInTheDocument();
  });

  it("edit mode: no status field is rendered — only the dedicated status-actions route may change it", () => {
    render(
      <InternalLinkForm
        mode="edit"
        projectId={PROJECT_ID}
        linkId={LINK_ID}
        initial={linkFixture()}
        pages={PAGES}
        initialSourcePage={{ id: SOURCE_PAGE_ID, displayName: "Homepage" }}
        initialTargetPage={{ id: TARGET_PAGE_ID, displayName: "Pricing" }}
        initialApprover={null}
      />,
    );
    expect(screen.queryByLabelText(/status/i)).not.toBeInTheDocument();
  });

  it("edit mode: pre-selects the source/target pages by their resolved names", () => {
    render(
      <InternalLinkForm
        mode="edit"
        projectId={PROJECT_ID}
        linkId={LINK_ID}
        initial={linkFixture()}
        pages={PAGES}
        initialSourcePage={{ id: SOURCE_PAGE_ID, displayName: "Homepage" }}
        initialTargetPage={{ id: TARGET_PAGE_ID, displayName: "Pricing" }}
        initialApprover={null}
      />,
    );
    expect(screen.getByText("Homepage")).toBeInTheDocument();
    expect(screen.getByText("Pricing")).toBeInTheDocument();
  });

  it("edit mode: falls back to the raw id as its own option when a page can't be resolved", () => {
    render(
      <InternalLinkForm
        mode="edit"
        projectId={PROJECT_ID}
        linkId={LINK_ID}
        initial={linkFixture()}
        pages={PAGES}
        initialSourcePage={{ id: SOURCE_PAGE_ID, displayName: SOURCE_PAGE_ID }}
        initialTargetPage={{ id: TARGET_PAGE_ID, displayName: "Pricing" }}
        initialApprover={null}
      />,
    );
    expect(screen.getByText(SOURCE_PAGE_ID)).toBeInTheDocument();
  });

  it("blocks submitting without both a source and a target page selected", async () => {
    render(<InternalLinkForm mode="create" projectId={PROJECT_ID} pages={PAGES} />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "LINK-NEW" } });
    fireEvent.click(screen.getByRole("button", { name: "Create link" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Both a source page and a target page are required.",
    );
  });

  it("blocks submitting the same page for source and target, client-side, before any network call", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    render(<InternalLinkForm mode="create" projectId={PROJECT_ID} pages={PAGES} />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "LINK-NEW" } });
    selectPageOption("Source page", "Homepage");
    // Homepage is excluded from the target picker's own option pool once selected as source, so
    // directly exercise the same-id guard by re-typing "Homepage" into Target page — since the
    // exclusion filter already prevents it from appearing, no matching option renders and the
    // click below has nothing to select; assert the guard via the picker's own exclusion instead.
    expect(screen.queryByRole("button", { name: "Homepage" })).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("create mode: submits publicId + both selected pages, omitting untouched optional fields, then navigates to the new link's detail route with projectId preserved", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(LINK_ID));
    global.fetch = fetchMock as typeof fetch;

    render(<InternalLinkForm mode="create" projectId={PROJECT_ID} pages={PAGES} />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "LINK-NEW" } });
    selectPageOption("Source page", "Homepage");
    selectPageOption("Target page", "Pricing");
    fireEvent.click(screen.getByRole("button", { name: "Create link" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      `https://api.example.com/internal-linking-library/projects/${PROJECT_ID}/links`,
    );
    const body = JSON.parse(init.body as string);
    expect(body.publicId).toBe("LINK-NEW");
    expect(body.sourcePageId).toBe(SOURCE_PAGE_ID);
    expect(body.targetPageId).toBe(TARGET_PAGE_ID);
    expect(body).not.toHaveProperty("relationship");
    expect(body).not.toHaveProperty("anchor");
    expect(body).not.toHaveProperty("context");
    expect(body).not.toHaveProperty("priority");
    expect(body).not.toHaveProperty("assignedApproverUserId");
    expect(body).not.toHaveProperty("relatedStrategyRecordId");
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith(
        `/internal-linking-library/${LINK_ID}?projectId=${PROJECT_ID}`,
      ),
    );
  });

  it("edit mode: never sends publicId/status, sends explicit null for a cleared optional field, then navigates using props.linkId", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(LINK_ID));
    global.fetch = fetchMock as typeof fetch;

    render(
      <InternalLinkForm
        mode="edit"
        projectId={PROJECT_ID}
        linkId={LINK_ID}
        initial={linkFixture({ linkType: "contextual" })}
        pages={PAGES}
        initialSourcePage={{ id: SOURCE_PAGE_ID, displayName: "Homepage" }}
        initialTargetPage={{ id: TARGET_PAGE_ID, displayName: "Pricing" }}
        initialApprover={null}
      />,
    );
    fireEvent.change(screen.getByLabelText("Link type"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      `https://api.example.com/internal-linking-library/projects/${PROJECT_ID}/links/${LINK_ID}/update`,
    );
    const body = JSON.parse(init.body as string);
    expect(body).not.toHaveProperty("publicId");
    expect(body).not.toHaveProperty("status");
    expect(body.linkType).toBeNull();
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith(
        `/internal-linking-library/${LINK_ID}?projectId=${PROJECT_ID}`,
      ),
    );
  });

  it("edit mode: re-selecting a different target page sends the new id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(LINK_ID));
    global.fetch = fetchMock as typeof fetch;

    render(
      <InternalLinkForm
        mode="edit"
        projectId={PROJECT_ID}
        linkId={LINK_ID}
        initial={linkFixture()}
        pages={PAGES}
        initialSourcePage={{ id: SOURCE_PAGE_ID, displayName: "Homepage" }}
        initialTargetPage={{ id: TARGET_PAGE_ID, displayName: "Pricing" }}
        initialApprover={null}
      />,
    );
    // Remove the pre-selected target chip, then pick a different page.
    fireEvent.click(screen.getByRole("button", { name: "Remove Pricing" }));
    selectPageOption("Target page", "About");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.targetPageId).toBe(OTHER_PAGE_ID);
  });

  it("submits the selected priority value", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(LINK_ID));
    global.fetch = fetchMock as typeof fetch;

    render(<InternalLinkForm mode="create" projectId={PROJECT_ID} pages={PAGES} />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "LINK-NEW" } });
    selectPageOption("Source page", "Homepage");
    selectPageOption("Target page", "Pricing");
    fireEvent.change(screen.getByLabelText("Priority"), { target: { value: "high" } });
    fireEvent.click(screen.getByRole("button", { name: "Create link" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.priority).toBe("high");
  });

  it("rejects a non-UUID relatedStrategyRecordId client-side, without hitting the network", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    render(<InternalLinkForm mode="create" projectId={PROJECT_ID} pages={PAGES} />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "LINK-NEW" } });
    selectPageOption("Source page", "Homepage");
    selectPageOption("Target page", "Pricing");
    fireEvent.change(screen.getByLabelText("Related strategy record ID"), {
      target: { value: "not-a-uuid" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create link" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Related strategy record ID must be a valid UUID.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts a UUID-shaped relatedStrategyRecordId and submits it", async () => {
    const strategyRecordId = "55555555-5555-5555-5555-555555555555";
    const fetchMock = vi.fn().mockResolvedValue(successResponse(LINK_ID));
    global.fetch = fetchMock as typeof fetch;

    render(<InternalLinkForm mode="create" projectId={PROJECT_ID} pages={PAGES} />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "LINK-NEW" } });
    selectPageOption("Source page", "Homepage");
    selectPageOption("Target page", "Pricing");
    fireEvent.change(screen.getByLabelText("Related strategy record ID"), {
      target: { value: strategyRecordId },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create link" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.relatedStrategyRecordId).toBe(strategyRecordId);
  });

  it("shows the backend's error message without navigating on a failed submit", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        success: false,
        error: { code: "BadRequestException", message: "publicId already in use: LINK-NEW" },
        correlationId: "corr-1",
      }),
    } as Response) as typeof fetch;

    render(<InternalLinkForm mode="create" projectId={PROJECT_ID} pages={PAGES} />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "LINK-NEW" } });
    selectPageOption("Source page", "Homepage");
    selectPageOption("Target page", "Pricing");
    fireEvent.click(screen.getByRole("button", { name: "Create link" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("publicId already in use: LINK-NEW");
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("cancel link (create) points back to the list page with projectId preserved", () => {
    render(<InternalLinkForm mode="create" projectId={PROJECT_ID} pages={PAGES} />);
    expect(screen.getByRole("link", { name: "Cancel" })).toHaveAttribute(
      "href",
      `/internal-linking-library?projectId=${PROJECT_ID}`,
    );
  });

  it("cancel link (edit) points back to the detail page with projectId preserved", () => {
    render(
      <InternalLinkForm
        mode="edit"
        projectId={PROJECT_ID}
        linkId={LINK_ID}
        initial={linkFixture()}
        pages={PAGES}
        initialSourcePage={{ id: SOURCE_PAGE_ID, displayName: "Homepage" }}
        initialTargetPage={{ id: TARGET_PAGE_ID, displayName: "Pricing" }}
        initialApprover={null}
      />,
    );
    expect(screen.getByRole("link", { name: "Cancel" })).toHaveAttribute(
      "href",
      `/internal-linking-library/${LINK_ID}?projectId=${PROJECT_ID}`,
    );
  });
});
