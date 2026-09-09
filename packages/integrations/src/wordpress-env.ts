import { loadEnv } from "@webdesk/configuration";
import { safeHttpUrlSchema } from "@webdesk/validation";
import { z } from "zod";

/**
 * Read and validated inside `packages/integrations` only — the WordPress integration contract
 * (docs/contracts/wordpress-integration-contract.md "Trust boundary") makes this package the sole
 * holder of WordPress Application Password credentials; no other package or app reads these vars
 * directly. Env-var names are environment-agnostic, same convention as every other credential in
 * this codebase (`DATABASE_URL`, `GOOGLE_OAUTH_CLIENT_ID`, `WEB_APP_ORIGIN`, ...) — per-environment
 * separation (ADR-0012: one dedicated least-privilege account per environment) comes from Vercel's
 * own per-environment env var scoping, not a name suffix; no doc in this project commits to a
 * suffix convention.
 */
export const wordpressEnvSchema = z.object({
  /**
   * e.g. "https://staging-7a61-wdsstage2.wpcomstaging.com" — no trailing slash. Built on the
   * shared `safeHttpUrlSchema` (`@webdesk/validation`), not a bare `z.string().url()` — that
   * bare pattern is exactly what let a real stored-XSS finding (Projects' `environment.url`)
   * through once already; `safeHttpUrlSchema` exists specifically so every new URL-accepting
   * field gets the http(s)-only restriction by construction.
   */
  WORDPRESS_BASE_URL: safeHttpUrlSchema.refine(
    (url) => !url.endsWith("/"),
    "WORDPRESS_BASE_URL must not have a trailing slash",
  ),
  /**
   * The dedicated least-privilege integration account's username (ADR-0012) — never a personal or
   * admin account. Real per-environment values are an unconfirmed setup-time input
   * (docs/project-state/setup-input-register.md, "WordPress Application Password accounts, per
   * environment") — every test in this repo uses a throwaway value.
   */
  WORDPRESS_APP_USERNAME: z.string().min(1, "WORDPRESS_APP_USERNAME is required"),
  /**
   * The Application Password itself. WordPress's own admin UI displays it space-separated
   * (`abcd efgh ijkl mnop qrst uvwx`) purely for readability — Basic Auth transmits whatever bytes
   * are given verbatim, so this is accepted with or without spaces.
   */
  WORDPRESS_APP_PASSWORD: z.string().min(1, "WORDPRESS_APP_PASSWORD is required"),
});

export type WordPressEnv = z.infer<typeof wordpressEnvSchema>;

export function loadWordPressEnv(
  source: Record<string, string | undefined> = process.env,
): WordPressEnv {
  return loadEnv(wordpressEnvSchema, source);
}
