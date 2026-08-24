"use client";

import type { FormEvent, ReactNode } from "react";
import type { Project } from "@webdesk/shared-types";
import { CURRENT_PROJECT_COOKIE } from "@/lib/current-project";
import {
  filterSelectStyle as selectStyle,
  filterSubmitButtonStyle as submitButtonStyle,
} from "@/lib/list-filter-styles";

export interface ProjectPickerFormProps {
  readonly projects: readonly Project[];
  readonly defaultProjectId: string | null;
  /** Defaults to "View pages" (Page Inventory's own original, only consumer) — Keyword & Entity
   *  Library, the 2nd project-scoped module to reuse this component, passes "View keywords"
   *  instead, so the submit button reads correctly for whichever module rendered it. */
  readonly submitLabel?: string;
}

/** Mirrors `ProjectSwitcher`'s own `COOKIE_MAX_AGE_SECONDS` exactly — the two pickers write the
 *  same cookie, so their lifetimes shouldn't silently diverge. */
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

const labelStyle = {
  fontSize: "0.75rem",
  color: "var(--webdesk-dashboard-color-foreground-muted)",
} as const;

/**
 * A thin client wrapper around the Page Inventory list page's project-picker `<select>` — the
 * only reason this needs `"use client"` at all is to mirror `ProjectSwitcher.handleChange()`'s own
 * `document.cookie` write on selection (code-review finding, `dashboard-web-page-inventory`):
 * previously, choosing a project through THIS picker never updated `CURRENT_PROJECT_COOKIE`, so the
 * header switcher's own "current project" indicator could silently diverge from what a user had
 * just picked here. `?projectId=` in the URL remains the sole source of truth for every actual
 * fetch/mutation (confirmed with the user directly) — this cookie write is purely a UX
 * convenience, the same advisory-only role it already plays for `ProjectSwitcher`'s own picker.
 */
export function ProjectPickerForm({
  projects,
  defaultProjectId,
  submitLabel = "View pages",
}: ProjectPickerFormProps): ReactNode {
  const hasDefault =
    defaultProjectId !== null && projects.some((project) => project.id === defaultProjectId);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    const projectId = new FormData(event.currentTarget).get("projectId");
    if (typeof projectId !== "string" || !projectId) {
      return;
    }
    const expires = new Date(Date.now() + COOKIE_MAX_AGE_SECONDS * 1000).toUTCString();
    document.cookie = `${CURRENT_PROJECT_COOKIE}=${projectId}; path=/; expires=${expires}; SameSite=Lax`;
    // The native GET navigation still proceeds — this handler only piggybacks the cookie write.
  }

  return (
    <form
      method="get"
      onSubmit={handleSubmit}
      style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "0.75rem" }}
    >
      <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        <span style={labelStyle}>Project</span>
        <select
          name="projectId"
          defaultValue={hasDefault ? (defaultProjectId as string) : ""}
          required
          style={selectStyle}
        >
          <option value="" disabled>
            Select a project…
          </option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" style={submitButtonStyle}>
        {submitLabel}
      </button>
    </form>
  );
}
