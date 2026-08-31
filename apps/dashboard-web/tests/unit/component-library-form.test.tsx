import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentRecord, DesignTokenRecord } from "@webdesk/shared-types";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { ComponentLibraryForm } from "../../components/component-library-form.js";

const RECORD_ID = "11111111-1111-1111-1111-111111111111";
const ROW_ID = "22222222-2222-2222-2222-222222222222";
const FORKED_ROW_ID = "33333333-3333-3333-3333-333333333333";
const TOKEN_ID = "44444444-4444-4444-4444-444444444444";
const OTHER_COMPONENT_ID = "55555555-5555-5555-5555-555555555555";

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

function componentFixture(overrides: Partial<ComponentRecord> = {}): ComponentRecord {
  return {
    id: ROW_ID,
    recordId: RECORD_ID,
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
    createdAt: "2026-08-23T00:00:00.000Z",
    updatedAt: "2026-08-23T00:00:00.000Z",
    ...overrides,
  };
}

function designTokenFixture(overrides: Partial<DesignTokenRecord> = {}): DesignTokenRecord {
  return {
    id: TOKEN_ID,
    recordId: TOKEN_ID,
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

describe("ComponentLibraryForm", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    pushMock.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("create mode: publicId/category/name are real HTML required fields", () => {
    render(<ComponentLibraryForm mode="create" designTokens={[]} components={[]} />);
    expect(screen.getByLabelText("Public ID")).toBeRequired();
    expect(screen.getByLabelText("Category")).toBeRequired();
    expect(screen.getByLabelText("Name")).toBeRequired();
  });

  it("renders only plain textareas for the long-text fields, no rich-text editor", () => {
    render(<ComponentLibraryForm mode="create" designTokens={[]} components={[]} />);
    expect(document.querySelectorAll("textarea")).toHaveLength(11);
    expect(document.querySelectorAll('[contenteditable="true"]')).toHaveLength(0);
  });

  it("edit mode: category is shown read-only, not as an editable field", () => {
    render(
      <ComponentLibraryForm
        mode="edit"
        recordId={RECORD_ID}
        initial={componentFixture()}
        designTokens={[]}
        components={[]}
      />,
    );
    expect(screen.queryByLabelText("Category")).not.toBeInTheDocument();
    expect(screen.getByText("buttons")).toBeInTheDocument();
  });

  it("edit mode: publicId is shown read-only, not as an editable field", () => {
    render(
      <ComponentLibraryForm
        mode="edit"
        recordId={RECORD_ID}
        initial={componentFixture()}
        designTokens={[]}
        components={[]}
      />,
    );
    expect(screen.queryByLabelText("Public ID")).not.toBeInTheDocument();
    expect(screen.getByText("CL-1")).toBeInTheDocument();
  });

  it("create mode: submits publicId/category/name, omitting untouched optional fields entirely, then navigates using the response's recordId", async () => {
    const fetchMock = vi.fn().mockResolvedValue(createSuccessResponse(RECORD_ID));
    global.fetch = fetchMock as typeof fetch;

    render(<ComponentLibraryForm mode="create" designTokens={[]} components={[]} />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "CL-NEW" } });
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "buttons" } });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Primary Button" } });
    fireEvent.click(screen.getByRole("button", { name: "Create component" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.com/component-library/components");
    const body = JSON.parse(init.body as string);
    expect(body.publicId).toBe("CL-NEW");
    expect(body.category).toBe("buttons");
    expect(body.name).toBe("Primary Button");
    expect(body).not.toHaveProperty("figmaReference");
    expect(body).not.toHaveProperty("tokenIds");
    expect(body).not.toHaveProperty("htmlStructure");
    expect(body).not.toHaveProperty("replacementRecordId");
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith(`/component-library/${RECORD_ID}`));
  });

  it("edit mode: never sends category/publicId/approvalStatus, and includes the current name", async () => {
    const fetchMock = vi.fn().mockResolvedValue(updateSuccessResponse());
    global.fetch = fetchMock as typeof fetch;

    render(
      <ComponentLibraryForm
        mode="edit"
        recordId={RECORD_ID}
        initial={componentFixture()}
        designTokens={[]}
        components={[]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.example.com/component-library/components/${RECORD_ID}/update`);
    const body = JSON.parse(init.body as string);
    expect(body).not.toHaveProperty("category");
    expect(body).not.toHaveProperty("publicId");
    expect(body).not.toHaveProperty("approvalStatus");
    expect(body.name).toBe("Primary Button");
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
      <ComponentLibraryForm
        mode="edit"
        recordId={RECORD_ID}
        initial={componentFixture({ approvalStatus: "approved" })}
        designTokens={[]}
        components={[]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith(`/component-library/${RECORD_ID}`));
    expect(pushMock).not.toHaveBeenCalledWith(`/component-library/${FORKED_ROW_ID}`);
  });

  it("edit mode: shows the fork notice when the current version is approved", () => {
    render(
      <ComponentLibraryForm
        mode="edit"
        recordId={RECORD_ID}
        initial={componentFixture({ approvalStatus: "approved" })}
        designTokens={[]}
        components={[]}
      />,
    );
    expect(screen.getByText(/creates a new draft version instead/)).toBeInTheDocument();
  });

  it("edit mode: shows no fork notice when the current version is not approved", () => {
    render(
      <ComponentLibraryForm
        mode="edit"
        recordId={RECORD_ID}
        initial={componentFixture({ approvalStatus: "draft" })}
        designTokens={[]}
        components={[]}
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
        error: { code: "BadRequestException", message: "publicId already in use: CL-NEW" },
        correlationId: "corr-1",
      }),
    } as Response) as typeof fetch;

    render(<ComponentLibraryForm mode="create" designTokens={[]} components={[]} />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "CL-NEW" } });
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "buttons" } });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "X" } });
    fireEvent.click(screen.getByRole("button", { name: "Create component" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("publicId already in use: CL-NEW");
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("rejects an unsafe figmaReference scheme client-side before ever calling fetch", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    render(<ComponentLibraryForm mode="create" designTokens={[]} components={[]} />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "CL-NEW" } });
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "buttons" } });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "X" } });
    fireEvent.change(screen.getByLabelText("Figma reference"), {
      target: { value: "javascript:alert(1)" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create component" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/valid http:\/\/ or https:\/\//);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("relationship picker: selecting a design token adds it to the submitted tokenIds", async () => {
    const fetchMock = vi.fn().mockResolvedValue(createSuccessResponse(RECORD_ID));
    global.fetch = fetchMock as typeof fetch;
    const token = designTokenFixture();

    render(<ComponentLibraryForm mode="create" designTokens={[token]} components={[]} />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "CL-NEW" } });
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "buttons" } });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "X" } });

    fireEvent.change(screen.getByRole("combobox", { name: "Design tokens" }), {
      target: { value: "Primary" },
    });
    fireEvent.click(screen.getByText("Primary Brand Blue"));

    fireEvent.click(screen.getByRole("button", { name: "Create component" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.tokenIds).toEqual([TOKEN_ID]);
  });

  it("replacement picker: selecting a component sets replacementRecordId, excluding the record itself in edit mode", async () => {
    const fetchMock = vi.fn().mockResolvedValue(updateSuccessResponse());
    global.fetch = fetchMock as typeof fetch;
    const other = componentFixture({
      id: OTHER_COMPONENT_ID,
      recordId: OTHER_COMPONENT_ID,
      name: "Secondary Button",
    });

    render(
      <ComponentLibraryForm
        mode="edit"
        recordId={RECORD_ID}
        initial={componentFixture()}
        designTokens={[]}
        components={[componentFixture(), other]}
      />,
    );

    // The record's own name never appears as an option in the replacement picker.
    fireEvent.change(screen.getByRole("combobox", { name: "Replacement component" }), {
      target: { value: "Button" },
    });
    expect(screen.queryByText("Primary Button")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Secondary Button"));

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.replacementRecordId).toBe(OTHER_COMPONENT_ID);
  });

  it("edit mode: an out-of-window replacementRecordId falls back to showing the raw id as its own chip", () => {
    render(
      <ComponentLibraryForm
        mode="edit"
        recordId={RECORD_ID}
        initial={componentFixture({ replacementRecordId: OTHER_COMPONENT_ID })}
        designTokens={[]}
        components={[]}
      />,
    );
    expect(screen.getByText(OTHER_COMPONENT_ID)).toBeInTheDocument();
  });
});
