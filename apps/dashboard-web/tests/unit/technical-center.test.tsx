import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { cookies } from "next/headers";
import type {
  TechnicalCheckDefinition,
  TechnicalCheckRun,
  TechnicalFinding,
} from "@webdesk/shared-types";
import {
  buildTechnicalCheckDefinitionsHref,
  getTechnicalCheckDefinition,
  getTechnicalCheckDefinitions,
  getTechnicalCheckRun,
  getTechnicalCheckRunsForDefinition,
  getTechnicalFinding,
  getTechnicalFindingsForRun,
  parseTechnicalCheckDefinitionsSearchParams,
  technicalCheckRunStatusBadge,
  technicalFindingSeverityBadge,
  technicalFindingStatusBadge,
} from "../../lib/technical-center.js";

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";
const DEFINITION_ID = "22222222-2222-2222-2222-222222222222";
const RUN_ID = "33333333-3333-3333-3333-333333333333";
const FINDING_ID = "44444444-4444-4444-4444-444444444444";

function definitionFixture(
  overrides: Partial<TechnicalCheckDefinition> = {},
): TechnicalCheckDefinition {
  return {
    id: DEFINITION_ID,
    projectId: PROJECT_ID,
    publicId: "TCD-1",
    name: "Lint the main branch",
    checkType: "linting",
    mode: "manual",
    target: null,
    environment: null,
    scheduleCron: null,
    isEnabled: true,
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-09-02T00:00:00.000Z",
    updatedAt: "2026-09-02T00:00:00.000Z",
    ...overrides,
  };
}

function runFixture(overrides: Partial<TechnicalCheckRun> = {}): TechnicalCheckRun {
  return {
    id: RUN_ID,
    projectId: PROJECT_ID,
    publicId: "TCR-1",
    technicalCheckDefinitionId: DEFINITION_ID,
    status: "requested",
    triggerType: "manual",
    startedAt: null,
    completedAt: null,
    errorSummary: null,
    requestedBy: null,
    createdAt: "2026-09-02T00:00:00.000Z",
    updatedAt: "2026-09-02T00:00:00.000Z",
    ...overrides,
  };
}

function findingFixture(overrides: Partial<TechnicalFinding> = {}): TechnicalFinding {
  return {
    id: FINDING_ID,
    projectId: PROJECT_ID,
    publicId: "TCF-1",
    technicalCheckRunId: RUN_ID,
    category: null,
    severity: "medium",
    title: "Unused import",
    description: null,
    location: null,
    status: "open",
    resolvedBy: null,
    resolvedAt: null,
    createdAt: "2026-09-02T00:00:00.000Z",
    updatedAt: "2026-09-02T00:00:00.000Z",
    ...overrides,
  };
}

describe("parseTechnicalCheckDefinitionsSearchParams", () => {
  it("defaults to no filters, offset 0, pageSize 20 when nothing is provided", () => {
    expect(parseTechnicalCheckDefinitionsSearchParams(PROJECT_ID, {})).toEqual({
      projectId: PROJECT_ID,
      checkType: null,
      isEnabled: null,
      search: null,
      offset: 0,
      pageSize: 20,
    });
  });

  it("parses valid checkType/isEnabled/search/offset/pageSize values", () => {
    expect(
      parseTechnicalCheckDefinitionsSearchParams(PROJECT_ID, {
        checkType: "accessibility",
        isEnabled: "false",
        search: "main branch",
        offset: "40",
        pageSize: "50",
      }),
    ).toEqual({
      projectId: PROJECT_ID,
      checkType: "accessibility",
      isEnabled: false,
      search: "main branch",
      offset: 40,
      pageSize: 50,
    });
  });

  it("treats isEnabled=true distinctly from the default null (all)", () => {
    expect(
      parseTechnicalCheckDefinitionsSearchParams(PROJECT_ID, { isEnabled: "true" }).isEnabled,
    ).toBe(true);
  });

  it("falls back to null for an unrecognized checkType, and to defaults for a negative/garbled offset", () => {
    expect(
      parseTechnicalCheckDefinitionsSearchParams(PROJECT_ID, {
        checkType: "not_a_real_type",
        offset: "-5",
      }),
    ).toEqual({
      projectId: PROJECT_ID,
      checkType: null,
      isEnabled: null,
      search: null,
      offset: 0,
      pageSize: 20,
    });
  });

  it("clamps search to 255 characters", () => {
    const long = "a".repeat(300);
    expect(
      parseTechnicalCheckDefinitionsSearchParams(PROJECT_ID, { search: long }).search,
    ).toHaveLength(255);
  });
});

describe("buildTechnicalCheckDefinitionsHref", () => {
  const base = parseTechnicalCheckDefinitionsSearchParams(PROJECT_ID, {});

  it("always includes projectId first", () => {
    expect(buildTechnicalCheckDefinitionsHref(base, {})).toBe(
      `/technical-center?projectId=${PROJECT_ID}`,
    );
  });

  it("resets offset to 0 when a non-offset field changes", () => {
    const withOffset = { ...base, offset: 40 };
    expect(buildTechnicalCheckDefinitionsHref(withOffset, { checkType: "security" })).toBe(
      `/technical-center?projectId=${PROJECT_ID}&checkType=security`,
    );
  });

  it("preserves an explicit offset override", () => {
    expect(buildTechnicalCheckDefinitionsHref(base, { offset: 20 })).toBe(
      `/technical-center?projectId=${PROJECT_ID}&offset=20`,
    );
  });

  it("only sets pageSize when it differs from the default", () => {
    expect(buildTechnicalCheckDefinitionsHref(base, { pageSize: 20 })).not.toContain("pageSize");
    expect(buildTechnicalCheckDefinitionsHref(base, { pageSize: 50 })).toContain("pageSize=50");
  });
});

describe("technicalCheckRunStatusBadge / technicalFindingSeverityBadge / technicalFindingStatusBadge", () => {
  it("maps every TechnicalCheckRunStatus to a token/label pair", () => {
    expect(technicalCheckRunStatusBadge("completed")).toEqual({
      token: "healthy",
      label: "Completed",
    });
    expect(technicalCheckRunStatusBadge("running")).toEqual({
      token: "degraded",
      label: "Running",
    });
    expect(technicalCheckRunStatusBadge("failed").token).toBe("unavailable");
    expect(technicalCheckRunStatusBadge("requested").token).toBe("notConfigured");
  });

  it("maps every TechnicalFindingSeverity to a token/label pair", () => {
    expect(technicalFindingSeverityBadge("critical").token).toBe("unavailable");
    expect(technicalFindingSeverityBadge("medium").token).toBe("degraded");
    expect(technicalFindingSeverityBadge("info").token).toBe("notConfigured");
  });

  it("maps every TechnicalFindingStatus to a token/label pair", () => {
    expect(technicalFindingStatusBadge("resolved")).toEqual({
      token: "healthy",
      label: "Resolved",
    });
    expect(technicalFindingStatusBadge("open").token).toBe("notConfigured");
    expect(technicalFindingStatusBadge("dismissed").token).toBe("unavailable");
  });
});

describe("getTechnicalCheckDefinitions", () => {
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
      getTechnicalCheckDefinitions(parseTechnicalCheckDefinitionsSearchParams(PROJECT_ID, {})),
    ).rejects.toThrow(/status 500/);
  });

  it("requests pageSize + 1 rows and slices/flags hasNextPage from the extra row", async () => {
    const pageSize = 10;
    const items = Array.from({ length: pageSize + 1 }, (_, index) =>
      definitionFixture({ id: String(index + 1) }),
    );
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: items, correlationId: "c1" }),
    } as Response);

    const result = await getTechnicalCheckDefinitions(
      parseTechnicalCheckDefinitionsSearchParams(PROJECT_ID, { pageSize: String(pageSize) }),
    );

    expect(result.items).toHaveLength(pageSize);
    expect(result.hasNextPage).toBe(true);
    const [url] = vi.mocked(global.fetch).mock.calls[0] as [string];
    expect(url).toContain(`/technical-center/projects/${PROJECT_ID}/definitions?`);
    expect(url).toContain(`limit=${pageSize + 1}`);
  });
});

describe("getTechnicalCheckDefinition", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    vi.mocked(cookies).mockResolvedValue({ toString: () => "sid=abc" } as never);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns null for a malformed projectId/definitionId without issuing a network call", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;
    expect(await getTechnicalCheckDefinition("not-a-uuid", DEFINITION_ID)).toBeNull();
    expect(await getTechnicalCheckDefinition(PROJECT_ID, "not-a-uuid")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns null on a 404", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response);
    expect(await getTechnicalCheckDefinition(PROJECT_ID, DEFINITION_ID)).toBeNull();
  });

  it("throws on a non-404 non-OK response", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);
    await expect(getTechnicalCheckDefinition(PROJECT_ID, DEFINITION_ID)).rejects.toThrow(
      /status 500/,
    );
  });

  it("returns the definition on success", async () => {
    const definition = definitionFixture();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: definition, correlationId: "c1" }),
    } as Response);
    expect(await getTechnicalCheckDefinition(PROJECT_ID, DEFINITION_ID)).toEqual(definition);
  });
});

describe("getTechnicalCheckRunsForDefinition / getTechnicalFindingsForRun", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    vi.mocked(cookies).mockResolvedValue({ toString: () => "sid=abc" } as never);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("getTechnicalCheckRunsForDefinition degrades to [] on a malformed id, a 404, or a non-OK status (never throws)", async () => {
    global.fetch = vi.fn() as typeof fetch;
    expect(await getTechnicalCheckRunsForDefinition("not-a-uuid", DEFINITION_ID)).toEqual([]);

    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response);
    expect(await getTechnicalCheckRunsForDefinition(PROJECT_ID, DEFINITION_ID)).toEqual([]);

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);
    expect(await getTechnicalCheckRunsForDefinition(PROJECT_ID, DEFINITION_ID)).toEqual([]);
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("getTechnicalCheckRunsForDefinition returns the run list and threads technicalCheckDefinitionId through the query", async () => {
    const run = runFixture();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [run], correlationId: "c1" }),
    } as Response);

    expect(await getTechnicalCheckRunsForDefinition(PROJECT_ID, DEFINITION_ID)).toEqual([run]);
    const [url] = vi.mocked(global.fetch).mock.calls[0] as [string];
    expect(url).toContain(`technicalCheckDefinitionId=${DEFINITION_ID}`);
  });

  it("getTechnicalFindingsForRun returns the finding list and threads technicalCheckRunId through the query", async () => {
    const finding = findingFixture();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [finding], correlationId: "c1" }),
    } as Response);

    expect(await getTechnicalFindingsForRun(PROJECT_ID, RUN_ID)).toEqual([finding]);
    const [url] = vi.mocked(global.fetch).mock.calls[0] as [string];
    expect(url).toContain(`technicalCheckRunId=${RUN_ID}`);
  });
});

describe("getTechnicalCheckRun / getTechnicalFinding", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    vi.mocked(cookies).mockResolvedValue({ toString: () => "sid=abc" } as never);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("getTechnicalCheckRun returns null for a malformed id, null on a 404, throws otherwise, and returns the run on success", async () => {
    global.fetch = vi.fn() as typeof fetch;
    expect(await getTechnicalCheckRun("not-a-uuid", RUN_ID)).toBeNull();

    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response);
    expect(await getTechnicalCheckRun(PROJECT_ID, RUN_ID)).toBeNull();

    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);
    await expect(getTechnicalCheckRun(PROJECT_ID, RUN_ID)).rejects.toThrow(/status 500/);

    const run = runFixture();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: run, correlationId: "c1" }),
    } as Response);
    expect(await getTechnicalCheckRun(PROJECT_ID, RUN_ID)).toEqual(run);
  });

  it("getTechnicalFinding returns null for a malformed id, null on a 404, throws otherwise, and returns the finding on success", async () => {
    global.fetch = vi.fn() as typeof fetch;
    expect(await getTechnicalFinding("not-a-uuid", FINDING_ID)).toBeNull();

    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response);
    expect(await getTechnicalFinding(PROJECT_ID, FINDING_ID)).toBeNull();

    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);
    await expect(getTechnicalFinding(PROJECT_ID, FINDING_ID)).rejects.toThrow(/status 500/);

    const finding = findingFixture();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: finding, correlationId: "c1" }),
    } as Response);
    expect(await getTechnicalFinding(PROJECT_ID, FINDING_ID)).toEqual(finding);
  });
});
