import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  withTransaction,
  type PageArtifactEntity,
  type PageArtifactRepository,
  type PageArtifactType,
  type PageArtifactVersionEntity,
  type PageArtifactVersionRepository,
  type PageArtifactVersionStatus,
} from "@webdesk/database";
import { sanitizeNullableRichText } from "@webdesk/validation";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuditService } from "../audit/audit.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuthorizationService } from "../authz/authorization.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { PagesService } from "../page-inventory/pages.service.js";
import {
  ARTIFACT_PERMISSION_GROUP,
  PAGE_ARTIFACT_REPOSITORY,
  PAGE_ARTIFACT_VERSION_REPOSITORY,
} from "./page-workspace.constants.js";
import type {
  ChangeVersionStatusDto,
  CreateArtifactDto,
  ReopenArtifactDto,
  UpdateArtifactVersionDto,
} from "./page-workspace.dto.js";

/**
 * Statuses a version can be reopened FROM (finding 2).
 *
 * `approved` is the case the spec names. `archived` is included because otherwise archiving a
 * version permanently bricks its tab: `archived` is terminal, `reopen()` was the only other code
 * path that creates a version, and `createArtifact()` cannot help because it also inserts the
 * artifact row and so fails the (page_id, artifact_type) unique index. The archived version
 * itself is never mutated — terminal still means terminal; reopening only forks a NEW draft
 * beside it.
 */
const REOPENABLE_STATUSES: readonly PageArtifactVersionStatus[] = ["approved", "archived"];

const RICH_TEXT_FIELDS = new Set(["content", "notes"]);

/**
 * Renders the changed fields of a version for an audit row. `content`/`notes` are reduced to a
 * character count rather than copied verbatim: the audit trail needs to show THAT they changed
 * and by roughly how much, not carry a duplicate of the document. Everything else (the Git
 * provenance fields) is short and is recorded exactly.
 */
function summarizeFields(
  source: Record<string, string | null>,
  fields: readonly string[],
): Record<string, unknown> {
  const summary: Record<string, unknown> = {};
  for (const field of fields) {
    const value = source[field];
    summary[field] = RICH_TEXT_FIELDS.has(field)
      ? { length: value === null || value === undefined ? 0 : value.length }
      : (value ?? null);
  }
  return summary;
}

/** The RBAC action a caller must hold, within the ARTIFACT's OWN permission group, to reach each
 *  status. Action names mirror `ServicesService`'s own already-code-reviewed mapping exactly
 *  (`-> draft` requires `submit`, so an author whose work was rejected or sent back can actually
 *  revise and resubmit it — a real workflow bug that review caught and fixed there). */
type ArtifactAction = "submit" | "review" | "approve";

/**
 * The single allowlist for artifact-version status transitions — one table encoding BOTH which
 * transitions are legal and which action each requires, the unified shape Service Library's own
 * code review produced after finding two independently-maintained structures had drifted.
 *
 * Sourced from `05_Workflow_State_Machines.md §2`'s generic artifact lifecycle. `superseded` and
 * `archived` are permanently terminal — no code path resurrects a version from either, matching
 * this codebase's established archived-is-terminal precedent (ADR-0016, no hard delete).
 */
const VERSION_TRANSITIONS: Readonly<
  Record<
    PageArtifactVersionStatus,
    Readonly<Partial<Record<PageArtifactVersionStatus, ArtifactAction>>>
  >
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

@Injectable()
export class PageArtifactsService {
  constructor(
    @Inject(PAGE_ARTIFACT_REPOSITORY) private readonly artifacts: PageArtifactRepository,
    @Inject(PAGE_ARTIFACT_VERSION_REPOSITORY)
    private readonly versions: PageArtifactVersionRepository,
    private readonly authorizationService: AuthorizationService,
    private readonly auditService: AuditService,
    private readonly pagesService: PagesService,
  ) {}

  /**
   * Task package D2's enforcement point: the required action is checked against the ARTIFACT's
   * own permission group, not the module's baseline `page_content`. This is what lets a developer
   * edit the Implementation artifact, a designer the UI Specification, and QA the QA artifact —
   * exactly what the approved RBAC matrix grants each of them, and what a single module-wide gate
   * would have wrongly denied.
   *
   * `projectId` is threaded through so a project-scoped grant resolves correctly — the exact gap
   * Page Inventory's own code review caught when routes omitted it.
   */
  private async assertArtifactPermission(
    userId: string,
    artifactType: PageArtifactType,
    action: string,
    projectId: string,
  ): Promise<void> {
    await this.authorizationService.assertAllowed(
      userId,
      ARTIFACT_PERMISSION_GROUP[artifactType],
      action,
      projectId,
    );
  }

  /** A page must genuinely exist in this project before any artifact may hang off it — a clean
   *  404 rather than the raw FK-violation 500 an unchecked insert would produce. */
  private async assertPageInProject(pageId: string, projectId: string): Promise<void> {
    const exists = await this.pagesService.existsInProject(pageId, projectId);
    if (!exists) {
      throw new NotFoundException(`Page not found: ${pageId}`);
    }
  }

  private async loadVersionOrThrow(
    versionId: string,
    projectId: string,
  ): Promise<PageArtifactVersionEntity> {
    const version = await this.versions.findById(versionId, projectId);
    if (!version) {
      throw new NotFoundException(`Artifact version not found: ${versionId}`);
    }
    return version;
  }

  /**
   * Resolves a version and proves it genuinely belongs to the artifact and page the URL names.
   * The route nests versions under `/pages/:pageId/artifacts/:artifactId/`, so without this the
   * nesting would be decorative — a caller could reach any version through any artifact's path.
   * Every mismatch is a 404, never a 403, so this leaks nothing about what exists elsewhere.
   */
  private async loadVersionInContextOrThrow(
    projectId: string,
    pageId: string,
    artifactId: string,
    versionId: string,
  ): Promise<{ version: PageArtifactVersionEntity; artifact: PageArtifactEntity }> {
    const artifact = await this.loadArtifactInPageOrThrow(artifactId, pageId, projectId);
    const version = await this.loadVersionOrThrow(versionId, projectId);
    if (version.artifactId !== artifactId) {
      throw new NotFoundException(`Artifact version not found: ${versionId}`);
    }
    return { version, artifact };
  }

  private async loadArtifactOrThrow(
    artifactId: string,
    projectId: string,
  ): Promise<PageArtifactEntity> {
    const artifact = await this.artifacts.findById(artifactId, projectId);
    if (!artifact) {
      throw new NotFoundException(`Artifact not found: ${artifactId}`);
    }
    return artifact;
  }

  /** The single ownership guard for "this artifact really is on this page". Previously duplicated
   *  between `listVersions()` and `loadVersionInContextOrThrow()`, where the two copies could
   *  drift; both now route through here. */
  private async loadArtifactInPageOrThrow(
    artifactId: string,
    pageId: string,
    projectId: string,
  ): Promise<PageArtifactEntity> {
    const artifact = await this.loadArtifactOrThrow(artifactId, projectId);
    if (artifact.pageId !== pageId) {
      throw new NotFoundException(`Artifact not found: ${artifactId}`);
    }
    return artifact;
  }

  /**
   * Artifacts on a page, filtered to the ones the caller may actually view.
   *
   * The 15 artifact types span four permission groups (D2), so a single route-level gate cannot
   * express "may view this tab". Rather than one check per artifact, the DISTINCT groups present
   * are evaluated once each — at most four regardless of how many artifacts the page has.
   *
   * Today every seeded role holds `view` on all four groups, so this filters nothing; it exists
   * so that narrowing any group's `view` grant later cannot silently start leaking tabs through
   * this route while `listVersions()` correctly denies them.
   */
  async listForPage(
    userId: string,
    projectId: string,
    pageId: string,
  ): Promise<readonly PageArtifactEntity[]> {
    await this.assertPageInProject(pageId, projectId);
    const all = await this.artifacts.listForPage(pageId, projectId);

    const groups = [...new Set(all.map((a) => ARTIFACT_PERMISSION_GROUP[a.artifactType]))];
    const viewable = new Set<string>();
    await Promise.all(
      groups.map(async (group) => {
        const decision = await this.authorizationService.evaluate(userId, group, "view", projectId);
        if (decision.allowed) {
          viewable.add(group);
        }
      }),
    );

    return all.filter((a) => viewable.has(ARTIFACT_PERMISSION_GROUP[a.artifactType]));
  }

  /** The "History" tab (task package D3) — a derived view over this artifact's own versions,
   *  which is exactly why `history` is not itself a stored artifact type. */
  async listVersions(
    userId: string,
    projectId: string,
    pageId: string,
    artifactId: string,
    options: { readonly limit?: number; readonly offset?: number },
  ): Promise<readonly PageArtifactVersionEntity[]> {
    const artifact = await this.loadArtifactInPageOrThrow(artifactId, pageId, projectId);
    await this.assertArtifactPermission(userId, artifact.artifactType, "view", projectId);
    return this.versions.listForArtifact(artifactId, projectId, options);
  }

  /**
   * Creates the artifact row for a tab plus its first `draft` version, in one transaction so an
   * artifact can never be left with no version at all.
   *
   * The `(page_id, artifact_type)` unique index is the real guard against two concurrent creates
   * for the same tab; its violation is mapped to a clean 409 rather than surfacing as a raw 500.
   * Matched by `error.name`, not `instanceof` — `dashboard-api` never imports `sequelize`
   * directly, per ADR-0006's architectural boundary.
   */
  async createArtifact(
    userId: string,
    projectId: string,
    pageId: string,
    input: CreateArtifactDto,
  ): Promise<{ artifact: PageArtifactEntity; version: PageArtifactVersionEntity }> {
    await this.assertPageInProject(pageId, projectId);
    await this.assertArtifactPermission(userId, input.artifactType, "create", projectId);

    try {
      const created = await withTransaction(async (transaction) => {
        const artifact = await this.artifacts.create(
          {
            pageId,
            projectId,
            artifactType: input.artifactType,
            createdBy: userId,
          },
          transaction,
        );
        const version = await this.versions.create(
          {
            artifactId: artifact.id,
            pageId,
            projectId,
            versionNumber: 1,
            status: "draft",
            content: sanitizeNullableRichText(input.content),
            notes: sanitizeNullableRichText(input.notes),
            repository: input.repository ?? null,
            path: input.path ?? null,
            branch: input.branch ?? null,
            commitSha: input.commitSha ?? null,
            contentChecksum: input.contentChecksum ?? null,
            createdBy: userId,
          },
          transaction,
        );
        const linked = await this.artifacts.setCurrentVersion(
          artifact.id,
          projectId,
          version.id,
          userId,
          transaction,
        );
        return { artifact: linked ?? artifact, version };
      });

      await this.recordAudit(userId, projectId, created.version, "create", null, {
        artifactType: input.artifactType,
        status: created.version.status,
      });
      return created;
    } catch (error) {
      if ((error as { name?: string }).name === "SequelizeUniqueConstraintError") {
        throw new ConflictException(
          `An artifact of type ${input.artifactType} already exists for page ${pageId}`,
        );
      }
      throw error;
    }
  }

  /**
   * In-place content edit, permitted ONLY while the version is still a `draft`.
   *
   * This is the direct enforcement of `04_Data_Model_and_Ownership.md §5` ("Approved artifacts are
   * immutable") and `05_Workflow_State_Machines.md §1` ("Approved versions are immutable"). A
   * version under review is equally off-limits — editing content out from under a reviewer would
   * silently invalidate the exact thing they are reviewing, which §12's "approval references an
   * exact version" requirement exists to prevent. To change an approved artifact, `reopen()`
   * forks a new draft version instead.
   *
   * The repository write additionally carries `expectedStatus: "draft"` as a compare-and-swap
   * guard, so a transition landing between this read and that write loses rather than silently
   * overwriting.
   */
  async updateVersion(
    userId: string,
    projectId: string,
    pageId: string,
    artifactId: string,
    versionId: string,
    patch: UpdateArtifactVersionDto,
  ): Promise<PageArtifactVersionEntity> {
    const { version, artifact } = await this.loadVersionInContextOrThrow(
      projectId,
      pageId,
      artifactId,
      versionId,
    );
    await this.assertArtifactPermission(userId, artifact.artifactType, "edit", projectId);

    if (version.status !== "draft") {
      throw new BadRequestException(
        `Version ${versionId} is ${version.status} and can no longer be edited in place — ` +
          "reopen the artifact to create a new draft version",
      );
    }

    const nextValues: Record<string, string | null> = {
      ...(patch.content !== undefined
        ? { content: sanitizeNullableRichText(patch.content) ?? null }
        : {}),
      ...(patch.notes !== undefined
        ? { notes: sanitizeNullableRichText(patch.notes) ?? null }
        : {}),
      ...(patch.repository !== undefined ? { repository: patch.repository ?? null } : {}),
      ...(patch.path !== undefined ? { path: patch.path ?? null } : {}),
      ...(patch.branch !== undefined ? { branch: patch.branch ?? null } : {}),
      ...(patch.commitSha !== undefined ? { commitSha: patch.commitSha ?? null } : {}),
      ...(patch.contentChecksum !== undefined
        ? { contentChecksum: patch.contentChecksum ?? null }
        : {}),
    };

    const changedFields = Object.keys(nextValues).filter(
      (field) => nextValues[field] !== (version as unknown as Record<string, string | null>)[field],
    );

    const updated = await this.versions.update(
      versionId,
      projectId,
      { ...nextValues, updatedBy: userId },
      "draft",
    );

    if (!updated) {
      throw new ConflictException(
        `Version ${versionId} changed status concurrently — reload and retry`,
      );
    }

    await this.recordAudit(
      userId,
      projectId,
      updated,
      "update",
      summarizeFields(version as unknown as Record<string, string | null>, changedFields),
      summarizeFields(updated as unknown as Record<string, string | null>, changedFields),
    );
    return updated;
  }

  /**
   * A version status transition. The required action comes from `VERSION_TRANSITIONS` and is
   * checked against the ARTIFACT's own permission group (D2), so the real separation of duties
   * the RBAC matrix encodes falls out naturally: on an Implementation artifact a `developer`
   * (`development_code: VCES`) can submit but never approve, while a `qa_security_reviewer`
   * (`development_code: VRA`) can review and approve but never submit.
   */
  async changeVersionStatus(
    userId: string,
    projectId: string,
    pageId: string,
    artifactId: string,
    versionId: string,
    input: ChangeVersionStatusDto,
  ): Promise<PageArtifactVersionEntity> {
    const { version, artifact } = await this.loadVersionInContextOrThrow(
      projectId,
      pageId,
      artifactId,
      versionId,
    );

    if (version.status === input.status) {
      return version;
    }

    const requiredAction = VERSION_TRANSITIONS[version.status][input.status];
    if (!requiredAction) {
      throw new BadRequestException(
        `Cannot transition version ${versionId} from ${version.status} to ${input.status}`,
      );
    }
    await this.assertArtifactPermission(userId, artifact.artifactType, requiredAction, projectId);

    const result = await this.versions.updateStatus(
      versionId,
      projectId,
      version.status,
      input.status,
      userId,
    );
    if (result.outcome === "not_found") {
      throw new NotFoundException(`Artifact version not found: ${versionId}`);
    }
    if (result.outcome === "conflict") {
      throw new ConflictException(
        `Version ${versionId} status changed concurrently ` +
          `(expected ${version.status}, now ${result.entity.status}) — reload and retry`,
      );
    }

    await this.recordAudit(
      userId,
      projectId,
      result.entity,
      `status:${version.status}->${input.status}`,
      { status: version.status },
      { status: input.status },
      input.reason ?? null,
    );
    return result.entity;
  }

  /**
   * `03_Detailed_Module_Specifications.md §6`: "Reopening an approved stage creates a new version
   * and records the reason." (task package D7)
   *
   * One transaction marks the approved version `superseded` and inserts version N+1 as a `draft`
   * carrying the previous content forward, so the artifact can never be left with two live
   * versions or none. The reason is mandatory at the schema layer, and the required action is
   * `approve` — the same action `VERSION_TRANSITIONS` demands for `approved -> superseded`, since
   * that is precisely the transition this performs. `versionNumber` is read under a row lock
   * inside the transaction, with the `(artifact_id, version_number)` unique index as the real
   * backstop against a concurrent reopen.
   */
  async reopen(
    userId: string,
    projectId: string,
    pageId: string,
    artifactId: string,
    versionId: string,
    input: ReopenArtifactDto,
  ): Promise<PageArtifactVersionEntity> {
    const { version, artifact } = await this.loadVersionInContextOrThrow(
      projectId,
      pageId,
      artifactId,
      versionId,
    );

    if (!REOPENABLE_STATUSES.includes(version.status)) {
      throw new BadRequestException(
        `Only an approved or archived version can be reopened; version ${versionId} is ` +
          version.status,
      );
    }
    await this.assertArtifactPermission(userId, artifact.artifactType, "approve", projectId);

    // Reopening must never leave two simultaneously editable versions on one artifact. For an
    // approved source the supersede below enforces that on its own, but an archived source is
    // already terminal and supersedes nothing, so the check has to be explicit.
    const live = await this.versions.findLiveVersion(artifact.id, projectId);
    if (live && live.id !== version.id) {
      throw new ConflictException(
        `Artifact ${artifact.id} already has an open version (v${live.versionNumber}, ` +
          `${live.status}) — work on that instead of reopening v${version.versionNumber}`,
      );
    }

    try {
      const next = await withTransaction(async (transaction) => {
        // An archived source stays archived; only an approved one is superseded by its
        // successor. The compare-and-swap is also what makes two concurrent reopens of the same
        // approved version safe — the loser sees `conflict` and rolls back.
        if (version.status === "approved") {
          const superseded = await this.versions.updateStatus(
            versionId,
            projectId,
            "approved",
            "superseded",
            userId,
            transaction,
          );
          if (superseded.outcome !== "updated") {
            throw new ConflictException(
              `Version ${versionId} changed concurrently and could not be reopened — reload and retry`,
            );
          }
        }

        const latest = await this.versions.findLatestVersionNumber(
          artifact.id,
          projectId,
          transaction,
        );
        const created = await this.versions.create(
          {
            artifactId: artifact.id,
            pageId: artifact.pageId,
            projectId,
            versionNumber: latest + 1,
            status: "draft",
            content: version.content,
            notes: version.notes,
            repository: version.repository,
            path: version.path,
            branch: version.branch,
            commitSha: version.commitSha,
            contentChecksum: version.contentChecksum,
            reopenedReason: input.reason,
            reopenedFromVersionId: version.id,
            createdBy: userId,
          },
          transaction,
        );
        await this.artifacts.setCurrentVersion(
          artifact.id,
          projectId,
          created.id,
          userId,
          transaction,
        );
        return created;
      });

      await this.recordAudit(
        userId,
        projectId,
        next,
        `reopen:v${version.versionNumber}->v${next.versionNumber}`,
        { versionNumber: version.versionNumber, status: version.status },
        { versionNumber: next.versionNumber, status: "draft" },
        input.reason,
      );
      return next;
    } catch (error) {
      if ((error as { name?: string }).name === "SequelizeUniqueConstraintError") {
        throw new ConflictException(
          `Artifact ${artifact.id} was reopened concurrently — reload and retry`,
        );
      }
      throw error;
    }
  }

  /**
   * `05_Workflow_State_Machines.md §1` ("Every transition creates an audit event") and §12 (every
   * approval records "entity and exact version", approver, decision, timestamp, reason, and the
   * Git commit SHA where applicable).
   *
   * `entityVersion` carries the real version number — this module is the first to populate it,
   * which is what makes §12's "exact version" requirement genuinely satisfied rather than
   * approximated by the entity id alone. An approval-shaped transition is classified as such so
   * it inherits the longer `approval-audit-7y` retention.
   *
   * A failed audit write is caught and console.error'd rather than failing the request — the
   * byte-identical, already-accepted pattern `PagesService.changeWorkflowStage()`/
   * `ServicesService.changeApprovalStatus()`/`PersonasService.changeApprovalStatus()` all share.
   */
  private async recordAudit(
    actorUserId: string,
    projectId: string,
    version: PageArtifactVersionEntity,
    action: string,
    beforeState: Record<string, unknown> | null,
    afterState: Record<string, unknown> | null,
    reason: string | null = null,
  ): Promise<void> {
    const isApproval = afterState?.status === "approved";
    try {
      await this.auditService.record({
        eventType: isApproval ? "approval" : "data_change",
        actorUserId,
        actorType: "human",
        projectId,
        entityType: "page_artifact_version",
        entityId: version.id,
        entityVersion: version.versionNumber,
        action,
        beforeState,
        afterState,
        reason,
        retentionCategory: isApproval ? "approval-audit-7y" : "audit-7y",
      });
    } catch (error) {
      console.error(
        `Page artifact version ${version.id} action "${action}" committed, ` +
          "but recording its audit event failed:",
        error,
      );
    }
  }
}
