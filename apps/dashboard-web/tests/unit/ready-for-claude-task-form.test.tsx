import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ModuleRegistrySummary, Project, ReadyForClaudeTask } from "@webdesk/shared-types";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { ReadyForClaudeTaskForm } from "../../components/ready-for-claude-task-form.js";

const TASK_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_TASK_ID = "22222222-2222-2222-2222-222222222222";
const PROJECT_ID = "33333333-3333-3333-3333-333333333333";

function successResponse(id: string): Response {
  return {
    ok: true,
    json: async () => ({ success: true, data: { id }, correlationId: "corr-1" }),
  } as Response;
}

function taskFixture(id: string, overrides: Partial<ReadyForClaudeTask> = {}): ReadyForClaudeTask {
  return {
    id,
    publicId: `TASK-${id}`,
    title: "Fix the flaky test",
    description: null,
    priority: "medium",
    agent: null,
    agentVersion: null,
    projectId: null,
    targetModuleKey: null,
    targetId: null,
    status: "draft",
    stage: null,
    dependencies: [],
    operatorUserId: null,
    developerUserId: null,
    featureBranch: null,
    sourceCommit: null,
    prId: null,
    prUrl: null,
    prStatus: null,
    reviewerUserId: null,
    codeReviewResult: null,
    stagingCommit: null,
    stagingDeployment: null,
    stagingUrl: null,
    dashboardReview: null,
    changesRequestedNotes: null,
    productionApproval: false,
    productionApproverUserId: null,
    productionCommit: null,
    productionDeployment: null,
    productionVerification: null,
    rollbackVersion: null,
    failureReason: null,
    retryCount: 0,
    dueDate: null,
    auditReference: null,
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

function moduleFixture(key: string): ModuleRegistrySummary {
  return {
    id: `module-${key}`,
    key,
    name: key,
    permissionGroupKey: key,
    displayName: key,
    description: null,
    navigationGroup: "workflow",
    navigationOrder: 1,
    route: `/${key}`,
    iconReference: null,
    v1InclusionStatus: "included",
    implementationStatus: "available",
    viewPermissionAction: "view",
    actionPermissions: null,
    featureStatus: null,
    documentationReference: null,
    helpDocumentReference: null,
    owner: null,
    dependencies: null,
    confidentialityLevel: null,
    badgeSupport: false,
    deprecationReference: null,
  };
}

function projectFixture(id: string, name: string): Project {
  return {
    id,
    publicId: `PROJ-${id}`,
    name,
    description: null,
    status: "active",
    confidentiality: "internal",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  };
}

const MODULES: readonly ModuleRegistrySummary[] = [moduleFixture("service_library")];
const PROJECTS: readonly Project[] = [projectFixture(PROJECT_ID, "Acme Growth")];
const OTHER_TASKS: readonly ReadyForClaudeTask[] = [
  taskFixture(OTHER_TASK_ID, { title: "Set up staging DB" }),
];

/** `RelationshipPicker`'s options list renders unconditionally whenever `options.length > 0` —
 *  same combobox/listbox scoping approach `internal-link-form.test.tsx` already established. */
function selectDependency(optionName: string): void {
  fireEvent.change(screen.getByRole("combobox", { name: "Blocked by" }), {
    target: { value: optionName },
  });
  const listbox = screen.getByRole("listbox", { name: "Blocked by" });
  fireEvent.click(within(listbox).getByRole("button", { name: optionName }));
}

describe("ReadyForClaudeTaskForm", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    pushMock.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("create mode: Public ID and Title are real HTML required fields", () => {
    render(
      <ReadyForClaudeTaskForm
        mode="create"
        modules={MODULES}
        projects={PROJECTS}
        otherTasks={OTHER_TASKS}
      />,
    );
    expect(screen.getByLabelText("Public ID")).toBeRequired();
    expect(screen.getByLabelText("Title")).toBeRequired();
  });

  it("renders every long-text field as a plain textarea, never RichTextEditor — a deliberate exception to the standing rule", () => {
    render(
      <ReadyForClaudeTaskForm
        mode="create"
        modules={MODULES}
        projects={PROJECTS}
        otherTasks={OTHER_TASKS}
      />,
    );
    expect(document.querySelectorAll("textarea").length).toBeGreaterThanOrEqual(5);
    expect(document.querySelectorAll('[contenteditable="true"]')).toHaveLength(0);
  });

  it("edit mode: publicId is shown read-only, not as an editable field", () => {
    render(
      <ReadyForClaudeTaskForm
        mode="edit"
        taskId={TASK_ID}
        initial={taskFixture(TASK_ID)}
        modules={MODULES}
        projects={PROJECTS}
        otherTasks={OTHER_TASKS}
      />,
    );
    expect(screen.queryByLabelText("Public ID")).not.toBeInTheDocument();
    expect(screen.getByText(`TASK-${TASK_ID}`)).toBeInTheDocument();
  });

  it("no status field is rendered — only the dedicated status-actions route may change it", () => {
    render(
      <ReadyForClaudeTaskForm
        mode="edit"
        taskId={TASK_ID}
        initial={taskFixture(TASK_ID)}
        modules={MODULES}
        projects={PROJECTS}
        otherTasks={OTHER_TASKS}
      />,
    );
    expect(screen.queryByLabelText(/^status$/i)).not.toBeInTheDocument();
  });

  it("no production approval / production approver / retry count fields are rendered — all server-managed, shown only on the detail page", () => {
    render(
      <ReadyForClaudeTaskForm
        mode="edit"
        taskId={TASK_ID}
        initial={taskFixture(TASK_ID)}
        modules={MODULES}
        projects={PROJECTS}
        otherTasks={OTHER_TASKS}
      />,
    );
    expect(screen.queryByLabelText(/production approval/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/production approver/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/retry count/i)).not.toBeInTheDocument();
  });

  it("the dependencies picker excludes the task's own id from its option list (no self-dependency)", () => {
    render(
      <ReadyForClaudeTaskForm
        mode="edit"
        taskId={OTHER_TASK_ID}
        initial={taskFixture(OTHER_TASK_ID)}
        modules={MODULES}
        projects={PROJECTS}
        otherTasks={[
          taskFixture(TASK_ID, { title: "Set up staging DB" }),
          taskFixture(OTHER_TASK_ID),
        ]}
      />,
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Blocked by" }), {
      target: { value: "" },
    });
    const listbox = screen.getByRole("listbox", { name: "Blocked by" });
    expect(within(listbox).queryAllByRole("button")).toHaveLength(1);
  });

  it("rejects an invalid PR URL before submitting", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    render(
      <ReadyForClaudeTaskForm
        mode="create"
        modules={MODULES}
        projects={PROJECTS}
        otherTasks={OTHER_TASKS}
      />,
    );
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "TASK-1" } });
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Do the thing" } });
    fireEvent.change(screen.getByLabelText("PR URL"), {
      target: { value: "javascript:alert(1)" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create task" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/PR URL must be a valid/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("create mode: submits POST to /ready-for-claude-queue/tasks with the entered dependency, then redirects", async () => {
    global.fetch = vi.fn().mockResolvedValue(successResponse(TASK_ID)) as typeof fetch;

    render(
      <ReadyForClaudeTaskForm
        mode="create"
        modules={MODULES}
        projects={PROJECTS}
        otherTasks={OTHER_TASKS}
      />,
    );
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "TASK-1" } });
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Do the thing" } });
    selectDependency("Set up staging DB");
    fireEvent.click(screen.getByRole("button", { name: "Create task" }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    const [url, options] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.com/ready-for-claude-queue/tasks");
    expect(options.method).toBe("POST");
    const body = JSON.parse(options.body as string) as Record<string, unknown>;
    expect(body.publicId).toBe("TASK-1");
    expect(body.title).toBe("Do the thing");
    expect(body.dependencies).toEqual([OTHER_TASK_ID]);
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith(`/ready-for-claude-queue/${TASK_ID}`),
    );
  });

  it("edit mode: submits PATCH to /ready-for-claude-queue/tasks/:id, then redirects to the stable taskId", async () => {
    global.fetch = vi.fn().mockResolvedValue(successResponse(TASK_ID)) as typeof fetch;

    render(
      <ReadyForClaudeTaskForm
        mode="edit"
        taskId={TASK_ID}
        initial={taskFixture(TASK_ID, { title: "Old title" })}
        modules={MODULES}
        projects={PROJECTS}
        otherTasks={OTHER_TASKS}
      />,
    );
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "New title" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    const [url, options] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.example.com/ready-for-claude-queue/tasks/${TASK_ID}`);
    expect(options.method).toBe("PATCH");
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith(`/ready-for-claude-queue/${TASK_ID}`),
    );
  });

  it("shows the backend's error message on a failed submit", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        error: { code: "BadRequestException", message: "publicId already in use: TASK-1" },
        correlationId: "corr-1",
      }),
    } as Response) as typeof fetch;

    render(
      <ReadyForClaudeTaskForm
        mode="create"
        modules={MODULES}
        projects={PROJECTS}
        otherTasks={OTHER_TASKS}
      />,
    );
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "TASK-1" } });
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Do the thing" } });
    fireEvent.click(screen.getByRole("button", { name: "Create task" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("publicId already in use: TASK-1");
    expect(pushMock).not.toHaveBeenCalled();
  });
});
