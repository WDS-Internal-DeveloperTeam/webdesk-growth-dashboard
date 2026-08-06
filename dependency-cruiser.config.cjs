/**
 * Monorepo-level architecture-fitness rules, adapted from the base skill's
 * single-app template (webdesk-nodejs/skills/nodejs/templates/architecture-tests/
 * dependency-cruiser.config.cjs) for this project's actual shape: multiple
 * apps/packages under Turborepo workspaces, not one src/ tree. Encodes the
 * rules from README.md's "Package dependency rules" and
 * docs/architecture/decisions/0001-turborepo-monorepo-boundaries.md.
 *
 * Run: npx depcruise apps packages --config dependency-cruiser.config.cjs
 * (via `pnpm boundaries:check`)
 */

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "dashboard-web-no-database-access",
      comment:
        "dashboard-web must not access the database directly (ADR-0002, ADR-0001) — " +
        "it calls dashboard-api for everything. Importing @webdesk/database from " +
        "dashboard-web is a layering violation, not a shortcut.",
      severity: "error",
      from: { path: "^apps/dashboard-web/" },
      to: { path: "^packages/database/" },
    },
    {
      name: "dashboard-web-no-integration-adapters",
      comment:
        "dashboard-web must not call integration adapters directly — all GitHub/" +
        "WordPress/Google Workspace/Blob/queue calls go through dashboard-api or " +
        "dashboard-worker, never the browser/presentation layer.",
      severity: "error",
      from: { path: "^apps/dashboard-web/" },
      to: { path: "^packages/integrations/" },
    },
    {
      name: "no-package-imports-from-apps",
      comment:
        "packages/* must never import from apps/* — dependency flow is one-directional " +
        "(apps depend on packages, never the reverse). A package reaching into an app " +
        "is an inversion that breaks independent packaging/testing of the package.",
      severity: "error",
      from: { path: "^packages/" },
      to: { path: "^apps/" },
    },
    {
      name: "no-circular-package-dependencies",
      comment:
        "No circular dependency between packages. A cycle here means two packages " +
        "cannot be built/tested independently, defeating the point of the boundary.",
      severity: "error",
      from: { path: "^packages/" },
      to: { circular: true },
    },
    {
      name: "only-database-package-touches-sequelize",
      comment:
        "Only packages/database may import sequelize — no other app or package may " +
        "instantiate its own connection or define its own models (WDS-011). This rule " +
        "is a no-op until Sequelize is actually added (Phase 1B) but exists now so a " +
        "premature import anywhere else is caught immediately, not discovered later.",
      severity: "error",
      from: { pathNot: "^packages/database/" },
      to: { path: "(^|/)node_modules/sequelize" },
    },
    {
      name: "no-orphans",
      comment: "Module is imported by nothing — likely dead code. Review and remove, or wire it in.",
      severity: "warn",
      from: {
        orphan: true,
        pathNot: [
          "(^|/)\\.[^/]+\\.(js|cjs|mjs|ts)$",
          "\\.(config|test|spec)\\.(ts|tsx|js|cjs|mjs|mts)$",
          "\\.test\\.tsx?$",
          "\\.e2e-spec\\.ts$",
          "^apps/dashboard-web/(app|next-env\\.d)",
          "^apps/dashboard-api/src/main\\.ts$",
        ],
      },
      to: {},
    },
  ],

  options: {
    moduleSystems: ["es6", "cjs"],
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.base.json" },
    doNotFollow: {
      path: "node_modules",
    },
    exclude: {
      path: "(^|/)(dist|\\.next|coverage|\\.turbo)/",
    },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
