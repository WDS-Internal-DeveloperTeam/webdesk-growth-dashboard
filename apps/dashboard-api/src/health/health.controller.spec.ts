import { Test, type TestingModule } from "@nestjs/testing";
import { beforeEach, describe, expect, it } from "vitest";
import { HealthController } from "./health.controller.js";

describe("HealthController", () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it("getHealth() reports ok status for dashboard-api", () => {
    const result = controller.getHealth();
    expect(result.status).toBe("ok");
    expect(result.service).toBe("dashboard-api");
  });

  it("getHealth() includes safe build/release metadata, never a fabricated commit SHA", () => {
    const result = controller.getHealth();
    expect(result.build).toBeDefined();
    expect(result.build?.version).toBe("0.1.0");
    // No VERCEL_GIT_COMMIT_SHA in the test environment — must report "unknown", not guess.
    expect(result.build?.commitSha).toBe("unknown");
  });

  it("getReady() reports ok status with an empty checks map at Phase 1A", () => {
    const result = controller.getReady();
    expect(result.status).toBe("ok");
    expect(result.checks).toEqual({});
  });

  it("getReady() also includes build metadata", () => {
    const result = controller.getReady();
    expect(result.build).toBeDefined();
  });
});
