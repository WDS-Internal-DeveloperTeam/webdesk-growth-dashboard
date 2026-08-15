---
tier: 2
load_when: ["code-review", "git-decision"]
description: "PR description template: what / why / gates affected / tests / risk."
---

# PR Template (Node.js)

> Copy to `.github/pull_request_template.md` in each project repo. Every PR fills this. Code Review Agent checks it's complete before approving.

---

```markdown
## What

<!-- One paragraph: what this PR changes. Reference the sprint/bug id. -->

Implements {{S2.1}} — {{the DDI inventory pull with watermark-resume}}.

## Why

<!-- The reason. Link the spec section / contract / ADR. Not "what" again. -->

Per {{spec.md §6.2}} and the client-approved {{integration-contracts/ddi-inform.md}}:
inventory syncs incrementally from the per-entity watermark so a slow or killed run
resumes correctly instead of reprocessing from zero.

## Gates affected

<!-- Which gate(s) this advances or unblocks. Confirm prerequisites are met. -->

- [ ] Advances {{G4 sprint QA for S2.1}}
- [ ] Depends on: {{G-Contracts passed (DDI contract client-approved), G-Schema passed (sync_state table exists)}}
- [ ] Touches a migration → migration dry-run attached below

## Tests

<!-- What was tested and the result. Never claim green without evidence. -->

- [ ] ESLint + Prettier: pass
- [ ] Unit tests: {{18/18}} pass
- [ ] Integration tests vs {{DDI mock + BigCommerce sandbox}}: {{6/6}} pass
- [ ] Contract tests (vs OpenAPI / integration-contract): pass
- [ ] Sync-specific: watermark-resume ✓ · overlapping-run guard ✓ · missed-run ✓
- [ ] Dependency audit (OSV-Scanner): {{0 high/critical}}
- [ ] Migration dry-run (if applicable): {{clean, reversible}}

<!-- Paste failing output if any check is not green. -->

## Risk

<!-- Honest. What could break, blast radius, rollback. Flag external-API uncertainty. -->

- **Blast radius:** {{inventory sync only; no schema change; behind a feature flag}}
- **Rollback:** {{revert commit; watermark is idempotent so no data corruption on re-run}}
- **External-API uncertainty:** {{DDI rate limits UNVERIFIED — verify-at-discovery; mock used pending sandbox}}
- **Security:** {{no new PII surfaces; ERP response validated before persist (API10)}}

## Forbidden-rule self-check

- [ ] No secrets in code (FG-001)
- [ ] All external input + ERP/store responses validated (FG-002)
- [ ] Errors thrown, not console.log'd (FG-003)
- [ ] DB access only in repositories (FG-004)
- [ ] No silent catch (FG-005)
- [ ] No fabricated/unverified API calls (FG-008)

## Consulted (KB files this work relied on)

<!-- The ai-output-verification rule. List the files actually used. -->

{{nodejs/knowledge/integration/01-sync-strategies.md, integration-contracts/ddi-inform.md,
  nodejs/integrations/erp/_erp-adapter-pattern.md, data-model.md}}
```

---

Last reviewed: 2026-06-30 (initial Node.js build)
Next review due: 2026-09-30
