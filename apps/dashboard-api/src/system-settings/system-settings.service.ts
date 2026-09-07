import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  SystemSettingEntity,
  SystemSettingListFilter,
  SystemSettingRepository,
} from "@webdesk/database";
import { isSequelizeUniqueConstraintError } from "@webdesk/validation";
import {
  SYSTEM_SETTING_REPOSITORY,
  SYSTEM_SETTINGS_MODULE_KEY,
} from "./system-settings.constants.js";
import type { CreateSystemSettingDto, UpdateSystemSettingDto } from "./system-settings.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuditService } from "../audit/audit.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuthorizationService } from "../authz/authorization.service.js";

@Injectable()
export class SystemSettingsService {
  constructor(
    @Inject(SYSTEM_SETTING_REPOSITORY)
    private readonly settings: SystemSettingRepository,
    private readonly authorizationService: AuthorizationService,
    private readonly auditService: AuditService,
  ) {}

  async create(input: CreateSystemSettingDto, actorUserId: string): Promise<SystemSettingEntity> {
    const existingPublicId = await this.settings.findByPublicId(input.publicId);
    if (existingPublicId) {
      throw new BadRequestException(`publicId already in use: ${input.publicId}`);
    }
    // (settingType, key) uniqueness (D3) — checked up front for the non-racing caller, same
    // belt-and-suspenders pattern as the publicId check above; the real DB-level composite unique
    // index (migration 00120) catches the TOCTOU race loser via the isSequelizeUniqueConstraintError
    // catch below.
    const existingKey = await this.settings.findByTypeAndKey(input.settingType, input.key);
    if (existingKey) {
      throw new BadRequestException(
        `key '${input.key}' is already in use for settingType '${input.settingType}'`,
      );
    }

    let created: SystemSettingEntity;
    try {
      created = await this.settings.create({
        ...input,
        description: input.description ?? null,
        createdBy: actorUserId,
      });
    } catch (error) {
      // The two checks above are TOCTOU (two concurrent creates with the same publicId, or the
      // same (settingType, key) pair, can both pass their respective check before either INSERT
      // commits) — the real unique indexes catch the race loser, but without this catch it would
      // otherwise surface as a raw 500 instead of the same clean 400 the checks above already give
      // the non-racing caller. Uses the shared `isSequelizeUniqueConstraintError()` helper
      // (`@webdesk/validation`, already used by Brand Library/Page Inventory/Keyword & Entity
      // Library/Internal Linking Library), not a hand-rolled
      // `error.name === "SequelizeUniqueConstraintError"` check.
      if (isSequelizeUniqueConstraintError(error)) {
        throw new BadRequestException(
          `publicId or (settingType, key) already in use: ${input.publicId} / ` +
            `${input.settingType}:${input.key}`,
        );
      }
      throw error;
    }

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      entityType: "system_setting",
      entityId: created.id,
      action: "create",
      afterState: { settingType: created.settingType, key: created.key },
      retentionCategory: "audit-7y",
    });

    return created;
  }

  async findById(id: string): Promise<SystemSettingEntity> {
    const setting = await this.settings.findById(id);
    if (!setting) {
      throw new NotFoundException(`System setting not found: ${id}`);
    }
    return setting;
  }

  async list(filter: SystemSettingListFilter): Promise<readonly SystemSettingEntity[]> {
    return this.settings.list(filter);
  }

  /**
   * Content update — `isActive` is deliberately never accepted here (D4); only
   * `updateActiveState()` may change it. Unlike Brand Library's `update()`, there is no
   * terminal-state/CAS guard here — this module has no approval workflow and no state that makes
   * a record permanently uneditable, so any caller holding `edit` may update `value`/
   * `description`/`key` regardless of the record's current `isActive` value.
   */
  async update(
    id: string,
    patch: UpdateSystemSettingDto,
    actorUserId: string,
  ): Promise<SystemSettingEntity> {
    // Confirms the row exists before attempting the write, so a missing id gives a clean 404
    // rather than the update() call's own ambiguous "0 affected rows" return distinguishing
    // "missing" from "nothing changed" the hard way.
    await this.findById(id);

    let updated: SystemSettingEntity | null;
    try {
      updated = await this.settings.update(id, {
        ...patch,
        updatedBy: actorUserId,
      });
    } catch (error) {
      // patch.key can collide with another row's (settingType, key) pair — the real DB-level
      // composite unique index (migration 00120) catches it; translated into a clean 400 here
      // rather than a raw 500, mirroring create()'s own identical catch.
      if (isSequelizeUniqueConstraintError(error)) {
        throw new BadRequestException(
          patch.key
            ? `key '${patch.key}' is already in use for this setting's settingType`
            : "Duplicate value",
        );
      }
      throw error;
    }
    if (!updated) {
      // The findById() call above already confirmed the row existed a moment ago — 0 affected
      // rows here means it was hard-deleted between that read and this write. No hard-delete
      // route exists for this module today (ADR-0016), but this still guards a hypothetical
      // future one, matching every sibling module's own identical belt-and-suspenders check.
      throw new NotFoundException(`System setting not found: ${id}`);
    }

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      entityType: "system_setting",
      entityId: id,
      action: "update",
      afterState: { ...patch },
      retentionCategory: "audit-7y",
    });

    return updated;
  }

  /**
   * Toggle a system setting's `isActive` state (D4) — gated on the `configure` (`M`) action, not
   * `edit`, matching the real seeded RBAC matrix split (both `super_admin` and
   * `owner_growth_approver` hold `M`, but only `super_admin` holds `E`). One method for both
   * directions (unlike Brand Library's separate `publish()`/`unpublish()`), since there's no
   * publish-shaped semantic here — just "set active"/"set inactive" — matching the implementation
   * doc's own D4 framing.
   *
   * `expectedIsActive` is an optional CAS guard: when the caller supplies it, a concurrent toggle
   * that already changed `isActive` since the caller's own last read surfaces as a clean 409
   * instead of silently overwriting it; when omitted, the write is unconditional on `id` alone.
   */
  async updateActiveState(
    id: string,
    nextIsActive: boolean,
    actorUserId: string,
    expectedIsActive?: boolean,
  ): Promise<SystemSettingEntity> {
    await this.authorizationService.assertAllowed(
      actorUserId,
      SYSTEM_SETTINGS_MODULE_KEY,
      "configure",
    );

    const result = await this.settings.updateActiveState(
      id,
      nextIsActive,
      actorUserId,
      expectedIsActive,
    );
    if (result.outcome === "not_found") {
      throw new NotFoundException(`System setting not found: ${id}`);
    }
    if (result.outcome === "conflict") {
      throw new ConflictException(
        `System setting ${id}'s active state changed concurrently — reload and retry`,
      );
    }

    try {
      await this.auditService.record({
        eventType: "data_change",
        actorUserId,
        actorType: "human",
        entityType: "system_setting",
        entityId: id,
        action: nextIsActive ? "activate" : "deactivate",
        afterState: { isActive: nextIsActive },
        retentionCategory: "audit-7y",
      });
    } catch (error) {
      console.error(
        `System setting ${id} active-state change to ${nextIsActive} committed, but recording its audit event failed:`,
        error,
      );
    }

    return result.entity;
  }
}
