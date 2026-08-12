import type {
  AuthEventRepository,
  ExternalAuthIdentityRepository,
  UserRepository,
} from "@webdesk/database";
import * as client from "openid-client";
import type * as OpenIdClientModule from "openid-client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthEnv } from "../config/auth-env.js";
import type { SessionService } from "../session/session.service.js";
import { GoogleAuthService } from "./google-auth.service.js";

vi.mock("openid-client", async (importOriginal) => {
  const actual = await importOriginal<typeof OpenIdClientModule>();
  return { ...actual, authorizationCodeGrant: vi.fn() };
});

/**
 * `authorizationCodeGrant` — the only call that would hit the network and
 * verify a real ID token signature — is mocked; everything downstream of
 * `claims()` (domain allowlist, pre-provisioned-user matching, identity
 * linking, generic-rejection behavior, event recording) is this service's
 * own logic and is exercised for real. `buildAuthorizationRequest` needs
 * no mocking — it's pure URL construction against a directly-built offline
 * `Configuration` (no discovery network call), per
 * docs/task-packages/phase-1c-authentication-sessions.md §6.
 */
describe("GoogleAuthService", () => {
  const env = {
    GOOGLE_WORKSPACE_ALLOWED_DOMAINS: ["webdesksolution.com", "webdeskinc.com"],
    GOOGLE_OAUTH_REDIRECT_URI: "https://api.example.com/auth/google/callback",
  } as AuthEnv;

  const oidcConfig = new client.Configuration(
    {
      issuer: "https://accounts.google.com",
      authorization_endpoint: "https://accounts.google.com/o/oauth2/v2/auth",
      token_endpoint: "https://oauth2.googleapis.com/token",
    },
    "test-client-id",
    "test-client-secret",
  );

  let users: {
    findByEmail: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    recordSuccessfulLogin: ReturnType<typeof vi.fn>;
  };
  let identities: {
    findByProviderSubject: ReturnType<typeof vi.fn>;
    link: ReturnType<typeof vi.fn>;
  };
  let events: { record: ReturnType<typeof vi.fn> };
  let sessionService: { issue: ReturnType<typeof vi.fn> };
  let service: GoogleAuthService;

  const activeUser = {
    id: "user-1",
    email: "person@webdesksolution.com",
    displayName: "Person",
    accountStatus: "active" as const,
  };

  beforeEach(() => {
    users = {
      findByEmail: vi.fn(),
      findById: vi.fn(),
      recordSuccessfulLogin: vi.fn(),
    };
    identities = { findByProviderSubject: vi.fn(), link: vi.fn() };
    events = { record: vi.fn() };
    sessionService = {
      issue: vi.fn().mockResolvedValue({
        session: { id: "session-1" },
        rawToken: "raw-token",
      }),
    };
    vi.mocked(client.authorizationCodeGrant).mockReset();

    service = new GoogleAuthService(
      oidcConfig,
      env,
      users as unknown as UserRepository,
      identities as unknown as ExternalAuthIdentityRepository,
      events as unknown as AuthEventRepository,
      sessionService as unknown as SessionService,
    );
  });

  const callbackUrl = new URL("https://api.example.com/auth/google/callback?code=abc&state=xyz");
  const transaction = { state: "xyz", nonce: "nonce-1", codeVerifier: "verifier-1" };
  const context = { ipHash: null, userAgent: null };

  function mockClaims(claims: Record<string, unknown>): void {
    vi.mocked(client.authorizationCodeGrant).mockResolvedValue({
      claims: () => claims,
    } as unknown as Awaited<ReturnType<typeof client.authorizationCodeGrant>>);
  }

  it("rejects a token from a disallowed domain, without creating any user/session", async () => {
    mockClaims({ sub: "sub-1", email: "user@evil.com", hd: "evil.com" });

    const result = await service.handleCallback(callbackUrl, transaction, context);

    expect(result.ok).toBe(false);
    expect(sessionService.issue).not.toHaveBeenCalled();
    expect(events.record).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "sso_login_rejected", reason: "domain_not_allowed" }),
    );
  });

  it("rejects when no pre-provisioned user matches the email — same generic result as a domain rejection", async () => {
    mockClaims({ sub: "sub-1", email: "nobody@webdesksolution.com", hd: "webdesksolution.com" });
    identities.findByProviderSubject.mockResolvedValue(null);
    users.findByEmail.mockResolvedValue(null);

    const result = await service.handleCallback(callbackUrl, transaction, context);

    expect(result.ok).toBe(false);
    expect(identities.link).not.toHaveBeenCalled();
    expect(events.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "sso_login_rejected",
        reason: "no_matching_active_user",
      }),
    );
  });

  it("rejects a disabled account's login the same generic way", async () => {
    mockClaims({ sub: "sub-1", email: activeUser.email, hd: "webdesksolution.com" });
    identities.findByProviderSubject.mockResolvedValue(null);
    users.findByEmail.mockResolvedValue({ ...activeUser, accountStatus: "disabled" });

    const result = await service.handleCallback(callbackUrl, transaction, context);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("no_matching_active_user");
    }
  });

  it("links the external identity and issues a session on first login for a pre-provisioned user", async () => {
    mockClaims({ sub: "sub-1", email: activeUser.email, hd: "webdesksolution.com" });
    identities.findByProviderSubject.mockResolvedValue(null);
    users.findByEmail.mockResolvedValue(activeUser);

    const result = await service.handleCallback(callbackUrl, transaction, context);

    expect(result.ok).toBe(true);
    expect(identities.link).toHaveBeenCalledWith({
      userId: activeUser.id,
      provider: "google",
      providerSubjectId: "sub-1",
      workspaceDomain: "webdesksolution.com",
    });
    expect(users.recordSuccessfulLogin).toHaveBeenCalledWith(activeUser.id, expect.any(Date));
    expect(sessionService.issue).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: activeUser.id,
        authMethod: "google_sso",
        requiresMfa: false,
      }),
    );
  });

  it("uses an existing identity link directly — never re-links or looks up by email again", async () => {
    mockClaims({ sub: "sub-1", email: activeUser.email, hd: "webdesksolution.com" });
    identities.findByProviderSubject.mockResolvedValue({ userId: activeUser.id });
    users.findById.mockResolvedValue(activeUser);

    const result = await service.handleCallback(callbackUrl, transaction, context);

    expect(result.ok).toBe(true);
    expect(identities.link).not.toHaveBeenCalled();
    expect(users.findByEmail).not.toHaveBeenCalled();
  });

  it("rejects and records the event when the token exchange itself fails (forged/expired code, state mismatch)", async () => {
    vi.mocked(client.authorizationCodeGrant).mockRejectedValue(new Error("state mismatch"));

    const result = await service.handleCallback(callbackUrl, transaction, context);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("token_exchange_failed");
    }
  });

  it("logs the real underlying error server-side only when the token exchange fails — never in the generic reason", async () => {
    const loggerSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(client.authorizationCodeGrant).mockRejectedValue(
      new Error("invalid_grant: redirect_uri mismatch"),
    );

    const result = await service.handleCallback(callbackUrl, transaction, context);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("token_exchange_failed");
      expect(result.reason).not.toContain("redirect_uri");
    }
    expect(loggerSpy).toHaveBeenCalledWith(
      expect.stringContaining("invalid_grant: redirect_uri mismatch"),
      expect.any(String),
    );

    loggerSpy.mockRestore();
  });

  it("builds an authorization URL with PKCE S256, a fresh state, and a fresh nonce", async () => {
    const request = await service.buildAuthorizationRequest();

    expect(request.redirectUrl.searchParams.get("code_challenge_method")).toBe("S256");
    expect(request.redirectUrl.searchParams.get("state")).toBe(request.transaction.state);
    expect(request.redirectUrl.searchParams.get("nonce")).toBe(request.transaction.nonce);
    expect(request.redirectUrl.searchParams.get("scope")).toBe("openid email profile");
    expect(request.redirectUrl.searchParams.get("redirect_uri")).toBe(
      env.GOOGLE_OAUTH_REDIRECT_URI,
    );
  });

  it("generates a different state/nonce/verifier on every call", async () => {
    const first = await service.buildAuthorizationRequest();
    const second = await service.buildAuthorizationRequest();
    expect(first.transaction.state).not.toBe(second.transaction.state);
    expect(first.transaction.nonce).not.toBe(second.transaction.nonce);
    expect(first.transaction.codeVerifier).not.toBe(second.transaction.codeVerifier);
  });
});
