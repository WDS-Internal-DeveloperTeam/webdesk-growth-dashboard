import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getApiBaseUrl } from "@/lib/auth";

/**
 * Same-origin proxy for `dashboard-api`'s real, guarded `upload-route` endpoint
 * (`BusinessKnowledgeAttachmentsController#uploadRoute`, behind `SessionGuard`/
 * `OriginCheckGuard`/`PermissionGuard`).
 *
 * `@vercel/blob/client`'s `upload()` POSTs directly to whatever `handleUploadUrl` it's given —
 * this was previously `dashboard-api`'s own origin, a genuinely cross-site request. The Blob
 * client SDK's `CommonUploadOptions` has no `credentials` option, and browsers forbid scripts
 * from setting a `Cookie` header manually, so that cross-origin call could never carry
 * `dashboard-api`'s session cookie — every real upload attempt 401'd. `upload()`'s own
 * `retrieveClientToken()` resolves a relative `handleUploadUrl` against the current page's
 * origin and calls `fetch()` with no `credentials` override (defaulting to `"same-origin"`), so
 * pointing it at this route instead makes the browser attach the session cookie automatically.
 *
 * This route then forwards the request server-to-server to `dashboard-api`, explicitly carrying
 * the incoming `Cookie` header and a real `Origin` header (a server-to-server `fetch()` sets
 * neither on its own) — the same forwarding pattern `app/auth/session/route.ts` already
 * established.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ recordId: string }> },
): Promise<Response> {
  const { recordId } = await params;
  const cookieStore = await cookies();
  const body = await request.text();

  const apiBaseUrl = getApiBaseUrl();
  const response = await fetch(
    `${apiBaseUrl}/business-knowledge/records/${recordId}/attachments/upload-route`,
    {
      method: "POST",
      headers: {
        "content-type": request.headers.get("content-type") ?? "application/json",
        cookie: cookieStore.toString(),
        origin: new URL(request.url).origin,
      },
      body,
      cache: "no-store",
    },
  );

  const responseBody = await response.text();
  return new NextResponse(responseBody, {
    status: response.status,
    headers: { "content-type": response.headers.get("content-type") ?? "application/json" },
  });
}
