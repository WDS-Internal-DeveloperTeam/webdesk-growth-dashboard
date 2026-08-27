import type { AssetEntity, AssetRepository } from "@webdesk/database";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditService } from "../audit/audit.service.js";
import type { AuthorizationService } from "../authz/authorization.service.js";
import { AssetsService } from "./assets.service.js";

const NOW = new Date("2026-08-27T00:00:00.000Z");

/** A stand-in for Sequelize's real `UniqueConstraintError` — checked by `.name` in
 *  `isSequelizeUniqueConstraintError()` rather than `instanceof`, since `dashboard-api` never
 *  imports `sequelize` directly (only `packages/database` may, per ADR-0006). */
function uniqueConstraintError(): Error {
  const error = new Error("Validation error");
  error.name = "SequelizeUniqueConstraintError";
  return error;
}

function asset(overrides: Partial<AssetEntity> = {}): AssetEntity {
  return {
    id: "asset-1",
    publicId: "ASSET-HERO-001",
    title: "Homepage hero image",
    description: null,
    fileReference: null,
    mimeType: "image/png",
    fileSizeBytes: "204800",
    checksum: null,
    widthPx: 1920,
    heightPx: 1080,
    durationSeconds: null,
    licence: null,
    licenceHolder: null,
    consentReference: null,
    altTextGuidance: null,
    visibility: "internal",
    retentionNote: null,
    scanStatus: "not_configured",
    approvalStatus: "draft",
    version: 1,
    isPublished: false,
    publishedAt: null,
    createdBy: "actor-1",
    updatedBy: "actor-1",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("AssetsService", () => {
  let assets: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    findByPublicId: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateApprovalStatus: ReturnType<typeof vi.fn>;
    updatePublishState: ReturnType<typeof vi.fn>;
  };
  let authorizationService: { assertAllowed: ReturnType<typeof vi.fn> };
  let auditService: { record: ReturnType<typeof vi.fn> };
  let svc: AssetsService;

  beforeEach(() => {
    assets = {
      create: vi.fn(),
      findById: vi.fn(),
      findByPublicId: vi.fn(),
      list: vi.fn(),
      update: vi.fn(),
      updateApprovalStatus: vi.fn(),
      updatePublishState: vi.fn(),
    };
    authorizationService = { assertAllowed: vi.fn() };
    auditService = { record: vi.fn() };
    svc = new AssetsService(
      assets as unknown as AssetRepository,
      authorizationService as unknown as AuthorizationService,
      auditService as unknown as AuditService,
    );
  });

  describe("create", () => {
    it("creates an asset after validating the publicId is free", async () => {
      assets.findByPublicId.mockResolvedValue(null);
      assets.create.mockResolvedValue(asset());

      const result = await svc.create(
        { publicId: "ASSET-HERO-001", title: "Homepage hero image" },
        "actor-1",
      );

      expect(result).toEqual(asset());
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "create", entityType: "asset" }),
      );
    });

    it("rejects a duplicate publicId", async () => {
      assets.findByPublicId.mockResolvedValue(asset());

      await expect(
        svc.create({ publicId: "ASSET-HERO-001", title: "X" }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
      expect(assets.create).not.toHaveBeenCalled();
    });

    it("sanitizes rich-text fields before writing, stripping a disallowed tag", async () => {
      assets.findByPublicId.mockResolvedValue(null);
      assets.create.mockResolvedValue(asset());

      await svc.create(
        {
          publicId: "ASSET-X",
          title: "X",
          description: "<script>alert(1)</script><p>Hero image</p>",
          licence: "<img src=x onerror=alert(1)><p>CC BY 4.0</p>",
          consentReference: null,
          altTextGuidance: null,
          retentionNote: null,
        },
        "actor-1",
      );

      const [writtenInput] = assets.create.mock.calls[0] as [Record<string, unknown>];
      expect(writtenInput.description).toBe("<p>Hero image</p>");
      expect(writtenInput.licence).toBe("<p>CC BY 4.0</p>");
      expect(writtenInput.consentReference).toBeNull();
    });

    it("never records fileReference or consentReference in the audit trail (D2)", async () => {
      assets.findByPublicId.mockResolvedValue(null);
      assets.create.mockResolvedValue(
        asset({
          visibility: "restricted",
          fileReference: "https://cdn.example.com/private/secret.png",
          consentReference: "Signed release from Jane Doe",
        }),
      );

      await svc.create({ publicId: "ASSET-X", title: "X" }, "actor-1");

      const [event] = auditService.record.mock.calls[0] as [Record<string, unknown>];
      const afterState = event.afterState as Record<string, unknown>;
      // Mirroring these into the audit trail would route around the very redaction the
      // controller applies to a restricted asset.
      expect(afterState).not.toHaveProperty("fileReference");
      expect(afterState).not.toHaveProperty("consentReference");
      // visibility IS recorded — that an asset was created restricted is the security-relevant
      // fact, not a leak.
      expect(afterState.visibility).toBe("restricted");
    });

    it("translates a concurrent publicId collision into a clean 400, not a raw 500", async () => {
      assets.findByPublicId.mockResolvedValue(null);
      assets.create.mockRejectedValue(uniqueConstraintError());

      await expect(svc.create({ publicId: "ASSET-RACE", title: "X" }, "actor-1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("re-throws a non-uniqueness error from create() unchanged", async () => {
      assets.findByPublicId.mockResolvedValue(null);
      const dbError = new Error("connection reset");
      assets.create.mockRejectedValue(dbError);

      await expect(svc.create({ publicId: "ASSET-X", title: "X" }, "actor-1")).rejects.toBe(
        dbError,
      );
    });
  });

  describe("findById", () => {
    it("throws 404 for an unknown id", async () => {
      assets.findById.mockResolvedValue(null);
      await expect(svc.findById("missing")).rejects.toThrow(NotFoundException);
    });
  });

  describe("update", () => {
    it("edits content and passes the current approvalStatus as a CAS guard", async () => {
      assets.findById.mockResolvedValue(asset({ approvalStatus: "draft" }));
      assets.update.mockResolvedValue(asset({ title: "Updated", version: 2 }));

      const result = await svc.update("asset-1", { title: "Updated" }, "actor-1");

      expect(result.version).toBe(2);
      const [, , expectedStatus] = assets.update.mock.calls[0] as [
        string,
        Record<string, unknown>,
        string,
      ];
      expect(expectedStatus).toBe("draft");
    });

    it.each(["archived", "superseded"] as const)("refuses to edit a %s asset", async (status) => {
      assets.findById.mockResolvedValue(asset({ approvalStatus: status }));

      await expect(svc.update("asset-1", { title: "X" }, "actor-1")).rejects.toThrow(
        BadRequestException,
      );
      expect(assets.update).not.toHaveBeenCalled();
    });

    it("reports a concurrent status change as a 409, not a 404", async () => {
      assets.findById
        .mockResolvedValueOnce(asset({ approvalStatus: "draft" }))
        // The disambiguating re-read: the row still exists, so the CAS miss was a concurrent
        // status change rather than a deletion.
        .mockResolvedValueOnce(asset({ approvalStatus: "archived" }));
      assets.update.mockResolvedValue(null);

      await expect(svc.update("asset-1", { title: "X" }, "actor-1")).rejects.toThrow(
        ConflictException,
      );
    });

    it("reports a genuinely vanished row as a 404", async () => {
      assets.findById
        .mockResolvedValueOnce(asset({ approvalStatus: "draft" }))
        .mockResolvedValueOnce(null);
      assets.update.mockResolvedValue(null);

      await expect(svc.update("asset-1", { title: "X" }, "actor-1")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("audits only which fields changed, never their values (D2)", async () => {
      assets.findById.mockResolvedValue(asset({ approvalStatus: "draft" }));
      assets.update.mockResolvedValue(asset());

      await svc.update(
        "asset-1",
        {
          fileReference: "https://cdn.example.com/private/secret.png",
          consentReference: "Signed release from Jane Doe",
        },
        "actor-1",
      );

      const [event] = auditService.record.mock.calls[0] as [Record<string, unknown>];
      const afterState = event.afterState as Record<string, unknown>;
      expect(afterState.changedFields).toEqual(["consentReference", "fileReference"]);
      expect(afterState).not.toHaveProperty("fileReference");
      expect(afterState).not.toHaveProperty("consentReference");
    });

    it("skips re-sanitizing a resent value identical to what is already stored", async () => {
      // A stored value the sanitizer WOULD visibly alter if it ran — so seeing it come back
      // verbatim proves the sanitize call was genuinely skipped, rather than run and
      // coincidentally idempotent. This is the real optimization
      // `sanitizeNullableRichTextIfChanged` exists for: a UI that resends full record state on
      // every save shouldn't re-sanitize untouched fields.
      const storedDirty = "<script>alert(1)</script><p>kept</p>";
      assets.findById.mockResolvedValue(
        asset({ approvalStatus: "draft", description: storedDirty }),
      );
      assets.update.mockResolvedValue(asset());

      await svc.update("asset-1", { description: storedDirty }, "actor-1");

      const [, patch] = assets.update.mock.calls[0] as [string, Record<string, unknown>];
      expect(patch.description).toBe(storedDirty);
    });

    it("leaves a field the caller omitted entirely out of the patch, so its column is untouched", async () => {
      assets.findById.mockResolvedValue(
        asset({ approvalStatus: "draft", description: "<p>existing</p>" }),
      );
      assets.update.mockResolvedValue(asset());

      await svc.update("asset-1", { title: "Only the title" }, "actor-1");

      const [, patch] = assets.update.mock.calls[0] as [string, Record<string, unknown>];
      // `undefined`, not the current value — Sequelize omits an undefined key from the UPDATE,
      // so the stored column is left exactly as it was.
      expect(patch.description).toBeUndefined();
      expect(patch.title).toBe("Only the title");
    });
  });

  describe("changeApprovalStatus", () => {
    it("returns the asset unchanged when the requested status is already current", async () => {
      assets.findById.mockResolvedValue(asset({ approvalStatus: "draft" }));

      const result = await svc.changeApprovalStatus("asset-1", "draft", "actor-1");

      expect(result.approvalStatus).toBe("draft");
      expect(assets.updateApprovalStatus).not.toHaveBeenCalled();
    });

    it("rejects an illegal transition", async () => {
      assets.findById.mockResolvedValue(asset({ approvalStatus: "draft" }));

      await expect(svc.changeApprovalStatus("asset-1", "approved", "actor-1")).rejects.toThrow(
        BadRequestException,
      );
      expect(authorizationService.assertAllowed).not.toHaveBeenCalled();
    });

    it.each([
      ["draft", "submitted", "submit"],
      ["submitted", "under_review", "review"],
      ["under_review", "approved", "approve"],
      ["revision_requested", "draft", "submit"],
    ] as const)(
      "requires the %s -> %s transition to hold the '%s' action",
      async (from, to, action) => {
        assets.findById.mockResolvedValue(asset({ approvalStatus: from }));
        assets.updateApprovalStatus.mockResolvedValue({
          outcome: "updated",
          entity: asset({ approvalStatus: to }),
        });

        await svc.changeApprovalStatus("asset-1", to, "actor-1");

        expect(authorizationService.assertAllowed).toHaveBeenCalledWith(
          "actor-1",
          "creative_design",
          action,
        );
      },
    );

    it.each(["archived", "superseded"] as const)(
      "treats %s as terminal — no transition out of it is legal",
      async (status) => {
        assets.findById.mockResolvedValue(asset({ approvalStatus: status }));

        await expect(svc.changeApprovalStatus("asset-1", "draft", "actor-1")).rejects.toThrow(
          BadRequestException,
        );
      },
    );

    it("propagates a denied permission rather than writing", async () => {
      assets.findById.mockResolvedValue(asset({ approvalStatus: "under_review" }));
      authorizationService.assertAllowed.mockRejectedValue(new ForbiddenException());

      await expect(svc.changeApprovalStatus("asset-1", "approved", "actor-1")).rejects.toThrow(
        ForbiddenException,
      );
      expect(assets.updateApprovalStatus).not.toHaveBeenCalled();
    });

    it("surfaces a lost compare-and-swap race as a 409", async () => {
      assets.findById.mockResolvedValue(asset({ approvalStatus: "under_review" }));
      assets.updateApprovalStatus.mockResolvedValue({
        outcome: "conflict",
        entity: asset({ approvalStatus: "approved" }),
      });

      await expect(svc.changeApprovalStatus("asset-1", "approved", "actor-1")).rejects.toThrow(
        ConflictException,
      );
    });

    it("records an approval-retention audit event when reaching approved", async () => {
      assets.findById.mockResolvedValue(asset({ approvalStatus: "under_review" }));
      assets.updateApprovalStatus.mockResolvedValue({
        outcome: "updated",
        entity: asset({ approvalStatus: "approved" }),
      });

      await svc.changeApprovalStatus("asset-1", "approved", "actor-1");

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "approval",
          retentionCategory: "approval-audit-7y",
        }),
      );
    });

    it("does not fail the transition when recording its audit event throws", async () => {
      assets.findById.mockResolvedValue(asset({ approvalStatus: "draft" }));
      assets.updateApprovalStatus.mockResolvedValue({
        outcome: "updated",
        entity: asset({ approvalStatus: "submitted" }),
      });
      auditService.record.mockRejectedValue(new Error("audit sink down"));
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

      const result = await svc.changeApprovalStatus("asset-1", "submitted", "actor-1");

      expect(result.approvalStatus).toBe("submitted");
      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });
  });

  describe("publish", () => {
    it("refuses to publish an asset that is not approved", async () => {
      assets.findById.mockResolvedValue(asset({ approvalStatus: "draft" }));

      await expect(svc.publish("asset-1", "actor-1")).rejects.toThrow(BadRequestException);
      expect(authorizationService.assertAllowed).not.toHaveBeenCalled();
      expect(assets.updatePublishState).not.toHaveBeenCalled();
    });

    it("publishes an approved asset, guarding the write on both isPublished and status", async () => {
      assets.findById.mockResolvedValue(asset({ approvalStatus: "approved" }));
      assets.updatePublishState.mockResolvedValue({
        outcome: "updated",
        entity: asset({ approvalStatus: "approved", isPublished: true }),
      });

      const result = await svc.publish("asset-1", "actor-1");

      expect(result.isPublished).toBe(true);
      expect(authorizationService.assertAllowed).toHaveBeenCalledWith(
        "actor-1",
        "creative_design",
        "publish",
      );
      expect(assets.updatePublishState).toHaveBeenCalledWith(
        "asset-1",
        false,
        true,
        "actor-1",
        // The second CAS guard — without it a concurrent approved->archived transition could
        // still let this publish land.
        "approved",
      );
    });

    it("surfaces an already-published or concurrently-changed asset as a 409", async () => {
      assets.findById.mockResolvedValue(asset({ approvalStatus: "approved" }));
      assets.updatePublishState.mockResolvedValue({
        outcome: "conflict",
        entity: asset({ approvalStatus: "approved", isPublished: true }),
      });

      await expect(svc.publish("asset-1", "actor-1")).rejects.toThrow(ConflictException);
    });
  });

  describe("unpublish", () => {
    it("unpublishes regardless of approvalStatus, passing no status CAS guard", async () => {
      assets.updatePublishState.mockResolvedValue({
        outcome: "updated",
        entity: asset({ approvalStatus: "archived", isPublished: false }),
      });

      const result = await svc.unpublish("asset-1", "actor-1");

      expect(result.isPublished).toBe(false);
      expect(authorizationService.assertAllowed).toHaveBeenCalledWith(
        "actor-1",
        "creative_design",
        "unpublish",
      );
      // Four arguments only — no expectedApprovalStatus, by design (D6).
      expect(assets.updatePublishState).toHaveBeenCalledWith("asset-1", true, false, "actor-1");
    });

    it("checks permission before touching the row at all", async () => {
      authorizationService.assertAllowed.mockRejectedValue(new ForbiddenException());

      await expect(svc.unpublish("asset-1", "actor-1")).rejects.toThrow(ForbiddenException);
      expect(assets.updatePublishState).not.toHaveBeenCalled();
    });

    it("surfaces an already-unpublished asset as a 409", async () => {
      assets.updatePublishState.mockResolvedValue({
        outcome: "conflict",
        entity: asset({ isPublished: false }),
      });

      await expect(svc.unpublish("asset-1", "actor-1")).rejects.toThrow(ConflictException);
    });

    it("reports a genuinely missing asset as a 404", async () => {
      assets.updatePublishState.mockResolvedValue({ outcome: "not_found" });

      await expect(svc.unpublish("asset-1", "actor-1")).rejects.toThrow(NotFoundException);
    });
  });
});
