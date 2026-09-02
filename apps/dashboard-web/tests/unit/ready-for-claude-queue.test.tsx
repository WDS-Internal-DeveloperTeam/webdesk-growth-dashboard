import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { cookies } from "next/headers";
import type { ReadyForClaudeTask } from "@webdesk/shared-types";
import {
  buildReadyForClaudeQueueHref,
  getReadyForClaudeTask,
  getReadyForClaudeTasks,
  parseReadyForClaudeQueueSearchParams,
  readyForClaudeTaskStatusBadge,
} from "../../lib/ready-for-claude-queue.js";

function taskFixture(id: string, overrides: Partial<ReadyForClaudeTask> = {}): ReadyForClaudeTask {
  return {
    id,
    publicId: `task-${id}`,
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

describe("parseReadyForClaudeQueueSearchParams", () => {
  it("defaults to no filters, offset 0, pageSize 20 when nothing is provided", () => {
    expect(parseReadyForClaudeQueueSearchParams({})).toEqual({
      status: null,
      priority: null,
      projectId: null,
      targetModuleKey: null,
      agent: null,
      search: null,
      offset: 0,
      pageSize: 20,
    });
  });

  it("parses valid status/priority/projectId/targetModuleKey/agent/search/offset/pageSize values", () => {
    expect(
      parseReadyForClaudeQueueSearchParams({
        status: "in_progress",
        priority: "critical",
        projectId: "11111111-1111-1111-1111-111111111111",
        targetModuleKey: "service_library",
        agent: "claude-code",
        search: "flaky",
        offset: "25",
        pageSize: "50",
      }),
    ).toEqual({
      status: "in_progress",
      priority: "critical",
      projectId: "11111111-1111-1111-1111-111111111111",
      targetModuleKey: "service_library",
      agent: "claude-code",
      search: "flaky",
      offset: 25,
      pageSize: 50,
    });
  });

  it("falls back to defaults for an invalid/garbled status or priority instead of passing it through", () => {
    const result = parseReadyForClaudeQueueSearchParams({
      status: "not_a_real_status",
      priority: "urgent",
      offset: "not-a-number",
      pageSize: "37",
    });
    expect(result.status).toBeNull();
    expect(result.priority).toBeNull();
    expect(result.offset).toBe(0);
    expect(result.pageSize).toBe(20);
  });

  it("clamps a negative offset to 0", () => {
    expect(parseReadyForClaudeQueueSearchParams({ offset: "-10" }).offset).toBe(0);
  });

  it("clamps an overlong targetModuleKey/projectId to 64 characters", () => {
    expect(
      parseReadyForClaudeQueueSearchParams({ targetModuleKey: "x".repeat(100) }).targetModuleKey,
    ).toHaveLength(64);
    expect(
      parseReadyForClaudeQueueSearchParams({ projectId: "x".repeat(100) }).projectId,
    ).toHaveLength(64);
  });

  it("clamps an overlong agent/search term", () => {
    expect(parseReadyForClaudeQueueSearchParams({ agent: "x".repeat(400) }).agent).toHaveLength(
      255,
    );
    expect(parseReadyForClaudeQueueSearchParams({ search: "x".repeat(400) }).search).toHaveLength(
      255,
    );
  });

  it("takes the first value when a param is duplicated in the URL", () => {
    expect(parseReadyForClaudeQueueSearchParams({ status: ["in_progress", "draft"] }).status).toBe(
      "in_progress",
    );
  });
});

describe("buildReadyForClaudeQueueHref", () => {
  const baseQuery = {
    status: null,
    priority: null,
    projectId: null,
    targetModuleKey: null,
    agent: null,
    search: null,
    offset: 0,
    pageSize: 20 as const,
  };

  it("returns the bare path when nothing diverges from defaults", () => {
    expect(buildReadyForClaudeQueueHref(baseQuery, {})).toBe("/ready-for-claude-queue");
  });

  it("includes every set filter and omits offset=0/the default pageSize", () => {
    expect(
      buildReadyForClaudeQueueHref(baseQuery, {
        status: "awaiting_review",
        priority: "high",
        agent: "claude-code",
        search: "flaky",
      }),
    ).toBe(
      "/ready-for-claude-queue?status=awaiting_review&priority=high&agent=claude-code&search=flaky",
    );
  });

  it("resets offset to 0 when an override other than offset itself is applied", () => {
    const withOffset = { ...baseQuery, offset: 50 };
    expect(buildReadyForClaudeQueueHref(withOffset, { status: "draft" })).toBe(
      "/ready-for-claude-queue?status=draft",
    );
  });

  it("keeps a nonzero offset when explicitly set", () => {
    expect(buildReadyForClaudeQueueHref(baseQuery, { offset: 25 })).toBe(
      "/ready-for-claude-queue?offset=25",
    );
  });
});

describe("readyForClaudeTaskStatusBadge", () => {
  it("maps every one of the 11 real statuses to a token, with completed/approved healthy and cancelled/failed unavailable", () => {
    expect(readyForClaudeTaskStatusBadge("completed").token).toBe("healthy");
    expect(readyForClaudeTaskStatusBadge("approved").token).toBe("healthy");
    expect(readyForClaudeTaskStatusBadge("cancelled").token).toBe("unavailable");
    expect(readyForClaudeTaskStatusBadge("failed").token).toBe("unavailable");
    expect(readyForClaudeTaskStatusBadge("draft").token).toBe("notConfigured");
  });

  it("never returns undefined for any of the 11 real statuses", () => {
    const statuses: readonly Parameters<typeof readyForClaudeTaskStatusBadge>[0][] = [
      "draft",
      "ready_for_claude",
      "claimed",
      "in_progress",
      "awaiting_review",
      "changes_requested",
      "approved",
      "completed",
      "cancelled",
      "paused",
      "failed",
    ];
    statuses.forEach((status) => {
      expect(readyForClaudeTaskStatusBadge(status)).toBeDefined();
      expect(readyForClaudeTaskStatusBadge(status).label.length).toBeGreaterThan(0);
    });
  });
});

describe("getReadyForClaudeTasks", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    vi.mocked(cookies).mockResolvedValue({ toString: () => "sid=abc" } as never);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("throws on a non-OK response instead of silently returning an empty list", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);
    await expect(
      getReadyForClaudeTasks({
        status: null,
        priority: null,
        projectId: null,
        targetModuleKey: null,
        agent: null,
        search: null,
        offset: 0,
        pageSize: 20,
      }),
    ).rejects.toThrow(/status 500/);
  });

  it("requests pageSize + 1 rows and slices/flags hasNextPage from the extra row", async () => {
    const pageSize = 10;
    const items = Array.from({ length: pageSize + 1 }, (_, index) =>
      taskFixture(String(index + 1)),
    );
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: items, correlationId: "c1" }),
    } as Response);

    const result = await getReadyForClaudeTasks({
      status: null,
      priority: null,
      projectId: null,
      targetModuleKey: null,
      agent: null,
      search: null,
      offset: 0,
      pageSize,
    });

    expect(result.items).toHaveLength(pageSize);
    expect(result.hasNextPage).toBe(true);
    const [url] = vi.mocked(global.fetch).mock.calls[0] as [string];
    expect(url).toContain(`limit=${pageSize + 1}`);
    expect(url).toContain("offset=0");
  });
});

describe("getReadyForClaudeTask", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    vi.mocked(cookies).mockResolvedValue({ toString: () => "sid=abc" } as never);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns null for a malformed id without issuing a network call", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;
    expect(await getReadyForClaudeTask("not-a-uuid")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns null on a 404", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response);
    expect(await getReadyForClaudeTask("11111111-1111-1111-1111-111111111111")).toBeNull();
  });

  it("throws on a non-404 non-OK response", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);
    await expect(getReadyForClaudeTask("11111111-1111-1111-1111-111111111111")).rejects.toThrow(
      /status 500/,
    );
  });

  it("returns the task on success", async () => {
    const task = taskFixture("11111111-1111-1111-1111-111111111111");
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: task, correlationId: "c1" }),
    } as Response);
    expect(await getReadyForClaudeTask(task.id)).toEqual(task);
  });
});
