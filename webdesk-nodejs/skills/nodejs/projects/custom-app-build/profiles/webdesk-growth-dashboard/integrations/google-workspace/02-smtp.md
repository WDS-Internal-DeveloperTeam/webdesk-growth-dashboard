---
tier: 2
load_when: ["webdesk-growth-dashboard", "integration-work"]
description: "Google Workspace SMTP adapter — connection config, send interface, bounce/delivery-status handling where available. Concrete implementation reference for the policy in knowledge/09-google-workspace-smtp.md."
---

# Google Workspace — SMTP

> Concrete adapter reference. Policy (delivery-state machine, retry rules, distribution lists, Resend exclusion) lives in `../../knowledge/09-google-workspace-smtp.md` — read that first.

---

## Adapter interface

```ts
// packages/integrations/google-workspace/src/smtp-adapter.ts
export interface SmtpAdapter {
  send(message: {
    to: string[];
    from: string;
    replyTo?: string;
    subject: string;
    bodyHtml: string;
    bodyText: string;
    idempotencyKey: string; // the notification's own ID — see knowledge/09
  }): Promise<{ accepted: boolean; providerMessageId?: string; error?: string }>;

  testConnection(): Promise<{ ok: boolean; latencyMs: number }>;
}
```

---

## Configuration

- Standard SMTP over TLS (port 587, STARTTLS — **confirm exact port/encryption per Google Workspace's current recommended configuration at discovery**) or Google's API-based sending path if that's the confirmed approach at implementation time (Google Workspace supports both SMTP relay and the Gmail API for sending — this profile specifies SMTP per the approved architecture; confirm which concrete mechanism is used at scaffold).
- Auth via an app-specific password or OAuth2 service-account credential, per Google Workspace's current recommended method for programmatic sending — **verify at discovery**, since Google has moved away from plain-password SMTP auth for many configurations.
- Sender/reply-to addresses, host/port/encryption/auth method are configuration (Settings module), not hardcoded.

---

## No delivery-status webhook assumed

Standard SMTP does not provide a delivery-confirmation callback the way a transactional-email API might — the `Sent to SMTP` → `Accepted` transition in the delivery-state machine (`../../knowledge/09-google-workspace-smtp.md`) reflects the SMTP server's own acceptance response, not a guarantee of final inbox delivery. If Google Workspace exposes any bounce/delivery-event reporting mechanism usable by this integration, that is a discovery-time finding, not assumed here.

---

## verify-at-discovery checklist

- [ ] Current recommended Google Workspace SMTP auth mechanism (app password vs. OAuth2 service account).
- [ ] Exact host/port/encryption values for Google Workspace's SMTP relay.
- [ ] Sending-quota limits (Google Workspace SMTP relay has daily send limits — confirm the number applicable to this account tier).
- [ ] Whether any delivery/bounce event feed is available and worth ingesting.

See `pointers.md` for documentation anchors.
