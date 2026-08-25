import type {
  PageArtifactEntity,
  PageArtifactRepository,
  PageArtifactType,
  PageArtifactVersionEntity,
  PageArtifactVersionRepository,
  PageArtifactVersionStatus,
} from "@webdesk/database";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditService } from "../audit/audit.service.js";
import type { AuthorizationService } from "../authz/authorization.service.js";
import type { PagesService } from "../page-inventory/pages.service.js";
import { PageArtifactsService } from "./page-artifacts.service.js";

// withTransaction() opens a real Sequelize connection (needs DATABASE_URL) — irrelevant to this
// service's own logic, so it's stubbed to just invoke the callback, matching
// project.service.spec.ts's own already-established approach.
vi.mock("@webdesk/database", async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports -- vitest's importOriginal<T>() needs the actual module's type inline; no top-level type-only equivalent exists for this generic parameter.
  const actual = await importOriginal<typeof import("@webdesk/database")>();
  return {
    ...actual,
    withTransaction: vi.fn((fn: (transaction: unknown) => unknown) =>
      fn({ fakeTransaction: true }),
    ),
  };
});

const NOW = new Date("2026-08-25T00:00:00.000Z");
const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const PAGE_ID = "22222222-2222-4222-8222-222222222222";
const ARTIFACT_ID = "33333333-3333-4333-8333-333333333333";
const VERSION_ID = "44444444-4444-4444-8444-444444444444";
const ACTOR = "55555555-5555-4555-8555-555555555555";

function artifact(overrides: Partial<PageArtifactEntity> = {}): PageArtifactEntity {
  return {
    id: ARTIFACT_ID,
    pageId: PAGE_ID,
    projectId: PROJECT_ID,
    artifactType: "content",
    currentVersionId: VERSION_ID,
    createdBy: ACTOR,
    updatedBy: ACTOR,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

function version(overrides: Partial<PageArtifactVersionEntity> = {}): PageArtifactVersionEntity {
  return {
    id: VERSION_ID,
    artifactId: ARTIFACT_ID,
    pageId: PAGE_ID,
    projectId: PROJECT_ID,
    versionNumber: 1,
    status: "draft",
    content: "<p>draft</p>",
    notes: null,
    repository: null,
    path: null,
    branch: null,
    commitSha: null,
    contentChecksum: null,
    reopenedReason: null,
    reopenedFromVersionId: null,
    approvedByUserId: null,
    approvedAt: null,
    createdBy: ACTOR,
    updatedBy: ACTOR,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("PageArtifactsService", () => {
  let artifacts: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    findByPageAndType: ReturnType<typeof vi.fn>;
    listForPage: ReturnType<typeof vi.fn>;
    setCurrentVersion: ReturnType<typeof vi.fn>;
  };
  let versions: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    listForArtifact: ReturnType<typeof vi.fn>;
    findLatestVersionNumber: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateStatus: ReturnType<typeof vi.fn>;
  };
  let authorizationService: { assertAllowed: ReturnType<typeof vi.fn> };
  let auditService: { record: ReturnType<typeof vi.fn> };
  let pagesService: { existsInProject: ReturnType<typeof vi.fn> };
  let svc: PageArtifactsService;

  beforeEach(() => {
    artifacts = {
      create: vi.fn(),
      findById: vi.fn().mockResolvedValue(artifact()),
      findByPageAndType: vi.fn(),
      listForPage: vi.fn(),
      setCurrentVersion: vi.fn().mockResolvedValue(artifact()),
    };
    versions = {
      create: vi.fn(),
      findById: vi.fn(),
      listForArtifact: vi.fn(),
      findLatestVersionNumber: vi.fn(),
      update: vi.fn(),
      updateStatus: vi.fn(),
    };
    authorizationService = { assertAllowed: vi.fn() };
    auditService = { record: vi.fn() };
    pagesService = { existsInProject: vi.fn().mockResolvedValue(true) };
    svc = new PageArtifactsService(
      artifacts as unknown as PageArtifactRepository,
      versions as unknown as PageArtifactVersionRepository,
      authorizationService as unknown as AuthorizationService,
      auditService as unknown as AuditService,
      pagesService as unknown as PagesService,
    );
  });

  /** Task package D2 — the single most important authorization behaviour in this module. */
  describe("per-artifact-type permission groups (D2)", () => {
    const cases: ReadonlyArray<readonly [PageArtifactType, string]> = [
      ["content", "page_content"],
      ["ui_specification", "creative_design"],
      ["implementation", "development_code"],
      ["qa", "security_qa"],
    ];

    it.each(cases)(
      "checks the %s artifact against its own group (%s), not the module baseline",
      async (artifactType, expectedGroup) => {
        artifacts.findById.mockResolvedValue(artifact({ artifactType }));
        versions.findById.mockResolvedValue(version());
        versions.update.mockResolvedValue(version({ content: "<p>edited</p>" }));

        await svc.updateVersion(ACTOR, PROJECT_ID, PAGE_ID, ARTIFACT_ID, VERSION_ID, {
          content: "<p>edited</p>",
        });

        expect(authorizationService.assertAllowed).toHaveBeenCalledWith(
          ACTOR,
          expectedGroup,
          "edit",
          PROJECT_ID,
        );
      },
    );
  });

  /** Task package D7 / `04_Data_Model_and_Ownership.md §5`. */
  describe("approved versions are immutable (D7)", () => {
    it.each(["approved", "submitted", "under_review", "superseded", "archived"] as const)(
      "refuses an in-place edit of a %s version",
      async (status: PageArtifactVersionStatus) => {
        versions.findById.mockResolvedValue(version({ status }));

        await expect(
          svc.updateVersion(ACTOR, PROJECT_ID, PAGE_ID, ARTIFACT_ID, VERSION_ID, {
            content: "<p>sneaky</p>",
          }),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(versions.update).not.toHaveBeenCalled();
      },
    );

    it("passes a draft-only compare-and-swap guard to the repository write", async () => {
      versions.findById.mockResolvedValue(version({ status: "draft" }));
      versions.update.mockResolvedValue(version());

      await svc.updateVersion(ACTOR, PROJECT_ID, PAGE_ID, ARTIFACT_ID, VERSION_ID, {
        content: "<p>edited</p>",
      });

      // Defence in depth: even if a transition lands between the read above and this write, the
      // CAS guard makes the edit lose rather than silently overwrite an approved version.
      expect(versions.update).toHaveBeenCalledWith(
        VERSION_ID,
        PROJECT_ID,
        expect.anything(),
        "draft",
      );
    });

    it("reports a lost edit race as a conflict", async () => {
      versions.findById.mockResolvedValue(version({ status: "draft" }));
      versions.update.mockResolvedValue(null);

      await expect(
        svc.updateVersion(ACTOR, PROJECT_ID, PAGE_ID, ARTIFACT_ID, VERSION_ID, {
          content: "<p>edited</p>",
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("sanitizes rich-text content before it reaches the repository", async () => {
      versions.findById.mockResolvedValue(version({ status: "draft" }));
      versions.update.mockResolvedValue(version());

      await svc.updateVersion(ACTOR, PROJECT_ID, PAGE_ID, ARTIFACT_ID, VERSION_ID, {
        content: "<p>ok</p><script>alert(1)</script>",
      });

      const [, , patch] = versions.update.mock.calls[0] as [string, string, { content: string }];
      expect(patch.content).not.toContain("<script>");
      expect(patch.content).toContain("<p>ok</p>");
    });
  });

  describe("version status transitions", () => {
    it("demands the action the transition table names, in the artifact's own group", async () => {
      // An Implementation artifact: `development_code` gives `developer` VCES (submit, no
      // approve) and `qa_security_reviewer` VRA (approve, no submit) — the separation of duties
      // this mapping is designed to produce.
      artifacts.findById.mockResolvedValue(artifact({ artifactType: "implementation" }));
      versions.findById.mockResolvedValue(version({ status: "under_review" }));
      versions.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: version({ status: "approved" }),
      });

      await svc.changeVersionStatus(ACTOR, PROJECT_ID, PAGE_ID, ARTIFACT_ID, VERSION_ID, {
        status: "approved",
      });

      expect(authorizationService.assertAllowed).toHaveBeenCalledWith(
        ACTOR,
        "development_code",
        "approve",
        PROJECT_ID,
      );
    });

    it("rejects a transition the allowlist does not contain", async () => {
      versions.findById.mockResolvedValue(version({ status: "draft" }));

      await expect(
        svc.changeVersionStatus(ACTOR, PROJECT_ID, PAGE_ID, ARTIFACT_ID, VERSION_ID, {
          status: "approved",
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(versions.updateStatus).not.toHaveBeenCalled();
    });

    it.each(["superseded", "archived"] as const)(
      "treats %s as permanently terminal",
      async (status: PageArtifactVersionStatus) => {
        versions.findById.mockResolvedValue(version({ status }));

        await expect(
          svc.changeVersionStatus(ACTOR, PROJECT_ID, PAGE_ID, ARTIFACT_ID, VERSION_ID, {
            status: "draft",
          }),
        ).rejects.toBeInstanceOf(BadRequestException);
      },
    );

    it("records an approval with the exact version number, per §12", async () => {
      versions.findById.mockResolvedValue(version({ status: "under_review", versionNumber: 3 }));
      versions.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: version({ status: "approved", versionNumber: 3 }),
      });

      await svc.changeVersionStatus(ACTOR, PROJECT_ID, PAGE_ID, ARTIFACT_ID, VERSION_ID, {
        status: "approved",
      });

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "approval",
          retentionCategory: "approval-audit-7y",
          entityType: "page_artifact_version",
          entityVersion: 3,
        }),
      );
    });
  });

  describe("reopen (D7)", () => {
    it("supersedes the approved version and forks the next one as a draft, carrying the reason", async () => {
      versions.findById.mockResolvedValue(
        version({ status: "approved", versionNumber: 2, content: "<p>approved copy</p>" }),
      );
      versions.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: version({ status: "superseded", versionNumber: 2 }),
      });
      versions.findLatestVersionNumber.mockResolvedValue(2);
      versions.create.mockResolvedValue(version({ id: "new-version", versionNumber: 3 }));

      await svc.reopen(ACTOR, PROJECT_ID, PAGE_ID, ARTIFACT_ID, VERSION_ID, {
        reason: "client changed the offer",
      });

      expect(versions.updateStatus).toHaveBeenCalledWith(
        VERSION_ID,
        PROJECT_ID,
        "approved",
        "superseded",
        ACTOR,
        expect.anything(),
      );
      const [created] = versions.create.mock.calls[0] as [Record<string, unknown>];
      expect(created).toMatchObject({
        versionNumber: 3,
        status: "draft",
        content: "<p>approved copy</p>",
        reopenedReason: "client changed the offer",
        reopenedFromVersionId: VERSION_ID,
      });
    });

    it("points the artifact at the newly created version", async () => {
      versions.findById.mockResolvedValue(version({ status: "approved", versionNumber: 1 }));
      versions.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: version({ status: "superseded" }),
      });
      versions.findLatestVersionNumber.mockResolvedValue(1);
      versions.create.mockResolvedValue(version({ id: "new-version", versionNumber: 2 }));

      await svc.reopen(ACTOR, PROJECT_ID, PAGE_ID, ARTIFACT_ID, VERSION_ID, { reason: "why" });

      expect(artifacts.setCurrentVersion).toHaveBeenCalledWith(
        ARTIFACT_ID,
        PROJECT_ID,
        "new-version",
        ACTOR,
        expect.anything(),
      );
    });

    it.each(["draft", "submitted", "under_review", "rejected"] as const)(
      "refuses to reopen a %s version — only an approved one can be reopened",
      async (status: PageArtifactVersionStatus) => {
        versions.findById.mockResolvedValue(version({ status }));

        await expect(
          svc.reopen(ACTOR, PROJECT_ID, PAGE_ID, ARTIFACT_ID, VERSION_ID, { reason: "why" }),
        ).rejects.toBeInstanceOf(BadRequestException);
      },
    );
  });

  describe("scoping and IDOR prevention", () => {
    it("refuses to reach a version through an artifact it does not belong to", async () => {
      artifacts.findById.mockResolvedValue(artifact());
      versions.findById.mockResolvedValue(version({ artifactId: "a-different-artifact" }));

      await expect(
        svc.updateVersion(ACTOR, PROJECT_ID, PAGE_ID, ARTIFACT_ID, VERSION_ID, {
          content: "<p>x</p>",
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("refuses to reach an artifact through a page it does not belong to", async () => {
      artifacts.findById.mockResolvedValue(artifact({ pageId: "a-different-page" }));

      await expect(
        svc.updateVersion(ACTOR, PROJECT_ID, PAGE_ID, ARTIFACT_ID, VERSION_ID, {
          content: "<p>x</p>",
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("refuses to create an artifact against a page in another project", async () => {
      pagesService.existsInProject.mockResolvedValue(false);

      await expect(
        svc.createArtifact(ACTOR, PROJECT_ID, PAGE_ID, { artifactType: "content" }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(artifacts.create).not.toHaveBeenCalled();
    });
  });

  describe("createArtifact", () => {
    it("creates the artifact with a first draft version and links them together", async () => {
      artifacts.create.mockResolvedValue(artifact({ currentVersionId: null }));
      versions.create.mockResolvedValue(version({ versionNumber: 1 }));

      const result = await svc.createArtifact(ACTOR, PROJECT_ID, PAGE_ID, {
        artifactType: "content",
        content: "<p>first</p>",
      });

      expect(result.version.versionNumber).toBe(1);
      const [created] = versions.create.mock.calls[0] as [Record<string, unknown>];
      expect(created).toMatchObject({ versionNumber: 1, status: "draft" });
      expect(artifacts.setCurrentVersion).toHaveBeenCalled();
    });

    it("maps the unique-index violation for a duplicate tab to a conflict, not a raw 500", async () => {
      const uniqueViolation = new Error("Validation error");
      uniqueViolation.name = "SequelizeUniqueConstraintError";
      artifacts.create.mockRejectedValue(uniqueViolation);

      await expect(
        svc.createArtifact(ACTOR, PROJECT_ID, PAGE_ID, { artifactType: "content" }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
