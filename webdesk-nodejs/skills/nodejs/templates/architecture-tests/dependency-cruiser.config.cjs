/**
 * dependency-cruiser configuration — architecture fitness rules.
 *
 * CommonJS (.cjs) on purpose: dependency-cruiser loads its config with require(),
 * so this file stays CJS even though the app itself is ESM ("type":"module").
 *
 * Run:  npx depcruise src --config architecture-tests/dependency-cruiser.config.cjs
 *
 * Each rule encodes one architectural boundary from knowledge/09-forbidden.md and
 * architecture-tests/README.md. `severity: error` fails the build (gated at G5);
 * `severity: warn` surfaces but does not fail.
 *
 * Path assumptions (adjust the regexes if your tree differs):
 *   src/controllers/**     HTTP only
 *   src/services/**        business logic
 *   src/repositories/**    ONLY layer that touches the DB
 *   src/db/**              Sequelize instance + models
 *   src/integrations/engine/**     the sync engine (ERP-neutral)
 *   src/integrations/erp/<erp>/sdk* per-ERP SDK / transport
 */

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      // BOUNDARY 1 — NODE-003: only repositories (and db/) may touch the DB.
      name: 'no-db-outside-repositories',
      comment:
        'Only src/repositories/** and src/db/** may import sequelize or the db module. ' +
        'DB access anywhere else bypasses tenant-scoping (NODE-104) and the transaction ' +
        'choke point. Move the query into a repository and call it from a service.',
      severity: 'error',
      from: {
        // Everything EXCEPT the repository and db layers...
        pathNot: '^src/(repositories|db)/',
      },
      to: {
        // ...must not reach the ORM or the db module.
        path: '(^|/)node_modules/sequelize|^src/db(/|$)',
      },
    },

    {
      // BOUNDARY 2 — controllers are HTTP-only: controller → service → repository.
      name: 'controllers-must-not-import-repositories',
      comment:
        'Controllers must not import repositories directly. They delegate to services, ' +
        'which own the business logic and call repositories. A controller reaching a ' +
        'repository skips the service layer.',
      severity: 'error',
      from: { path: '^src/controllers/' },
      to: { path: '^src/repositories/' },
    },

    {
      // BOUNDARY 3 — dependencies point inward; services never import controllers.
      name: 'services-must-not-import-controllers',
      comment:
        'Services must not import controllers. Dependencies flow ' +
        'controller → service → repository, never back out. A service importing a ' +
        'controller is a layering inversion (and usually a cycle).',
      severity: 'error',
      from: { path: '^src/services/' },
      to: { path: '^src/controllers/' },
    },

    {
      // BOUNDARY 4 — the sync engine never imports an ERP SDK.
      name: 'no-erp-sdk-in-engine',
      comment:
        'The sync engine must talk ONLY to the common ERP adapter interface, never an ' +
        'ERP-specific SDK/transport. Importing src/integrations/erp/<erp>/sdk into the ' +
        'engine re-couples them and defeats the adapter pattern. Route it through the ' +
        'adapter interface instead.',
      severity: 'error',
      from: { path: '^src/integrations/engine/' },
      to: { path: '^src/integrations/erp/[^/]+/sdk' },
    },

    {
      // BOUNDARY 7 — dead code surfaced (warn, not fail).
      name: 'no-orphans',
      comment:
        'Module is imported by nothing and imports of it are not the entrypoint. ' +
        'Likely dead code — review and remove, or wire it in.',
      severity: 'warn',
      from: {
        orphan: true,
        // Don't flag legitimate non-imported files.
        pathNot: [
          '(^|/)\\.[^/]+\\.(js|cjs|mjs)$', // dotfiles
          '\\.(config|test|spec)\\.(js|cjs|mjs)$',
          '^src/server\\.js$', // process entrypoint
        ],
      },
      to: {},
    },
  ],

  options: {
    // Resolve ESM + CJS; the app is ESM but this config and some tooling are CJS.
    moduleSystems: ['es6', 'cjs'],
    doNotFollow: {
      path: 'node_modules',
    },
    // Treat these as the project's source roots when reporting.
    tsPreCompilationDeps: false,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
