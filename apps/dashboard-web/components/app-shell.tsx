"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { APPROVED_NAVIGATION_GROUPS, type ModuleRegistrySummary } from "@webdesk/shared-types";
import type { ServerSessionProfile } from "@/lib/server-session";
import styles from "./app-shell.module.css";

export interface AppShellProps {
  readonly me: ServerSessionProfile;
  readonly navigation: readonly ModuleRegistrySummary[];
  readonly children: ReactNode;
}

const NAV_GROUP_LABELS: Readonly<Record<string, string>> = {
  home: "Home",
  projects: "Projects",
  pages: "Pages",
  libraries: "Libraries",
  workflow: "Workflow",
  scans: "Scans",
  technical: "Technical",
  releases: "Releases",
  help: "Help",
  settings: "Settings",
};

/**
 * Groups navigation entries, then orders the groups per
 * `APPROVED_NAVIGATION_GROUPS` (the approved wireframe order — home,
 * projects, pages, ... settings), NOT the API response order (which is
 * alphabetical, per `ModuleRegistryRepository.listForNavigation()`'s own
 * `ORDER BY navigation_group`). Any group not in the approved list sorts
 * after all approved ones, so an unexpected value is visible rather than
 * silently reordering everything.
 */
function groupNavigation(
  navigation: readonly ModuleRegistrySummary[],
): ReadonlyArray<readonly [string, ModuleRegistrySummary[]]> {
  const groups = new Map<string, ModuleRegistrySummary[]>();
  for (const entry of navigation) {
    const group = groups.get(entry.navigationGroup) ?? [];
    group.push(entry);
    groups.set(entry.navigationGroup, group);
  }
  return [...groups.entries()].sort(([a], [b]) => {
    const indexA = APPROVED_NAVIGATION_GROUPS.indexOf(a);
    const indexB = APPROVED_NAVIGATION_GROUPS.indexOf(b);
    return (
      (indexA === -1 ? APPROVED_NAVIGATION_GROUPS.length : indexA) -
      (indexB === -1 ? APPROVED_NAVIGATION_GROUPS.length : indexB)
    );
  });
}

/**
 * The authenticated application frame (Phase 1F brief §8): global header
 * with user/account area, registry-driven permission-aware sidebar
 * navigation (brief §9/§10 — server already filtered `navigation` to what
 * the caller may view; this component never re-derives that decision),
 * skip link, and the main content slot. Backend route authorization
 * remains authoritative regardless of what this sidebar shows.
 */
export function AppShell({ me, navigation, children }: AppShellProps): ReactNode {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const groupedNavigation = groupNavigation(navigation);

  return (
    <div className={styles.shell}>
      <a href="#main-content" className={styles.skipLink}>
        Skip to main content
      </a>

      <header className={styles.header}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <button
            type="button"
            className={styles.navToggle}
            aria-expanded={mobileNavOpen}
            aria-controls="primary-navigation"
            onClick={() => setMobileNavOpen((open) => !open)}
          >
            <span aria-hidden="true">☰</span>
            <span style={{ marginLeft: "0.5rem" }}>Menu</span>
          </button>
          <Link href="/home" className={styles.brand}>
            WebDesk Growth Dashboard
          </Link>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.userArea}>
            <span>{me.displayName}</span>
          </div>
          <Link href="/auth/logout" className={styles.sidebarLink}>
            Sign out
          </Link>
        </div>
      </header>

      <nav
        id="primary-navigation"
        aria-label="Primary"
        className={`${styles.sidebar} ${mobileNavOpen ? styles.sidebarOpen : ""}`}
      >
        {groupedNavigation.map(([group, entries]) => (
          <div className={styles.navGroup} key={group}>
            <span className={styles.navGroupLabel}>{NAV_GROUP_LABELS[group] ?? group}</span>
            <ul className={styles.navList}>
              {entries.map((entry) => {
                const isActive = pathname === entry.route || pathname.startsWith(`${entry.route}/`);
                return (
                  <li key={entry.key}>
                    <Link
                      href={entry.route}
                      className={isActive ? styles.sidebarLinkActive : styles.sidebarLink}
                      aria-current={isActive ? "page" : undefined}
                      onClick={() => setMobileNavOpen(false)}
                    >
                      {entry.displayName ?? entry.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <main id="main-content" className={styles.main} tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
