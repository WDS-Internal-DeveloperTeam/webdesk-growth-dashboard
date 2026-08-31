import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SectionPatternRecord } from "@webdesk/shared-types";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { SectionAndPatternLibraryForm } from "../../components/section-and-pattern-library-form.js";

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

function recordFixture(overrides: Partial<SectionPatternRecord> = {}): SectionPatternRecord {
  return {
    id: ROW_ID,
    recordId: RECORD_ID,
    publicId: "SPL-1",
    patternType: "homepage_storytelling",
    versionNumber: 1,
    isCurrent: true,
    name: "Hero storytelling block",
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
    ...overrides,
  };
}

describe("SectionAndPatternLibraryForm", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    pushMock.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("create mode: publicId/patternType/name are real HTML required fields", () => {
    render(<SectionAndPatternLibraryForm mode="create" />);
    expect(screen.getByLabelText("Public ID")).toBeRequired();
    expect(screen.getByLabelText("Pattern type")).toBeRequired();
    expect(screen.getByLabelText("Name")).toBeRequired();
  });

  it("renders a rich-text editor (not a plain textarea) for Description, Responsive behavior, and Accessibility notes", () => {
    render(<SectionAndPatternLibraryForm mode="create" />);
    expect(document.querySelectorAll('[contenteditable="true"]')).toHaveLength(3);
  });

  it("renders plain code textareas for HTML structure, SCSS reference, and Browser support", () => {
    render(<SectionAndPatternLibraryForm mode="create" />);
    expect(document.querySelectorAll("textarea")).toHaveLength(3);
  });

  it("edit mode: patternType is shown read-only, not as an editable field", () => {
    render(
      <SectionAndPatternLibraryForm mode="edit" recordId={RECORD_ID} initial={recordFixture()} />,
    );
    expect(screen.queryByLabelText("Pattern type")).not.toBeInTheDocument();
    expect(screen.getByText("Homepage storytelling")).toBeInTheDocument();
  });

  it("edit mode: publicId is shown read-only, not as an editable field", () => {
    render(
      <SectionAndPatternLibraryForm mode="edit" recordId={RECORD_ID} initial={recordFixture()} />,
    );
    expect(screen.queryByLabelText("Public ID")).not.toBeInTheDocument();
    expect(screen.getByText("SPL-1")).toBeInTheDocument();
  });

  it("create mode: submits publicId/patternType/name, omitting untouched optional fields entirely, then navigates using the response's recordId", async () => {
    const fetchMock = vi.fn().mockResolvedValue(createSuccessResponse(RECORD_ID));
    global.fetch = fetchMock as typeof fetch;

    render(<SectionAndPatternLibraryForm mode="create" />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "SPL-NEW" } });
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Hero storytelling block" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create record" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.com/section-and-pattern-library/records");
    const body = JSON.parse(init.body as string);
    expect(body.publicId).toBe("SPL-NEW");
    expect(body.patternType).toBe("homepage_storytelling");
    expect(body.name).toBe("Hero storytelling block");
    expect(body).not.toHaveProperty("description");
    expect(body).not.toHaveProperty("designReference");
    expect(body).not.toHaveProperty("htmlStructure");
    expect(body).not.toHaveProperty("phpPath");
    expect(body).not.toHaveProperty("scssReference");
    expect(body).not.toHaveProperty("jsDependencies");
    expect(body).not.toHaveProperty("responsiveBehavior");
    expect(body).not.toHaveProperty("accessibilityNotes");
    expect(body).not.toHaveProperty("browserSupport");
    expect(body).not.toHaveProperty("tokenReferences");
    expect(body).not.toHaveProperty("relatedComponentIds");
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith(`/section-and-pattern-library/${RECORD_ID}`),
    );
  });

  it("edit mode: never sends patternType/publicId/approvalStatus, and includes the current name", async () => {
    const fetchMock = vi.fn().mockResolvedValue(updateSuccessResponse());
    global.fetch = fetchMock as typeof fetch;

    render(
      <SectionAndPatternLibraryForm mode="edit" recordId={RECORD_ID} initial={recordFixture()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      `https://api.example.com/section-and-pattern-library/records/${RECORD_ID}/update`,
    );
    const body = JSON.parse(init.body as string);
    expect(body).not.toHaveProperty("patternType");
    expect(body).not.toHaveProperty("publicId");
    expect(body).not.toHaveProperty("approvalStatus");
    expect(body.name).toBe("Hero storytelling block");
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
      <SectionAndPatternLibraryForm
        mode="edit"
        recordId={RECORD_ID}
        initial={recordFixture({ approvalStatus: "approved" })}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith(`/section-and-pattern-library/${RECORD_ID}`),
    );
    expect(pushMock).not.toHaveBeenCalledWith(`/section-and-pattern-library/${FORKED_ROW_ID}`);
  });

  it("edit mode: shows the fork notice when the current version is approved", () => {
    render(
      <SectionAndPatternLibraryForm
        mode="edit"
        recordId={RECORD_ID}
        initial={recordFixture({ approvalStatus: "approved" })}
      />,
    );
    expect(screen.getByText(/creates a new draft version instead/)).toBeInTheDocument();
  });

  it("edit mode: shows no fork notice when the current version is not approved", () => {
    render(
      <SectionAndPatternLibraryForm
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
        error: { code: "BadRequestException", message: "publicId already in use: SPL-NEW" },
        correlationId: "corr-1",
      }),
    } as Response) as typeof fetch;

    render(<SectionAndPatternLibraryForm mode="create" />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "SPL-NEW" } });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "X" } });
    fireEvent.click(screen.getByRole("button", { name: "Create record" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("publicId already in use: SPL-NEW");
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid design reference URL client-side, without submitting", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    render(<SectionAndPatternLibraryForm mode="create" />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "SPL-NEW" } });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "X" } });
    fireEvent.change(screen.getByLabelText("Design reference"), {
      target: { value: "javascript:alert(1)" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create record" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Design reference must be a valid http:// or https:// URL.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("tag input: pressing Enter adds a JS dependency tag, and it's included in the submitted jsDependencies", async () => {
    const fetchMock = vi.fn().mockResolvedValue(createSuccessResponse(RECORD_ID));
    global.fetch = fetchMock as typeof fetch;

    render(<SectionAndPatternLibraryForm mode="create" />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "SPL-NEW" } });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "X" } });
    const depsInput = screen.getByLabelText("JS dependencies");
    fireEvent.change(depsInput, { target: { value: "carousel.js" } });
    fireEvent.keyDown(depsInput, { key: "Enter" });
    expect(screen.getByText("carousel.js")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Create record" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.jsDependencies).toEqual(["carousel.js"]);
  });

  it("edit mode: a previously-set PHP path loads into the input", () => {
    render(
      <SectionAndPatternLibraryForm
        mode="edit"
        recordId={RECORD_ID}
        initial={recordFixture({ phpPath: "template-parts/hero.php" })}
      />,
    );
    expect(screen.getByLabelText("PHP path")).toHaveValue("template-parts/hero.php");
  });
});
