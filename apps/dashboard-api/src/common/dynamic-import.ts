/**
 * Indirect (eval-based) dynamic import. Defeats bundler-level rewriting of
 * `import()` syntax: a plain `await import(specifier)` was independently
 * observed being rewritten back into a synchronous require() by two
 * different toolchains for a CommonJS target - TypeScript's own downlevel
 * emit, and (separately, since Vercel's Function bundler does not consume
 * our compiled dist/ output for src/ files, it re-transpiles the same
 * source itself) Vercel's own Function bundler - both throwing
 * ERR_REQUIRE_ESM for genuinely ESM-only packages like openid-client. A
 * string passed to `Function(...)` is opaque to static analysis in either
 * toolchain, so the `import()` inside it survives untouched.
 */
const indirectImport = new Function("specifier", "return import(specifier)") as (
  specifier: string,
) => Promise<unknown>;

/**
 * Under Vitest, use a literal `import()` instead: Vite's own SSR module
 * runner needs to see and instrument the literal expression for
 * `vi.mock()` interception to work, and doesn't support resolving a
 * dynamic import hidden inside a Function-constructed string (throws "A
 * dynamic import callback was not specified"). This branch never runs in
 * production - `VITEST` is set automatically by Vitest itself, never on
 * Vercel - so the plain `import()` here is dead code outside tests even
 * if a bundler's static rewrite ends up touching it.
 */
export function dynamicImport<T>(specifier: string): Promise<T> {
  if (process.env["VITEST"]) {
    return import(specifier) as Promise<T>;
  }
  return indirectImport(specifier) as Promise<T>;
}
