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

/** Formalizes docs/contracts/vercel-blob-contract.md. */
export interface BlobStorageAdapter {
  createUploadAuthorization(input: {
    fileName: string;
    contentType: string;
    sizeBytes: number;
  }): Promise<{ uploadUrl: string; expiresAt: string }>;
  getSignedReadUrl(objectKey: string): Promise<string>;
}

/** Formalizes docs/contracts/vercel-background-jobs-contract.md. */
export interface JobQueueAdapter {
  enqueue(jobType: string, payload: Record<string, unknown>): Promise<{ jobId: string }>;
}
