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

/** Formalizes docs/contracts/wordpress-integration-contract.md. */
export interface WordPressAdapter {
  getPost(postType: string, id: string): Promise<unknown>;
  upsertPost(postType: string, id: string | null, data: Record<string, unknown>): Promise<unknown>;
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
