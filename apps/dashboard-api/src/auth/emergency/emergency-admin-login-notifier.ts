import { Injectable, Logger } from "@nestjs/common";

/**
 * "Emergency-admin access alerts" (knowledge/05): every successful
 * emergency-local login should fire a notification to the Security/DevOps
 * distribution list, since use of this path is inherently unusual.
 *
 * The actual delivery mechanism (`knowledge/09-google-workspace-smtp.md`)
 * is a separate, not-yet-built integration — out of Phase 1C's scope per
 * docs/task-packages/phase-1c-authentication-sessions.md §5. This
 * interface exists so `EmergencyAdminService` records the requirement and
 * calls a real notification hook (never skipped), while the concrete
 * delivery implementation is swapped in later without touching the login
 * flow itself. The default implementation logs a warning — a genuine gap,
 * not a fabricated "sent" claim.
 */
export interface EmergencyAdminLoginNotifier {
  notify(input: { userId: string; email: string; at: Date }): Promise<void>;
}

@Injectable()
export class LoggingEmergencyAdminLoginNotifier implements EmergencyAdminLoginNotifier {
  private readonly logger = new Logger(LoggingEmergencyAdminLoginNotifier.name);

  async notify(input: { userId: string; email: string; at: Date }): Promise<void> {
    this.logger.warn(
      `Emergency-admin login by user ${input.userId} (${input.email}) at ${input.at.toISOString()} — ` +
        "SMTP alert delivery is not yet wired (knowledge/09-google-workspace-smtp.md is a separate, " +
        "not-yet-built integration); this is a log-only placeholder, not a delivered notification.",
    );
    await Promise.resolve();
  }
}
