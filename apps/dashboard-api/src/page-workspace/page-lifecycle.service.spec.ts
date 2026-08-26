import type { PageEntity, PageLifecycleRepository, PageLifecycleStage } from "@webdesk/database";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditService } from "../audit/audit.service.js";
import type { AuthorizationService } from "../authz/authorization.service.js";
import { PageLifecycleService } from "./page-lifecycle.service.js";

const NOW = new Date("2026-08-25T00:00:00.000Z");
const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const PAGE_ID = "22222222-2222-4222-8222-222222222222";
const ACTOR = "33333333-3333-4333-8333-333333333333";

function page(overrides: Partial<PageEntity> = {}): PageEntity {
  return {
    id: PAGE_ID,
    projectId: PROJECT_ID,
    publicId: "PAGE-HOME",
    pageName: "Home",
    pageType: null,
    existingOrProposed: "proposed",
    indexStatus: "unknown",
    template: null,
    roadmapPhaseId: null,
    workflowStage: "draft",
    lifecycleStage: "proposed",
    lifecyclePreviousStage: null,
    targetKeyword: null,
    designVersion: null,
    repositoryFiles: null,
    wordpressPageId: null,
    wordpressPostId: null,
    lastScanAt: null,
    lastDeploymentAt: null,
    classification: null,
    createdBy: ACTOR,
    updatedBy: ACTOR,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("PageLifecycleService", () => {
  let pages: { findById: ReturnType<typeof vi.fn>; updateLifecycleStage: ReturnType<typeof vi.fn> };
  let authorizationService: { assertAllowed: ReturnType<typeof vi.fn> };
  let auditService: { record: ReturnType<typeof vi.fn> };
  let svc: PageLifecycleService;

  /** Resolves `updateLifecycleStage` to a successful CAS carrying the requested stage. */
  function updatesTo(stage: PageLifecycleStage, previous: PageLifecycleStage | null = null) {
    pages.updateLifecycleStage.mockResolvedValue({
      outcome: "updated",
      entity: page({ lifecycleStage: stage, lifecyclePreviousStage: previous }),
    });
  }

  beforeEach(() => {
    pages = { findById: vi.fn(), updateLifecycleStage: vi.fn() };
    authorizationService = { assertAllowed: vi.fn() };
    auditService = { record: vi.fn() };
    svc = new PageLifecycleService(
      pages as unknown as PageLifecycleRepository,
      authorizationService as unknown as AuthorizationService,
      auditService as unknown as AuditService,
    );
  });

  it("advances along the main path and checks the action the transition table demands", async () => {
    pages.findById.mockResolvedValue(page({ lifecycleStage: "proposed" }));
    updatesTo("approved_for_planning");

    await svc.changeStage(ACTOR, PROJECT_ID, PAGE_ID, { stage: "approved_for_planning" });

    // `proposed -> approved_for_planning` is an approval gate, and the check is scoped to the
    // project so a project-scoped grant resolves (the gap Page Inventory's review caught).
    expect(authorizationService.assertAllowed).toHaveBeenCalledWith(
      ACTOR,
      "page_content",
      "approve",
      PROJECT_ID,
    );
  });

  it("rejects a transition the allowlist does not contain", async () => {
    pages.findById.mockResolvedValue(page({ lifecycleStage: "proposed" }));

    await expect(
      svc.changeStage(ACTOR, PROJECT_ID, PAGE_ID, { stage: "production_deployed" }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(pages.updateLifecycleStage).not.toHaveBeenCalled();
  });

  it("never advances a stage as a side effect — an unchanged target is a no-op", async () => {
    pages.findById.mockResolvedValue(page({ lifecycleStage: "in_development" }));

    const result = await svc.changeStage(ACTOR, PROJECT_ID, PAGE_ID, { stage: "in_development" });

    expect(result.lifecycleStage).toBe("in_development");
    expect(pages.updateLifecycleStage).not.toHaveBeenCalled();
    expect(auditService.record).not.toHaveBeenCalled();
  });

  it("stamps where the page came from when it drops into an interrupt stage", async () => {
    pages.findById.mockResolvedValue(page({ lifecycleStage: "in_development" }));
    updatesTo("paused", "in_development");

    await svc.changeStage(ACTOR, PROJECT_ID, PAGE_ID, { stage: "paused" });

    expect(pages.updateLifecycleStage).toHaveBeenCalledWith(
      PAGE_ID,
      PROJECT_ID,
      "in_development",
      "paused",
      "in_development",
      ACTOR,
    );
  });

  it("lets a paused page resume to exactly the stage it came from, and clears the marker", async () => {
    pages.findById.mockResolvedValue(
      page({ lifecycleStage: "paused", lifecyclePreviousStage: "in_development" }),
    );
    updatesTo("in_development");

    await svc.changeStage(ACTOR, PROJECT_ID, PAGE_ID, { stage: "in_development" });

    expect(pages.updateLifecycleStage).toHaveBeenCalledWith(
      PAGE_ID,
      PROJECT_ID,
      "paused",
      "in_development",
      null,
      ACTOR,
    );
  });

  it("refuses to resume a paused page anywhere except where it actually came from", async () => {
    pages.findById.mockResolvedValue(
      page({ lifecycleStage: "paused", lifecyclePreviousStage: "in_development" }),
    );

    // `production_approved` is a real stage, but not this page's resume point — allowing it would
    // let a pause be used to skip every gate between here and production.
    await expect(
      svc.changeStage(ACTOR, PROJECT_ID, PAGE_ID, { stage: "production_approved" }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("keeps the original resume point when one interrupt follows another", async () => {
    pages.findById.mockResolvedValue(
      page({ lifecycleStage: "paused", lifecyclePreviousStage: "in_development" }),
    );
    updatesTo("blocked", "in_development");

    await svc.changeStage(ACTOR, PROJECT_ID, PAGE_ID, {
      stage: "blocked",
      reason: "waiting on a vendor",
    });

    // Not "paused" — otherwise resuming would strand the page in the interrupt it came from.
    expect(pages.updateLifecycleStage).toHaveBeenCalledWith(
      PAGE_ID,
      PROJECT_ID,
      "paused",
      "blocked",
      "in_development",
      ACTOR,
    );
  });

  it("surfaces a lost compare-and-swap race as a conflict, never a silent overwrite", async () => {
    pages.findById.mockResolvedValue(page({ lifecycleStage: "in_strategy" }));
    pages.updateLifecycleStage.mockResolvedValue({
      outcome: "conflict",
      entity: page({ lifecycleStage: "blocked" }),
    });

    await expect(
      svc.changeStage(ACTOR, PROJECT_ID, PAGE_ID, { stage: "search_approved" }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("throws NotFound when the page is genuinely gone rather than concurrently transitioned", async () => {
    pages.findById.mockResolvedValue(page({ lifecycleStage: "in_strategy" }));
    pages.updateLifecycleStage.mockResolvedValue({ outcome: "not_found" });

    await expect(
      svc.changeStage(ACTOR, PROJECT_ID, PAGE_ID, { stage: "search_approved" }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("throws NotFound for a page in a different project (IDOR prevention)", async () => {
    pages.findById.mockResolvedValue(null);

    await expect(
      svc.changeStage(ACTOR, PROJECT_ID, PAGE_ID, { stage: "approved_for_planning" }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("audits every transition, giving approval gates the longer approval retention", async () => {
    pages.findById.mockResolvedValue(page({ lifecycleStage: "staging_deployed" }));
    updatesTo("staging_approved");

    await svc.changeStage(ACTOR, PROJECT_ID, PAGE_ID, { stage: "staging_approved" });

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "approval",
        retentionCategory: "approval-audit-7y",
        entityType: "page",
        entityId: PAGE_ID,
        action: "lifecycle:staging_deployed->staging_approved",
      }),
    );
  });

  it("classifies approved_for_planning as an approval gate (code-review regression)", async () => {
    // The classifier previously tested `stage.endsWith("_approved")`, which silently missed this
    // one — it STARTS with "approved" — so a genuine approval gate was filed as a data_change
    // under the shorter retention.
    pages.findById.mockResolvedValue(page({ lifecycleStage: "proposed" }));
    updatesTo("approved_for_planning");

    await svc.changeStage(ACTOR, PROJECT_ID, PAGE_ID, { stage: "approved_for_planning" });

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "approval",
        retentionCategory: "approval-audit-7y",
      }),
    );
  });

  it("records a non-approval transition as a plain data change", async () => {
    pages.findById.mockResolvedValue(page({ lifecycleStage: "ready_for_development" }));
    updatesTo("in_development");

    await svc.changeStage(ACTOR, PROJECT_ID, PAGE_ID, { stage: "in_development" });

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "data_change", retentionCategory: "audit-7y" }),
    );
  });

  it("still returns the transition when the audit write itself fails", async () => {
    pages.findById.mockResolvedValue(page({ lifecycleStage: "proposed" }));
    updatesTo("approved_for_planning");
    auditService.record.mockRejectedValue(new Error("audit down"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await svc.changeStage(ACTOR, PROJECT_ID, PAGE_ID, {
      stage: "approved_for_planning",
    });

    expect(result.lifecycleStage).toBe("approved_for_planning");
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
