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

  it("getReady() reports ok status with an empty checks map at Phase 1A", () => {
    const result = controller.getReady();
    expect(result.status).toBe("ok");
    expect(result.checks).toEqual({});
  });
});
