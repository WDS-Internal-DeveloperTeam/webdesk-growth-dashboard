import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentRecord, MotionInteractionRecord } from "@webdesk/shared-types";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { MotionInteractionLibraryForm } from "../../components/motion-interaction-library-form.js";

const RECORD_ID = "11111111-1111-1111-1111-111111111111";
const ROW_ID = "22222222-2222-2222-2222-222222222222";
const FORKED_ROW_ID = "33333333-3333-3333-3333-333333333333";
const COMPONENT_ID = "55555555-5555-5555-5555-555555555555";

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

function recordFixture(overrides: Partial<MotionInteractionRecord> = {}): MotionInteractionRecord {
  return {
    id: ROW_ID,
    recordId: RECORD_ID,
    publicId: "MIL-1",
    category: "modal_drawer",
    versionNumber: 1,
    isCurrent: true,
    name: "Modal open/close",
    description: null,
    triggerAndBehavior: null,
    timingAndEasing: null,
    implementationSpec: null,
    accessibilityNotes: null,
    fallbackBehavior: null,
    designReference: null,
    relatedComponentIds: [],
    approvalStatus: "draft",
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-08-31T00:00:00.000Z",
    updatedAt: "2026-08-31T00:00:00.000Z",
    ...overrides,
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

function renderForm(
  overrides: { readonly components?: readonly ComponentRecord[] } = {},
): ReturnType<typeof render> {
  return render(
    <MotionInteractionLibraryForm mode="create" components={overrides.components ?? []} />,
  );
}

describe("MotionInteractionLibraryForm", () => {
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
    renderForm();
    expect(screen.getByLabelText("Public ID")).toBeRequired();
    expect(screen.getByLabelText("Category")).toBeRequired();
    expect(screen.getByLabelText("Name")).toBeRequired();
  });

  it("renders a rich-text editor (not a plain textarea) for Description, Trigger and behavior, and Accessibility notes", () => {
    renderForm();
    expect(document.querySelectorAll('[contenteditable="true"]')).toHaveLength(3);
  });

  it("renders plain textareas for Timing and easing, Implementation spec, and Fallback behavior", () => {
    renderForm();
    expect(document.querySelectorAll("textarea")).toHaveLength(3);
  });

  it("edit mode: category is shown read-only, not as an editable field", () => {
    render(
      <MotionInteractionLibraryForm
        mode="edit"
        recordId={RECORD_ID}
        initial={recordFixture()}
        components={[]}
      />,
    );
    expect(screen.queryByLabelText("Category")).not.toBeInTheDocument();
    expect(screen.getByText("Modal / drawer")).toBeInTheDocument();
  });

  it("edit mode: publicId is shown read-only, not as an editable field", () => {
    render(
      <MotionInteractionLibraryForm
        mode="edit"
        recordId={RECORD_ID}
        initial={recordFixture()}
        components={[]}
      />,
    );
    expect(screen.queryByLabelText("Public ID")).not.toBeInTheDocument();
    expect(screen.getByText("MIL-1")).toBeInTheDocument();
  });

  it("create mode: submits publicId/category/name, omitting untouched optional fields entirely, then navigates using the response's recordId", async () => {
    const fetchMock = vi.fn().mockResolvedValue(createSuccessResponse(RECORD_ID));
    global.fetch = fetchMock as typeof fetch;

    renderForm();
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "MIL-NEW" } });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Modal open/close" } });
    fireEvent.click(screen.getByRole("button", { name: "Create record" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.com/motion-and-interaction-library/records");
    const body = JSON.parse(init.body as string);
    expect(body.publicId).toBe("MIL-NEW");
    // The category <select> defaults to CATEGORY_VALUES[0] ("page_transition") — the test never
    // changes it, so the submitted body reflects the default, not the "modal_drawer" fixture value
    // (which only applies in edit mode, via `initial`).
    expect(body.category).toBe("page_transition");
    expect(body.name).toBe("Modal open/close");
    expect(body).not.toHaveProperty("description");
    expect(body).not.toHaveProperty("triggerAndBehavior");
    expect(body).not.toHaveProperty("timingAndEasing");
    expect(body).not.toHaveProperty("implementationSpec");
    expect(body).not.toHaveProperty("accessibilityNotes");
    expect(body).not.toHaveProperty("fallbackBehavior");
    expect(body).not.toHaveProperty("designReference");
    expect(body).not.toHaveProperty("relatedComponentIds");
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith(`/motion-and-interaction-library/${RECORD_ID}`),
    );
  });

  it("edit mode: never sends category/publicId/approvalStatus, and includes the current name", async () => {
    const fetchMock = vi.fn().mockResolvedValue(updateSuccessResponse());
    global.fetch = fetchMock as typeof fetch;

    render(
      <MotionInteractionLibraryForm
        mode="edit"
        recordId={RECORD_ID}
        initial={recordFixture()}
        components={[]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      `https://api.example.com/motion-and-interaction-library/records/${RECORD_ID}/update`,
    );
    const body = JSON.parse(init.body as string);
    expect(body).not.toHaveProperty("category");
    expect(body).not.toHaveProperty("publicId");
    expect(body).not.toHaveProperty("approvalStatus");
    expect(body.name).toBe("Modal open/close");
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
      <MotionInteractionLibraryForm
        mode="edit"
        recordId={RECORD_ID}
        initial={recordFixture({ approvalStatus: "approved" })}
        components={[]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith(`/motion-and-interaction-library/${RECORD_ID}`),
    );
    expect(pushMock).not.toHaveBeenCalledWith(`/motion-and-interaction-library/${FORKED_ROW_ID}`);
  });

  it("edit mode: shows the fork notice when the current version is approved", () => {
    render(
      <MotionInteractionLibraryForm
        mode="edit"
        recordId={RECORD_ID}
        initial={recordFixture({ approvalStatus: "approved" })}
        components={[]}
      />,
    );
    expect(screen.getByText(/creates a new draft version instead/)).toBeInTheDocument();
  });

  it("edit mode: shows no fork notice when the current version is not approved", () => {
    render(
      <MotionInteractionLibraryForm
        mode="edit"
        recordId={RECORD_ID}
        initial={recordFixture({ approvalStatus: "draft" })}
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
        error: { code: "BadRequestException", message: "publicId already in use: MIL-NEW" },
        correlationId: "corr-1",
      }),
    } as Response) as typeof fetch;

    renderForm();
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "MIL-NEW" } });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "X" } });
    fireEvent.click(screen.getByRole("button", { name: "Create record" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("publicId already in use: MIL-NEW");
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid design reference URL client-side, without submitting", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    renderForm();
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "MIL-NEW" } });
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

  it("relationship picker: selecting a component adds it to the submitted relatedComponentIds", async () => {
    const fetchMock = vi.fn().mockResolvedValue(createSuccessResponse(RECORD_ID));
    global.fetch = fetchMock as typeof fetch;
    const component = componentFixture();

    renderForm({ components: [component] });
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "MIL-NEW" } });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "X" } });

    fireEvent.change(screen.getByRole("combobox", { name: "Related components" }), {
      target: { value: "Primary" },
    });
    fireEvent.click(screen.getByText("Primary Button"));

    fireEvent.click(screen.getByRole("button", { name: "Create record" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.relatedComponentIds).toEqual([COMPONENT_ID]);
  });

  it("edit mode: a previously-set timing/easing value loads into the textarea", () => {
    render(
      <MotionInteractionLibraryForm
        mode="edit"
        recordId={RECORD_ID}
        initial={recordFixture({ timingAndEasing: "ease-in-out 200ms" })}
        components={[]}
      />,
    );
    expect(screen.getByLabelText("Timing and easing")).toHaveValue("ease-in-out 200ms");
  });
});
