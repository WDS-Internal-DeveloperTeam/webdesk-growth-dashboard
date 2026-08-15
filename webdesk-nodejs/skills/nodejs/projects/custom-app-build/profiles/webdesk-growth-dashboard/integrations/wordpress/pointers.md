---
tier: 2
load_when: ["webdesk-growth-dashboard", "integration-work"]
description: "WordPress REST API / Application Passwords / WP-CLI / WordPress.com doc anchors. Confirm current reported versions and hosting constraints at build — none have been independently verified for this project's actual site."
---

# WordPress — Doc Pointers

> Anchored entry points. Environment facts below are now sourced from the registered `canonical-inputs/Current_WordPress_Technical_Discovery.md` (supplied 2026-08-05) rather than the original dashboard pack alone — see `../../knowledge/07-wordpress-integration.md §"Confirmed environment facts"` for the full three-tier breakdown (confirmed fact / approved target / still requires verification).

## Reported current environment (per the registered Technical Discovery)

- Production: `https://webdesksolution.com/` — **confirmed current fact**
- Staging: `https://staging-7a61-wdsstage2.wpcomstaging.com/` — **confirmed current fact**
- WordPress version: 7.0.2 — **confirmed current fact**
- PHP version: 8.4 — **confirmed current fact**
- Hosting: WordPress.com Business Plan — **confirmed current fact**
- REST API (`/wp-json/`) availability — **still requires verification** (explicitly stated as unverified by the source document itself)
- Application Passwords enabled — **still requires verification**
- WP-CLI/SSH actual provisioning — **still requires verification**
- Active theme, custom files, dependencies — **still requires verification** (separate from the plugin list, which IS confirmed — see the full plugin inventory in `../../knowledge/07-wordpress-integration.md`)

## Doc anchors

- REST API handbook: https://developer.wordpress.org/rest-api/
- Application Passwords: https://make.wordpress.org/core/2020/11/05/application-passwords-integration-guide/
- `register_post_meta()`: https://developer.wordpress.org/reference/functions/register_post_meta/
- Custom REST fields: https://developer.wordpress.org/rest-api/extending-the-rest-api/modifying-responses/
- WP-CLI handbook: https://make.wordpress.org/cli/handbook/
- `wp core verify-checksums`: https://developer.wordpress.org/cli/commands/core/verify-checksums/
- WordPress.com GitHub Deployments: https://developer.wordpress.com/docs/developer-tools/github-deployments/
- Theme development handbook: https://developer.wordpress.org/themes/

## At-build checklist

- [ ] Confirm REST API (`/wp-json/`) is reachable and not restricted/disabled for the operations in scope — explicitly unverified as of the registered discovery.
- [ ] Confirm Application Passwords are enabled on this WordPress.com plan and the required least-privilege role can actually be created.
- [ ] Confirm WP-CLI/SSH access constraints on this specific hosting plan, per environment (dev/staging/production).
- [ ] Confirm the exact active production theme, child theme, custom files, and dependencies (distinct from the already-confirmed plugin list).
- [ ] Confirm whether current WordPress code is already in Git, and where.
