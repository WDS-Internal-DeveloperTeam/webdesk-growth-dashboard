import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Keyword } from "@webdesk/shared-types";

const { redirectMock, notFoundMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  notFoundMock: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  notFound: notFoundMock,
}));

const getServerSessionMock = vi.fn();
vi.mock("@/lib/server-session", () => ({
  getServerSession: () => getServerSessionMock(),
}));

const getProjectMock = vi.fn();
vi.mock("@/lib/projects", () => ({
  getProject: (id: string) => getProjectMock(id),
}));

const getKeywordMock = vi.fn();
vi.mock("@/lib/keyword-and-entity-library", () => ({
  getKeyword: (projectId: string, keywordId: string) => getKeywordMock(projectId, keywordId),
  withProjectId: (path: string, projectId: string) => `${path}?projectId=${projectId}`,
  // Real implementation is a plain no-op passthrough for `.catch()`-purposes only — the mock
  // mirrors that exactly, since the page's own code review fix (parallelizing the project check
  // with the keyword fetch) now depends on this export existing.
  tolerateDiscard: <T,>(promise: Promise<T>): Promise<T> => {
    promise.catch(() => {});
    return promise;
  },
}));

import EditKeywordPage from "../../app/(shell)/keyword-and-entity-library/[keywordId]/edit/page.js";

const PROJECT_ID = "99999999-9999-9999-9999-999999999999";
const KEYWORD_ID = "11111111-1111-1111-1111-111111111111";

function keywordFixture(overrides: Partial<Keyword> = {}): Keyword {
  return {
    id: KEYWORD_ID,
    projectId: PROJECT_ID,
    publicId: "KW-1",
    queryText: "best seo tools",
    keywordType: null,
    intent: null,
    funnelStage: null,
    country: null,
    searchVolume: null,
    difficultyScore: null,
    source: null,
    researchDate: null,
    cannibalizationNotes: null,
    confidence: null,
    approvalStatus: "draft",
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-08-24T00:00:00.000Z",
    updatedAt: "2026-08-24T00:00:00.000Z",
    ...overrides,
  };
}

function args(
  searchParams: Record<string, string | string[] | undefined> = { projectId: PROJECT_ID },
) {
  return {
    params: Promise.resolve({ keywordId: KEYWORD_ID }),
    searchParams: Promise.resolve(searchParams),
  };
}

describe("EditKeywordPage", () => {
  beforeEach(() => {
    getServerSessionMock.mockReset();
    getProjectMock.mockReset();
    getKeywordMock.mockReset();
    redirectMock.mockClear();
    notFoundMock.mockClear();
  });

  it("redirects to the list page's project-picker prompt when projectId is missing/unresolvable", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1" } });
    getProjectMock.mockResolvedValue(null);

    await expect(EditKeywordPage(args({}))).rejects.toThrow("REDIRECT:/keyword-and-entity-library");
    expect(getKeywordMock).not.toHaveBeenCalled();
  });

  it("calls notFound() when the keyword doesn't exist", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1" } });
    getProjectMock.mockResolvedValue({ id: PROJECT_ID, name: "Acme" });
    getKeywordMock.mockResolvedValue(null);

    await expect(EditKeywordPage(args())).rejects.toThrow("NOT_FOUND");
  });

  it.each(["archived", "superseded"] as const)(
    "redirects back to the detail page for a %s keyword instead of rendering a form whose submit is guaranteed to fail",
    async (terminalStatus) => {
      getServerSessionMock.mockResolvedValue({ user: { id: "u1" } });
      getProjectMock.mockResolvedValue({ id: PROJECT_ID, name: "Acme" });
      getKeywordMock.mockResolvedValue(keywordFixture({ approvalStatus: terminalStatus }));

      await expect(EditKeywordPage(args())).rejects.toThrow(
        `REDIRECT:/keyword-and-entity-library/${KEYWORD_ID}?projectId=${PROJECT_ID}`,
      );
    },
  );

  it("renders the form for a non-terminal keyword", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1" } });
    getProjectMock.mockResolvedValue({ id: PROJECT_ID, name: "Acme" });
    getKeywordMock.mockResolvedValue(keywordFixture({ approvalStatus: "draft" }));

    const element = await EditKeywordPage(args());
    expect(element).not.toBeNull();
  });

  it("returns null (no fetches) when there is no session", async () => {
    getServerSessionMock.mockResolvedValue(null);

    const element = await EditKeywordPage(args());
    expect(element).toBeNull();
    expect(getProjectMock).not.toHaveBeenCalled();
  });
});
