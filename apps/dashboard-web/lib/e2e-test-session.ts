import type { ModuleRegistrySummary, ProjectSummary } from "@webdesk/shared-types";
import type { ServerSession } from "./server-session";

/**
 * A test-only authenticated-session bypass, built for exactly one purpose: letting
 * Playwright's automated WCAG 2.2 AA suite (`tests/e2e/accessibility.spec.ts`) actually
 * scan the real, rendered authenticated application shell. Before this existed, the
 * automated a11y suite could only cover 3 unauthenticated routes — Phase 1C's own
 * pre-provisioned-Google-SSO-only session model means Playwright can never complete a
 * real login in CI (`16-existing-shell-gap-analysis.md` §4), so the entire authenticated
 * shell (the sidebar, header, nav clustering, every new component wired into it) had
 * zero automated accessibility coverage. That is a real, previously-undocumented gap
 * this file closes.
 *
 * SECURITY — read this before touching this file:
 *
 * This must NEVER be reachable from a real deployment. It is gated on TWO independent
 * conditions, both of which must hold, neither of which a request can set on its own:
 *
 * 1. `process.env.NODE_ENV !== "production"`. Every real Vercel deployment (production
 *    AND preview) runs `next build` + `next start`, which Next.js itself always runs
 *    under `NODE_ENV=production` — this is not a value this app sets or could get wrong,
 *    it's Next.js's own build-time behavior. Only `next dev` (this app's own local dev
 *    server, and what Playwright's `webServer` config in `playwright.config.ts` runs)
 *    ever has a non-production `NODE_ENV`. A request cannot influence this — it is fixed
 *    for the entire life of the process before any request is ever handled.
 * 2. `process.env.PLAYWRIGHT_E2E_TEST_MODE === "1"`, set only in
 *    `playwright.config.ts`'s `webServer.env` — never in `.env.local`, never in any real
 *    dev workflow, never in any deployment config. A developer's ordinary `pnpm dev`
 *    session does not have this set, so it never accidentally activates outside a
 *    Playwright run.
 *
 * Even with both conditions true, a request still needs the exact cookie value below —
 * this is not itself a secret (there is nothing secret to protect once both gates above
 * are satisfied in a real deployment they can never be true anyway), it just keeps this
 * bypass from firing on every request in a Playwright run, only the ones that ask for it.
 *
 * This is scoped narrowly on purpose: a fixed fixture session, not a general
 * "impersonate any user" mechanism, and it never touches the real `dashboard-api` or any
 * real session cookie/token logic. If this file is ever changed, the same code-review
 * scrutiny as a change to real authentication code applies, per this project's own
 * accepted task-package instruction — do not treat this as routine test scaffolding.
 */

export const E2E_SESSION_COOKIE_NAME = "wds_e2e_test_session";
const E2E_SESSION_COOKIE_VALUE = "playwright-a11y-fixture-v1";

export function isE2eTestModeEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env["PLAYWRIGHT_E2E_TEST_MODE"] === "1";
}

export function isE2eSessionCookieValid(value: string | undefined): boolean {
  return value === E2E_SESSION_COOKIE_VALUE;
}

export function e2eSessionCookieHeader(): string {
  return `${E2E_SESSION_COOKIE_NAME}=${E2E_SESSION_COOKIE_VALUE}`;
}

function fixtureModule(
  overrides: Partial<ModuleRegistrySummary> & {
    key: string;
    navigationGroup: string;
    navigationOrder: number;
  },
): ModuleRegistrySummary {
  return {
    id: overrides.key,
    name: overrides.key,
    permissionGroupKey: "project_configuration",
    displayName: overrides.key,
    description: null,
    route: `/${overrides.key.replace(/_/g, "-")}`,
    iconReference: null,
    v1InclusionStatus: "included",
    implementationStatus: "available",
    viewPermissionAction: "view",
    actionPermissions: null,
    featureStatus: null,
    documentationReference: "docs.md",
    helpDocumentReference: null,
    owner: "TBD",
    dependencies: null,
    confidentialityLevel: null,
    badgeSupport: true,
    deprecationReference: null,
    canView: true,
    ...overrides,
  };
}

/**
 * A representative slice across all 10 nav groups (including enough `libraries`
 * entries to trigger real cluster sub-headers) — enough surface for axe-core to
 * meaningfully scan the shell's real rendering, without hardcoding all 43 real modules.
 */
const E2E_FIXTURE_NAVIGATION: readonly ModuleRegistrySummary[] = [
  fixtureModule({
    key: "home",
    displayName: "Home",
    navigationGroup: "home",
    navigationOrder: 1,
    route: "/home",
  }),
  fixtureModule({
    key: "projects",
    displayName: "Projects",
    navigationGroup: "projects",
    navigationOrder: 1,
    route: "/projects",
  }),
  fixtureModule({
    key: "page_inventory",
    displayName: "Page Inventory",
    navigationGroup: "pages",
    navigationOrder: 1,
  }),
  fixtureModule({
    key: "business_knowledge_center",
    displayName: "Business Knowledge Center",
    navigationGroup: "libraries",
    navigationOrder: 1,
  }),
  fixtureModule({
    key: "website_strategy_center",
    displayName: "Website Strategy Center",
    navigationGroup: "libraries",
    navigationOrder: 2,
  }),
  fixtureModule({
    key: "case_study_studio",
    displayName: "Case Study Studio",
    navigationGroup: "libraries",
    navigationOrder: 3,
  }),
  fixtureModule({
    key: "brand_library",
    displayName: "Brand Library",
    navigationGroup: "libraries",
    navigationOrder: 6,
  }),
  fixtureModule({
    key: "service_library",
    displayName: "Service Library",
    navigationGroup: "libraries",
    navigationOrder: 16,
  }),
  fixtureModule({
    key: "agent_directory",
    displayName: "Agent Directory",
    navigationGroup: "libraries",
    navigationOrder: 22,
  }),
  fixtureModule({
    key: "ready_for_claude_queue",
    displayName: "Ready for Claude Queue",
    navigationGroup: "workflow",
    navigationOrder: 1,
  }),
  fixtureModule({
    key: "scan_center",
    displayName: "Scan Center",
    navigationGroup: "scans",
    navigationOrder: 1,
  }),
  fixtureModule({
    key: "audit_logs_and_system_health",
    displayName: "Audit Logs & System Health",
    navigationGroup: "technical",
    navigationOrder: 1,
  }),
  fixtureModule({
    key: "release_center",
    displayName: "Release Center",
    navigationGroup: "releases",
    navigationOrder: 1,
  }),
  fixtureModule({
    key: "help_center",
    displayName: "Help Center",
    navigationGroup: "help",
    navigationOrder: 1,
    route: "/help",
  }),
  fixtureModule({
    key: "system_settings",
    displayName: "System Settings",
    navigationGroup: "settings",
    navigationOrder: 1,
  }),
];

const E2E_FIXTURE_PROJECTS: readonly ProjectSummary[] = [
  {
    id: "e2e-fixture-project-1",
    publicId: "e2e-fixture-project-1",
    name: "Fixture Project",
    status: "active",
  },
];

const E2E_FIXTURE_SESSION: ServerSession = {
  me: {
    id: "e2e-fixture-user",
    email: "a11y-fixture@example.com",
    displayName: "A11y Fixture User",
  },
  navigation: E2E_FIXTURE_NAVIGATION,
  projects: E2E_FIXTURE_PROJECTS,
  systemStatus: { environment: null, isDegraded: false },
};

export function getE2eFixtureSession(): ServerSession {
  return E2E_FIXTURE_SESSION;
}
