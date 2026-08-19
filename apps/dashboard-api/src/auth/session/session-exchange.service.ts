import { Inject, Injectable } from "@nestjs/common";
import type {
  AuthEventRepository,
  AuthMethod,
  SessionExchangeCodeRepository,
} from "@webdesk/database";
import {
  AUTH_ENV,
  AUTH_EVENT_REPOSITORY,
  SESSION_EXCHANGE_CODE_REPOSITORY,
} from "../config/auth.constants.js";
import type { AuthEnv } from "../config/auth-env.js";
import {
  generateSessionToken as generateExchangeCode,
  hashSessionToken as hashExchangeCode,
} from "../crypto/session-token.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime, see google-auth.service.ts's note.
import { SessionService, type IssuedSession } from "./session.service.js";

/**
 * Bridges the cross-domain session-cookie gap between `dashboard-api` and `dashboard-web` — see
 * `docs/implementation/session-exchange.md` for the full account of why this exists.
 * `dashboard-api`'s own session cookie (`session/cookie.util.ts`) is host-only to its own domain
 * by construction (no `Domain` attribute — the two apps are separate `*.vercel.app` projects with
 * no shared parent domain to scope a cookie to), so a browser navigating from `dashboard-api` to
 * `dashboard-web` after login never carries it. This service issues a short-lived, single-use
 * opaque code in its place; `dashboard-web`'s own exchange route redeems it server-to-server and
 * uses the result to mint `dashboard-web` its own, independent first-party cookie.
 *
 * Deliberately mints a **second, independent session row** on redeem rather than trying to relay
 * the original raw session token — raw tokens are never persisted anywhere (`session-token.ts`'s
 * own doc comment), only their SHA-256 hash, so the original token cannot be recovered later to
 * relay. Both sessions are fully valid, independently revocable, and belong to the same user; a
 * `revokeAllForUser` call revokes both.
 *
 * `issue()`'s `ipHash`/`userAgent` are captured by the caller from the REAL browser request (e.g.
 * `GoogleAuthController#callback`) and stored on the exchange-code row itself — `redeem()` reuses
 * those stored values rather than re-deriving them from the `POST /auth/exchange` request, which
 * is a server-to-server call from `dashboard-web`'s own Route Handler and carries no forwarded
 * client IP/user-agent. Re-deriving there would stamp the resulting (and actively-used) session
 * with Vercel-internal request data instead of the real visitor's.
 */
@Injectable()
export class SessionExchangeService {
  constructor(
    @Inject(SESSION_EXCHANGE_CODE_REPOSITORY)
    private readonly exchangeCodes: SessionExchangeCodeRepository,
    private readonly sessions: SessionService,
    @Inject(AUTH_EVENT_REPOSITORY) private readonly events: AuthEventRepository,
    @Inject(AUTH_ENV) private readonly env: AuthEnv,
  ) {}

  /** Mints a single-use exchange code for an already-authenticated user (post-login, never pending-MFA). */
  async issue(input: {
    userId: string;
    authMethod: AuthMethod;
    ipHash?: string | null;
    userAgent?: string | null;
    now?: Date;
  }): Promise<string> {
    const now = input.now ?? new Date();
    const rawCode = generateExchangeCode();
    const codeHash = hashExchangeCode(rawCode);
    const expiresAt = new Date(
      now.getTime() + this.env.SESSION_EXCHANGE_CODE_MAX_AGE_SECONDS * 1000,
    );
    await this.exchangeCodes.create({
      userId: input.userId,
      authMethod: input.authMethod,
      codeHash,
      expiresAt,
      ipHash: input.ipHash ?? null,
      userAgent: input.userAgent ?? null,
    });
    return rawCode;
  }

  /**
   * Redeems a single-use exchange code, or returns `null` if it's missing, expired, or already
   * redeemed (the repository's `redeem()` is an atomic conditional UPDATE — see its own doc
   * comment — so this is safe under concurrent redeem attempts). Records a
   * `session_exchange_redeemed` audit event referencing the new session — the login itself is
   * already recorded separately (e.g. `sso_login_succeeded` in `GoogleAuthService`) against the
   * *other* session row, so without this call the session that `dashboard-web` actually uses for
   * every subsequent request would have no audit trail explaining its creation.
   */
  async redeem(rawCode: string, now = new Date()): Promise<IssuedSession | null> {
    const codeHash = hashExchangeCode(rawCode);
    const redeemed = await this.exchangeCodes.redeem(codeHash, now);
    if (!redeemed) {
      return null;
    }
    const issued = await this.sessions.issue({
      userId: redeemed.userId,
      authMethod: redeemed.authMethod,
      requiresMfa: false,
      ipHash: redeemed.ipHash,
      userAgent: redeemed.userAgent,
      now,
    });
    await this.events.record({
      eventType: "session_exchange_redeemed",
      userId: redeemed.userId,
      sessionId: issued.session.id,
      authMethod: redeemed.authMethod,
      success: true,
      reason: null,
      ipHash: redeemed.ipHash,
      userAgent: redeemed.userAgent,
    });
    return issued;
  }
}
