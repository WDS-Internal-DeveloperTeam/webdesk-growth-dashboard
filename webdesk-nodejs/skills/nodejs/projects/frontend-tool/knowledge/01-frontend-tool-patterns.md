---
tier: 2
load_when: ["pt-frontend-tool", "design", "frontend-active", "g2"]
description: Patterns for a storefront-embedded frontend tool — embedding methods, talking to the backend, state, live-preview rendering, performance budget, accessibility, and not-breaking-the-host-store rules.
---

# 01 — Frontend Tool Patterns

> A frontend tool runs inside a live store you don't own. Every pattern below is in service of three constraints, in priority order: **(1) don't break the host store, (2) stay within the performance budget, (3) stay accessible.** When a pattern trades against one of these, the constraint wins.

---

## Embedding patterns — pick one at G2

The embedding method decides your isolation, your performance profile, and your CSP exposure. Choose deliberately.

### A. Script tag (mounts into a host element)

A `<script>` the store loads; it finds a mount point and renders the widget into the DOM.

- **Pro:** lightest, fastest, can read host page context (selected product, theme).
- **Con:** **shares the host DOM and global scope** — highest risk of CSS leakage both ways and JS collisions. Requires strict isolation discipline (see below).
- **Use when:** the widget must blend visually into the store and read page context, and you can isolate rigorously.

### B. iframe (sandboxed document)

The widget is its own document loaded in an `<iframe>`.

- **Pro:** **strongest isolation** — CSS and JS cannot leak in either direction. The host store is structurally protected.
- **Con:** heavier; awkward responsive sizing; cross-document messaging needed (`postMessage`); harder to make it feel native; the host's CSP `frame-src` must allow your origin.
- **Use when:** isolation matters more than visual blending, or the host store's environment is hostile/unknown.

### C. Web component (custom element + Shadow DOM)

A custom element (`<config-tool>`) with Shadow DOM.

- **Pro:** **native style encapsulation** via Shadow DOM (CSS scoped automatically) while living in the host DOM — a strong middle ground.
- **Con:** Shadow DOM boundary needs care for fonts/theming; older host themes may need a polyfill check.
- **Use when:** you want script-tag-like integration with iframe-like style isolation. **Default recommendation** unless a specific reason favors A or B.

> Decision rule: prefer **C (web component + Shadow DOM)** for the isolation-vs-blend balance; choose **B (iframe)** when the host environment is untrusted or CSP-hostile; choose **A (script tag)** only when you must read deep host context and can prove isolation.

---

## Talking to the backend API

The backend is **thin**: save a configuration, price a combination, fetch options. Keep these honest:

- **CORS:** the API explicitly allows the host store's origin(s). Lock the allowlist to the real storefront domains — no `*`.
- **CSP reconciliation:** the host store's `connect-src` must permit calls to your API origin; `script-src` must permit your script (or you load via iframe to sidestep it). **Check the live store's CSP at G2** — a restrictive CSP is the most common late-stage blocker.
- **Auth:** usually a public, rate-limited, read-mostly API (shoppers aren't logged into our system). Scope what it can do; never expose write/admin surface to the embedded origin. Sign or scope any save token.
- **Fail closed:** every API call has a timeout and a catch. On failure the widget degrades to a usable or hidden state — it **never** throws into the host page.

---

## Widget state

- Keep state **local to the widget** (component state / a small store). Don't reach into or mutate host-page state beyond the single sanctioned handoff (e.g. writing the chosen variant to the store's add-to-cart form).
- Persist long-lived state (a saved design) via the backend, keyed by an opaque ID — not in host `localStorage` you might collide on. If you must use storage, namespace the key hard.
- The **handoff to the store** (add-to-cart, quote, saved design) is the one place you touch the host's native flow. Treat it as an integration point: tested, defensive, and reversible.

---

## Live-preview rendering

The interactive heart of most of these tools — change an option, see the result update.

- **Render on the client** for responsiveness; debounce option changes; avoid a network round-trip per keystroke.
- If a preview needs server compute (e.g. a rendered image), show an optimistic/placeholder state, then reconcile — never block the UI on the network.
- Keep the preview's work off the main thread where it's heavy (Web Worker / `requestIdleCallback`) so the host page stays responsive.

---

## Performance budget

The widget is extra weight on a page that already has a budget. Treat the budget as a contract.

- **Set an explicit budget at G1/G2:** a transfer-size cap for the widget bundle and a main-thread-time cap. Write it in `performance-budget.md`.
- **Lazy-load:** don't load the widget (or its heavy assets) until it's needed — on interaction or in-viewport. Don't block the host page's first render.
- **Measure on the host page with the widget embedded** — Lighthouse before and after, on the real storefront, mobile profile. The widget-in-isolation number is meaningless; the shopper experiences the combined page.
- Code-split, tree-shake, compress. No giant dependency for one helper.

---

## Accessibility

It's an interactive control a real shopper uses. Non-negotiable:

- **axe-core: zero violations** on the widget (gated at G4).
- **Full keyboard operability** — every control reachable and operable by keyboard; logical tab order; visible focus.
- **Focus management** — when the widget opens/updates, focus goes somewhere sensible; trapped appropriately if modal.
- **ARIA + semantics** — real roles, labels, and state announcements; live regions for preview updates a screen reader should hear.
- **Color contrast** meets WCAG AA, independent of the host theme.
- If using **iframe or Shadow DOM**, verify the screen-reader experience across that boundary — it can swallow announcements if done carelessly.

---

## Not breaking the host store — the hard rules

This is the constraint that outranks everything. The store is the client's livelihood; the widget is a guest.

1. **Fail closed and silent.** Any error, timeout, or failed API call degrades gracefully. The widget disappearing is acceptable; an uncaught error in the host page is not.
2. **Never let an error escape into the host page.** Wrap the widget's entry points; swallow and report errors internally; don't let a throw bubble to the store's runtime.
3. **No global namespace pollution.** No globals beyond a single namespaced entry. No overwriting host globals. No monkey-patching host objects.
4. **Style isolation in both directions.** The widget's CSS must not leak into the store (Shadow DOM / iframe / strict prefix), and the store's CSS must not deform the widget. Verify against the real theme.
5. **Never block the host's native flow.** Add-to-cart, navigation, and the cart must keep working with the widget present — and with the widget's API forced down. This is a G4 and G6 check.
6. **Don't touch what you don't own.** Read host context through sanctioned points only; write only to the single agreed handoff (e.g. the add-to-cart form). No reaching into unrelated host DOM/state.
7. **Respect the host CSP.** Design within it. If the store's CSP blocks your method, change the method (often iframe) or get the CSP amended at G2 — don't ship something that violates it.

---

## Store-specific embedding + the theme-system boundary

The embedding methods above are generic web patterns. Each store platform also has a **sanctioned install mechanism** — prefer it over hand-editing the storefront, because it's merchant-installable and doesn't touch theme code:

- **Shopify:** a **theme app extension** (app embed block / app block) is the sanctioned way to inject a widget into an OS 2.0 theme — the merchant enables it, no Liquid edit. Checkout uses **checkout UI extensions**. The legacy **ScriptTag API** exists but avoid it for new work. Auth/session for an embedded app uses App Bridge (`../../integrations/shopify/02-oauth-and-app-bridge.md`).
- **BigCommerce:** **Script Manager** or **Storefront widgets** (Stencil) are the sanctioned injection points (`../../integrations/bigcommerce/`).

**The boundary rule (this skill vs. the WebDesk Shopify theme system):** this skill owns the **tool** — the app, its backend, its widget bundle, its logic, and its delivery through a theme app extension / app embed / Script Manager. It does **not** own the **theme**. The moment the work requires editing the store's own Liquid templates, theme sections, or OS 2.0 JSON templates, that is theme work and belongs to the **WebDesk Shopify theme system (v1.11.3)**, not here. Keep the tool decoupled: deliver via the app-extension mechanism so it installs without a theme edit. If a project genuinely needs both a custom tool _and_ theme changes, run them as two tracks with a clear handoff — don't let this skill start editing Liquid, and don't let the theme skill start building the Node backend. Record which skill owns which artifact at G1.

---

## Host-store safety checklist (use at G4 + G6)

- [ ] Widget bundle within the transfer-size budget; main-thread time within budget.
- [ ] Lighthouse on the host page with widget: performance not regressed past budget.
- [ ] axe-core: zero violations; keyboard + screen-reader pass.
- [ ] Styles isolated both ways, verified on the real live theme.
- [ ] Widget errors do not propagate to the host page (forced-error test).
- [ ] Native add-to-cart / cart works with the widget present and with the widget API forced down.
- [ ] CORS allowlist scoped to real storefront origins; CSP reconciled.
- [ ] Cross-browser + cross-device render verified.
- [ ] Graceful failure verified (API down → widget degrades, store unharmed).

---

Last reviewed: 2026-06-30 by Claude (initial build)
