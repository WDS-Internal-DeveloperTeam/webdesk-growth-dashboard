import { Global, Module } from "@nestjs/common";
import type * as Client from "openid-client";
import { dynamicImport } from "../../common/dynamic-import.js";
import { AUTH_ENV, OIDC_CONFIGURATION } from "./auth.constants.js";
import { loadAuthEnv } from "./auth-env.js";

/**
 * Global so every auth sub-module (google, emergency, session, recovery,
 * events) can inject `AUTH_ENV`/`OIDC_CONFIGURATION` without each
 * re-importing this module explicitly.
 *
 * `OIDC_CONFIGURATION` is built via `client.discovery()` — a real network
 * call to the issuer's `.well-known/openid-configuration` at module
 * instantiation (this is issuer-level metadata, not client-specific, so it
 * succeeds even with a placeholder client ID/secret; those only matter at
 * actual token-exchange time). Tests that must stay offline override this
 * provider with a `Configuration` built directly from a static
 * `ServerMetadata` object instead (see
 * apps/dashboard-api/src/auth/google/google-auth.service.spec.ts).
 */
@Global()
@Module({
  providers: [
    { provide: AUTH_ENV, useFactory: () => loadAuthEnv() },
    {
      provide: OIDC_CONFIGURATION,
      useFactory: async (env: ReturnType<typeof loadAuthEnv>) => {
        // Bundler-defeating dynamic import: see dynamic-import.ts's comment.
        // A plain `await import("openid-client")` was observed getting
        // rewritten back into a require() by both tsc's own CommonJS
        // downlevel emit and, separately, Vercel's Function bundler
        // (which re-transpiles this file itself rather than consuming our
        // compiled dist/ output) - both throwing ERR_REQUIRE_ESM.
        const client = await dynamicImport<typeof Client>("openid-client");
        return client.discovery(
          new URL(env.GOOGLE_OAUTH_ISSUER_URL),
          env.GOOGLE_OAUTH_CLIENT_ID,
          env.GOOGLE_OAUTH_CLIENT_SECRET,
        );
      },
      inject: [AUTH_ENV],
    },
  ],
  exports: [AUTH_ENV, OIDC_CONFIGURATION],
})
export class AuthConfigModule {}
