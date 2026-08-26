import { describe, expect, it } from "vitest";
import {
  allowedLifecycleTargets,
  buildWorkspaceHref,
  DEFAULT_TAB_KEY,
  findTab,
  isOffPathStage,
  LIFECYCLE_MAIN_PATH,
  LIFECYCLE_STAGE_LABEL,
  lifecycleStageBadge,
  REOPENABLE_STATUSES,
  VERSION_TRANSITIONS,
  WORKSPACE_TABS,
} from "@/lib/page-workspace-query";

describe("page-workspace-query", () => {
  describe("tabs", () => {
    it("exposes the 16 tabs the spec names, 15 of them backed by a stored artifact type", () => {
      expect(WORKSPACE_TABS).toHaveLength(16);
      expect(WORKSPACE_TABS.filter((tab) => tab.artifactType !== null)).toHaveLength(15);
      // History is derived from the version list, not stored (backend D3).
      expect(WORKSPACE_TABS.at(-1)).toMatchObject({ key: "history", artifactType: null });
    });

    it("falls back to the first tab for an unknown or missing key", () => {
      expect(findTab(undefined).key).toBe(DEFAULT_TAB_KEY);
      expect(findTab("not-a-tab").key).toBe(DEFAULT_TAB_KEY);
      expect(findTab("content").artifactType).toBe("content");
    });

    it("builds a deep-linkable href carrying both the project and the tab", () => {
      const href = buildWorkspaceHref("page-1", "project-1", "qa");
      expect(href).toContain("/page-workspace/page-1?");
      expect(href).toContain("projectId=project-1");
      expect(href).toContain("tab=qa");
    });
  });

  describe("lifecycle stages", () => {
    it("treats only the 16 main-path stages as on-path", () => {
      expect(LIFECYCLE_MAIN_PATH).toHaveLength(16);
      for (const stage of LIFECYCLE_MAIN_PATH) {
        expect(isOffPathStage(stage)).toBe(false);
      }
      for (const stage of ["paused", "blocked", "failed", "rolled_back", "archived"] as const) {
        expect(isOffPathStage(stage)).toBe(true);
      }
    });

    it("labels every stage, including the off-path ones", () => {
      // A missing label would render an empty badge rather than failing loudly.
      for (const stage of Object.keys(LIFECYCLE_STAGE_LABEL)) {
        expect(LIFECYCLE_STAGE_LABEL[stage as keyof typeof LIFECYCLE_STAGE_LABEL]).toBeTruthy();
      }
    });

    it("uses only real StatusToken values", () => {
      const valid = ["healthy", "degraded", "unavailable", "unknown"];
      for (const stage of Object.keys(LIFECYCLE_STAGE_LABEL)) {
        const badge = lifecycleStageBadge(stage as keyof typeof LIFECYCLE_STAGE_LABEL);
        expect(valid).toContain(badge.token);
      }
    });
  });
});

describe("allowedLifecycleTargets", () => {
  it("offers the next main-path stage plus the interrupt states", () => {
    const targets = allowedLifecycleTargets("proposed", null);
    expect(targets).toContain("approved_for_planning");
    expect(targets).toEqual(
      expect.arrayContaining(["revision_requested", "blocked", "paused", "failed", "archived"]),
    );
  });

  it("offers rollback only from the two deployed stages", () => {
    expect(allowedLifecycleTargets("staging_deployed", null)).toContain("rolled_back");
    expect(allowedLifecycleTargets("production_deployed", null)).toContain("rolled_back");
    expect(allowedLifecycleTargets("in_development", null)).not.toContain("rolled_back");
  });

  it("offers only archival from verified — nothing follows the happy path", () => {
    expect(allowedLifecycleTargets("verified", null)).toEqual(["archived"]);
  });

  it("offers nothing at all from archived, which is terminal", () => {
    expect(allowedLifecycleTargets("archived", null)).toEqual([]);
  });

  it("lets an interrupted page resume only to where it actually came from", () => {
    // The whole point of lifecyclePreviousStage: without it, pausing would become a way to skip
    // every approval gate between here and anywhere else.
    const targets = allowedLifecycleTargets("paused", "in_development");
    expect(targets).toEqual(["in_development", "archived"]);
    expect(targets).not.toContain("production_approved");
  });

  it("offers only archival when an interrupted page has no recorded resume point", () => {
    expect(allowedLifecycleTargets("blocked", null)).toEqual(["archived"]);
  });

  it("never offers a stage that is not a legal successor", () => {
    // Guards the mirror against drifting into offering a jump the backend would reject.
    expect(allowedLifecycleTargets("proposed", null)).not.toContain("production_deployed");
    expect(allowedLifecycleTargets("in_strategy", null)).not.toContain("verified");
  });
});

describe("version transitions", () => {
  it("treats superseded and archived as terminal", () => {
    expect(VERSION_TRANSITIONS.superseded).toEqual([]);
    expect(VERSION_TRANSITIONS.archived).toEqual([]);
  });

  it("lets a rejected or revision-requested version return to draft", () => {
    // The workflow bug a Service Library review caught once: without this the author of rejected
    // work could never revise and resubmit it.
    expect(VERSION_TRANSITIONS.rejected).toContain("draft");
    expect(VERSION_TRANSITIONS.revision_requested).toContain("draft");
  });

  it("only allows reopening an approved or archived version", () => {
    expect([...REOPENABLE_STATUSES].sort()).toEqual(["approved", "archived"]);
  });
});
