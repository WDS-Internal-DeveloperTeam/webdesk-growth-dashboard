import { randomBytes, randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import {
  buildMigrator,
  closeConnection,
  RoleRepository,
  UserRepository,
  UserRoleRepository,
} from "@webdesk/database";
import * as client from "openid-client";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import cookieParser from "cookie-parser";
import type { NextFunction, Response } from "express";
import { AllExceptionsFilter } from "../src/common/all-exceptions.filter.js";
import {
  CorrelationIdMiddleware,
  type RequestWithCorrelationId,
} from "../src/common/correlation-id.middleware.js";
import { AUTH_ENV, OIDC_CONFIGURATION } from "../src/auth/config/auth.constants.js";
import type { AuthEnv } from "../src/auth/config/auth-env.js";
import { SessionService } from "../src/auth/session/session.service.js";
import { AuditService } from "../src/audit/audit.service.js";
import { DecisionAndActivityLogModule } from "../src/decision-and-activity-log/decision-and-activity-log.module.js";

/**
 * Request-level coverage for the Decision and Activity Log module's HTTP surface
 * (`docs/implementation/module-decision-and-activity-log.md`), against a REAL disposable
 * PostgreSQL database — same harness pattern as `../test/business-knowledge.e2e-spec.ts`.
 * `system_settings` has real, deliberately NARROW seeded grants (`00013-seed-rbac-matrix.ts`:
 * `super_admin: "VCERM"`, `owner_growth_approver: "VM"`) — only these two roles hold `view`; a
 * `read_only`/`marketing_editor` session (both hold no `system_settings` grant at all) proves the
 * 403 side.
 */

process.env.GOOGLE_OAUTH_CLIENT_ID ??= "test-client-id";
process.env.GOOGLE_OAUTH_CLIENT_SECRET ??= "test-client-secret";
process.env.GOOGLE_OAUTH_REDIRECT_URI ??= "https://api.example.com/auth/google/callback";
process.env.WEB_APP_ORIGIN ??= "https://dashboard.example.com";
process.env.TOTP_ENCRYPTION_KEY ??= randomBytes(32).toString("hex");
process.env.SESSION_COOKIE_SECURE ??= "false";
process.env.AUTH_LOCKOUT_MAX_ATTEMPTS ??= "3";
process.env.AUTH_LOCKOUT_WINDOW_SECONDS ??= "900";
process.env.AUTH_LOCKOUT_DURATION_SECONDS ??= "900";

describe("Decision and Activity Log module endpoints (e2e, real disposable database)", () => {
  let app: INestApplication;
  let users: UserRepository;
  let roles: RoleRepository;
  let userRoles: UserRoleRepository;
  let sessionService: SessionService;
  let authEnv: AuthEnv;
  let auditService: AuditService;

  let superAdminUserId: string;
  let ownerGrowthApproverUserId: string;
  let readOnlyUserId: string;

  async function cookieForNewSession(userId: string): Promise<string> {
    const { rawToken } = await sessionService.issue({
      userId,
      authMethod: "google_sso",
      requiresMfa: false,
    });
    return `${authEnv.SESSION_COOKIE_NAME}=${rawToken}`;
  }

  async function createUserWithRole(emailPrefix: string, roleKey: string): Promise<string> {
    const user = await users.create({
      email: `${emailPrefix}.e2e@webdesksolution.com`,
      displayName: `${emailPrefix} E2E`,
      accountStatus: "active",
    });
    const role = await roles.findByKey(roleKey);
    if (!role) {
      throw new Error(`Expected ${roleKey} role was not seeded — check migration 00013`);
    }
    await userRoles.assign(user.id, role.id);
    return user.id;
  }

  beforeAll(async () => {
    const migrator = buildMigrator();
    await migrator.up();

    const offlineOidcConfig = new client.Configuration(
      {
        issuer: "https://accounts.google.com",
        authorization_endpoint: "https://accounts.google.com/o/oauth2/v2/auth",
        token_endpoint: "https://oauth2.googleapis.com/token",
      },
      "test-client-id",
      "test-client-secret",
    );

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [DecisionAndActivityLogModule],
    })
      .overrideProvider(OIDC_CONFIGURATION)
      .useValue(offlineOidcConfig)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new AllExceptionsFilter());
    app.use(cookieParser());
    const correlationIdMiddleware = new CorrelationIdMiddleware();
    app.use((req: RequestWithCorrelationId, res: Response, next: NextFunction) =>
      correlationIdMiddleware.use(req, res, next),
    );
    await app.init();

    sessionService = moduleRef.get(SessionService);
    authEnv = moduleRef.get(AUTH_ENV);
    auditService = moduleRef.get(AuditService);

    users = new UserRepository();
    roles = new RoleRepository();
    userRoles = new UserRoleRepository();

    superAdminUserId = await createUserWithRole("dal.super-admin", "super_admin");
    ownerGrowthApproverUserId = await createUserWithRole(
      "dal.owner-growth-approver",
      "owner_growth_approver",
    );
    readOnlyUserId = await createUserWithRole("dal.read-only", "read_only");
  }, 30_000);

  afterAll(async () => {
    await app.close();
    const migrator = buildMigrator();
    await migrator.down({ to: 0 });
    await closeConnection();
  }, 30_000);

  async function seedEvent(overrides: Partial<Parameters<typeof auditService.record>[0]> = {}) {
    return auditService.record({
      eventType: "approval",
      actorUserId: superAdminUserId,
      actorType: "human",
      entityType: "project",
      entityId: randomUUID(),
      action: "status_changed",
      retentionCategory: "approval-audit-7y",
      ...overrides,
    });
  }

  it("rejects GET /decision-and-activity-log/events with 401 when there is no session cookie", async () => {
    await request(app.getHttpServer()).get("/decision-and-activity-log/events").expect(401);
  });

  it("denies a read_only session with 403 — system_settings:view is seeded ONLY for super_admin/owner_growth_approver", async () => {
    const cookie = await cookieForNewSession(readOnlyUserId);
    await request(app.getHttpServer())
      .get("/decision-and-activity-log/events")
      .set("Cookie", cookie)
      .expect(403);
  });

  it("allows a real super_admin session to list events, restricted to the module's own event-type allowlist", async () => {
    const approval = await seedEvent({ eventType: "approval" });
    const login = await seedEvent({
      eventType: "login",
      actorType: "human",
      entityType: "user",
      action: "login",
      retentionCategory: "audit-7y",
    });

    const cookie = await cookieForNewSession(superAdminUserId);
    const response = await request(app.getHttpServer())
      .get("/decision-and-activity-log/events")
      .set("Cookie", cookie)
      .expect(200);

    expect(response.body.success).toBe(true);
    const ids = (response.body.data as Array<{ id: string }>).map((row) => row.id);
    expect(ids).toContain(approval.id);
    expect(ids).not.toContain(login.id);
  });

  it("allows a real owner_growth_approver session (VM grant includes view)", async () => {
    const cookie = await cookieForNewSession(ownerGrowthApproverUserId);
    await request(app.getHttpServer())
      .get("/decision-and-activity-log/events")
      .set("Cookie", cookie)
      .expect(200);
  });

  it("narrows results with an explicit ?eventType= filter", async () => {
    const rollback = await seedEvent({ eventType: "rollback" });
    const scan = await seedEvent({ eventType: "scan_run" });

    const cookie = await cookieForNewSession(superAdminUserId);
    const response = await request(app.getHttpServer())
      .get("/decision-and-activity-log/events")
      .query({ eventType: "rollback" })
      .set("Cookie", cookie)
      .expect(200);

    const ids = (response.body.data as Array<{ id: string }>).map((row) => row.id);
    expect(ids).toContain(rollback.id);
    expect(ids).not.toContain(scan.id);
  });

  it("rejects an eventType outside the module's own allowlist with a clean 400, not silently ignoring it", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .get("/decision-and-activity-log/events")
      .query({ eventType: "login" })
      .set("Cookie", cookie)
      .expect(400);
  });

  it("supports pagination via limit/offset", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const response = await request(app.getHttpServer())
      .get("/decision-and-activity-log/events")
      .query({ eventType: "approval", limit: 1, offset: 0 })
      .set("Cookie", cookie)
      .expect(200);

    expect((response.body.data as unknown[]).length).toBeLessThanOrEqual(1);
  });
});
