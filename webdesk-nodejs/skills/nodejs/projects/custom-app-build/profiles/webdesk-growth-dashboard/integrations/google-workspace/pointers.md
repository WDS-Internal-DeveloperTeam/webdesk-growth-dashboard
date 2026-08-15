---
tier: 2
load_when: ["webdesk-growth-dashboard", "integration-work"]
description: "Google Workspace OIDC and SMTP doc anchors. Confirm current recommended auth mechanisms at build — Google has shifted away from some legacy auth paths over time."
---

# Google Workspace — Doc Pointers

## Doc anchors

### OIDC / Identity

- OpenID Connect: https://developers.google.com/identity/openid-connect/openid-connect
- Google Identity Services: https://developers.google.com/identity
- Verifying ID tokens: https://developers.google.com/identity/openid-connect/openid-connect#validatinganidtoken
- Google's JWKS endpoint: https://www.googleapis.com/oauth2/v3/certs

### Workspace Admin / Domain

- Workspace Admin SDK (for domain/user verification if needed beyond token claims): https://developers.google.com/admin-sdk

### SMTP / Mail

- Google Workspace SMTP relay setup: https://support.google.com/a/answer/176600
- Sending limits: https://support.google.com/a/answer/166852
- App passwords (if still applicable to the account's 2FA configuration): https://support.google.com/accounts/answer/185833

## At-build checklist

- [ ] Confirm current OIDC issuer claim value(s) accepted by Google.
- [ ] Confirm current recommended SMTP auth mechanism for this Workspace account's security configuration.
- [ ] Confirm sending-quota limits for the account tier in use.
- [ ] Confirm MFA/2FA policy interaction with any app-password-based SMTP auth path.
