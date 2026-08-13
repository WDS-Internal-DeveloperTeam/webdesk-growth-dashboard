import { randomBytes, randomUUID } from "node:crypto";
import {
  AuditEventRepository,
  buildMigrator,
  closeConnection,
  getConnection,
  RetentionHoldRepository,
  RetentionPolicyRepository,
  UserRepository,
} from "@webdesk/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AuditService } from "../src/audit/audit.service.js";
import { RetentionEligibilityService } from "../src/retention/retention-eligibility.service.js";
import {
  RetentionCleanupService,
  type RetentionRecordDeleter,
} from "../src/retention/retention-cleanup.service.js";

/**
 * Proves §22's full 9-step cleanup process end-to-end against a REAL
 * disposable PostgreSQL database — no NestJS HTTP layer involved, since no
 * HTTP route can reach `RetentionCleanupService` by design (see
 * docs/task-packages/phase-1e-retention-architecture.md §4). Every service
 * here is constructed directly against real repositories, the same
 * "real database, no mocks" discipline every other Phase 1E integration
 * test follows.
 *
 * Uses `_framework_probe` (migration `00001`) as the safe test fixture —
 * the same "test-only, proves the mechanism, never a real business
 * entity" table Phase 1B's own database foundation established, reused
 * here rather than inventing a second one. Reads/writes it via plain SQL
 * (`getConnection().query()`) rather than defining a Sequelize model —
 * `apps/dashboard-api` doesn't depend on the `sequelize` package directly,
 * only on `@webdesk/database`'s own exports.
 */

process.env.TOTP_ENCRYPTION_KEY ??= randomBytes(32).toString("hex");

interface FrameworkProbeRow {
  readonly id: string;
  readonly label: string;
  readonly deletedAt: Date | null;
}

async function createProbeRow(ageDays: number): Promise<FrameworkProbeRow> {
  const id = randomUUID();
  const label = `age-${ageDays}d`;
  const createdAt = new Date(Date.now() - ageDays * 24 * 60 * 60 * 1000);
  await getConnection().query(
    `INSERT INTO _framework_probe (id, label, created_at, updated_at) VALUES (:id, :label, :createdAt, now());`,
    { replacements: { id, label, createdAt } },
  );
  return { id, label, deletedAt: null };
}

async function findProbeRow(id: string): Promise<FrameworkProbeRow | null> {
  const [rows] = await getConnection().query(
    `SELECT id, label, deleted_at AS "deletedAt" FROM _framework_probe WHERE id = :id;`,
    { replacements: { id } },
  );
  const [row] = rows as FrameworkProbeRow[];
  return row ?? null;
}

describe("RetentionCleanupService — full 9-step proof (real disposable database)", () => {
  let cleanupService: RetentionCleanupService;
  let holdRepository: RetentionHoldRepository;
  let userId: string;

  const CATEGORY_KEY = "import-export-artifact-7d"; // real seeded policy: 7 days

  const deleter: RetentionRecordDeleter = {
    async softDelete(candidate) {
      await getConnection().query(
        `UPDATE _framework_probe SET deleted_at = now() WHERE id = :id;`,
        { replacements: { id: candidate.resourceId } },
      );
    },
  };

  beforeAll(async () => {
    const migrator = buildMigrator();
    await migrator.up();

    const policyRepository = new RetentionPolicyRepository();
    holdRepository = new RetentionHoldRepository();
    const auditEventRepository = new AuditEventRepository();
    const auditService = new AuditService(auditEventRepository);
    const eligibilityService = new RetentionEligibilityService(policyRepository, holdRepository);
    cleanupService = new RetentionCleanupService(eligibilityService, auditService);

    const users = new UserRepository();
    const user = await users.create({
      email: `retention-cleanup-${randomUUID()}@webdesksolution.com`,
      displayName: "Retention Cleanup Test",
    });
    userId = user.id;
  }, 30_000);

  afterAll(async () => {
    const migrator = buildMigrator();
    await migrator.down({ to: 0 });
    await closeConnection();
  }, 30_000);

  it("dry_run reports correct eligible/ineligible counts and deletes nothing", async () => {
    const old = await createProbeRow(10); // past the 7-day threshold
    const recent = await createProbeRow(1); // within the 7-day threshold

    const result = await cleanupService.run(
      [
        {
          categoryKey: CATEGORY_KEY,
          resourceType: "_framework_probe",
          resourceId: old.id,
          anchorDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        },
        {
          categoryKey: CATEGORY_KEY,
          resourceType: "_framework_probe",
          resourceId: recent.id,
          anchorDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        },
      ],
      "dry_run",
      userId,
    );

    expect(result.evaluated).toBe(2);
    expect(result.eligible).toBe(1);
    expect(result.deleted).toBe(0);

    expect((await findProbeRow(old.id))?.deletedAt).toBeNull();
    expect((await findProbeRow(recent.id))?.deletedAt).toBeNull();
  });

  it("execute mode soft-deletes only the eligible row, leaving the ineligible one untouched", async () => {
    const old = await createProbeRow(10);
    const recent = await createProbeRow(1);

    const result = await cleanupService.run(
      [
        {
          categoryKey: CATEGORY_KEY,
          resourceType: "_framework_probe",
          resourceId: old.id,
          anchorDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        },
        {
          categoryKey: CATEGORY_KEY,
          resourceType: "_framework_probe",
          resourceId: recent.id,
          anchorDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        },
      ],
      "execute",
      userId,
      deleter,
    );

    expect(result.deleted).toBe(1);
    expect((await findProbeRow(old.id))?.deletedAt).not.toBeNull();
    expect((await findProbeRow(recent.id))?.deletedAt).toBeNull();
  });

  it("a hold blocks deletion, and releasing it restores eligibility", async () => {
    const held = await createProbeRow(10);
    const anchorDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const candidate = {
      categoryKey: CATEGORY_KEY,
      resourceType: "_framework_probe",
      resourceId: held.id,
      anchorDate,
    };

    const hold = await holdRepository.create({
      scope: "entity",
      resourceType: "_framework_probe",
      resourceId: held.id,
      reasonCategory: "legal",
      reason: "litigation hold on this fixture row",
      createdByUserId: userId,
    });

    const blockedResult = await cleanupService.run([candidate], "execute", userId, deleter);
    expect(blockedResult.eligible).toBe(0);
    expect(blockedResult.results[0]?.decision.reasonCode).toBe("active_hold");
    expect((await findProbeRow(held.id))?.deletedAt).toBeNull();

    await holdRepository.release(hold.id, {
      releaseReason: "investigation concluded",
      releasedByUserId: userId,
    });

    const afterReleaseResult = await cleanupService.run([candidate], "execute", userId, deleter);
    expect(afterReleaseResult.eligible).toBe(1);
    expect(afterReleaseResult.deleted).toBe(1);
    expect((await findProbeRow(held.id))?.deletedAt).not.toBeNull();
  });
});
