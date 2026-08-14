import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { NextFunction, Response } from "express";
import { AllExceptionsFilter } from "../src/common/all-exceptions.filter.js";
import {
  CORRELATION_ID_HEADER,
  CorrelationIdMiddleware,
  type RequestWithCorrelationId,
} from "../src/common/correlation-id.middleware.js";
import { HealthModule } from "../src/health/health.module.js";

/**
 * Integration test — boots a real Nest application (HealthModule + the
 * cross-cutting middleware/filter every module gets) and exercises it
 * through supertest. No database, no external API, no cloud resource.
 */
describe("Health endpoints (integration)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [HealthModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new AllExceptionsFilter());
    const correlationIdMiddleware = new CorrelationIdMiddleware();
    app.use((req: RequestWithCorrelationId, res: Response, next: NextFunction) =>
      correlationIdMiddleware.use(req, res, next),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /health returns 200 with status ok", async () => {
    const response = await request(app.getHttpServer()).get("/health");
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(response.body.service).toBe("dashboard-api");
  });

  it("GET /health includes build metadata", async () => {
    const response = await request(app.getHttpServer()).get("/health");
    expect(response.body.build).toBeDefined();
    expect(response.body.build.version).toBe("0.1.0");
  });

  it("GET /ready returns 200 with status ok", async () => {
    const response = await request(app.getHttpServer()).get("/ready");
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
  });

  it("echoes a correlation ID on every response, generating one if absent", async () => {
    const response = await request(app.getHttpServer()).get("/health");
    expect(response.headers[CORRELATION_ID_HEADER]).toBeDefined();
  });

  it("reuses an incoming correlation ID rather than replacing it", async () => {
    const response = await request(app.getHttpServer())
      .get("/health")
      .set(CORRELATION_ID_HEADER, "test-correlation-id");
    expect(response.headers[CORRELATION_ID_HEADER]).toBe("test-correlation-id");
  });

  it("returns a generic ApiErrorResponse shape for a 404", async () => {
    const response = await request(app.getHttpServer()).get("/no-such-route");
    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.correlationId).toBeDefined();
  });
});
