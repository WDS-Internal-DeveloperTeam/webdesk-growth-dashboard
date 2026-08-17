# Recommended Direction

**Status:** Recommendation only. Requires explicit human approval before any of the remaining
documents in this package (05 onward) are treated as final, and before any implementation begins.
See `17-dashboard-ui-approval-checklist.md`.

## Recommendation: Direction A — Clean Enterprise, as the base system, with one deliberate

## borrowing from Direction B for workflow-heavy modules

Adopt **Direction A (Clean Enterprise)** as the dashboard's canonical visual direction for all 43
modules. Within it, apply **Direction B's richer status/progress treatment** as a required
addition — not an optional accent — for the small set of modules that are genuinely pipeline-
shaped rather than record-shaped: Ready for Claude Queue, Scan Center, Change Center, Release
Center, and Review & Approval Center. Direction C is not recommended, for reasons below, but two
of its ideas (a calmer, slightly less saturated status palette, and extra care on the Home
overview screen specifically) are worth carrying forward as refinements within Direction A, not
as a reason to choose C.

## Why Direction A, specifically against what this system actually is

Three separate signals point the same direction, and none of them come from aesthetic preference:

1. **The content is already dense, not the design.** `03_Detailed_Module_Specifications.md`
   describes a 16-tab Page Workspace, a ~30-field Ready for Claude task record, and a Service
   Library with a dozen-plus fields per record before any custom fields exist. Direction C's
   lower-density, more-spacious treatment works directly against that reality — it would make the
   system's most common screens (record editors, dense list tables) feel like they're fighting
   their own content, which is the opposite of Principle 2.2 in `00-dashboard-design-principles.md`.
   Direction A's density-first stance is not a stylistic choice here; it's the only one of the
   three that matches the actual information the system has to display.

2. **What already exists is already Direction A, and it's tested.** `packages/ui`'s live token set
   (`colorTokens`, `typographyTokens`, `spacingTokens`) is, in substance, already a Clean
   Enterprise palette — neutral slate/blue, system fonts, tight spacing, restrained shadows. It has
   real unit test coverage (`tokens.test.ts`, `states.test.tsx`, `page-shell.test.tsx`) and real
   production usage across 5 live Projects-module pages. Choosing Direction A means the existing
   foundation is _refined and formalized_, not discarded — directly satisfying the design prompt's
   own instruction (§2): "Do not discard working Phase 1F foundations without documenting why."
   Direction B's added typeface and richer status components, and especially Direction C's new
   typeface and heavier card system, both require touching or replacing tested foundation code for
   a benefit that isn't proven to be worth the churn yet.

3. **No brand exists to differentiate toward.** Directions B and C both partly justify their extra
   visual investment by reference to WebDesk's brand personality ("AI-first," "premium"). But
   `16-existing-shell-gap-analysis.md` confirms **no WebDesk brand-identity material exists in this
   repository at all** — no logo, no approved color, no approved typeface. Spending real design and
   engineering effort differentiating toward a brand that hasn't been supplied yet is effort that
   may need to be redone once one is. Direction A's restraint is the direction least likely to be
   wasted work if/when a real brand reference eventually arrives — it can absorb an accent-color
   swap and a typography substitution cleanly; Directions B and C have committed to more surface
   area that would need to be re-evaluated alongside a real brand.

## Why not a pure Direction B or Direction C

**Not pure B:** its central strength — visible, richly-instrumented workflow/progress state — is
genuinely well-suited to only about 5 of the 43 modules (the pipeline-shaped ones). Applying it
system-wide would mean either (a) building a second status-rendering pattern that mostly sits
unused on the ~38 record/library-shaped modules, a direct violation of Principle 2.3
(Consistency) once two status idioms coexist without a clear rule for which applies where, or (b)
force-fitting progress/stepper visuals onto static library records where they add nothing.
Recommendation below solves this by scoping B's richer treatment explicitly, not applying it
uniformly.

**Not C:** its central weakness — lower density, heavier surface treatment — works directly against
the system's own content shape, and its main strength (a stronger sense of "considered product")
is real but secondary to this system's actual job, which is fast, correct, defensible operational
work, not first-impression polish. C's ideas are worth preserving in small doses (see below), not
adopting wholesale.

## What to take from B and C into Direction A

- **From B:** a scoped, second-tier status treatment for the 5 pipeline-shaped modules named
  above — a progress/stepper component that supplements, never replaces, the standard badge
  (every workflow item still gets the standard status badge; pipeline-shaped items _additionally_
  get a stepper/progress element on their detail page specifically). See
  `10-status-and-workflow-system.md` for exactly where this applies and where it deliberately does
  not.
- **From B:** consistent, prominent monospace treatment for IDs/SHAs/branch names/PR numbers
  everywhere they appear, not just in tables — this is cheap (the token already exists,
  `typographyTokens.fontFamilyMono`), reinforces the "technology-forward" brand attribute the
  prompt asks for, and costs nothing in density or consistency.
- **From C:** a calmer, verified-for-AA-contrast status palette rather than reusing Tailwind's
  default saturated slate hues as-is — see `05-dashboard-design-tokens.md` for the specific
  adjusted values.
- **From C:** deliberately more editorial care on the Home overview screen specifically (design
  prompt's own representative-screen list includes it as its own case) — Home is the one screen
  every role sees first and most often regardless of their day-to-day module, so it earns slightly
  more visual investment than a routine list screen without changing the system-wide direction.

## Dark mode recommendation

**Recommendation: Later, not Version 1.** Per the design prompt's own instruction (§26): "Do not
implement dark mode solely because modern dashboards often have it... do not delay the dashboard
for dark mode unless approved." Three real reasons, not a default no:

1. **No signal of user need exists.** This is an internal tool with 7 known roles and no user
   research suggesting dark mode is wanted or needed — unlike a public product where dark-mode
   demand is a known, common request.
2. **Zero foundation exists today.** Confirmed in `16-existing-shell-gap-analysis.md`: no
   `:root[data-theme]`/`prefers-color-scheme` branching exists anywhere in the codebase; every
   token is a single flat value. Building it now means designing and maintaining two complete
   palettes before the light palette itself has even been used in production for its intended
   business modules yet.
3. **The token architecture should stay dark-mode-ready without building it now.** `05-dashboard-design-tokens.md`
   structures every color as a named semantic token (`colorTokens.background`, not a hardcoded
   hex used ad hoc) specifically so that a future dark palette is a token-value swap, not a
   redesign — this recommendation defers the _work_, not the _architectural readiness_ for it.

Revisit once real usage exists and either a genuine user request or an accessibility need (e.g., a
role working in low-light conditions for extended sessions) is documented.

## What this recommendation does not decide

It does not select final hex values, type sizes, or component specs — those are proposed in
`05-dashboard-design-tokens.md` and `06-dashboard-component-system.md`, built to this direction's
philosophy, and still require their own review as part of the same approval gate. It does not
authorize implementation of anything — see `17-dashboard-ui-approval-checklist.md`.
