import { z } from "zod";
import type { WPDraftInput, WPListQuery, WPPost, WordPressAdapter } from "./adapters.js";

/**
 * The first real implementation of `WordPressAdapter` — see `adapters.ts`'s own doc comment for
 * why its interface shape was revised from the Phase 1A placeholder, and threads `postType`
 * through every method that names a specific post (closing an independent-code-review finding:
 * the profile spec's own bare-`postId` shape for `getPostMeta`/`getPublicationState`/`updateDraft`
 * would have hardcoded all three to the built-in `post` REST route with no compile-time signal).
 *
 * Scope of this build (packages/integrations only, per explicit instruction): the REST API
 * adapter itself. No `dashboard-api` wiring exists yet — there is no owning feature/module to
 * consume it (no business module reads from or writes to WordPress today), so wiring a DI
 * provider now would be speculative code ahead of a real consumer, which this project's own
 * standing discipline avoids elsewhere. A future consumer imports `WordPressRestAdapter` from
 * `@webdesk/integrations` and constructs it from `loadWordPressEnv()`'s result.
 */

const wpRenderedFieldSchema = z.object({ rendered: z.string() });

/**
 * WordPress's REST API commonly serializes an empty meta record as the PHP-array-to-JSON quirk
 * `[]` rather than `{}` (found during code review — a real post with no registered REST-visible
 * custom meta hits this, not just a theoretical edge case).
 */
function normalizeMeta(value: unknown): Record<string, unknown> {
  if (Array.isArray(value)) {
    return {};
  }
  return z.record(z.string(), z.unknown()).parse(value);
}

const wpPostSchema = z.object({
  id: z.number(),
  status: z.string(),
  type: z.string(),
  slug: z.string(),
  link: z.string().url().nullable(),
  date: z.string(),
  modified: z.string(),
  title: wpRenderedFieldSchema,
  content: wpRenderedFieldSchema.optional(),
  excerpt: wpRenderedFieldSchema.optional(),
  meta: z.unknown().transform(normalizeMeta).optional(),
});

const wpPostListSchema = z.array(wpPostSchema);

const wpRestRootSchema = z.object({
  name: z.string(),
  namespaces: z.array(z.string()),
});

export class WordPressApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
    this.name = "WordPressApiError";
  }
}

const MAX_429_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 500;
/** Caps a server-supplied `Retry-After` value — an untrusted, remotely-controlled input that must never be allowed to hold a caller open indefinitely (Node's `setTimeout` overflows past ~24.8 days). */
const MAX_RETRY_AFTER_SECONDS = 30;

export class WordPressRestAdapter implements WordPressAdapter {
  private readonly baseUrl: string;
  private readonly authHeader: string;

  constructor(config: {
    readonly baseUrl: string;
    readonly username: string;
    readonly password: string;
  }) {
    if (config.baseUrl.endsWith("/")) {
      throw new Error("WordPressRestAdapter baseUrl must not have a trailing slash");
    }
    this.baseUrl = config.baseUrl;
    this.authHeader =
      "Basic " + Buffer.from(`${config.username}:${config.password}`).toString("base64");
  }

  async getPost(postType: string, id: number): Promise<WPPost | null> {
    const response = await this.request("GET", `/wp/v2/${postType}/${id}`);
    if (response.status === 404) {
      return null;
    }
    return wpPostSchema.parse(await response.json());
  }

  async listPosts(postType: string, query: WPListQuery): Promise<WPPost[]> {
    const params = new URLSearchParams();
    if (query.page !== undefined) params.set("page", String(query.page));
    if (query.perPage !== undefined) params.set("per_page", String(query.perPage));
    if (query.search !== undefined) params.set("search", query.search);
    if (query.status !== undefined && query.status.length > 0) {
      params.set("status", query.status.join(","));
    }
    if (query.orderby !== undefined) params.set("orderby", query.orderby);
    if (query.order !== undefined) params.set("order", query.order);

    const response = await this.request(
      "GET",
      `/wp/v2/${postType}${params.size > 0 ? `?${params.toString()}` : ""}`,
    );
    if (response.status === 404) {
      // An invalid/unregistered postType route (e.g. "rest_no_route") is a caller error, not "no
      // data" — never silently returned as an empty list (contract: "REST API errors are
      // surfaced distinctly from 'no data' states").
      throw await this.toApiError("listPosts", response);
    }
    return wpPostListSchema.parse(await response.json());
  }

  async getPostMeta(postType: string, postId: number, key: string): Promise<unknown> {
    const body = await this.getPostField(
      postType,
      postId,
      "meta",
      z.object({ meta: z.unknown().transform(normalizeMeta) }),
    );
    return body?.meta[key];
  }

  async getPublicationState(
    postType: string,
    postId: number,
  ): Promise<{ status: string; url: string | null }> {
    const body = await this.getPostField(
      postType,
      postId,
      "status,link",
      z.object({ status: z.string(), link: z.string().url().nullable() }),
    );
    if (body === undefined) {
      // Explicit, typed "no longer there" — never conflated with a request failure (contract:
      // "REST API errors are surfaced distinctly from 'no data' states").
      return { status: "not_found", url: null };
    }
    return { status: body.status, url: body.link };
  }

  async createDraft(postType: string, data: WPDraftInput): Promise<WPPost> {
    assertDraftOnly(data.status);
    // Retry-safety: the contract requires write operations to check for an existing record via a
    // stable identifier before creating a duplicate on retry. No stable-identifier concept exists
    // on `WPDraftInput` today (no real caller yet to validate one against) — deduplication on
    // retry is the CALLER's responsibility until this interface grows one, not silently assumed
    // to be handled here.
    const response = await this.request("POST", `/wp/v2/${postType}`, {
      ...data,
      status: "draft",
    });
    return wpPostSchema.parse(await response.json());
  }

  async updateDraft(
    postType: string,
    postId: number,
    data: Partial<WPDraftInput>,
  ): Promise<WPPost> {
    assertDraftOnly(data.status);
    const response = await this.request(
      "POST",
      `/wp/v2/${postType}/${postId}`,
      data.status === undefined ? data : { ...data, status: "draft" },
    );
    if (response.status === 404) {
      throw await this.toApiError("updateDraft", response);
    }
    return wpPostSchema.parse(await response.json());
  }

  async healthCheck(): Promise<{ ok: boolean; latencyMs: number; wpVersion?: string }> {
    const start = Date.now();
    try {
      // A health check must fail fast — never inherit the data-call 429 backoff, which could
      // block a readiness probe for seconds under rate limiting.
      const response = await this.request("GET", "/", undefined, { retryOn429: false });
      const latencyMs = Date.now() - start;
      if (!response.ok) {
        return { ok: false, latencyMs };
      }
      const parsed = wpRestRootSchema.safeParse(await response.json());
      // No unauthenticated REST field reliably exposes the WordPress core version (checked
      // against this project's own local verification and the WP REST API index shape) — left
      // undefined rather than guessed.
      return { ok: parsed.success && parsed.data.namespaces.includes("wp/v2"), latencyMs };
    } catch {
      return { ok: false, latencyMs: Date.now() - start };
    }
  }

  /** Shared by `getPostMeta`/`getPublicationState`: fetch a narrow `_fields` slice of a specific post, returning `undefined` on a 404 rather than throwing. */
  private async getPostField<T>(
    postType: string,
    postId: number,
    fields: string,
    schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  ): Promise<T | undefined> {
    const response = await this.request("GET", `/wp/v2/${postType}/${postId}?_fields=${fields}`);
    if (response.status === 404) {
      return undefined;
    }
    return schema.parse(await response.json());
  }

  private async toApiError(context: string, response: Response): Promise<WordPressApiError> {
    return new WordPressApiError(
      `WordPress REST API request failed: ${context} -> ${response.status}`,
      response.status,
      await readBody(response),
    );
  }

  private async request(
    method: "GET" | "POST",
    path: string,
    body?: Record<string, unknown>,
    options?: { readonly retryOn429?: boolean },
  ): Promise<Response> {
    const url = `${this.baseUrl}/wp-json${path}`;
    const retryOn429 = options?.retryOn429 ?? true;
    let attempt = 0;
    for (;;) {
      const response = await fetch(url, {
        method,
        headers: {
          Authorization: this.authHeader,
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });

      if (response.status === 429 && retryOn429 && attempt < MAX_429_RETRIES) {
        // Never leave the just-received response's body unconsumed before looping — an
        // unconsumed body can pin the underlying keep-alive connection open under undici.
        await response.body?.cancel().catch(() => {});

        const retryAfterHeader = response.headers.get("Retry-After");
        const retryAfterSeconds = retryAfterHeader === null ? NaN : Number(retryAfterHeader);
        const delayMs = Number.isFinite(retryAfterSeconds)
          ? Math.min(retryAfterSeconds, MAX_RETRY_AFTER_SECONDS) * 1000
          : DEFAULT_RETRY_DELAY_MS * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        attempt += 1;
        continue;
      }

      if (response.status === 404 || response.ok) {
        return response;
      }

      throw new WordPressApiError(
        `WordPress REST API request failed: ${method} ${path} -> ${response.status}`,
        response.status,
        await readBody(response),
      );
    }
  }
}

/**
 * Reads a response body for diagnostics, tolerating a non-JSON body (e.g. an HTML error page from
 * a PHP fatal). Reads the raw text FIRST and attempts to parse it — calling `response.json()`
 * first and falling back to `response.text()` on failure never works, since `json()` internally
 * consumes the body via `text()`, leaving a second `text()` call to throw "body stream already
 * read" (a real bug this shape replaces, found during code review).
 */
async function readBody(response: Response): Promise<unknown> {
  const rawText = await response.text().catch(() => undefined);
  if (rawText === undefined) {
    return undefined;
  }
  try {
    return JSON.parse(rawText);
  } catch {
    return rawText;
  }
}

/**
 * Enforces "writes are approved-draft-only, never direct publish" for every call that goes
 * through `createDraft`/`updateDraft`. This is a single-file guard, not a substitute for the
 * WordPress-side least-privilege role ADR-0012 actually requires as the real backstop — a raw
 * `fetch()` call bypassing this adapter entirely would not be caught by it.
 */
function assertDraftOnly(status: string | undefined): void {
  if (status !== undefined && status !== "draft") {
    throw new Error(
      `WordPressRestAdapter only ever writes status "draft" (contract: no direct publish path) — got "${status}"`,
    );
  }
}
