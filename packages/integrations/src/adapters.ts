import type { IncomingMessage } from "node:http";

/**
 * Adapter INTERFACES only — Phase 1A. No implementation of any of these
 * exists yet; each is implemented only once its owning integration is
 * separately authorized (see docs/phase-plans/phase-1-foundation-plan.md
 * and docs/contracts/*.md for the full contract each interface formalizes).
 * Calling any of these before Phase 1B+ implementation is a build-time
 * type error, not a runtime possibility — no adapter object is exported
 * from this package yet, only the shapes future adapters will satisfy.
 */

/** Formalizes docs/contracts/github-integration-contract.md. */
export interface GitHubAdapter {
  getPullRequest(owner: string, repo: string, number: number): Promise<unknown>;
  getCommitStatus(owner: string, repo: string, sha: string): Promise<unknown>;
}

/**
 * Formalizes docs/contracts/wordpress-integration-contract.md — REVISED here, its first real
 * implementation (`wordpress-adapter.ts`, `WordPressRestAdapter`), starting from the concrete
 * interface spec in `webdesk-nodejs/skills/.../integrations/wordpress/01-rest-api-and-app-passwords.md`
 * (mirrors `BlobStorageAdapter`'s own precedent of being revised for its first real
 * implementation) but widened during code review: the profile doc's own snippet gives
 * `getPostMeta`/`getPublicationState`/`updateDraft` a bare `postId` with no `postType`, which
 * would have hardcoded all three to the built-in `post` REST route with no compile-time signal —
 * WordPress has no type-agnostic "get any post by ID" route, each post type has its own base
 * route. Every method that touches a specific post now takes `postType` uniformly, closing that
 * gap before any real caller exists to be broken by widening it later. Two further differences
 * from the original Phase 1A stub: (1) no generic `upsertPost` — writes are split into
 * `createDraft`/`updateDraft`, both of which enforce "approved-draft-only, never direct publish"
 * at the type level (no `status` field wider than the literal `"draft"`); (2) `id`/`postId` are
 * `number`, matching WordPress's own REST API (`upsertPost`'s original `string` was never
 * accurate). `getPost` returns `WPPost | null` (not the profile doc's non-nullable `WPPost`) —
 * `null` on a 404 is the "no data" signal the contract's own "Error handling" section requires be
 * distinguished from a real failure.
 */
export interface WordPressAdapter {
  getPost(postType: string, id: number): Promise<WPPost | null>;
  listPosts(postType: string, query: WPListQuery): Promise<WPPost[]>;
  getPostMeta(postType: string, postId: number, key: string): Promise<unknown>;
  getPublicationState(
    postType: string,
    postId: number,
  ): Promise<{ status: string; url: string | null }>;
  /** Always creates with `status: "draft"` — see `WordPressRestAdapter`'s own doc comment for the code-level enforcement. */
  createDraft(postType: string, data: WPDraftInput): Promise<WPPost>;
  /** Never changes `status` away from `"draft"` — see `WordPressRestAdapter`'s own doc comment for the code-level enforcement. */
  updateDraft(postType: string, postId: number, data: Partial<WPDraftInput>): Promise<WPPost>;
  healthCheck(): Promise<{ ok: boolean; latencyMs: number; wpVersion?: string }>;
}

/** A normalized subset of a WordPress REST API post object — see `wordpress-adapter.ts`'s `wpPostSchema` for the exact validated shape. */
export interface WPPost {
  readonly id: number;
  readonly status: string;
  readonly type: string;
  readonly slug: string;
  readonly link: string | null;
  readonly date: string;
  readonly modified: string;
  readonly title: { readonly rendered: string };
  readonly content?: { readonly rendered: string };
  readonly excerpt?: { readonly rendered: string };
  readonly meta?: Readonly<Record<string, unknown>>;
}

export interface WPListQuery {
  readonly page?: number;
  readonly perPage?: number;
  readonly search?: string;
  readonly status?: readonly string[];
  readonly orderby?: string;
  readonly order?: "asc" | "desc";
}

export interface WPDraftInput {
  readonly title?: string;
  readonly content?: string;
  readonly excerpt?: string;
  readonly meta?: Readonly<Record<string, unknown>>;
  /** Only ever `"draft"` — see `assertDraftOnly` in `wordpress-adapter.ts`. */
  readonly status?: "draft";
}

/** Formalizes docs/contracts/google-workspace-auth-contract.md. */
export interface GoogleWorkspaceAuthAdapter {
  exchangeAuthorizationCode(code: string): Promise<unknown>;
  verifyIdToken(idToken: string): Promise<unknown>;
}

/** Formalizes docs/contracts/google-workspace-smtp-contract.md. */
export interface SmtpAdapter {
  sendMail(input: {
    to: string;
    subject: string;
    templateId: string;
    data: Record<string, unknown>;
  }): Promise<{ messageId: string }>;
}

/**
 * Formalizes docs/contracts/vercel-blob-contract.md — REVISED here, its first real
 * implementation (`vercel-blob-adapter.ts`, Business Knowledge Center attachments), to match
 * Vercel Blob's actual documented mechanics rather than the Phase 1A placeholder guess. Two real
 * differences from the original stub, both confirmed against Vercel's own current docs before
 * writing this: (1) there is no "uploadUrl" — a private Blob store's client-upload flow works via
 * `@vercel/blob/client`'s `handleUpload()` (server) / `upload()` (browser) pair, a two-phase
 * token-then-PUT protocol, not a URL the caller PUTs to directly; (2) there is no "signed read
 * URL" concept for a private store either — every read for a private object requires an
 * authenticated `get()` call server-side, proxied through the consuming app's own route (Vercel's
 * own documented pattern, "Delivering private blobs"). `getObject()`/`deleteObject()` below exist
 * for exactly that proxy-read and for attachment removal.
 */
export interface BlobStorageAdapter {
  /** Wraps `@vercel/blob/client`'s `handleUpload()` — the server half of Vercel's direct-to-Blob
   *  client upload protocol. `onBeforeGenerateToken` is where the caller (the owning business
   *  module, never this adapter) performs its own auth/RBAC/format/size checks before a token is
   *  minted; `onUploadCompleted` is Vercel Blob's own best-effort completion webhook — not relied
   *  on for correctness here, since the browser's own `upload()` call resolving is the real
   *  completion signal the caller acts on (see the Business Knowledge Center attachments
   *  implementation notes for why). `request` must be Node's raw `IncomingMessage` (an Express
   *  `req` satisfies this) — `handleUpload()` accepts either that or a Fetch API `Request`. */
  handleClientUploadRequest(input: {
    body: unknown;
    request: IncomingMessage;
    onBeforeGenerateToken: (
      pathname: string,
      clientPayload: string | null,
    ) => Promise<{
      allowedContentTypes: readonly string[];
      maximumSizeInBytes: number;
      addRandomSuffix?: boolean;
      tokenPayload?: string;
    }>;
    onUploadCompleted: (event: {
      blob: { url: string; pathname: string; contentType: string };
      tokenPayload: string | null;
    }) => Promise<void>;
  }): Promise<Record<string, unknown>>;
  /** Reads a private object's full content — used both to compute a checksum/generate a preview
   *  right after a direct upload, and by the proxy route that serves an attachment to an
   *  authenticated browser. Returns `null` if the object doesn't exist. */
  getObject(pathname: string): Promise<{ body: Buffer; contentType: string } | null>;
  deleteObject(pathname: string): Promise<void>;
}

/** Formalizes docs/contracts/vercel-background-jobs-contract.md. */
export interface JobQueueAdapter {
  enqueue(jobType: string, payload: Record<string, unknown>): Promise<{ jobId: string }>;
}
