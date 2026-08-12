import { closeConnection, UserRepository } from "@webdesk/database";

/**
 * Operator-run, non-HTTP provisioning for a plain pre-provisioned user
 * (ADR-0008/knowledge/05: "an unmatched login is rejected... never
 * auto-creates a user"). Distinct from `provision-emergency-admin.ts`,
 * which bundles a local password+TOTP credential meant only for restricted
 * emergency access — this script creates just the `users` row a normal
 * Google Workspace SSO login needs to find via `UserRepository.findByEmail`.
 * `UserRepository.create` itself already documents this as its intended
 * caller ("exposed here only for the CLI seed script and tests").
 *
 * No role is assigned here — pair with `bootstrap:super-admin` (first
 * administrator only) or the normal Users/roles admin surface for that.
 *
 * Usage:
 *   node dist/auth/scripts/provision-user.js \
 *     --email jitesh@webdeskinc.com --name "Jitesh D"
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
    throw new Error("Usage: provision-user --email <email> --name <display name>");
  }
  return { email: email.toLowerCase(), name };
}

async function main(): Promise<void> {
  const { email, name } = parseArgs(process.argv.slice(2));

  const users = new UserRepository();

  const existing = await users.findByEmail(email);
  if (existing) {
    throw new Error(
      `A user already exists for ${email} (id: ${existing.id}, status: ${existing.accountStatus}). ` +
        "This script only handles first-time provisioning, not updates.",
    );
  }

  const user = await users.create({ email, displayName: name, accountStatus: "active" });

  // eslint-disable-next-line no-console -- this IS the script's own one-time operator-facing output, not application logging.
  console.log(
    ["", `User provisioned: ${email} (id: ${user.id}).`, "No role assigned yet.", ""].join("\n"),
  );
}

main()
  .catch((error: unknown) => {
    console.error("User provisioning failed:", error);
    process.exitCode = 1;
  })
  .finally(() => {
    void closeConnection();
  });
