import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ComponentRecord,
  PageTemplateRecord,
  SectionPatternRecord,
} from "@webdesk/shared-types";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { PageTemplateLibraryForm } from "../../components/page-template-library-form.js";

const RECORD_ID = "11111111-1111-1111-1111-111111111111";
const ROW_ID = "22222222-2222-2222-2222-222222222222";
const FORKED_ROW_ID = "33333333-3333-3333-3333-333333333333";
const SECTION_ID = "44444444-4444-4444-4444-444444444444";
const COMPONENT_ID = "55555555-5555-5555-5555-555555555555";
const REPLACEMENT_ID = "66666666-6666-6666-6666-666666666666";

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

function pageTemplateFixture(overrides: Partial<PageTemplateRecord> = {}): PageTemplateRecord {
  return {
    id: ROW_ID,
    recordId: RECORD_ID,
    publicId: "PGT-1",
    pageType: "homepage",
    versionNumber: 1,
    isCurrent: true,
    name: "Homepage Template",
    requiredSectionIds: [],
    optionalSectionIds: [],
    supportedComponentIds: [],
    wireframeReferences: [],
    contentRequirements: null,
    searchRequirements: null,
    conversionGoal: null,
    phpTemplateRelationship: null,
    replacementRecordId: null,
    approvalStatus: "draft",
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-08-31T00:00:00.000Z",
    updatedAt: "2026-08-31T00:00:00.000Z",
    ...overrides,
  };
}

function sectionFixture(): SectionPatternRecord {
  return {
    id: SECTION_ID,
    recordId: SECTION_ID,
    publicId: "SPL-1",
    patternType: "homepage_storytelling",
    versionNumber: 1,
    isCurrent: true,
    name: "Homepage Hero",
    description: null,
    designReference: null,
    htmlStructure: null,
    phpPath: null,
    scssReference: null,
    jsDependencies: [],
    responsiveBehavior: null,
    accessibilityNotes: null,
    browserSupport: null,
    tokenReferences: [],
    relatedComponentIds: [],
    approvalStatus: "draft",
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-08-31T00:00:00.000Z",
    updatedAt: "2026-08-31T00:00:00.000Z",
  };
}

function componentFixture(): ComponentRecord {
  return {
    id: COMPONENT_ID,
    recordId: COMPONENT_ID,
    publicId: "CL-1",
    category: "buttons",
    versionNumber: 1,
    isCurrent: true,
    name: "Primary Button",
    figmaReference: null,
    tokenIds: [],
    htmlStructure: null,
    phpPath: null,
    scssClassesPath: null,
    jsDependencies: null,
    states: null,
    responsiveBehavior: null,
    browserSupport: null,
    accessibility: null,
    schema: null,
    analytics: null,
    tests: null,
    replacementRecordId: null,
    approvalStatus: "draft",
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-08-31T00:00:00.000Z",
    updatedAt: "2026-08-31T00:00:00.000Z",
  };
}

describe("PageTemplateLibraryForm", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    pushMock.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function renderForm(
    overrides: {
      readonly sectionPatterns?: readonly SectionPatternRecord[];
      readonly components?: readonly ComponentRecord[];
      readonly pageTemplates?: readonly PageTemplateRecord[];
    } = {},
  ) {
    return render(
      <PageTemplateLibraryForm
        mode="create"
        sectionPatterns={overrides.sectionPatterns ?? []}
        components={overrides.components ?? []}
        pageTemplates={overrides.pageTemplates ?? []}
      />,
    );
  }

  it("create mode: publicId/pageType/name are real HTML required fields", () => {
    renderForm();
    expect(screen.getByLabelText("Public ID")).toBeRequired();
    expect(screen.getByLabelText("Page type")).toBeRequired();
    expect(screen.getByLabelText("Name")).toBeRequired();
  });

  it("renders a rich-text editor (not a plain textarea) for Content requirements, Search requirements, and Conversion goal", () => {
    renderForm();
    expect(document.querySelectorAll('[contenteditable="true"]')).toHaveLength(3);
  });

  it("renders a plain textarea for PHP template relationship", () => {
    renderForm();
    expect(document.querySelectorAll("textarea")).toHaveLength(1);
  });

  it("edit mode: pageType is shown read-only, not as an editable field", () => {
    render(
      <PageTemplateLibraryForm
        mode="edit"
        recordId={RECORD_ID}
        initial={pageTemplateFixture()}
        sectionPatterns={[]}
        components={[]}
        pageTemplates={[]}
      />,
    );
    expect(screen.queryByLabelText("Page type")).not.toBeInTheDocument();
    expect(screen.getByText("Homepage")).toBeInTheDocument();
  });

  it("edit mode: publicId is shown read-only, not as an editable field", () => {
    render(
      <PageTemplateLibraryForm
        mode="edit"
        recordId={RECORD_ID}
        initial={pageTemplateFixture()}
        sectionPatterns={[]}
        components={[]}
        pageTemplates={[]}
      />,
    );
    expect(screen.queryByLabelText("Public ID")).not.toBeInTheDocument();
    expect(screen.getByText("PGT-1")).toBeInTheDocument();
  });

  it("create mode: submits publicId/pageType/name, omitting untouched optional fields entirely, then navigates using the response's recordId", async () => {
    const fetchMock = vi.fn().mockResolvedValue(createSuccessResponse(RECORD_ID));
    global.fetch = fetchMock as typeof fetch;

    renderForm();
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "PGT-NEW" } });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Homepage Template" } });
    fireEvent.click(screen.getByRole("button", { name: "Create page template" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.com/page-template-library/page-templates");
    const body = JSON.parse(init.body as string);
    expect(body.publicId).toBe("PGT-NEW");
    expect(body.pageType).toBe("homepage");
    expect(body.name).toBe("Homepage Template");
    expect(body).not.toHaveProperty("requiredSectionIds");
    expect(body).not.toHaveProperty("optionalSectionIds");
    expect(body).not.toHaveProperty("supportedComponentIds");
    expect(body).not.toHaveProperty("wireframeReferences");
    expect(body).not.toHaveProperty("contentRequirements");
    expect(body).not.toHaveProperty("searchRequirements");
    expect(body).not.toHaveProperty("conversionGoal");
    expect(body).not.toHaveProperty("phpTemplateRelationship");
    expect(body).not.toHaveProperty("replacementRecordId");
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith(`/page-template-library/${RECORD_ID}`),
    );
  });

  it("edit mode: never sends pageType/publicId/approvalStatus, and includes the current name", async () => {
    const fetchMock = vi.fn().mockResolvedValue(updateSuccessResponse());
    global.fetch = fetchMock as typeof fetch;

    render(
      <PageTemplateLibraryForm
        mode="edit"
        recordId={RECORD_ID}
        initial={pageTemplateFixture()}
        sectionPatterns={[]}
        components={[]}
        pageTemplates={[]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      `https://api.example.com/page-template-library/page-templates/${RECORD_ID}/update`,
    );
    const body = JSON.parse(init.body as string);
    expect(body).not.toHaveProperty("pageType");
    expect(body).not.toHaveProperty("publicId");
    expect(body).not.toHaveProperty("approvalStatus");
    expect(body.name).toBe("Homepage Template");
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
      <PageTemplateLibraryForm
        mode="edit"
        recordId={RECORD_ID}
        initial={pageTemplateFixture({ approvalStatus: "approved" })}
        sectionPatterns={[]}
        components={[]}
        pageTemplates={[]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith(`/page-template-library/${RECORD_ID}`),
    );
    expect(pushMock).not.toHaveBeenCalledWith(`/page-template-library/${FORKED_ROW_ID}`);
  });

  it("edit mode: shows the fork notice when the current version is approved", () => {
    render(
      <PageTemplateLibraryForm
        mode="edit"
        recordId={RECORD_ID}
        initial={pageTemplateFixture({ approvalStatus: "approved" })}
        sectionPatterns={[]}
        components={[]}
        pageTemplates={[]}
      />,
    );
    expect(screen.getByText(/creates a new draft version instead/)).toBeInTheDocument();
  });

  it("edit mode: shows no fork notice when the current version is not approved", () => {
    render(
      <PageTemplateLibraryForm
        mode="edit"
        recordId={RECORD_ID}
        initial={pageTemplateFixture({ approvalStatus: "draft" })}
        sectionPatterns={[]}
        components={[]}
        pageTemplates={[]}
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
        error: { code: "BadRequestException", message: "publicId already in use: PGT-NEW" },
        correlationId: "corr-1",
      }),
    } as Response) as typeof fetch;

    renderForm();
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "PGT-NEW" } });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "X" } });
    fireEvent.click(screen.getByRole("button", { name: "Create page template" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("publicId already in use: PGT-NEW");
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("relationship picker: selecting a section adds it to the submitted requiredSectionIds", async () => {
    const fetchMock = vi.fn().mockResolvedValue(createSuccessResponse(RECORD_ID));
    global.fetch = fetchMock as typeof fetch;
    const section = sectionFixture();

    renderForm({ sectionPatterns: [section] });
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "PGT-NEW" } });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "X" } });

    // "Homepage Hero" appears as an available option in BOTH the "Required sections" and
    // "Optional sections" pickers simultaneously (neither has excluded it yet) — the first match
    // is the "Required sections" listbox's own option, since it renders first in the form.
    fireEvent.change(screen.getByRole("combobox", { name: "Required sections" }), {
      target: { value: "Hero" },
    });
    const [firstMatch] = screen.getAllByText("Homepage Hero");
    expect(firstMatch).toBeDefined();
    fireEvent.click(firstMatch as HTMLElement);

    fireEvent.click(screen.getByRole("button", { name: "Create page template" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.requiredSectionIds).toEqual([SECTION_ID]);
  });

  it("rejects a section already selected as required from also being added as optional, client-side, mirroring the backend's own overlap rule", () => {
    const section = sectionFixture();
    renderForm({
      sectionPatterns: [section],
    });
    const [firstMatch] = screen.getAllByText("Homepage Hero");
    expect(firstMatch).toBeDefined();
    fireEvent.click(firstMatch as HTMLElement);

    // Once selected as required, the same section is excluded from the optional picker's own
    // option pool entirely — it can never be chosen there in the first place. Only one
    // "Homepage Hero" now renders anywhere: the "Required sections" picker's own selected chip.
    expect(screen.queryByRole("combobox", { name: "Optional sections" })).toBeInTheDocument();
    expect(screen.getAllByText("Homepage Hero")).toHaveLength(1);
  });

  it("relationship picker: selecting a component adds it to the submitted supportedComponentIds", async () => {
    const fetchMock = vi.fn().mockResolvedValue(createSuccessResponse(RECORD_ID));
    global.fetch = fetchMock as typeof fetch;
    const component = componentFixture();

    renderForm({ components: [component] });
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "PGT-NEW" } });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "X" } });

    fireEvent.change(screen.getByRole("combobox", { name: "Supported components" }), {
      target: { value: "Primary" },
    });
    fireEvent.click(screen.getByText("Primary Button"));

    fireEvent.click(screen.getByRole("button", { name: "Create page template" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.supportedComponentIds).toEqual([COMPONENT_ID]);
  });

  it("tag input: pressing Enter adds a wireframe reference, and it's included in the submitted wireframeReferences", async () => {
    const fetchMock = vi.fn().mockResolvedValue(createSuccessResponse(RECORD_ID));
    global.fetch = fetchMock as typeof fetch;

    renderForm();
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "PGT-NEW" } });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "X" } });
    const wireframeInput = screen.getByLabelText("Wireframe references");
    fireEvent.change(wireframeInput, { target: { value: "figma.com/wireframe-1" } });
    fireEvent.keyDown(wireframeInput, { key: "Enter" });
    expect(screen.getByText("figma.com/wireframe-1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Create page template" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.wireframeReferences).toEqual(["figma.com/wireframe-1"]);
  });

  it("replacement picker: selecting a page template sets replacementRecordId, excluding the record itself in edit mode", async () => {
    const fetchMock = vi.fn().mockResolvedValue(updateSuccessResponse());
    global.fetch = fetchMock as typeof fetch;
    const replacement = pageTemplateFixture({
      id: REPLACEMENT_ID,
      recordId: REPLACEMENT_ID,
      name: "Newer Homepage Template",
    });

    render(
      <PageTemplateLibraryForm
        mode="edit"
        recordId={RECORD_ID}
        initial={pageTemplateFixture()}
        sectionPatterns={[]}
        components={[]}
        pageTemplates={[replacement, pageTemplateFixture()]}
      />,
    );

    // The record's own recordId (RECORD_ID) must not appear as an option — only the OTHER
    // page template does.
    fireEvent.change(screen.getByRole("combobox", { name: "Replacement page template" }), {
      target: { value: "Newer" },
    });
    expect(screen.getByText("Newer Homepage Template")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Newer Homepage Template"));

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.replacementRecordId).toBe(REPLACEMENT_ID);
  });

  it("edit mode: a previously-set PHP template relationship loads into the textarea", () => {
    render(
      <PageTemplateLibraryForm
        mode="edit"
        recordId={RECORD_ID}
        initial={pageTemplateFixture({ phpTemplateRelationship: "template-parts/homepage.php" })}
        sectionPatterns={[]}
        components={[]}
        pageTemplates={[]}
      />,
    );
    expect(screen.getByLabelText("PHP template relationship")).toHaveValue(
      "template-parts/homepage.php",
    );
  });
});
