import { describe, expect, it, vi } from "vitest";
import {
  checkCoreVersion,
  checkDatabase,
  clearCache,
  flushRewriteRules,
  NotConfiguredWpCliExecutor,
  runCaseStudyMigration,
  WpCliNotConfiguredError,
  type WpCliExecutor,
  type WpCliResult,
} from "./wp-cli-actions.js";

function ok(stdout: string): WpCliResult {
  return { stdout, stderr: "", exitCode: 0 };
}

function fail(stderr: string, exitCode = 1): WpCliResult {
  return { stdout: "", stderr, exitCode };
}

function fakeExecutor(run: WpCliExecutor["run"]): WpCliExecutor {
  return { run };
}

describe("NotConfiguredWpCliExecutor", () => {
  it("throws WpCliNotConfiguredError instead of fabricating a result", async () => {
    const executor = new NotConfiguredWpCliExecutor();
    await expect(executor.run("staging", ["core", "version"])).rejects.toThrow(
      WpCliNotConfiguredError,
    );
  });

  it("names the environment in the error message", async () => {
    const executor = new NotConfiguredWpCliExecutor();
    await expect(executor.run("production", [])).rejects.toThrow(/"production"/);
  });
});

describe("checkCoreVersion", () => {
  it("runs two separate wp-cli invocations and trims each result", async () => {
    const run = vi.fn().mockResolvedValueOnce(ok("7.0.2\n")).mockResolvedValueOnce(ok("8.4.1\n"));
    const result = await checkCoreVersion(fakeExecutor(run), "staging");
    expect(result).toEqual({ wpVersion: "7.0.2", phpVersion: "8.4.1" });
    expect(run).toHaveBeenCalledWith("staging", ["core", "version"]);
    expect(run).toHaveBeenCalledWith("staging", ["eval", "echo PHP_VERSION;"]);
  });
});

describe("clearCache", () => {
  it("reports cleared: true on exit code 0", async () => {
    const run = vi.fn().mockResolvedValue(ok("Cache cleared."));
    const result = await clearCache(fakeExecutor(run), "development");
    expect(result).toEqual({ cleared: true, message: "Cache cleared." });
    expect(run).toHaveBeenCalledWith("development", ["cache", "flush"]);
  });

  it("reports cleared: false and surfaces stderr on a non-zero exit", async () => {
    const run = vi.fn().mockResolvedValue(fail("no cache backend"));
    const result = await clearCache(fakeExecutor(run), "development");
    expect(result).toEqual({ cleared: false, message: "no cache backend" });
  });
});

describe("flushRewriteRules", () => {
  it("invokes wp rewrite flush --hard", async () => {
    const run = vi.fn().mockResolvedValue(ok(""));
    await flushRewriteRules(fakeExecutor(run), "staging");
    expect(run).toHaveBeenCalledWith("staging", ["rewrite", "flush", "--hard"]);
  });

  it("throws instead of silently succeeding when the underlying command fails", async () => {
    const run = vi.fn().mockResolvedValue(fail("Error: could not flush rewrite rules"));
    await expect(flushRewriteRules(fakeExecutor(run), "staging")).rejects.toThrow(
      /could not flush rewrite rules/,
    );
  });
});

describe("checkDatabase", () => {
  it("reports ok on exit code 0", async () => {
    const run = vi.fn().mockResolvedValue(ok("Success: Database checks complete."));
    const result = await checkDatabase(fakeExecutor(run), "staging");
    expect(result.ok).toBe(true);
  });
});

describe("runCaseStudyMigration", () => {
  const reportJson = JSON.stringify({
    dryRun: true,
    beforeCounts: { casestudy: 40, portfolio: 12 },
    afterCounts: { casestudy: 40, portfolio: 12 },
    errors: [],
    rollbackInstructions: "Restore from the pre-migration backup tagged in this run's own log.",
  });

  it("defaults to --dry-run and never requires approval for a dry run", async () => {
    const run = vi.fn().mockResolvedValue(ok(reportJson));
    const report = await runCaseStudyMigration(fakeExecutor(run), "production", { dryRun: true });
    expect(report.dryRun).toBe(true);
    expect(run).toHaveBeenCalledWith("production", [
      "webdesk",
      "migrate-case-study-portfolio",
      "--dry-run",
      "--format=json",
    ]);
  });

  it("rejects an --apply run against production with no approval, and never calls the executor", async () => {
    const run = vi.fn();
    await expect(
      runCaseStudyMigration(fakeExecutor(run), "production", { dryRun: false }),
    ).rejects.toThrow(/require explicit \{ approved: true \}/);
    expect(run).not.toHaveBeenCalled();
  });

  it("allows an approved --apply run against production", async () => {
    const run = vi.fn().mockResolvedValue(ok(reportJson));
    await runCaseStudyMigration(fakeExecutor(run), "production", { dryRun: false, approved: true });
    expect(run).toHaveBeenCalledWith("production", [
      "webdesk",
      "migrate-case-study-portfolio",
      "--apply",
      "--format=json",
    ]);
  });

  it("allows an --apply run against staging with no approval flag (only production is gated)", async () => {
    const run = vi.fn().mockResolvedValue(ok(reportJson));
    await runCaseStudyMigration(fakeExecutor(run), "staging", { dryRun: false });
    expect(run).toHaveBeenCalled();
  });

  it("throws on a non-zero exit code instead of trying to parse garbage as a report", async () => {
    const run = vi.fn().mockResolvedValue(fail("migration script crashed", 1));
    await expect(
      runCaseStudyMigration(fakeExecutor(run), "staging", { dryRun: true }),
    ).rejects.toThrow(/migration script crashed/);
  });

  it("throws when the script's own stdout doesn't match the expected report shape", async () => {
    const run = vi.fn().mockResolvedValue(ok(JSON.stringify({ unexpected: true })));
    await expect(
      runCaseStudyMigration(fakeExecutor(run), "staging", { dryRun: true }),
    ).rejects.toThrow();
  });
});
