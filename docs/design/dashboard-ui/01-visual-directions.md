# Three Visual Directions

**Status:** Direction A (Clean Enterprise) was selected and approved as-is — WebDesk Solution,
2026-08-17. See `02-recommended-direction.md` for the reasoning and
`17-dashboard-ui-approval-checklist.md` for the recorded decision. Directions B and C are kept
here as the record of what was considered, not as live options.

## Grounding constraints (apply to all three)

Before reading the three directions, note what's already true and not up for reinvention here
(see `16-existing-shell-gap-analysis.md` for the full inventory):

- **No WebDesk brand identity material exists anywhere in this repository** — no logo file, no
  approved hex colors, no typography direction. Every color/type choice below is this design
  task's own proposal, not a rendering of an existing brand. Confirming or supplying a real brand
  reference remains open (§3 of the design prompt allows the dashboard to _reference_ approved
  brand color/typography/logo — none currently exists to reference).
- `packages/ui`'s current tokens (`colorTokens`, `typographyTokens`, etc.) are a real, live,
  neutral placeholder palette — not a design decision anyone approved as final, but not
  meaningless either. All three directions are evaluated partly on how much of that existing,
  tested foundation they can keep versus discard.
- The system ships **zero web fonts** today — pure OS system-font stack. Any direction that adds a
  custom typeface is a new dependency with real cost (self-hosting via `next/font/local`, load
  time, licensing) that must be justified, not assumed.
- No dark mode exists. See `02-recommended-direction.md` §5 for the dark-mode recommendation,
  applied uniformly regardless of which direction is chosen.

---

## Direction A — Clean Enterprise

**Design philosophy.** Radical restraint. The interface should be nearly invisible — the user's
attention goes entirely to the data, the status, and the action, never to the chrome around them.
Closely related to what enterprise tools like Linear's settings panes, GitHub's repo admin, or
Stripe's dashboard (pre-2023 redesign) do: a tight neutral palette, one accent color reserved
exclusively for primary actions and links, and status communicated through a small, disciplined
badge vocabulary rather than through page-wide color washes.

- **Layout approach.** Fixed-width sidebar (matches the existing `260px`/`64px`-collapsed tokens),
  sticky header, single main content column with a hard `1280px` max-width (matches
  `layoutTokens.contentMaxWidth` exactly as it exists today). Generous but not loose whitespace —
  spacing scale stays tight (`0.25rem`–`2rem` for in-page rhythm; `3rem`/`4rem` reserved for
  section breaks only).
- **Navigation approach.** Text-first sidebar, one icon per module (subtle, single-color, never
  decorative), grouped under the 10 approved nav-group labels with no visual weight added beyond
  a small uppercase group label. Active state: a left border rail + subtle background tint, not a
  bold color fill.
- **Density.** High. Tables default to a compact row height; forms use single-column layout with
  tight vertical rhythm; multiple related fields (e.g., a status + owner + last-updated triplet)
  sit inline in a metadata row rather than stacked.
- **Typography direction.** System font stack only (no new dependency) — `-apple-system, "Segoe
UI", Roboto, ...`, exactly what's already shipping. A single weight scale (400/500/600) does all
  the hierarchy work; size steps stay close together (the existing `0.75rem`→`2.25rem` scale is
  already close to right for this direction).
- **Surface/card treatment.** Mostly flat. Cards get a `1px` border, not a shadow, to separate from
  the page background — shadows reserved for genuinely elevated content (modals, dropdowns,
  the off-canvas mobile nav that already uses one). No gradients, no colored surface tints except
  the reserved semantic-status backgrounds (danger/warning/success/info surface tokens, which
  already exist).
- **Status treatment.** Small pill badges: colored dot + label text, exactly `packages/ui`'s
  existing `StatusBadge` pattern. No large colored banners for routine status; reserved for
  destructive/blocking states only (e.g., a full-width danger bar for "Production release blocked
  — unresolved critical finding").
- **Table treatment.** Dense, bordered rows, sticky header, right-aligned numeric/date columns,
  sortable column headers with a minimal chevron affordance. Row actions collapse into a trailing
  icon-button menu rather than a row of visible buttons per row.
- **Form treatment.** Single-column, label-above-field, inline validation messages directly under
  the field, sectioned with plain heading rules (no card-per-section wrapper) for logically related
  groups.
- **Strengths.** Matches the existing token foundation almost exactly, so implementation cost is
  low and nothing already-live needs visual rework. Scales cleanly to 43 modules without visual
  fatigue. Reads as trustworthy/professional with zero risk of looking "designed at" rather than
  "designed for" a working operator. Excellent for the density this system genuinely has.
- **Weaknesses.** Can read as generic/interchangeable with any other enterprise tool — carries the
  least distinct brand personality of the three. Requires real discipline in status/badge design
  to avoid feeling flat or under-differentiated between "important" and "routine" screens.
- **Best-fit user.** A daily internal operator (marketing editor, developer, QA reviewer) moving
  fast across many records per session — the majority of this system's actual users, per
  `06_Roles_and_Permissions.md`'s 7-role breakdown skewing toward working roles over executive
  ones.
- **Accessibility considerations.** Easiest of the three to hit WCAG 2.2 AA cleanly — tight,
  well-tested neutral contrast pairs, no low-contrast decorative tints to audit, minimal custom
  interaction patterns to give focus/ARIA treatment to.

---

## Direction B — Modern AI Operations

**Design philosophy.** Technology-forward and workflow-centric — visually communicates that this
is a system where AI-assisted work (Ready for Claude tasks, agent-produced drafts, automated
scans) and human review are in constant, visible interplay. Leans on stronger visual language for
_state_ and _progress_ — a system that feels alive and instrumented, closer to a CI/CD dashboard
(GitHub Actions, Vercel's deployment view) crossed with an ops-monitoring tool (Datadog, Grafana).

- **Layout approach.** Same structural skeleton as Direction A (fixed sidebar, sticky header,
  contained main column), but with a slightly wider content area (`1440px`) to accommodate
  workflow-stage visualizations (a horizontal stepper for Page Workspace's 16 tabs, a pipeline
  view for Release Center) that need more lateral room than a plain form does.
- **Navigation approach.** Same grouped sidebar, but each nav-group can carry a live status
  indicator (a small dot showing "N pending" or "1 blocked") next to the group label — surfacing
  attention-worthy state before the user even opens the group. Requires new counts from the API
  the current shell doesn't expose (see `16-existing-shell-gap-analysis.md`).
- **Density.** Medium — slightly more breathing room than Direction A because workflow-stage and
  progress visualizations need room to read clearly; tables stay dense, but record/detail pages
  get more vertical space around status/progress elements specifically.
- **Typography direction.** A single added weight of visual distinction: a monospace or
  slightly-technical accent typeface for IDs, commit SHAs, branch names, and status codes (the
  system already reserves `fontFamilyMono` for this — this direction leans into it more visibly,
  e.g., always showing task IDs, PR numbers, and commit SHAs in mono even inline in prose, not
  just in tables). Body/heading font can stay system-default or add one geometric sans (e.g.
  self-hosted Inter) for a slightly more "product" feel — a genuine new dependency, flagged per
  §28 of the design prompt if selected.
- **Surface/card treatment.** Cards get a touch more presence — a subtle shadow (`shadowTokens.sm`,
  already defined) and a slightly rounded corner, used to separate "workflow stage" cards from flat
  table rows so progression state reads as a distinct object, not just another row.
  **Note:** `radiusTokens` currently defines `sm/md/lg/full`; some rounding tiers may be no-ops in
  practice, and could be trimmed rather than kept unused — see `05-dashboard-design-tokens.md`.
- **Status treatment.** Richer than Direction A's plain pill: a progress-aware status component
  that can show a stepper/progress-bar state (e.g., Release Center's 10-stage lifecycle) in
  addition to the flat badge for simpler binary states. Higher design and engineering cost — a
  second status-rendering pattern to build and keep consistent, not just the one badge.
- **Table treatment.** Same dense table system as Direction A, but rows for "in-progress" workflow
  items (a running scan, an in-progress Ready for Claude task) can show inline progress
  (a slim bar or a live-updating relative timestamp) rather than only a static badge.
- **Form treatment.** Same sectioned single-column pattern as A, with one addition: AI-originated
  field values (a Claude-drafted description, a scan-suggested fix) get a distinct "AI Draft"
  inline treatment (small icon + label) directly on the field, not just at the record level — see
  `12-ready-for-claude-ux.md` and design prompt §15.
- **Strengths.** Directly reflects the brand attributes explicitly requested ("AI-first,
  technology-forward") and gives the Ready for Claude / Scan / Release workflows — arguably the
  system's most distinctive modules — their own visual identity worth the extra design investment.
  Makes "what's currently in motion" scannable at a glance across the whole app, which is a real,
  named requirement (design prompt §5: "status visibility").
- **Weaknesses.** More components to design, build, and keep visually consistent (a second status
  pattern, workflow-stepper components, progress indicators) — directly working against Principle
  2.3 (Consistency) and Principle 2.2 (density without clutter) if not executed with real
  discipline. Risk of the "instrumented, alive" feeling tipping into busy or gimmicky on the ~35
  library-type modules that are mostly static records, not live pipelines — the visual language
  is genuinely suited to only a subset of the 43 modules (Ready for Claude, Scan, Change, Release,
  Review & Approval — roughly 5 of 43) and would need deliberate restraint everywhere else.
- **Best-fit user.** A technical/QA/release-focused role (Developer, QA/Security Reviewer, the
  Owner/Growth Approver monitoring release state) who spends real time in the workflow-heavy
  modules specifically.
- **Accessibility considerations.** Higher risk surface: progress bars and steppers both need real
  `aria-valuenow`/`aria-label` work (not just visual), and any color-coded progress state must
  still pair with text per WCAG 2.2 AA and this system's own "never color alone" rule (§10 of the
  design prompt) — achievable, but it's more surface area to get right than Direction A.

---

## Direction C — Premium Professional

**Design philosophy.** A more refined visual hierarchy and quiet brand personality — closer to
Notion, Linear's main app (not just settings), or Ramp: still clearly a working tool, but with
more considered typography, slightly warmer/more considered neutrals than a pure slate-gray
system palette, and small moments of polish (refined empty states, a more considered card
treatment) that signal quality without adding decoration that competes with the data.

- **Layout approach.** Same skeleton as A, with more generous whitespace throughout — the spacing
  scale's upper steps (`1.5rem`/`2rem`/`3rem`) get used more often between sections, giving pages
  more visual room to breathe at the cost of somewhat lower density per screen.
- **Navigation approach.** Same grouped sidebar structure, with slightly more refined
  active/hover states (a soft background tint using an off-white/off-black rather than a flat
  accent-tinted rectangle) and a touch more icon presence than Direction A.
- **Density.** Medium-low — the lowest-density of the three. Genuinely in tension with Principle
  2.2 ("information density without clutter") given how dense this system's real content actually
  is (16-tab workspaces, 30-field task records) — flagged explicitly as a real risk below, not
  glossed over.
- **Typography direction.** The direction most likely to justify a genuine typeface investment: a
  refined sans for headings (e.g., self-hosted Inter or a similar humanist sans at a slightly
  heavier weight for page titles) paired with the system stack for body/table text, so the
  investment is concentrated where it's visible (titles, section headers) without touching every
  line of dense table data.
- **Surface/card treatment.** The most "designed" of the three — soft shadows, rounded corners
  used consistently for cards and panels, a slightly elevated feel for primary content areas versus
  the page background.
- **Status treatment.** Same badge vocabulary as Direction A functionally, styled with slightly
  more refined color (muted/desaturated semantic hues rather than saturated slate-Tailwind
  defaults) for a calmer overall palette.
- **Table treatment.** Comfortable row height by default (not compact), more line-height/padding
  per cell — directly costs vertical density on the system's most information-dense screens
  (Page Inventory, Ready for Claude Queue), which is this direction's central weakness.
- **Form treatment.** Card-wrapped sections (each logical group gets its own bordered/shadowed
  card) rather than plain heading rules — reads polished but adds visual weight to already-long
  forms (Page Workspace's 16 tabs, Ready for Claude's ~30 fields).
- **Strengths.** The strongest sense of brand personality and "considered product" feel of the
  three — the best answer if executive/approval-focused users' first impression matters (Owner/
  Growth Approver, who spends comparatively more time in overview and approval screens than deep
  record editing). Best-fit for the Home dashboard and top-level overview screens specifically.
- **Weaknesses.** The direction most in tension with this system's actual content density and with
  Principle 2.2 directly — a genuine, not cosmetic, risk that dense record/table screens (the
  majority of real screens in this system) feel like they're fighting the visual language rather
  than served by it. Highest implementation cost of the three (new typeface, more surface
  treatment variety, more states to keep visually calm rather than heavy).
- **Best-fit user.** An approval-focused or executive-facing role reviewing summaries and making
  decisions, spending less time in deep multi-field editing than a Marketing Editor or Developer.
- **Accessibility considerations.** Desaturated/muted semantic colors need real contrast-ratio
  verification (a muted amber or muted red can slip below AA contrast against a light card
  background more easily than the current saturated tokens) — solvable, but requires deliberate
  checking rather than being a natural consequence of the palette choice, unlike Direction A.

---

See `02-recommended-direction.md` for the recommendation, the reasoning against these three
profiles specifically, and what — if anything — is deliberately borrowed from B and C into the
primary recommendation.
