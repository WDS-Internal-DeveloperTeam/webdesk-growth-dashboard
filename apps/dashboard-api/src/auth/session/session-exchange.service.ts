import { Inject, Injectable } from "@nestjs/common";
import type { AuthMethod, SessionExchangeCodeRepository } from "@webdesk/database";
import { AUTH_ENV, SESSION_EXCHANGE_CODE_REPOSITORY } from "../config/auth.constants.js";
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
 */
@Injectable()
export class SessionExchangeService {
  constructor(
    @Inject(SESSION_EXCHANGE_CODE_REPOSITORY)
    private readonly exchangeCodes: SessionExchangeCodeRepository,
    private readonly sessions: SessionService,
    @Inject(AUTH_ENV) private readonly env: AuthEnv,
  ) {}

  /** Mints a single-use exchange code for an already-authenticated user (post-login, never pending-MFA). */
  async issue(input: { userId: string; authMethod: AuthMethod; now?: Date }): Promise<string> {
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
    });
    return rawCode;
  }

  /**
   * Redeems a single-use exchange code, or returns `null` if it's missing, expired, or already
   * redeemed (the repository's `redeem()` is an atomic conditional UPDATE — see its own doc
   * comment — so this is safe under concurrent redeem attempts).
   */
  async redeem(
    rawCode: string,
    context: { ipHash?: string | null; userAgent?: string | null },
    now = new Date(),
  ): Promise<IssuedSession | null> {
    const codeHash = hashExchangeCode(rawCode);
    const redeemed = await this.exchangeCodes.redeem(codeHash, now);
    if (!redeemed) {
      return null;
    }
    return this.sessions.issue({
      userId: redeemed.userId,
      authMethod: redeemed.authMethod,
      requiresMfa: false,
      ipHash: context.ipHash ?? null,
      userAgent: context.userAgent ?? null,
      now,
    });
  }
}
