import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  AssetApprovalStatus,
  AssetEntity,
  AssetListFilter,
  AssetRepository,
} from "@webdesk/database";
import {
  isSequelizeUniqueConstraintError,
  sanitizeNullableRichText,
  sanitizeNullableRichTextIfChanged,
} from "@webdesk/validation";
import { ASSET_LIBRARY_MODULE_KEY, ASSET_REPOSITORY } from "./asset-library.constants.js";
import type { CreateAssetDto, UpdateAssetDto } from "./asset-library.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuditService } from "../audit/audit.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuthorizationService } from "../authz/authorization.service.js";

/** The real, seeded RBAC action (`06_Roles_and_Permissions.md`) required for a given
 *  `approvalStatus` transition — identical vocabulary to Brand Library's/Content Template
 *  Library's/Service Library's own. */
type AssetApprovalAction = "submit" | "review" | "approve";

/**
 * Reused verbatim (byte-for-byte, D5) from `BrandLibraryService`'s own (already code-reviewed)
 * `TRANSITIONS` table — a single source of truth for both "is this transition legal" (a key's
 * presence) and "what RBAC action does it require" (the value).
 * `submitted`/`revision_requested`/`rejected -> draft` all require `submit` (the submitter/editor
 * drives the revise-and-resubmit loop, not the approver). `archived`/`superseded` are both
 * terminal — no code path resurrects an asset from either.
 */
const TRANSITIONS: Readonly<
  Record<AssetApprovalStatus, Readonly<Partial<Record<AssetApprovalStatus, AssetApprovalAction>>>>
> = {
  draft: { submitted: "submit", archived: "approve" },
  submitted: { under_review: "review", draft: "submit", archived: "approve" },
  under_review: {
    approved: "approve",
    revision_requested: "review",
    rejected: "approve",
    archived: "approve",
  },
  revision_requested: { draft: "submit", submitted: "submit", archived: "approve" },
  approved: { superseded: "approve", archived: "approve" },
  rejected: { draft: "submit", archived: "approve" },
  superseded: {},
  archived: {},
};

/** Both terminal states, named once rather than repeated as an inline pair at each guard — their
 *  `TRANSITIONS` entries above are both `{}`, i.e. no code path resurrects an asset from either. */
function isTerminal(status: AssetApprovalStatus): boolean {
  return status === "archived" || status === "superseded";
}

@Injectable()
export class AssetsService {
  constructor(
    @Inject(ASSET_REPOSITORY)
    private readonly assets: AssetRepository,
    private readonly authorizationService: AuthorizationService,
    private readonly auditService: AuditService,
  ) {}

  async create(input: CreateAssetDto, actorUserId: string): Promise<AssetEntity> {
    const existing = await this.assets.findByPublicId(input.publicId);
    if (existing) {
      throw new BadRequestException(`publicId already in use: ${input.publicId}`);
    }

    let created: AssetEntity;
    try {
      created = await this.assets.create({
        ...input,
        description: sanitizeNullableRichText(input.description),
        licence: sanitizeNullableRichText(input.licence),
        consentReference: sanitizeNullableRichText(input.consentReference),
        altTextGuidance: sanitizeNullableRichText(input.altTextGuidance),
        retentionNote: sanitizeNullableRichText(input.retentionNote),
        createdBy: actorUserId,
      });
    } catch (error) {
      // The publicId uniqueness check above is TOCTOU (two concurrent creates with the same
      // publicId can both pass it before either INSERT commits) — the real unique index catches
      // the race loser, but without this catch it would otherwise surface as a raw 500 instead of
      // the same clean 400 the check above already gives the non-racing caller. Uses the shared
      // `isSequelizeUniqueConstraintError()` helper (`@webdesk/validation`), not a hand-rolled
      // `error.name === "SequelizeUniqueConstraintError"` check — the exact regression Brand
      // Library's own code review had to fix one module earlier.
      if (isSequelizeUniqueConstraintError(error)) {
        throw new BadRequestException(`publicId already in use: ${input.publicId}`);
      }
      throw error;
    }

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      entityType: "asset",
      entityId: created.id,
      action: "create",
      // Deliberately records only non-confidential identifying fields — `fileReference` and
      // `consentReference` are exactly the two fields D2 redacts on a restricted asset, so
      // mirroring them into the audit trail would route around that redaction. `visibility` is
      // included because knowing an asset was created restricted is itself the security-relevant
      // fact.
      afterState: { title: created.title, visibility: created.visibility },
      retentionCategory: "audit-7y",
    });

    return created;
  }

  async findById(id: string): Promise<AssetEntity> {
    const asset = await this.assets.findById(id);
    if (!asset) {
      throw new NotFoundException(`Asset not found: ${id}`);
    }
    return asset;
  }

  async list(filter: AssetListFilter): Promise<readonly AssetEntity[]> {
    return this.assets.list(filter);
  }

  async update(id: string, patch: UpdateAssetDto, actorUserId: string): Promise<AssetEntity> {
    const current = await this.findById(id);

    // archived/superseded are both terminal — content on a terminal row must never change,
    // mirroring BrandLibraryService.update()'s own identical guard.
    if (isTerminal(current.approvalStatus)) {
      throw new BadRequestException(
        `Asset ${id} is ${current.approvalStatus} and can no longer be edited`,
      );
    }

    // current.approvalStatus is passed as a CAS guard — the terminal-state check above reads
    // approvalStatus into application memory, but without this the actual write would still be
    // unconditional: a concurrent changeApprovalStatus() transition landing between the read and
    // this write could let this edit silently succeed against what is now an archived/superseded
    // row, mirroring BrandLibraryService.update()'s own identical fix.
    const updated = await this.assets.update(
      id,
      {
        ...patch,
        description: sanitizeNullableRichTextIfChanged(patch.description, current.description),
        licence: sanitizeNullableRichTextIfChanged(patch.licence, current.licence),
        consentReference: sanitizeNullableRichTextIfChanged(
          patch.consentReference,
          current.consentReference,
        ),
        altTextGuidance: sanitizeNullableRichTextIfChanged(
          patch.altTextGuidance,
          current.altTextGuidance,
        ),
        retentionNote: sanitizeNullableRichTextIfChanged(
          patch.retentionNote,
          current.retentionNote,
        ),
        updatedBy: actorUserId,
      },
      current.approvalStatus,
    );
    if (!updated) {
      // 0 affected rows means either the row is genuinely gone (no hard delete exists for assets
      // today, but this still guards a hypothetical future one, matching every sibling module's
      // own identical belt-and-suspenders check) or — the real case the CAS guard above exists for
      // — its approvalStatus changed concurrently since the read. Distinguish the two with a fresh
      // read rather than assuming either.
      const stillExists = await this.assets.findById(id);
      if (!stillExists) {
        throw new NotFoundException(`Asset not found: ${id}`);
      }
      throw new ConflictException(
        `Asset ${id} approval status changed concurrently while editing — reload and retry`,
      );
    }

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      entityType: "asset",
      entityId: id,
      action: "update",
      // Records only WHICH fields changed, never their values — `patch` can carry
      // `fileReference`/`consentReference`, the two fields D2 redacts on a restricted asset, so
      // spreading `patch` here (as several sibling modules do, an already-accepted tracked-debt
      // pattern elsewhere) would route around that redaction for anyone who can read the audit
      // trail. `visibility` is included by value because it is itself the security-relevant fact.
      afterState: {
        changedFields: Object.keys(patch).sort(),
        ...(patch.visibility ? { visibility: patch.visibility } : {}),
      },
      retentionCategory: "audit-7y",
    });

    return updated;
  }

  async changeApprovalStatus(
    id: string,
    nextStatus: AssetApprovalStatus,
    actorUserId: string,
  ): Promise<AssetEntity> {
    const asset = await this.findById(id);
    if (asset.approvalStatus === nextStatus) {
      return asset; // no-op, not an error — re-requesting the current status is harmless
    }

    const requiredAction = TRANSITIONS[asset.approvalStatus][nextStatus];
    if (!requiredAction) {
      throw new BadRequestException(
        `Invalid asset approval status transition: ${asset.approvalStatus} -> ${nextStatus}`,
      );
    }
    await this.authorizationService.assertAllowed(
      actorUserId,
      ASSET_LIBRARY_MODULE_KEY,
      requiredAction,
    );

    const result = await this.assets.updateApprovalStatus(
      id,
      asset.approvalStatus,
      nextStatus,
      actorUserId,
    );
    if (result.outcome === "not_found") {
      throw new NotFoundException(`Asset not found: ${id}`);
    }
    if (result.outcome === "conflict") {
      throw new ConflictException(
        `Asset ${id} approval status changed concurrently ` +
          `(expected ${asset.approvalStatus}, now ${result.entity.approvalStatus}) — reload and retry`,
      );
    }

    const isApproval = nextStatus === "approved";
    try {
      await this.auditService.record({
        eventType: isApproval ? "approval" : "data_change",
        actorUserId,
        actorType: "human",
        entityType: "asset",
        entityId: id,
        action: `status:${asset.approvalStatus}->${nextStatus}`,
        beforeState: { approvalStatus: asset.approvalStatus },
        afterState: { approvalStatus: nextStatus },
        retentionCategory: isApproval ? "approval-audit-7y" : "audit-7y",
      });
    } catch (error) {
      console.error(
        `Asset ${id} approval status transition ${asset.approvalStatus}->${nextStatus} ` +
          "committed, but recording its audit event failed:",
        error,
      );
    }

    return result.entity;
  }

  /**
   * Publish an `approved` asset (D6) — what the roadmap's "private assets remain private until
   * approved" actually resolves to. Rejects with a clean 400 BEFORE attempting the CAS write if
   * the asset isn't currently `approved`. A concurrent double-publish (or a repeat call once
   * already published) surfaces as a clean 409 via the atomic compare-and-swap, never a silent
   * no-op success — deliberately asymmetric with `changeApprovalStatus()`'s own
   * same-status-is-a-no-op short circuit, mirroring `BrandLibraryService.publish()`'s own
   * identical reasoning.
   *
   * `asset.approvalStatus` (`"approved"`, the value the check above just confirmed) is also passed
   * as a CAS guard to `updatePublishState()` — the check above only reads `approvalStatus` into
   * application memory; without also guarding the write on it, a concurrent
   * `changeApprovalStatus()` transition (e.g. `approved -> archived`) landing between the read and
   * this write could still let the publish succeed, since `isPublished` alone was still `false`.
   */
  async publish(id: string, actorUserId: string): Promise<AssetEntity> {
    const asset = await this.findById(id);
    if (asset.approvalStatus !== "approved") {
      throw new BadRequestException(
        `Asset ${id} cannot be published while its approval status is ` +
          `'${asset.approvalStatus}' — only an approved asset may be published.`,
      );
    }
    await this.authorizationService.assertAllowed(actorUserId, ASSET_LIBRARY_MODULE_KEY, "publish");

    const NOT_YET_PUBLISHED = false;
    const NOW_PUBLISHED = true;
    const result = await this.assets.updatePublishState(
      id,
      NOT_YET_PUBLISHED,
      NOW_PUBLISHED,
      actorUserId,
      asset.approvalStatus,
    );
    if (result.outcome === "not_found") {
      throw new NotFoundException(`Asset not found: ${id}`);
    }
    if (result.outcome === "conflict") {
      throw new ConflictException(
        `Asset ${id} was published concurrently, is already published, or its approval status ` +
          `changed concurrently — reload and retry.`,
      );
    }

    try {
      await this.auditService.record({
        eventType: "publish",
        actorUserId,
        actorType: "human",
        entityType: "asset",
        entityId: id,
        action: "publish",
        afterState: { isPublished: true, visibility: result.entity.visibility },
        retentionCategory: "audit-7y",
      });
    } catch (error) {
      console.error(`Asset ${id} publish committed, but recording its audit event failed:`, error);
    }

    return result.entity;
  }

  /**
   * Unpublish an asset — always allowed regardless of current `approvalStatus` (D6): an operator
   * must always be able to pull a published asset down, even one that has since moved to
   * `superseded`/`archived`. A concurrent double-unpublish (or a repeat call once already
   * unpublished) surfaces as a clean 409 via the atomic compare-and-swap, the same
   * asymmetric-with-`changeApprovalStatus()` reasoning as `publish()`. `publishedAt` is never
   * touched here — it records only the first publish time, preserved as permanent history (D6).
   */
  async unpublish(id: string, actorUserId: string): Promise<AssetEntity> {
    await this.authorizationService.assertAllowed(
      actorUserId,
      ASSET_LIBRARY_MODULE_KEY,
      "unpublish",
    );

    const CURRENTLY_PUBLISHED = true;
    const NOW_UNPUBLISHED = false;
    const result = await this.assets.updatePublishState(
      id,
      CURRENTLY_PUBLISHED,
      NOW_UNPUBLISHED,
      actorUserId,
    );
    if (result.outcome === "not_found") {
      throw new NotFoundException(`Asset not found: ${id}`);
    }
    if (result.outcome === "conflict") {
      throw new ConflictException(
        `Asset ${id} was unpublished concurrently, or is already unpublished — reload and retry.`,
      );
    }

    try {
      await this.auditService.record({
        eventType: "unpublish",
        actorUserId,
        actorType: "human",
        entityType: "asset",
        entityId: id,
        action: "unpublish",
        afterState: { isPublished: false },
        retentionCategory: "audit-7y",
      });
    } catch (error) {
      console.error(
        `Asset ${id} unpublish committed, but recording its audit event failed:`,
        error,
      );
    }

    return result.entity;
  }
}
