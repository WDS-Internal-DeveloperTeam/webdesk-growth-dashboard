import {
  AuthEventRepository,
  RoleRepository,
  UserRepository,
  UserRoleRepository,
  closeConnection,
} from "@webdesk/database";

/**
 * Operator-run, non-HTTP first-administrator bootstrap (task package §18).
 * Solves a real chicken-and-egg gap this phase's RBAC introduces: assigning
 * a role requires already holding `users_roles:edit`, so *someone* must
 * become the first Super Admin without going through
 * `RoleAssignmentService`'s own guard-gated HTTP endpoint. Mirrors
 * `provision-emergency-admin.ts`'s established pattern (operator CLI, no
 * HTTP surface, explicit flags, one-time output) rather than inventing a
 * new one.
 *
 * Per §18's own requirements:
 * - Requires explicit environment configuration (`SUPER_ADMIN_BOOTSTRAP_ENABLED=true`)
 *   — refuses to run at all otherwise, so it can never fire by accident in
 *   a real deployment that hasn't deliberately opted in for this one run.
 * - Works only when no user currently holds Super Admin — refuses once a
 *   first administrator already exists, which is what makes it
 *   "unusable after bootstrap" in practice without needing a separate
 *   disable mechanism.
 * - Never assigns a role based on email domain — takes an explicit,
 *   already-existing (pre-provisioned) user by email; does not create a
 *   user, consistent with the pre-provisioned-only model Phase 1C
 *   established.
 * - No default password or hardcoded user — this script only ever grants
 *   a role to an account whose authentication (Google SSO or emergency
 *   local) is entirely Phase 1C's own concern, untouched here.
 * - Emits a `super_admin_bootstrap` audit event.
 *
 * Usage:
 *   SUPER_ADMIN_BOOTSTRAP_ENABLED=true node dist/authz/scripts/bootstrap-super-admin.js \
 *     --email owner@webdesksolution.com
 */

interface CliArgs {
  readonly email: string;
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
  if (!email) {
    throw new Error("Usage: bootstrap-super-admin --email <existing pre-provisioned user email>");
  }
  return { email: email.toLowerCase() };
}

async function main(): Promise<void> {
  if (process.env.SUPER_ADMIN_BOOTSTRAP_ENABLED !== "true") {
    throw new Error(
      'Refusing to run: SUPER_ADMIN_BOOTSTRAP_ENABLED is not set to "true". This is a ' +
        "deliberate, explicit opt-in per run — never set it in a real deployment's standing " +
        "environment configuration.",
    );
  }

  const { email } = parseArgs(process.argv.slice(2));

  const users = new UserRepository();
  const roles = new RoleRepository();
  const userRoles = new UserRoleRepository();
  const events = new AuthEventRepository();

  const user = await users.findByEmail(email);
  if (!user) {
    throw new Error(
      `No pre-provisioned user found for ${email}. This script never creates a user — the ` +
        "account must already exist (created via the same pre-provisioned model Phase 1C's " +
        "Google SSO and emergency-admin paths both require).",
    );
  }

  const superAdminRole = await roles.findByKey("super_admin");
  if (!superAdminRole) {
    throw new Error("Expected role 'super_admin' was not found — check migration 00013 has run.");
  }

  if (await userRoles.anyUserHoldsRole(superAdminRole.id)) {
    throw new Error(
      "Refusing to run: a Super Admin already exists. This script only bootstraps the FIRST " +
        "administrator — use the normal Users/roles admin surface (which requires an existing " +
        "Super Admin) for any subsequent role assignment.",
    );
  }

  await userRoles.assign(user.id, superAdminRole.id);
  await events.record({
    eventType: "super_admin_bootstrap",
    userId: user.id,
    success: true,
    reason: `Bootstrapped first Super Admin via operator CLI for ${email}`,
  });

  // eslint-disable-next-line no-console -- this IS the script's own one-time operator-facing output, not application logging.
  console.log(
    [
      "",
      `Super Admin bootstrapped: ${email} (user id: ${user.id}).`,
      "This script will refuse to run again now that a Super Admin exists — use the",
      "Users/roles admin surface for any further role assignment.",
      "",
    ].join("\n"),
  );
}

main()
  .catch((error: unknown) => {
    console.error("Super Admin bootstrap failed:", error);
    process.exitCode = 1;
  })
  .finally(() => {
    void closeConnection();
  });
