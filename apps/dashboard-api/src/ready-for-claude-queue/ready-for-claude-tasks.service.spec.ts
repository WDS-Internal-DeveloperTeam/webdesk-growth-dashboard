import type { ReadyForClaudeTaskEntity, ReadyForClaudeTaskRepository } from "@webdesk/database";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditService } from "../audit/audit.service.js";
import type { AuthorizationService } from "../authz/authorization.service.js";
import type { SeparationOfDutiesService } from "../auth/common/separation-of-duties.service.js";
import type { ProjectService } from "../projects/project.service.js";
import type { UsersService } from "../users/users.service.js";
import { ReadyForClaudeTasksService } from "./ready-for-claude-tasks.service.js";

const NOW = new Date("2026-09-01T00:00:00.000Z");
const TASK_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const DEPENDENCY_ID = "33333333-3333-4333-8333-333333333333";
const USER_ID = "44444444-4444-4444-8444-444444444444";

/** A stand-in for Sequelize's real `UniqueConstraintError` — matched via the shared
 *  `isSequelizeUniqueConstraintError()` helper's own `.name` check rather than `instanceof`, since
 *  `dashboard-api` never imports `sequelize` directly (ADR-0006's architectural boundary). */
function uniqueConstraintError(): Error {
  const error = new Error("Validation error");
  error.name = "SequelizeUniqueConstraintError";
  return error;
}

function task(overrides: Partial<ReadyForClaudeTaskEntity> = {}): ReadyForClaudeTaskEntity {
  return {
    id: TASK_ID,
    publicId: "RFC-001",
    title: "Wire the Ready for Claude Queue backend",
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
    createdBy: "actor-1",
    updatedBy: "actor-1",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("ReadyForClaudeTasksService", () => {
  let tasks: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    findByPublicId: ReturnType<typeof vi.fn>;
    existsById: ReturnType<typeof vi.fn>;
    existingIds: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateStatus: ReturnType<typeof vi.fn>;
  };
  let projects: { findById: ReturnType<typeof vi.fn> };
  let usersService: { assertUserExists: ReturnType<typeof vi.fn> };
  let authorizationService: {
    assertAllowed: ReturnType<typeof vi.fn>;
    isValidModuleKey: ReturnType<typeof vi.fn>;
  };
  let separationOfDuties: { assertDistinctActors: ReturnType<typeof vi.fn> };
  let auditService: { record: ReturnType<typeof vi.fn> };
  let svc: ReadyForClaudeTasksService;

  beforeEach(() => {
    tasks = {
      create: vi.fn(),
      // Default: a task authored by a different actor than "actor-1" (every changeStatus test
      // below acts as "actor-1"), so the separation-of-duties check passes by default; tests that
      // exercise self-approval override this per-test.
      findById: vi.fn().mockResolvedValue(task({ createdBy: "creator-1" })),
      findByPublicId: vi.fn(),
      existsById: vi.fn().mockResolvedValue(true),
      // Default: every id passed in resolves as existing, mirroring the old existsById default.
      existingIds: vi.fn().mockImplementation(async (ids: readonly string[]) => new Set(ids)),
      list: vi.fn(),
      update: vi.fn(),
      updateStatus: vi.fn(),
    };
    projects = { findById: vi.fn().mockResolvedValue({ id: PROJECT_ID }) };
    usersService = { assertUserExists: vi.fn() };
    authorizationService = {
      assertAllowed: vi.fn(),
      isValidModuleKey: vi.fn().mockResolvedValue(true),
    };
    separationOfDuties = { assertDistinctActors: vi.fn() };
    auditService = { record: vi.fn() };
    svc = new ReadyForClaudeTasksService(
      tasks as unknown as ReadyForClaudeTaskRepository,
      projects as unknown as ProjectService,
      usersService as unknown as UsersService,
      authorizationService as unknown as AuthorizationService,
      separationOfDuties as unknown as SeparationOfDutiesService,
      auditService as unknown as AuditService,
    );
  });

  describe("create", () => {
    const validInput = { publicId: "RFC-001", title: "A task" };

    it("creates a task in draft after validating its publicId is unused", async () => {
      tasks.findByPublicId.mockResolvedValue(null);
      tasks.create.mockResolvedValue(task());

      const result = await svc.create(validInput, "actor-1");

      expect(result).toEqual(task());
      expect(tasks.create).toHaveBeenCalledWith(
        expect.objectContaining({ publicId: "RFC-001", title: "A task", createdBy: "actor-1" }),
      );
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "data_change", action: "create" }),
      );
    });

    it("rejects a publicId that is already in use", async () => {
      tasks.findByPublicId.mockResolvedValue(task());
      await expect(svc.create(validInput, "actor-1")).rejects.toBeInstanceOf(BadRequestException);
      expect(tasks.create).not.toHaveBeenCalled();
    });

    it("maps a concurrent publicId uniqueness race to a clean 400, not a raw 500", async () => {
      tasks.findByPublicId.mockResolvedValue(null);
      tasks.create.mockRejectedValue(uniqueConstraintError());
      await expect(svc.create(validInput, "actor-1")).rejects.toBeInstanceOf(BadRequestException);
    });

    it("validates an optional projectId actually exists (D5)", async () => {
      tasks.findByPublicId.mockResolvedValue(null);
      projects.findById.mockRejectedValue(new NotFoundException("Project not found"));
      await expect(
        svc.create({ ...validInput, projectId: PROJECT_ID }, "actor-1"),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(tasks.create).not.toHaveBeenCalled();
    });

    it("does not touch ProjectService at all when projectId is omitted (D5 — optional)", async () => {
      tasks.findByPublicId.mockResolvedValue(null);
      tasks.create.mockResolvedValue(task());
      await svc.create(validInput, "actor-1");
      expect(projects.findById).not.toHaveBeenCalled();
    });

    it("validates targetModuleKey against the real module registry (D1)", async () => {
      tasks.findByPublicId.mockResolvedValue(null);
      authorizationService.isValidModuleKey.mockResolvedValue(false);
      await expect(
        svc.create({ ...validInput, targetModuleKey: "not_a_real_module" }, "actor-1"),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(tasks.create).not.toHaveBeenCalled();
    });

    it("accepts a valid targetModuleKey and never validates targetId (D1 — opaque)", async () => {
      tasks.findByPublicId.mockResolvedValue(null);
      tasks.create.mockResolvedValue(task());
      await svc.create(
        { ...validInput, targetModuleKey: "page_inventory", targetId: DEPENDENCY_ID },
        "actor-1",
      );
      expect(authorizationService.isValidModuleKey).toHaveBeenCalledWith("page_inventory");
      // targetId is deliberately never existence-checked — no generic cross-module lookup exists.
      expect(tasks.existingIds).not.toHaveBeenCalled();
    });

    it("existence-validates every dependency id against this same table (D2), in one batched query", async () => {
      tasks.findByPublicId.mockResolvedValue(null);
      tasks.create.mockResolvedValue(task());
      await svc.create({ ...validInput, dependencies: [DEPENDENCY_ID] }, "actor-1");
      expect(tasks.existingIds).toHaveBeenCalledWith([DEPENDENCY_ID]);
    });

    it("rejects a dependency id that does not resolve to a task (D2)", async () => {
      tasks.findByPublicId.mockResolvedValue(null);
      tasks.existingIds.mockResolvedValue(new Set());
      await expect(
        svc.create({ ...validInput, dependencies: [DEPENDENCY_ID] }, "actor-1"),
      ).rejects.toThrow(/dependencies contains ids that do not resolve/);
      expect(tasks.create).not.toHaveBeenCalled();
    });

    it("de-duplicates repeated dependency ids into a single batched lookup", async () => {
      tasks.findByPublicId.mockResolvedValue(null);
      tasks.create.mockResolvedValue(task());
      await svc.create(
        { ...validInput, dependencies: [DEPENDENCY_ID, DEPENDENCY_ID, DEPENDENCY_ID] },
        "actor-1",
      );
      expect(tasks.existingIds).toHaveBeenCalledTimes(1);
      expect(tasks.existingIds).toHaveBeenCalledWith([DEPENDENCY_ID]);
    });

    it("existence-validates every supplied user-reference field", async () => {
      tasks.findByPublicId.mockResolvedValue(null);
      tasks.create.mockResolvedValue(task());
      await svc.create(
        { ...validInput, operatorUserId: USER_ID, reviewerUserId: USER_ID },
        "actor-1",
      );
      expect(usersService.assertUserExists).toHaveBeenCalledWith(USER_ID, "operatorUserId");
      expect(usersService.assertUserExists).toHaveBeenCalledWith(USER_ID, "reviewerUserId");
      expect(usersService.assertUserExists).toHaveBeenCalledTimes(2);
    });

    it("propagates a rejected user-reference field as a 400", async () => {
      tasks.findByPublicId.mockResolvedValue(null);
      usersService.assertUserExists.mockRejectedValue(new BadRequestException("no such user"));
      await expect(
        svc.create({ ...validInput, developerUserId: USER_ID }, "actor-1"),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(tasks.create).not.toHaveBeenCalled();
    });
  });

  describe("findById", () => {
    it("throws 404 for a missing task", async () => {
      tasks.findById.mockResolvedValue(null);
      await expect(svc.findById(TASK_ID)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("update", () => {
    it("edits a non-terminal task, passing its current status as a CAS guard", async () => {
      tasks.findById.mockResolvedValue(task({ status: "in_progress" }));
      tasks.update.mockResolvedValue(task({ status: "in_progress", title: "Renamed" }));

      const result = await svc.update(TASK_ID, { title: "Renamed" }, "actor-1");

      expect(result.title).toBe("Renamed");
      expect(tasks.update).toHaveBeenCalledWith(
        TASK_ID,
        expect.objectContaining({ title: "Renamed", updatedBy: "actor-1" }),
        "in_progress",
      );
    });

    it.each(["completed", "cancelled", "failed"] as const)(
      "refuses a content edit on a terminal (%s) task (D4)",
      async (status) => {
        tasks.findById.mockResolvedValue(task({ status }));
        await expect(svc.update(TASK_ID, { title: "Renamed" }, "actor-1")).rejects.toThrow(
          new RegExp(`is ${status} and can no longer be edited`),
        );
        expect(tasks.update).not.toHaveBeenCalled();
      },
    );

    it("rejects a task listing itself as one of its own dependencies", async () => {
      tasks.findById.mockResolvedValue(task());
      await expect(svc.update(TASK_ID, { dependencies: [TASK_ID] }, "actor-1")).rejects.toThrow(
        /may not depend on itself/,
      );
      expect(tasks.update).not.toHaveBeenCalled();
    });

    it("catches a self-dependency written with different UUID casing", async () => {
      tasks.findById.mockResolvedValue(task());
      await expect(
        svc.update(TASK_ID, { dependencies: [TASK_ID.toUpperCase()] }, "actor-1"),
      ).rejects.toThrow(/may not depend on itself/);
    });

    it("normalizes an explicit null dependencies patch to the empty array (NOT NULL column)", async () => {
      tasks.findById.mockResolvedValue(task());
      tasks.update.mockResolvedValue(task());
      await svc.update(TASK_ID, { dependencies: null }, "actor-1");
      expect(tasks.update).toHaveBeenCalledWith(
        TASK_ID,
        expect.objectContaining({ dependencies: [] }),
        "draft",
      );
    });

    it("omits dependencies entirely when the patch does not mention it", async () => {
      tasks.findById.mockResolvedValue(task());
      tasks.update.mockResolvedValue(task());
      await svc.update(TASK_ID, { title: "Renamed" }, "actor-1");
      const patchArgument = tasks.update.mock.calls[0]?.[1] as Record<string, unknown>;
      expect(Object.keys(patchArgument)).not.toContain("dependencies");
    });

    it("only re-validates a user-reference field that is actually changing", async () => {
      tasks.findById.mockResolvedValue(task({ operatorUserId: USER_ID }));
      tasks.update.mockResolvedValue(task({ operatorUserId: USER_ID }));
      await svc.update(TASK_ID, { operatorUserId: USER_ID, title: "Renamed" }, "actor-1");
      expect(usersService.assertUserExists).not.toHaveBeenCalled();
    });

    it("surfaces a concurrent status change as a 409, not a silent no-op", async () => {
      tasks.findById
        .mockResolvedValueOnce(task({ status: "in_progress" }))
        .mockResolvedValueOnce(task({ status: "completed" }));
      tasks.update.mockResolvedValue(null);
      await expect(svc.update(TASK_ID, { title: "Renamed" }, "actor-1")).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it("surfaces a since-deleted task as a 404 rather than a 409", async () => {
      tasks.findById.mockResolvedValueOnce(task()).mockResolvedValueOnce(null);
      tasks.update.mockResolvedValue(null);
      await expect(svc.update(TASK_ID, { title: "Renamed" }, "actor-1")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe("changeStatus — the full TRANSITIONS table (D4)", () => {
    /** Every legal edge, with the exact seeded RBAC action it must check. Mirrors
     *  `ReadyForClaudeTasksService`'s own `TRANSITIONS` table and
     *  `docs/implementation/module-ready-for-claude-queue.md`'s D4 table one-for-one. */
    const LEGAL_EDGES = [
      ["draft", "ready_for_claude", "submit"],
      ["draft", "cancelled", "edit"],
      ["ready_for_claude", "claimed", "edit"],
      ["ready_for_claude", "cancelled", "edit"],
      ["claimed", "in_progress", "edit"],
      ["claimed", "cancelled", "edit"],
      ["in_progress", "paused", "edit"],
      ["paused", "in_progress", "edit"],
      ["in_progress", "failed", "edit"],
      ["in_progress", "awaiting_review", "submit"],
      ["awaiting_review", "changes_requested", "review"],
      ["changes_requested", "ready_for_claude", "submit"],
      ["awaiting_review", "approved", "approve"],
      ["approved", "completed", "approve"],
    ] as const;

    it.each(LEGAL_EDGES)(
      "allows %s -> %s, gated on the %s action",
      async (from, to, expectedAction) => {
        tasks.updateStatus.mockResolvedValue({ outcome: "updated", entity: task({ status: to }) });

        const result = await svc.changeStatus(
          TASK_ID,
          { status: to, expectedStatus: from },
          "actor-1",
        );

        expect(result.status).toBe(to);
        expect(authorizationService.assertAllowed).toHaveBeenCalledWith(
          "actor-1",
          "ready_for_claude",
          expectedAction,
        );
        expect(tasks.updateStatus).toHaveBeenCalledWith(TASK_ID, from, to, "actor-1");
      },
    );

    it("covers every legal edge the TRANSITIONS table declares", () => {
      // A guard against the table and this suite silently drifting apart: 14 edges, exactly the
      // count of D4's own table in docs/implementation/module-ready-for-claude-queue.md.
      expect(LEGAL_EDGES).toHaveLength(14);
    });

    const ILLEGAL_EDGES = [
      // Skipping the whole middle of the pipeline.
      ["draft", "completed"],
      // Backwards out of an approval.
      ["approved", "in_progress"],
      // Out of a terminal state.
      ["cancelled", "draft"],
      ["completed", "approved"],
      ["failed", "in_progress"],
      // A plausible-looking but undeclared edge.
      ["awaiting_review", "ready_for_claude"],
    ] as const;

    it.each(ILLEGAL_EDGES)("rejects the illegal transition %s -> %s", async (from, to) => {
      await expect(
        svc.changeStatus(TASK_ID, { status: to, expectedStatus: from }, "actor-1"),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(authorizationService.assertAllowed).not.toHaveBeenCalled();
      expect(tasks.updateStatus).not.toHaveBeenCalled();
    });

    it("names a terminal state as terminal in the rejection message", async () => {
      await expect(
        svc.changeStatus(TASK_ID, { status: "draft", expectedStatus: "completed" }, "actor-1"),
      ).rejects.toThrow(/completed is terminal/);
    });

    it("lists the legal next states in the rejection message for a non-terminal state", async () => {
      await expect(
        svc.changeStatus(TASK_ID, { status: "completed", expectedStatus: "draft" }, "actor-1"),
      ).rejects.toThrow(/Legal next states from draft: ready_for_claude, cancelled/);
    });

    it("rejects a no-op transition (expectedStatus === status)", async () => {
      await expect(
        svc.changeStatus(TASK_ID, { status: "draft", expectedStatus: "draft" }, "actor-1"),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(authorizationService.assertAllowed).not.toHaveBeenCalled();
    });

    it("propagates a denied permission check without writing anything", async () => {
      authorizationService.assertAllowed.mockRejectedValue(new ForbiddenException("nope"));
      await expect(
        svc.changeStatus(
          TASK_ID,
          { status: "approved", expectedStatus: "awaiting_review" },
          "actor-1",
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(tasks.updateStatus).not.toHaveBeenCalled();
    });

    it("surfaces a CAS conflict as a 409 naming both statuses", async () => {
      tasks.updateStatus.mockResolvedValue({
        outcome: "conflict",
        entity: task({ status: "cancelled" }),
      });
      await expect(
        svc.changeStatus(
          TASK_ID,
          { status: "ready_for_claude", expectedStatus: "draft" },
          "actor-1",
        ),
      ).rejects.toThrow(/expected draft, now cancelled/);
    });

    it("surfaces a CAS not_found as a 404", async () => {
      tasks.updateStatus.mockResolvedValue({ outcome: "not_found" });
      await expect(
        svc.changeStatus(
          TASK_ID,
          { status: "ready_for_claude", expectedStatus: "draft" },
          "actor-1",
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("audits an approve-gated transition as an approval event", async () => {
      tasks.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: task({ status: "approved" }),
      });
      await svc.changeStatus(
        TASK_ID,
        { status: "approved", expectedStatus: "awaiting_review" },
        "actor-1",
      );
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "approval",
          retentionCategory: "approval-audit-7y",
        }),
      );
    });

    it("audits a review-gated transition as an approval event too", async () => {
      tasks.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: task({ status: "changes_requested" }),
      });
      await svc.changeStatus(
        TASK_ID,
        { status: "changes_requested", expectedStatus: "awaiting_review" },
        "actor-1",
      );
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "approval" }),
      );
    });

    it("audits an edit-gated transition as a plain data change", async () => {
      tasks.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: task({ status: "claimed" }),
      });
      await svc.changeStatus(
        TASK_ID,
        { status: "claimed", expectedStatus: "ready_for_claude" },
        "actor-1",
      );
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "data_change", retentionCategory: "audit-7y" }),
      );
    });

    it.each([
      ["awaiting_review", "approved", "approve"],
      ["awaiting_review", "changes_requested", "review"],
      ["approved", "completed", "approve"],
    ] as const)(
      "rejects %s -> %s (a %s-gated transition) when the actor is the task's own creator",
      async (from, to, _requiredAction) => {
        tasks.findById.mockResolvedValue(task({ status: from, createdBy: "actor-1" }));
        separationOfDuties.assertDistinctActors.mockRejectedValue(
          new ForbiddenException("Separation of duties"),
        );
        await expect(
          svc.changeStatus(TASK_ID, { status: to, expectedStatus: from }, "actor-1"),
        ).rejects.toBeInstanceOf(ForbiddenException);
        expect(separationOfDuties.assertDistinctActors).toHaveBeenCalledWith(
          "actor-1",
          "actor-1",
          expect.any(String),
          expect.objectContaining({ entityType: "ready_for_claude_task", entityId: TASK_ID }),
        );
        expect(tasks.updateStatus).not.toHaveBeenCalled();
      },
    );

    it("never checks separation of duties for an edit/submit-gated transition", async () => {
      tasks.findById.mockResolvedValue(task({ status: "ready_for_claude", createdBy: "actor-1" }));
      tasks.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: task({ status: "claimed" }),
      });
      await svc.changeStatus(
        TASK_ID,
        { status: "claimed", expectedStatus: "ready_for_claude" },
        "actor-1",
      );
      expect(separationOfDuties.assertDistinctActors).not.toHaveBeenCalled();
    });

    it("skips the separation-of-duties check when the task has no recorded creator", async () => {
      tasks.findById.mockResolvedValue(task({ status: "awaiting_review", createdBy: null }));
      tasks.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: task({ status: "approved" }),
      });
      await svc.changeStatus(
        TASK_ID,
        { status: "approved", expectedStatus: "awaiting_review" },
        "actor-1",
      );
      expect(separationOfDuties.assertDistinctActors).not.toHaveBeenCalled();
    });

    it("blocks claimed -> in_progress while a declared dependency has not reached completed (D2)", async () => {
      const dependency = task({ id: DEPENDENCY_ID, status: "in_progress" });
      tasks.findById.mockImplementation(async (id: string) =>
        id === TASK_ID
          ? task({ status: "claimed", dependencies: [DEPENDENCY_ID], createdBy: "creator-1" })
          : dependency,
      );
      await expect(
        svc.changeStatus(TASK_ID, { status: "in_progress", expectedStatus: "claimed" }, "actor-1"),
      ).rejects.toThrow(/dependencies not yet completed/);
      expect(tasks.updateStatus).not.toHaveBeenCalled();
    });

    it("allows claimed -> in_progress once every declared dependency is completed", async () => {
      const dependency = task({ id: DEPENDENCY_ID, status: "completed" });
      tasks.findById.mockImplementation(async (id: string) =>
        id === TASK_ID
          ? task({ status: "claimed", dependencies: [DEPENDENCY_ID], createdBy: "creator-1" })
          : dependency,
      );
      tasks.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: task({ status: "in_progress" }),
      });
      const result = await svc.changeStatus(
        TASK_ID,
        { status: "in_progress", expectedStatus: "claimed" },
        "actor-1",
      );
      expect(result.status).toBe("in_progress");
    });

    it("never checks dependency completion for a transition other than claimed -> in_progress", async () => {
      tasks.findById.mockResolvedValue(
        task({ status: "ready_for_claude", dependencies: [DEPENDENCY_ID], createdBy: "creator-1" }),
      );
      tasks.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: task({ status: "claimed" }),
      });
      await svc.changeStatus(
        TASK_ID,
        { status: "claimed", expectedStatus: "ready_for_claude" },
        "actor-1",
      );
      // Only the one findById call for `current` — no extra lookups for a dependency task.
      expect(tasks.findById).toHaveBeenCalledTimes(1);
    });

    it("still returns the transitioned task when the audit write itself fails", async () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      tasks.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: task({ status: "claimed" }),
      });
      auditService.record.mockRejectedValue(new Error("audit down"));

      const result = await svc.changeStatus(
        TASK_ID,
        { status: "claimed", expectedStatus: "ready_for_claude" },
        "actor-1",
      );

      expect(result.status).toBe("claimed");
      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });
  });
});
