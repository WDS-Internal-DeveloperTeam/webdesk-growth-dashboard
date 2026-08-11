import { Global, Module } from "@nestjs/common";
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
        // Dynamic import: openid-client is ESM-only, and dashboard-api is
        // CommonJS - a static import compiles to a require() that fails
        // under Node's CJS/ESM interop in some execution environments
        // (observed on Vercel Functions). See auth-config.module's history.
        const client = await import("openid-client");
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
