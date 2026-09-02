import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { cookies } from "next/headers";
import type { ScanDefinition, ScanEvidence, ScanFinding, ScanRun } from "@webdesk/shared-types";
import {
  buildScanDefinitionsHref,
  getScanDefinition,
  getScanDefinitions,
  getScanEvidenceForFinding,
  getScanFinding,
  getScanFindingsForRun,
  getScanRun,
  getScanRunsForDefinition,
  parseScanDefinitionsSearchParams,
  scanFindingSeverityBadge,
  scanFindingStatusBadge,
  scanRunStatusBadge,
} from "../../lib/scan-center.js";

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";
const DEFINITION_ID = "22222222-2222-2222-2222-222222222222";
const RUN_ID = "33333333-3333-3333-3333-333333333333";
const FINDING_ID = "44444444-4444-4444-4444-444444444444";

function definitionFixture(overrides: Partial<ScanDefinition> = {}): ScanDefinition {
  return {
    id: DEFINITION_ID,
    projectId: PROJECT_ID,
    publicId: "SCAN-1",
    name: "Homepage accessibility scan",
    scanType: "accessibility",
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

function runFixture(overrides: Partial<ScanRun> = {}): ScanRun {
  return {
    id: RUN_ID,
    projectId: PROJECT_ID,
    publicId: "RUN-1",
    scanDefinitionId: DEFINITION_ID,
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

function findingFixture(overrides: Partial<ScanFinding> = {}): ScanFinding {
  return {
    id: FINDING_ID,
    projectId: PROJECT_ID,
    publicId: "FND-1",
    scanRunId: RUN_ID,
    category: null,
    severity: "medium",
    title: "Missing alt text",
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

function evidenceFixture(overrides: Partial<ScanEvidence> = {}): ScanEvidence {
  return {
    id: "55555555-5555-5555-5555-555555555555",
    projectId: PROJECT_ID,
    publicId: "EVD-1",
    scanFindingId: FINDING_ID,
    evidenceType: "screenshot",
    reference: "https://example.com/evidence.png",
    notes: null,
    capturedAt: null,
    createdBy: null,
    createdAt: "2026-09-02T00:00:00.000Z",
    updatedAt: "2026-09-02T00:00:00.000Z",
    ...overrides,
  };
}

describe("parseScanDefinitionsSearchParams", () => {
  it("defaults to no filters, offset 0, pageSize 20 when nothing is provided", () => {
    expect(parseScanDefinitionsSearchParams(PROJECT_ID, {})).toEqual({
      projectId: PROJECT_ID,
      scanType: null,
      isEnabled: null,
      search: null,
      offset: 0,
      pageSize: 20,
    });
  });

  it("parses valid scanType/isEnabled/search/offset/pageSize values", () => {
    expect(
      parseScanDefinitionsSearchParams(PROJECT_ID, {
        scanType: "accessibility",
        isEnabled: "false",
        search: "homepage",
        offset: "40",
        pageSize: "50",
      }),
    ).toEqual({
      projectId: PROJECT_ID,
      scanType: "accessibility",
      isEnabled: false,
      search: "homepage",
      offset: 40,
      pageSize: 50,
    });
  });

  it("treats isEnabled=true distinctly from the default null (all)", () => {
    expect(parseScanDefinitionsSearchParams(PROJECT_ID, { isEnabled: "true" }).isEnabled).toBe(
      true,
    );
  });

  it("falls back to null for an unrecognized scanType, and to defaults for a negative/garbled offset", () => {
    expect(
      parseScanDefinitionsSearchParams(PROJECT_ID, {
        scanType: "not_a_real_type",
        offset: "-5",
      }),
    ).toEqual({
      projectId: PROJECT_ID,
      scanType: null,
      isEnabled: null,
      search: null,
      offset: 0,
      pageSize: 20,
    });
  });

  it("clamps search to 255 characters", () => {
    const long = "a".repeat(300);
    expect(parseScanDefinitionsSearchParams(PROJECT_ID, { search: long }).search).toHaveLength(255);
  });
});

describe("buildScanDefinitionsHref", () => {
  const base = parseScanDefinitionsSearchParams(PROJECT_ID, {});

  it("always includes projectId first", () => {
    expect(buildScanDefinitionsHref(base, {})).toBe(`/scan-center?projectId=${PROJECT_ID}`);
  });

  it("resets offset to 0 when a non-offset field changes", () => {
    const withOffset = { ...base, offset: 40 };
    expect(buildScanDefinitionsHref(withOffset, { scanType: "links" })).toBe(
      `/scan-center?projectId=${PROJECT_ID}&scanType=links`,
    );
  });

  it("preserves an explicit offset override", () => {
    expect(buildScanDefinitionsHref(base, { offset: 20 })).toBe(
      `/scan-center?projectId=${PROJECT_ID}&offset=20`,
    );
  });

  it("only sets pageSize when it differs from the default", () => {
    expect(buildScanDefinitionsHref(base, { pageSize: 20 })).not.toContain("pageSize");
    expect(buildScanDefinitionsHref(base, { pageSize: 50 })).toContain("pageSize=50");
  });
});

describe("scanRunStatusBadge / scanFindingSeverityBadge / scanFindingStatusBadge", () => {
  it("maps every ScanRunStatus to a token/label pair", () => {
    expect(scanRunStatusBadge("completed")).toEqual({ token: "healthy", label: "Completed" });
    expect(scanRunStatusBadge("running")).toEqual({ token: "degraded", label: "Running" });
    expect(scanRunStatusBadge("failed").token).toBe("unavailable");
    expect(scanRunStatusBadge("requested").token).toBe("notConfigured");
  });

  it("maps every ScanFindingSeverity to a token/label pair", () => {
    expect(scanFindingSeverityBadge("critical").token).toBe("unavailable");
    expect(scanFindingSeverityBadge("medium").token).toBe("degraded");
    expect(scanFindingSeverityBadge("info").token).toBe("notConfigured");
  });

  it("maps every ScanFindingStatus to a token/label pair", () => {
    expect(scanFindingStatusBadge("resolved")).toEqual({ token: "healthy", label: "Resolved" });
    expect(scanFindingStatusBadge("open").token).toBe("notConfigured");
    expect(scanFindingStatusBadge("dismissed").token).toBe("unavailable");
  });
});

describe("getScanDefinitions", () => {
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
      getScanDefinitions(parseScanDefinitionsSearchParams(PROJECT_ID, {})),
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

    const result = await getScanDefinitions(
      parseScanDefinitionsSearchParams(PROJECT_ID, { pageSize: String(pageSize) }),
    );

    expect(result.items).toHaveLength(pageSize);
    expect(result.hasNextPage).toBe(true);
    const [url] = vi.mocked(global.fetch).mock.calls[0] as [string];
    expect(url).toContain(`/scan-center/projects/${PROJECT_ID}/definitions?`);
    expect(url).toContain(`limit=${pageSize + 1}`);
  });
});

describe("getScanDefinition", () => {
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
    expect(await getScanDefinition("not-a-uuid", DEFINITION_ID)).toBeNull();
    expect(await getScanDefinition(PROJECT_ID, "not-a-uuid")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns null on a 404", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response);
    expect(await getScanDefinition(PROJECT_ID, DEFINITION_ID)).toBeNull();
  });

  it("throws on a non-404 non-OK response", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);
    await expect(getScanDefinition(PROJECT_ID, DEFINITION_ID)).rejects.toThrow(/status 500/);
  });

  it("returns the definition on success", async () => {
    const definition = definitionFixture();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: definition, correlationId: "c1" }),
    } as Response);
    expect(await getScanDefinition(PROJECT_ID, DEFINITION_ID)).toEqual(definition);
  });
});

describe("getScanRunsForDefinition / getScanFindingsForRun / getScanEvidenceForFinding", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    vi.mocked(cookies).mockResolvedValue({ toString: () => "sid=abc" } as never);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("getScanRunsForDefinition degrades to [] on a malformed id, a 404, or a non-OK status (never throws)", async () => {
    global.fetch = vi.fn() as typeof fetch;
    expect(await getScanRunsForDefinition("not-a-uuid", DEFINITION_ID)).toEqual([]);

    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response);
    expect(await getScanRunsForDefinition(PROJECT_ID, DEFINITION_ID)).toEqual([]);

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);
    expect(await getScanRunsForDefinition(PROJECT_ID, DEFINITION_ID)).toEqual([]);
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("getScanRunsForDefinition returns the run list and threads scanDefinitionId through the query", async () => {
    const run = runFixture();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [run], correlationId: "c1" }),
    } as Response);

    expect(await getScanRunsForDefinition(PROJECT_ID, DEFINITION_ID)).toEqual([run]);
    const [url] = vi.mocked(global.fetch).mock.calls[0] as [string];
    expect(url).toContain(`scanDefinitionId=${DEFINITION_ID}`);
  });

  it("getScanFindingsForRun returns the finding list and threads scanRunId through the query", async () => {
    const finding = findingFixture();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [finding], correlationId: "c1" }),
    } as Response);

    expect(await getScanFindingsForRun(PROJECT_ID, RUN_ID)).toEqual([finding]);
    const [url] = vi.mocked(global.fetch).mock.calls[0] as [string];
    expect(url).toContain(`scanRunId=${RUN_ID}`);
  });

  it("getScanEvidenceForFinding returns the evidence list", async () => {
    const evidence = evidenceFixture();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [evidence], correlationId: "c1" }),
    } as Response);

    expect(await getScanEvidenceForFinding(PROJECT_ID, FINDING_ID)).toEqual([evidence]);
    const [url] = vi.mocked(global.fetch).mock.calls[0] as [string];
    expect(url).toContain(`/findings/${FINDING_ID}/evidence?`);
  });
});

describe("getScanRun / getScanFinding", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    vi.mocked(cookies).mockResolvedValue({ toString: () => "sid=abc" } as never);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("getScanRun returns null for a malformed id, null on a 404, throws otherwise, and returns the run on success", async () => {
    global.fetch = vi.fn() as typeof fetch;
    expect(await getScanRun("not-a-uuid", RUN_ID)).toBeNull();

    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response);
    expect(await getScanRun(PROJECT_ID, RUN_ID)).toBeNull();

    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);
    await expect(getScanRun(PROJECT_ID, RUN_ID)).rejects.toThrow(/status 500/);

    const run = runFixture();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: run, correlationId: "c1" }),
    } as Response);
    expect(await getScanRun(PROJECT_ID, RUN_ID)).toEqual(run);
  });

  it("getScanFinding returns null for a malformed id, null on a 404, throws otherwise, and returns the finding on success", async () => {
    global.fetch = vi.fn() as typeof fetch;
    expect(await getScanFinding("not-a-uuid", FINDING_ID)).toBeNull();

    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response);
    expect(await getScanFinding(PROJECT_ID, FINDING_ID)).toBeNull();

    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);
    await expect(getScanFinding(PROJECT_ID, FINDING_ID)).rejects.toThrow(/status 500/);

    const finding = findingFixture();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: finding, correlationId: "c1" }),
    } as Response);
    expect(await getScanFinding(PROJECT_ID, FINDING_ID)).toEqual(finding);
  });
});
