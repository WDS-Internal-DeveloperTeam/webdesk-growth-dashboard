"use client";

import { useState, type ReactNode } from "react";
import type { ProjectSummary } from "@webdesk/shared-types";
import { CURRENT_PROJECT_COOKIE } from "@/lib/current-project";
import styles from "./project-switcher.module.css";

export interface ProjectSwitcherProps {
  readonly projects: readonly ProjectSummary[];
  /** The project id read from `CURRENT_PROJECT_COOKIE` server-side, or `null` if unset/stale. */
  readonly initialProjectId: string | null;
}

const STATUS_LABEL: Readonly<Record<ProjectSummary["status"], string>> = {
  active: "",
  paused: " (paused)",
  archived: " (archived)",
};

/** One year — the same "survives a normal browsing session, not forever" horizon this codebase
 *  hasn't needed to pick before now; nothing else reads this cookie server-side yet, so its exact
 *  lifetime has no other consumer to stay consistent with. */
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/**
 * Header project context switcher (`07_Low_Fidelity_Wireframes.md` §1's "Project Switcher"
 * placeholder — no interaction spec beyond the label existed before this). Selecting a project
 * only persists the choice to `CURRENT_PROJECT_COOKIE` for now; no other module reads it yet
 * (`docs/task-packages/module-projects-foundation.md` D7 flags wiring a real downstream project
 * context as separate, still-undesigned scope). A native `<select>` rather than a custom listbox —
 * fully keyboard/screen-reader accessible for free, and no approved visual design exists yet to
 * justify a bespoke control (Phase 1F's own "neutral foundations where visual detail isn't yet
 * approved" precedent, `docs/implementation/phase-1f-application-shell.md`).
 */
export function ProjectSwitcher({ projects, initialProjectId }: ProjectSwitcherProps): ReactNode {
  // A cookie naming a project that's since been deleted, or that this caller can no longer see,
  // must not select a nonexistent <option> — falls back to "All projects" instead.
  const validInitialId =
    initialProjectId && projects.some((project) => project.id === initialProjectId)
      ? initialProjectId
      : "";
  const [selectedId, setSelectedId] = useState(validInitialId);

  if (projects.length === 0) {
    return (
      <div className={styles.wrapper}>
        <label htmlFor="project-switcher" className={styles.label}>
          Project
        </label>
        <select id="project-switcher" className={styles.select} disabled>
          <option>No projects yet</option>
        </select>
      </div>
    );
  }

  function handleChange(projectId: string): void {
    setSelectedId(projectId);
    const expires = new Date(Date.now() + COOKIE_MAX_AGE_SECONDS * 1000).toUTCString();
    document.cookie = `${CURRENT_PROJECT_COOKIE}=${projectId}; path=/; expires=${expires}; SameSite=Lax`;
  }

  return (
    <div className={styles.wrapper}>
      <label htmlFor="project-switcher" className={styles.label}>
        Project
      </label>
      <select
        id="project-switcher"
        className={styles.select}
        value={selectedId}
        onChange={(event) => handleChange(event.target.value)}
      >
        <option value="">All projects</option>
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
            {STATUS_LABEL[project.status]}
          </option>
        ))}
      </select>
    </div>
  );
}
