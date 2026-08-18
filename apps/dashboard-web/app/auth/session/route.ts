import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getApiBaseUrl } from "../../../lib/auth";
import { SESSION_COOKIE_NAME } from "../../../lib/session-cookie";

/**
 * Ends `dashboard-web`'s own first-party session — see `docs/implementation/session-exchange.md`
 * for why one Google SSO login now produces two independent session rows. `dashboard-api`'s own
 * `POST /auth/logout`, when called directly by the browser (`credentials: "include"`), only ever
 * carries `dashboard-api`'s own host-only cookie — a cross-origin fetch never carries a cookie
 * scoped to a different domain — so it can never reach or revoke the session
 * `lib/server-session.ts#getServerSession()` actually authenticates every `(shell)` page against.
 * `LogoutPage` calls both `dashboard-api`'s `/auth/logout` AND this route so both of a login's two
 * sessions are actually revoked.
 *
 * Forwards the whole incoming `Cookie` header (not a name-keyed lookup) so this works regardless
 * of what `dashboard-api`'s own `SESSION_COOKIE_NAME` happens to be configured as —
 * `dashboard-api`'s own `readSessionCookie()` picks out whichever cookie matches its own
 * configured name, the same "forward everything, let the far side pick" pattern
 * `lib/server-session.ts` already uses for authenticated reads. The outgoing `Origin` header is
 * set explicitly (derived from this route's own request URL, i.e. `dashboard-web`'s real deployed
 * origin) since a plain server-to-server `fetch()` sets no `Origin` header, and `OriginCheckGuard`
 * on `dashboard-api`'s `/auth/logout` fails closed on a missing one.
 */
export async function DELETE(request: Request): Promise<Response> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  if (cookieHeader) {
    try {
      const apiBaseUrl = getApiBaseUrl();
      await fetch(`${apiBaseUrl}/auth/logout`, {
        method: "POST",
        headers: {
          cookie: cookieHeader,
          origin: new URL(request.url).origin,
        },
        cache: "no-store",
      });
    } catch (error) {
      console.error("auth/session: failed to revoke dashboard-web's session server-side", error);
    }
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
  return NextResponse.json({ success: true });
}
