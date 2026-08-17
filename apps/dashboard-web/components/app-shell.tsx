"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  APPROVED_NAVIGATION_GROUPS,
  type ModuleRegistrySummary,
  type ProjectSummary,
} from "@webdesk/shared-types";
import {
  Avatar,
  Badge,
  CommandMenu,
  Drawer,
  Dropdown,
  IconButton,
  NotConfiguredState,
  Tooltip,
} from "@webdesk/ui";
import type { ServerSessionProfile } from "@/lib/server-session";
import type { ServerSessionSystemStatus } from "@/lib/server-session";
import { ProjectSwitcher } from "./project-switcher";
import styles from "./app-shell.module.css";

export interface AppShellProps {
  readonly me: ServerSessionProfile;
  readonly navigation: readonly ModuleRegistrySummary[];
  readonly projects: readonly ProjectSummary[];
  readonly initialProjectId: string | null;
  readonly systemStatus?: ServerSessionSystemStatus;
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
 * The `libraries` group's 5-cluster display-only sub-organization
 * (`03-information-architecture.md` §2, `04-navigation-system.md` §1.1) —
 * derived from each module's existing seeded `navigationOrder`, not a new
 * `module_registry` field. A cluster with zero visible modules for the
 * current caller is simply never rendered (its `keys` all absent from the
 * server-filtered `navigation` prop).
 */
const LIBRARY_CLUSTERS: ReadonlyArray<{
  readonly label: string;
  readonly keys: ReadonlySet<string>;
}> = [
  {
    label: "Strategy & Business",
    keys: new Set(["business_knowledge_center", "website_strategy_center"]),
  },
  {
    label: "Case Studies & Portfolio",
    keys: new Set(["case_study_studio", "case_study_library", "portfolio_library"]),
  },
  {
    label: "Design System",
    keys: new Set([
      "brand_library",
      "design_reference_library",
      "asset_library",
      "design_token_library",
      "component_library",
      "section_and_pattern_library",
      "page_template_library",
      "wireframe_library",
      "motion_and_interaction_library",
      "design_review_center",
    ]),
  },
  {
    label: "Content & Search",
    keys: new Set([
      "service_library",
      "persona_library",
      "proof_and_claims_library",
      "keyword_and_entity_library",
      "internal_linking_library",
      "content_template_library",
    ]),
  },
  {
    label: "Agents & Knowledge",
    keys: new Set([
      "agent_directory",
      "agent_specification_library",
      "knowledge_library",
      "workflow_and_task_template_library",
    ]),
  },
];

const SIDEBAR_COLLAPSED_STORAGE_KEY = "webdesk-dashboard-sidebar-collapsed";
const TABLET_RANGE_QUERY = "(min-width: 768px) and (max-width: 1023.98px)";

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

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

/** For the `libraries` group only: interleaves non-interactive cluster sub-headers between entries, by seeded order. */
function withLibraryClusters(
  entries: readonly ModuleRegistrySummary[],
): ReadonlyArray<{ readonly clusterLabel: string | null; readonly entry: ModuleRegistrySummary }> {
  const result: Array<{ clusterLabel: string | null; entry: ModuleRegistrySummary }> = [];
  let lastCluster: string | null = null;
  for (const entry of entries) {
    const cluster =
      LIBRARY_CLUSTERS.find((candidate) => candidate.keys.has(entry.key))?.label ?? null;
    result.push({ clusterLabel: cluster !== lastCluster ? cluster : null, entry });
    lastCluster = cluster;
  }
  return result;
}

/**
 * The authenticated application frame (Phase 1F brief §8, extended per the
 * dashboard UI/UX design system's `04-navigation-system.md`): global header
 * with the Project Switcher, search, notifications, help, environment/
 * system-status indicators, and a user menu; registry-driven permission-
 * aware sidebar navigation with a desktop collapse toggle and forced
 * icon-only rendering in the tablet width range. Backend route
 * authorization remains authoritative regardless of what this sidebar or
 * header shows.
 */
export function AppShell({
  me,
  navigation,
  projects,
  initialProjectId,
  systemStatus = { environment: null, isDegraded: false },
  children,
}: AppShellProps): ReactNode {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isTabletRange, setIsTabletRange] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const groupedNavigation = groupNavigation(navigation);

  useEffect(() => {
    const stored = window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
    if (stored === "true") {
      setIsCollapsed(true);
    }
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia(TABLET_RANGE_QUERY);
    setIsTabletRange(mediaQuery.matches);
    function handleChange(event: MediaQueryListEvent) {
      setIsTabletRange(event.matches);
    }
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsSearchOpen(true);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  function toggleCollapsed() {
    setIsCollapsed((previous) => {
      const next = !previous;
      window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(next));
      return next;
    });
  }

  const isIconOnly = isTabletRange || isCollapsed;

  const searchItems = useMemo(
    () =>
      navigation.map((entry) => ({
        id: entry.key,
        label: entry.displayName ?? entry.name,
        description: NAV_GROUP_LABELS[entry.navigationGroup] ?? entry.navigationGroup,
        onSelect: () => router.push(entry.route),
      })),
    [navigation, router],
  );

  const helpRoute = navigation.find((entry) => entry.navigationGroup === "help")?.route ?? null;
  const showEnvironmentBadge =
    systemStatus.environment && systemStatus.environment !== "production";

  return (
    <div
      className={`${styles.shell} ${isCollapsed && !isTabletRange ? styles.shellCollapsed : ""}`}
    >
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
          {!isTabletRange ? (
            <IconButton
              label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              icon={<span aria-hidden="true">{isCollapsed ? "»" : "«"}</span>}
              onClick={toggleCollapsed}
              className={styles.collapseToggle}
            />
          ) : null}
          <Link href="/home" className={styles.brand}>
            WebDesk Growth Dashboard
          </Link>
          <ProjectSwitcher projects={projects} initialProjectId={initialProjectId} />
        </div>
        <div className={styles.headerActions}>
          {showEnvironmentBadge ? (
            <Badge bucket="attention" label={systemStatus.environment ?? ""} />
          ) : null}
          {systemStatus.isDegraded ? (
            <Tooltip label="System health is degraded">
              <a href="/health" aria-label="System health is degraded">
                <Badge bucket="blocked" label="Degraded" />
              </a>
            </Tooltip>
          ) : null}
          <IconButton
            label="Search (Ctrl+K)"
            icon={<span aria-hidden="true">🔍</span>}
            onClick={() => setIsSearchOpen(true)}
          />
          <IconButton
            label="Notifications"
            icon={<span aria-hidden="true">🔔</span>}
            onClick={() => setIsNotificationsOpen(true)}
          />
          {helpRoute ? (
            <IconButton
              label="Help"
              icon={<span aria-hidden="true">?</span>}
              onClick={() => router.push(helpRoute)}
            />
          ) : null}
          <Dropdown
            triggerLabel="Account menu"
            trigger={
              <span className={styles.userArea}>
                <Avatar name={me.displayName} size="sm" />
                <span>{me.displayName}</span>
              </span>
            }
            header={<span className={styles.userMenuEmail}>{me.email}</span>}
            items={[
              { id: "sign-out", label: "Sign out", onSelect: () => router.push("/auth/logout") },
            ]}
          />
        </div>
      </header>

      <nav
        id="primary-navigation"
        aria-label="Primary"
        className={`${styles.sidebar} ${mobileNavOpen ? styles.sidebarOpen : ""} ${isIconOnly ? styles.sidebarIconOnly : ""}`}
      >
        {groupedNavigation.map(([group, entries]) => (
          <div className={styles.navGroup} key={group}>
            {!isIconOnly ? (
              <span className={styles.navGroupLabel}>{NAV_GROUP_LABELS[group] ?? group}</span>
            ) : null}
            <ul className={styles.navList}>
              {(group === "libraries"
                ? withLibraryClusters(entries)
                : entries.map((entry) => ({ clusterLabel: null, entry }))
              ).map(({ clusterLabel, entry }) => {
                const isActive = pathname === entry.route || pathname.startsWith(`${entry.route}/`);
                const label = entry.displayName ?? entry.name;
                return (
                  <li key={entry.key}>
                    {clusterLabel && !isIconOnly ? (
                      <span className={styles.clusterLabel}>{clusterLabel}</span>
                    ) : null}
                    {isIconOnly ? (
                      <Tooltip label={label}>
                        <Link
                          href={entry.route}
                          className={isActive ? styles.sidebarLinkActive : styles.sidebarLink}
                          aria-current={isActive ? "page" : undefined}
                          aria-label={label}
                        >
                          <span aria-hidden="true">{initialsFor(label)}</span>
                        </Link>
                      </Tooltip>
                    ) : (
                      <Link
                        href={entry.route}
                        className={isActive ? styles.sidebarLinkActive : styles.sidebarLink}
                        aria-current={isActive ? "page" : undefined}
                        onClick={() => setMobileNavOpen(false)}
                      >
                        {label}
                      </Link>
                    )}
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

      <CommandMenu
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        items={searchItems}
        placeholder="Search modules…"
        emptyMessage="No modules match your search."
      />

      <Drawer
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        title="Notifications"
      >
        <NotConfiguredState message="Personal notifications aren't wired up yet — the backend has no self-service inbox endpoint for your own account. This will be connected once that's built." />
      </Drawer>
    </div>
  );
}
