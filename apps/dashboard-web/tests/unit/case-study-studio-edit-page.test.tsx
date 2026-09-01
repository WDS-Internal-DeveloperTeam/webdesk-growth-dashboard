import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CaseStudy } from "@webdesk/shared-types";

const { notFoundMock } = vi.hoisted(() => ({
  notFoundMock: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}));

const getServerSessionMock = vi.fn();
vi.mock("@/lib/server-session", () => ({
  getServerSession: () => getServerSessionMock(),
}));

const getCaseStudyMock = vi.fn();
const getServicesForCaseStudyPickerMock = vi.fn();
const getProofClaimsForCaseStudyPickerMock = vi.fn();
vi.mock("@/lib/case-study-studio", () => ({
  getCaseStudy: (id: string) => getCaseStudyMock(id),
  getServicesForCaseStudyPicker: () => getServicesForCaseStudyPickerMock(),
  getProofClaimsForCaseStudyPicker: () => getProofClaimsForCaseStudyPickerMock(),
}));

const getUserMock = vi.fn();
vi.mock("@/lib/users", () => ({
  getUser: (id: string) => getUserMock(id),
}));

vi.mock("@/components/case-study-studio-form", () => ({
  CaseStudyStudioForm: () => null,
}));

import EditCaseStudyPage from "../../app/(shell)/case-study-studio/[caseStudyId]/edit/page.js";

const CASE_STUDY_ID = "22222222-2222-2222-2222-222222222222";
const REVIEWER_ID = "33333333-3333-3333-3333-333333333333";

function caseStudyFixture(overrides: Partial<CaseStudy> = {}): CaseStudy {
  return {
    id: CASE_STUDY_ID,
    publicId: "CS-1",
    clientName: "Acme",
    projectTitle: "Acme growth story",
    industry: null,
    platform: null,
    visibility: "public",
    embargoDate: null,
    challenge: null,
    solution: null,
    implementation: null,
    results: null,
    relatedServiceIds: [],
    relatedClaimIds: [],
    assignedReviewerUserId: REVIEWER_ID,
    clientApprovalRequired: false,
    status: "intake",
    scheduledPublishAt: null,
    publishedAt: null,
    unpublishReason: null,
    version: 1,
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("EditCaseStudyPage — reviewer resolution failure isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServerSessionMock.mockResolvedValue({ user: { id: "session-user" } });
    getServicesForCaseStudyPickerMock.mockResolvedValue([]);
    getProofClaimsForCaseStudyPickerMock.mockResolvedValue([]);
  });

  it("does not crash when getUser() throws (e.g. a 403 from a caller lacking users_roles:view)", async () => {
    getCaseStudyMock.mockResolvedValue(caseStudyFixture());
    getUserMock.mockRejectedValue(new Error("Failed to load user (status 403)"));

    // Regression test for a code-review finding: the reviewer lookup was previously an unguarded
    // `getUser()` call inside a `Promise.all`, so any non-404 failure (most roles lack
    // `users_roles:view`) crashed the whole edit page instead of degrading to an unresolved
    // reviewer, the same guard `ProjectForm`'s own edit page already applies.
    await expect(
      EditCaseStudyPage({ params: Promise.resolve({ caseStudyId: CASE_STUDY_ID }) }),
    ).resolves.toBeDefined();
  });

  it("resolves the reviewer normally when getUser() succeeds", async () => {
    getCaseStudyMock.mockResolvedValue(caseStudyFixture());
    getUserMock.mockResolvedValue({
      id: REVIEWER_ID,
      displayName: "Jamie Reviewer",
      email: "jamie@example.com",
    });

    await expect(
      EditCaseStudyPage({ params: Promise.resolve({ caseStudyId: CASE_STUDY_ID }) }),
    ).resolves.toBeDefined();
    expect(getUserMock).toHaveBeenCalledWith(REVIEWER_ID);
  });

  it("skips the reviewer lookup entirely when no reviewer is assigned", async () => {
    getCaseStudyMock.mockResolvedValue(caseStudyFixture({ assignedReviewerUserId: null }));

    await EditCaseStudyPage({ params: Promise.resolve({ caseStudyId: CASE_STUDY_ID }) });
    expect(getUserMock).not.toHaveBeenCalled();
  });

  it("calls notFound() when the case study does not exist", async () => {
    getCaseStudyMock.mockResolvedValue(null);

    await expect(
      EditCaseStudyPage({ params: Promise.resolve({ caseStudyId: CASE_STUDY_ID }) }),
    ).rejects.toThrow("NOT_FOUND");
  });
});
