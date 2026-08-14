import { afterEach, describe, expect, it } from "vitest";
import { getBuildMetadata } from "./build-metadata.js";

const ENV_KEYS = [
  "VERCEL_GIT_COMMIT_SHA",
  "VERCEL_ENV",
  "VERCEL_DEPLOYMENT_ID",
  "NODE_ENV",
] as const;

function clearEnv(): void {
  for (const key of ENV_KEYS) delete process.env[key];
}

describe("getBuildMetadata", () => {
  afterEach(() => {
    clearEnv();
  });

  it("reports 'unknown' for every field outside Vercel, never a fabricated value", () => {
    clearEnv();
    const metadata = getBuildMetadata("0.1.0");
    expect(metadata.commitSha).toBe("unknown");
    expect(metadata.commitShaShort).toBe("unknown");
    expect(metadata.deploymentId).toBe("unknown");
  });

  it("reads real Vercel-injected env vars when present", () => {
    process.env["VERCEL_GIT_COMMIT_SHA"] = "abcdef1234567890";
    process.env["VERCEL_ENV"] = "production";
    process.env["VERCEL_DEPLOYMENT_ID"] = "dpl_123";

    const metadata = getBuildMetadata("1.2.3");
    expect(metadata.commitSha).toBe("abcdef1234567890");
    expect(metadata.commitShaShort).toBe("abcdef1");
    expect(metadata.environment).toBe("production");
    expect(metadata.deploymentId).toBe("dpl_123");
  });

  it("falls back to NODE_ENV when VERCEL_ENV is absent", () => {
    process.env["NODE_ENV"] = "test";
    const metadata = getBuildMetadata("0.1.0");
    expect(metadata.environment).toBe("test");
  });

  it("passes the caller-supplied version straight through", () => {
    expect(getBuildMetadata("9.9.9").version).toBe("9.9.9");
  });

  it("returns a stable processStartedAt across repeated calls (computed once at module load)", () => {
    const first = getBuildMetadata("0.1.0").processStartedAt;
    const second = getBuildMetadata("0.1.0").processStartedAt;
    expect(first).toBe(second);
  });
});
