import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkflowTaskTemplate } from "@webdesk/shared-types";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { WorkflowTaskTemplateForm } from "../../components/workflow-task-template-form.js";

const TEMPLATE_ID = "11111111-1111-1111-1111-111111111111";

function successResponse(id: string): Response {
  return {
    ok: true,
    json: async () => ({ success: true, data: { id }, correlationId: "corr-1" }),
  } as Response;
}

function templateFixture(overrides: Partial<WorkflowTaskTemplate> = {}): WorkflowTaskTemplate {
  return {
    id: TEMPLATE_ID,
    publicId: "WTT-1",
    templateType: "content",
    title: "Blog Post Template",
    authorizedStage: "content_production",
    requiredInputs: null,
    expectedOutputs: null,
    restrictions: null,
    agentAssignment: null,
    validationCriteria: null,
    requiredApprovals: null,
    approvalStatus: "draft",
    version: 1,
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-09-02T00:00:00.000Z",
    updatedAt: "2026-09-02T00:00:00.000Z",
    ...overrides,
  };
}

describe("WorkflowTaskTemplateForm", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    pushMock.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("create mode: publicId/templateType/title/authorizedStage are real HTML required fields", () => {
    render(<WorkflowTaskTemplateForm mode="create" />);
    expect(screen.getByLabelText("Public ID")).toBeRequired();
    expect(screen.getByLabelText("Template type")).toBeRequired();
    expect(screen.getByLabelText("Title")).toBeRequired();
    expect(screen.getByLabelText("Authorized stage")).toBeRequired();
  });

  it("renders a rich-text editor (not a plain textarea) for the 4 long-text fields", () => {
    render(<WorkflowTaskTemplateForm mode="create" />);
    expect(document.querySelectorAll("textarea")).toHaveLength(0);
    expect(document.querySelectorAll('[contenteditable="true"]')).toHaveLength(4);
  });

  it("create mode: submits publicId/templateType/title/authorizedStage, omitting untouched optional fields entirely", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(TEMPLATE_ID));
    global.fetch = fetchMock as typeof fetch;

    render(<WorkflowTaskTemplateForm mode="create" />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "WTT-NEW" } });
    fireEvent.change(screen.getByLabelText("Template type"), { target: { value: "design" } });
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Design Template" } });
    fireEvent.change(screen.getByLabelText("Authorized stage"), {
      target: { value: "design_review" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create template" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.com/workflow-and-task-template-library/templates");
    const body = JSON.parse(init.body as string);
    expect(body.publicId).toBe("WTT-NEW");
    expect(body.templateType).toBe("design");
    expect(body.title).toBe("Design Template");
    expect(body.authorizedStage).toBe("design_review");
    expect(body).not.toHaveProperty("requiredInputs");
    expect(body).not.toHaveProperty("expectedOutputs");
    expect(body).not.toHaveProperty("restrictions");
    expect(body).not.toHaveProperty("validationCriteria");
    expect(body).not.toHaveProperty("agentAssignment");
    expect(body).not.toHaveProperty("requiredApprovals");
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith(`/workflow-and-task-template-library/${TEMPLATE_ID}`),
    );
  });

  it("edit mode: never sends approvalStatus/version/publicId/templateType", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(TEMPLATE_ID));
    global.fetch = fetchMock as typeof fetch;

    render(
      <WorkflowTaskTemplateForm
        mode="edit"
        templateId={TEMPLATE_ID}
        initial={templateFixture({ title: "Was set" })}
      />,
    );
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Renamed" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      `https://api.example.com/workflow-and-task-template-library/templates/${TEMPLATE_ID}/update`,
    );
    const body = JSON.parse(init.body as string);
    expect(body.title).toBe("Renamed");
    expect(body).not.toHaveProperty("approvalStatus");
    expect(body).not.toHaveProperty("version");
    expect(body).not.toHaveProperty("publicId");
    expect(body).not.toHaveProperty("templateType");
  });

  it("edit mode: clearing a previously-set optional plain field sends an explicit null, not an empty string", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(TEMPLATE_ID));
    global.fetch = fetchMock as typeof fetch;

    render(
      <WorkflowTaskTemplateForm
        mode="edit"
        templateId={TEMPLATE_ID}
        initial={templateFixture({ agentAssignment: "growth-director-agent" })}
      />,
    );
    fireEvent.change(screen.getByLabelText("Agent assignment"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.agentAssignment).toBeNull();
  });

  it("shows the backend's error message and does not navigate on a failed submit", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        success: false,
        error: { code: "BadRequestException", message: "publicId already in use: WTT-NEW" },
        correlationId: "corr-1",
      }),
    } as Response) as typeof fetch;

    render(<WorkflowTaskTemplateForm mode="create" />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "WTT-NEW" } });
    fireEvent.change(screen.getByLabelText("Template type"), { target: { value: "content" } });
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "X" } });
    fireEvent.change(screen.getByLabelText("Authorized stage"), { target: { value: "stage" } });
    fireEvent.click(screen.getByRole("button", { name: "Create template" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("publicId already in use: WTT-NEW");
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("edit mode: a rich-text field's initial HTML content loads into its editor", async () => {
    render(
      <WorkflowTaskTemplateForm
        mode="edit"
        templateId={TEMPLATE_ID}
        initial={templateFixture({ requiredInputs: "<p>A completed content brief</p>" })}
      />,
    );
    await waitFor(() => expect(screen.getByText("A completed content brief")).toBeInTheDocument());
  });

  it("edit mode: publicId and templateType are both shown read-only, not as editable fields", () => {
    render(
      <WorkflowTaskTemplateForm
        mode="edit"
        templateId={TEMPLATE_ID}
        initial={templateFixture({ publicId: "WTT-READONLY", templateType: "security" })}
      />,
    );
    expect(screen.queryByLabelText("Public ID")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Template type")).not.toBeInTheDocument();
    expect(screen.getByText("WTT-READONLY")).toBeInTheDocument();
    expect(screen.getByText("Security")).toBeInTheDocument();
  });
});
