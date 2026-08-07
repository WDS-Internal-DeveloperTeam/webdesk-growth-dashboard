import {
  closeConnection,
  EmergencyAdminCredentialRepository,
  UserRepository,
} from "@webdesk/database";
import { loadAuthEnv } from "../config/auth-env.js";
import { hashPassword } from "../crypto/password.js";
import { generateSessionToken } from "../crypto/session-token.js";
import { buildTotpKeyUri, generateTotpSecret } from "../crypto/totp.js";
import { encryptTotpSecret } from "../crypto/totp-encryption.js";

/**
 * Operator-run, non-HTTP provisioning for an emergency-administrator
 * account (ADR-0009: "no self-service creation of an emergency-admin
 * account... requires an existing authorized administrator to provision
 * the account and TOTP secret initially"). There is deliberately no HTTP
 * endpoint for this — see docs/task-packages/phase-1c-authentication-sessions.md
 * §4/§5 and auth.module.ts's own note on why `RecoveryService` has no HTTP
 * surface either (no RBAC yet to gate who may call this).
 *
 * Generates a random password and TOTP secret rather than accepting
 * operator-typed input — stronger than most human-chosen values, and
 * avoids ever having the password echoed to (or readable from) a
 * terminal's scrollback/history. Both are printed exactly once; neither is
 * ever written to disk or logged.
 *
 * Usage:
 *   node dist/auth/scripts/provision-emergency-admin.js \
 *     --email admin@webdesksolution.com --name "Jane Doe"
 */

interface CliArgs {
  readonly email: string;
  readonly name: string;
}

function parseArgs(argv: readonly string[]): CliArgs {
  const args = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token?.startsWith("--")) {
      const key = token.slice(2);
      const value = argv[i + 1];
      if (value !== undefined) {
        args.set(key, value);
        i += 1;
      }
    }
  }

  const email = args.get("email");
  const name = args.get("name");
  if (!email || !name) {
    throw new Error("Usage: provision-emergency-admin --email <email> --name <display name>");
  }
  return { email: email.toLowerCase(), name };
}

async function main(): Promise<void> {
  const { email, name } = parseArgs(process.argv.slice(2));
  const authEnv = loadAuthEnv();

  const users = new UserRepository();
  const credentials = new EmergencyAdminCredentialRepository();

  let user = await users.findByEmail(email);
  if (!user) {
    user = await users.create({ email, displayName: name, accountStatus: "active" });
  }

  const existing = await credentials.findByUserId(user.id);
  if (existing) {
    throw new Error(
      `An emergency-admin credential already exists for ${email} (id: ${existing.id}). ` +
        "This script does not overwrite an existing credential — that is a separate rotation operation, not first-time provisioning.",
    );
  }

  // A random, high-entropy password — the same generator used for session
  // tokens is equally appropriate here (both need only cryptographic
  // randomness, not a memorable shape).
  const password = generateSessionToken();
  const passwordHash = await hashPassword(password);

  const totpSecret = generateTotpSecret();
  const totpSecretEncrypted = encryptTotpSecret(totpSecret, authEnv.TOTP_ENCRYPTION_KEY);
  const otpauthUri = buildTotpKeyUri(email, "WebDesk Growth Dashboard", totpSecret);

  await credentials.create({
    userId: user.id,
    passwordHash,
    totpSecretEncrypted,
    totpEnrolledAt: new Date(),
  });

  // eslint-disable-next-line no-console -- this IS the script's own one-time output, not application logging.
  console.log(
    [
      "",
      "Emergency-administrator account provisioned.",
      "The password and TOTP secret below are shown exactly once — copy them",
      "into a password manager now. Neither is recoverable from the database.",
      "",
      `  Email:            ${email}`,
      `  Password:         ${password}`,
      `  TOTP secret:      ${totpSecret}`,
      `  Enrollment QR URI: ${otpauthUri}`,
      "",
      "Add the TOTP secret to an authenticator app (scan the URI above as a QR",
      "code, or enter the secret manually) before relying on this account for",
      "emergency access.",
      "",
    ].join("\n"),
  );
}

main()
  .catch((error: unknown) => {
    console.error("Emergency-admin provisioning failed:", error);
    process.exitCode = 1;
  })
  .finally(() => {
    void closeConnection();
  });
