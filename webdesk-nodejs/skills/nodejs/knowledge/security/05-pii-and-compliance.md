---
tier: 2
load_when: ["code-production", "security-topic", "schema-work"]
description: "PII handling and compliance — GDPR/CCPA basics and PCI-scope avoidance."
---

# Security 05 — PII & Compliance

> ERP↔store middleware moves customer and order data — names, emails, addresses, sometimes phone. That's PII, and it crosses systems and borders. This file is the practical baseline; it is not legal advice, and a project with real regulatory exposure flags it at discovery for counsel.

---

## Know what PII you hold

At G-Schema, **classify each field**: is it PII (name, email, address, phone), sensitive PII (government ID, anything special-category), or non-personal? The data-model documents this. You can't protect or honor deletion of data you haven't inventoried.

- Map where each PII field comes from (ERP/store), where it's stored, where it's displayed, and where it's logged. **PII does not belong in logs** — redact it like secrets (`03-secrets-and-config.md`).

---

## GDPR / CCPA basics

- **Data minimization:** sync and store only the fields the product needs. Don't mirror the entire ERP customer record "in case" — each extra PII field is added risk.
- **Purpose limitation:** use the data for the integration's stated purpose; don't repurpose.
- **Right to access / deletion:** the design must support exporting and **deleting** a customer's PII on request — including in the sync state and logs, not just the primary table. Soft-delete + a hard-delete/anonymization path. Plan the cascade (orders, sync records) at modeling time.
- **Lawful basis & retention:** retain PII only as long as needed; define a retention/purge policy. Anonymize rather than keep where analytics is the only need.
- **Cross-border:** ERP/store and host may be in different jurisdictions. Note data residency at G0/G1.5 if the client is EU-based or contractually restricted.
- **Encryption in transit + at rest** for PII (TLS everywhere; encrypt sensitive columns / use disk encryption).
- **Audit trail:** access to PII and to the master cross-tenant scope is logged (`02-authn-authz.md`).

---

## PCI scope — avoid it

**Do not handle, store, or transmit raw cardholder data (PAN, CVV).** Bringing card data into this system pulls it into PCI-DSS scope, which is a heavy, audited compliance burden we design _out_ of.

- The store (BigCommerce/Shopify) and its payment provider own card data. The middleware syncs **orders and customers**, which reference payments by **token/last-4/transaction id** — never the card number.
- If a spec appears to require touching card data, **stop and flag it** — re-architect so a PCI-compliant processor handles it and we only ever see tokens. This is an architecture decision at G1.5, not something to implement quietly.

---

## Checklist (touches G-Schema and G6)

- [ ] PII fields classified in the data-model
- [ ] PII minimized — only needed fields synced/stored
- [ ] PII redacted from logs
- [ ] Access + deletion (incl. sync-state/logs) supported; retention policy defined
- [ ] PII encrypted in transit and at rest
- [ ] No raw cardholder data anywhere — payments referenced by token/last-4 only
- [ ] Data residency / cross-border noted if applicable
