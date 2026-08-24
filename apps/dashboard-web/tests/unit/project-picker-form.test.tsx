import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Project } from "@webdesk/shared-types";

import { ProjectPickerForm } from "../../components/project-picker-form.js";

const PROJECT_ID = "99999999-9999-9999-9999-999999999999";
const OTHER_PROJECT_ID = "88888888-8888-8888-8888-888888888888";

function projectFixture(id: string, name: string): Project {
  return {
    id,
    publicId: `PROJ-${id}`,
    name,
    description: null,
    status: "active",
    confidentiality: "internal",
    createdAt: "2026-08-24T00:00:00.000Z",
    updatedAt: "2026-08-24T00:00:00.000Z",
  };
}

const PROJECTS: readonly Project[] = [
  projectFixture(PROJECT_ID, "Acme"),
  projectFixture(OTHER_PROJECT_ID, "Beta"),
];

describe("ProjectPickerForm", () => {
  afterEach(() => {
    document.cookie = "wds_current_project=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  });

  it("defaults the submit button label to 'View pages' (Page Inventory's own original consumer) when submitLabel isn't given", () => {
    render(<ProjectPickerForm projects={PROJECTS} defaultProjectId={null} />);
    expect(screen.getByRole("button", { name: "View pages" })).toBeInTheDocument();
  });

  it("uses a custom submitLabel when given — e.g. Keyword & Entity Library's own 'View keywords'/'View entities'", () => {
    render(
      <ProjectPickerForm projects={PROJECTS} defaultProjectId={null} submitLabel="View keywords" />,
    );
    expect(screen.getByRole("button", { name: "View keywords" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "View pages" })).not.toBeInTheDocument();
  });

  it("pre-selects defaultProjectId when it resolves to a real project in the list", () => {
    render(<ProjectPickerForm projects={PROJECTS} defaultProjectId={OTHER_PROJECT_ID} />);
    expect(screen.getByRole("combobox")).toHaveValue(OTHER_PROJECT_ID);
  });

  it("falls back to the placeholder option when defaultProjectId doesn't resolve to a real project", () => {
    render(<ProjectPickerForm projects={PROJECTS} defaultProjectId="not-a-real-project" />);
    expect(screen.getByRole("combobox")).toHaveValue("");
  });

  it("lists every project by name as a selectable option", () => {
    render(<ProjectPickerForm projects={PROJECTS} defaultProjectId={null} />);
    expect(screen.getByRole("option", { name: "Acme" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Beta" })).toBeInTheDocument();
  });

  it("writes the wds_current_project cookie on submit, mirroring ProjectSwitcher's own advisory-only cookie write", () => {
    render(<ProjectPickerForm projects={PROJECTS} defaultProjectId={null} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: OTHER_PROJECT_ID } });
    // jsdom doesn't implement real navigation for a plain <form method="get"> submit, so the
    // "submit" event still fires and reaches the handler even though nothing actually navigates —
    // exactly what this test needs to isolate.
    fireEvent.submit(screen.getByRole("combobox").closest("form")!);
    expect(document.cookie).toContain(`wds_current_project=${OTHER_PROJECT_ID}`);
  });
});
