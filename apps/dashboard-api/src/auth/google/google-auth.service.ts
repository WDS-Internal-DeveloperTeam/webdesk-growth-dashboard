import { Inject, Injectable } from "@nestjs/common";
import type {
  AuthEventRepository,
  ExternalAuthIdentityRepository,
  SessionEntity,
  UserEntity,
  UserRepository,
} from "@webdesk/database";
import type * as Client from "openid-client";
import { dynamicImport } from "../../common/dynamic-import.js";
import {
  AUTH_ENV,
  AUTH_EVENT_REPOSITORY,
  EXTERNAL_AUTH_IDENTITY_REPOSITORY,
  OIDC_CONFIGURATION,
  USER_REPOSITORY,
} from "../config/auth.constants.js";
import type { AuthEnv } from "../config/auth-env.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- must be a real (value) import: NestJS's constructor-injection relies on emitDecoratorMetadata, which needs the actual class reference at runtime, not just its type.
import { SessionService } from "../session/session.service.js";
import type { OidcTransaction } from "./oidc-transaction.js";

export interface GoogleAuthorizationRequest {
  readonly redirectUrl: URL;
  readonly transaction: OidcTransaction;
}

export type GoogleCallbackResult =
  | {
      readonly ok: true;
      readonly user: UserEntity;
      readonly session: SessionEntity;
      readonly rawToken: string;
    }
  | { readonly ok: false; readonly reason: string };

/**
 * Google Workspace OIDC — Authorization Code flow with PKCE (ADR-0008,
 * knowledge/05). Issuer/audience/signature/expiry/nonce validation is
 * performed by `openid-client` itself inside `authorizationCodeGrant`; this
 * service adds the domain allowlist and pre-provisioned-only user-matching
 * checks on top, per docs/task-packages/phase-1c-authentication-sessions.md
 * §2/§4.
 *
 * Every rejection path returns the same shape (`{ ok: false, reason }`) —
 * `reason` is for the audit event only, never surfaced to the caller
 * verbatim (knowledge/05: "without leaking to the rejected user *which*
 * check failed"). The controller maps every `ok: false` to one identical
 * generic HTTP response regardless of `reason`.
 *
 * The `token_exchange_failed` catch below additionally logs the underlying
 * `openid-client` error server-side only (Vercel runtime logs, never the
 * HTTP response or the `reason` field/`auth_events` row) — that catch
 * previously swallowed the real cause entirely, making a systemic
 * misconfiguration (e.g. a `redirect_uri` mismatch against the registered
 * OAuth client) indistinguishable from a one-off failure. Uses `console.error`
 * directly rather than `@nestjs/common`'s `Logger` — a first attempt at this
 * (2026-08-12) used `new Logger(GoogleAuthService.name)` and never appeared
 * in Vercel's logs for real production failures, despite working in every
 * local/unit-test check; the exact cause wasn't tracked down (candidates:
 * `app.useLogger()`'s override not reaching plain `new Logger()` instances
 * in this Vercel Function's specific bundling, or a pino/nestjs-pino
 * integration gap), but `console.error` is confirmed captured by Vercel
 * (the same channel that surfaced this app's own NestJS bootstrap-crash
 * logs), so it's used here directly instead of chasing that mystery further.
 */
@Injectable()
export class GoogleAuthService {
  constructor(
    @Inject(OIDC_CONFIGURATION) private readonly oidcConfig: Client.Configuration,
    @Inject(AUTH_ENV) private readonly env: AuthEnv,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(EXTERNAL_AUTH_IDENTITY_REPOSITORY)
    private readonly identities: ExternalAuthIdentityRepository,
    @Inject(AUTH_EVENT_REPOSITORY) private readonly events: AuthEventRepository,
    private readonly sessionService: SessionService,
  ) {}

  async buildAuthorizationRequest(): Promise<GoogleAuthorizationRequest> {
    // Bundler-defeating dynamic import: see dynamic-import.ts's comment.
    const client = await dynamicImport<typeof Client>("openid-client");
    const codeVerifier = client.randomPKCECodeVerifier();
    const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
    const state = client.randomState();
    const nonce = client.randomNonce();

    const redirectUrl = client.buildAuthorizationUrl(this.oidcConfig, {
      redirect_uri: this.env.GOOGLE_OAUTH_REDIRECT_URI,
      scope: "openid email profile",
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      state,
      nonce,
    });

    return { redirectUrl, transaction: { state, nonce, codeVerifier } };
  }

  async handleCallback(
    currentUrl: URL,
    transaction: OidcTransaction,
    context: { ipHash: string | null; userAgent: string | null; now?: Date },
  ): Promise<GoogleCallbackResult> {
    const client = await dynamicImport<typeof Client>("openid-client");
    const now = context.now ?? new Date();

    let claims: Client.IDToken | undefined;
    try {
      const tokens = await client.authorizationCodeGrant(this.oidcConfig, currentUrl, {
        expectedState: transaction.state,
        expectedNonce: transaction.nonce,
        pkceCodeVerifier: transaction.codeVerifier,
      });
      claims = tokens.claims();
    } catch (error) {
      // Server-side-only diagnostic: never sent to the browser, never written to auth_events.reason.
      console.error(
        `[GoogleAuthService] Google OIDC token exchange failed: ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`,
        error instanceof Error ? error.stack : error,
      );
      return this.reject("token_exchange_failed", now);
    }

    if (!claims) {
      return this.reject("no_id_token", now);
    }

    const email = typeof claims.email === "string" ? claims.email.toLowerCase() : null;
    const hd = typeof claims["hd"] === "string" ? claims["hd"] : null;
    const emailDomain = email?.split("@")[1] ?? null;
    const domain = (hd ?? emailDomain)?.toLowerCase() ?? null;

    if (!domain || !this.env.GOOGLE_WORKSPACE_ALLOWED_DOMAINS.includes(domain)) {
      return this.reject("domain_not_allowed", now);
    }
    if (!email) {
      return this.reject("missing_email_claim", now);
    }

    const sub = claims.sub;
    const existingIdentity = await this.identities.findByProviderSubject("google", sub);
    let user = existingIdentity ? await this.users.findById(existingIdentity.userId) : null;

    if (!user) {
      // Pre-provisioned-only (resolved this session): first login for this
      // Google subject only succeeds if an administrator already created a
      // matching `users` row by email — never auto-created here.
      user = await this.users.findByEmail(email);
      if (user && !existingIdentity) {
        await this.identities.link({
          userId: user.id,
          provider: "google",
          providerSubjectId: sub,
          workspaceDomain: domain,
        });
      }
    }

    if (!user || user.accountStatus !== "active") {
      return this.reject("no_matching_active_user", now);
    }

    await this.users.recordSuccessfulLogin(user.id, now);
    const issued = await this.sessionService.issue({
      userId: user.id,
      authMethod: "google_sso",
      requiresMfa: false,
      ipHash: context.ipHash,
      userAgent: context.userAgent,
      now,
    });

    await this.events.record({
      eventType: "sso_login_succeeded",
      userId: user.id,
      sessionId: issued.session.id,
      authMethod: "google_sso",
      success: true,
      ipHash: context.ipHash,
      userAgent: context.userAgent,
    });

    return { ok: true, user, session: issued.session, rawToken: issued.rawToken };
  }

  private async reject(reason: string, _now: Date): Promise<GoogleCallbackResult> {
    await this.events.record({
      eventType: "sso_login_rejected",
      authMethod: "google_sso",
      success: false,
      reason,
    });
    return { ok: false, reason };
  }
}
