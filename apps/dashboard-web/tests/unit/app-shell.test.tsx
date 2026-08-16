import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ModuleRegistrySummary, ProjectSummary } from "@webdesk/shared-types";
import { AppShell } from "../../components/app-shell.js";

vi.mock("next/navigation", () => ({
  usePathname: () => "/home",
}));

function navEntry(
  overrides: Partial<ModuleRegistrySummary> & { key: string },
): ModuleRegistrySummary {
  const base = {
    id: overrides.key,
    name: overrides.key,
    permissionGroupKey: "project_configuration",
    displayName: overrides.key,
    description: null,
    navigationGroup: "home",
    navigationOrder: 1,
    route: `/${overrides.key}`,
    iconReference: null,
    v1InclusionStatus: "included",
    implementationStatus: "not_started",
    viewPermissionAction: "view",
    actionPermissions: null,
    featureStatus: null,
    documentationReference: "docs.md",
    helpDocumentReference: null,
    owner: "TBD",
    dependencies: null,
    confidentialityLevel: null,
    badgeSupport: true,
    deprecationReference: null,
    canView: true,
  } satisfies Omit<ModuleRegistrySummary, "key">;
  return { ...base, ...overrides, key: overrides.key };
}

function projectSummary(overrides: Partial<ProjectSummary> & { id: string }): ProjectSummary {
  return { publicId: overrides.id, name: overrides.id, status: "active", ...overrides };
}

describe("AppShell", () => {
  const navigation: ModuleRegistrySummary[] = [
    navEntry({ key: "home", displayName: "Home", route: "/home", navigationGroup: "home" }),
    navEntry({
      key: "system_settings",
      displayName: "System Settings",
      route: "/system-settings",
      navigationGroup: "settings",
    }),
  ];

  it("renders the user's display name and a sign-out link", () => {
    render(
      <AppShell
        me={{ id: "u1", email: "jane@example.com", displayName: "Jane Doe" }}
        navigation={navigation}
        projects={[]}
        initialProjectId={null}
      >
        <p>Page content</p>
      </AppShell>,
    );
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign out" })).toHaveAttribute("href", "/auth/logout");
  });

  it("renders navigation grouped by navigation_group, from the registry data only", () => {
    render(
      <AppShell
        me={{ id: "u1", email: "jane@example.com", displayName: "Jane Doe" }}
        navigation={navigation}
        projects={[]}
        initialProjectId={null}
      >
        <p>Page content</p>
      </AppShell>,
    );
    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/home");
    expect(screen.getByRole("link", { name: "System Settings" })).toHaveAttribute(
      "href",
      "/system-settings",
    );
  });

  it("marks the current route's link as the active page via aria-current", () => {
    render(
      <AppShell
        me={{ id: "u1", email: "jane@example.com", displayName: "Jane Doe" }}
        navigation={navigation}
        projects={[]}
        initialProjectId={null}
      >
        <p>Page content</p>
      </AppShell>,
    );
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "System Settings" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("renders a skip link targeting the main content landmark", () => {
    render(
      <AppShell
        me={{ id: "u1", email: "jane@example.com", displayName: "Jane Doe" }}
        navigation={navigation}
        projects={[]}
        initialProjectId={null}
      >
        <p>Page content</p>
      </AppShell>,
    );
    expect(screen.getByRole("link", { name: "Skip to main content" })).toHaveAttribute(
      "href",
      "#main-content",
    );
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
  });

  it("renders the page content passed as children", () => {
    render(
      <AppShell
        me={{ id: "u1", email: "jane@example.com", displayName: "Jane Doe" }}
        navigation={navigation}
        projects={[]}
        initialProjectId={null}
      >
        <p>Page content</p>
      </AppShell>,
    );
    expect(screen.getByText("Page content")).toBeInTheDocument();
  });

  it("orders navigation groups per APPROVED_NAVIGATION_GROUPS, not alphabetically or API order", () => {
    // Deliberately out of both alphabetical and canonical order in the input array —
    // "workflow" and "projects" both sort after "libraries"/"pages" alphabetically, but
    // APPROVED_NAVIGATION_GROUPS puts "projects" second and "workflow" fifth.
    const outOfOrder: ModuleRegistrySummary[] = [
      navEntry({ key: "workflow_mod", displayName: "Workflow Mod", navigationGroup: "workflow" }),
      navEntry({ key: "settings_mod", displayName: "Settings Mod", navigationGroup: "settings" }),
      navEntry({ key: "projects_mod", displayName: "Projects Mod", navigationGroup: "projects" }),
      navEntry({ key: "home_mod", displayName: "Home Mod", navigationGroup: "home" }),
    ];
    render(
      <AppShell
        me={{ id: "u1", email: "jane@example.com", displayName: "Jane Doe" }}
        navigation={outOfOrder}
        projects={[]}
        initialProjectId={null}
      >
        <p>Page content</p>
      </AppShell>,
    );
    const links = screen.getAllByRole("link").filter((link) => link.textContent?.endsWith(" Mod"));
    expect(links.map((link) => link.textContent)).toEqual([
      "Home Mod",
      "Projects Mod",
      "Workflow Mod",
      "Settings Mod",
    ]);
  });

  it("renders no navigation items when the caller has no visible modules", () => {
    render(
      <AppShell
        me={{ id: "u1", email: "jane@example.com", displayName: "Jane Doe" }}
        navigation={[]}
        projects={[]}
        initialProjectId={null}
      >
        <p>Page content</p>
      </AppShell>,
    );
    expect(screen.getByRole("navigation", { name: "Primary" })).toBeEmptyDOMElement();
  });

  describe("Project Switcher", () => {
    it("renders a disabled 'No projects yet' control when the caller has no visible projects", () => {
      render(
        <AppShell
          me={{ id: "u1", email: "jane@example.com", displayName: "Jane Doe" }}
          navigation={navigation}
          projects={[]}
          initialProjectId={null}
        >
          <p>Page content</p>
        </AppShell>,
      );
      const select = screen.getByLabelText("Project");
      expect(select).toBeDisabled();
      expect(screen.getByText("No projects yet")).toBeInTheDocument();
    });

    it("lists real projects plus an 'All projects' option, defaulting to 'All projects'", () => {
      const projects = [
        projectSummary({ id: "p1", name: "Acme Website" }),
        projectSummary({ id: "p2", name: "Beta Portal", status: "paused" }),
      ];
      render(
        <AppShell
          me={{ id: "u1", email: "jane@example.com", displayName: "Jane Doe" }}
          navigation={navigation}
          projects={projects}
          initialProjectId={null}
        >
          <p>Page content</p>
        </AppShell>,
      );
      const select = screen.getByLabelText("Project") as HTMLSelectElement;
      expect(select).not.toBeDisabled();
      expect(select.value).toBe("");
      expect(screen.getByRole("option", { name: "All projects" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Acme Website" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Beta Portal (paused)" })).toBeInTheDocument();
    });

    it("pre-selects the project named by initialProjectId when it's still visible", () => {
      const projects = [
        projectSummary({ id: "p1", name: "Acme Website" }),
        projectSummary({ id: "p2", name: "Beta Portal" }),
      ];
      render(
        <AppShell
          me={{ id: "u1", email: "jane@example.com", displayName: "Jane Doe" }}
          navigation={navigation}
          projects={projects}
          initialProjectId="p2"
        >
          <p>Page content</p>
        </AppShell>,
      );
      const select = screen.getByLabelText("Project") as HTMLSelectElement;
      expect(select.value).toBe("p2");
    });

    it("falls back to 'All projects' when initialProjectId names a project no longer visible", () => {
      const projects = [projectSummary({ id: "p1", name: "Acme Website" })];
      render(
        <AppShell
          me={{ id: "u1", email: "jane@example.com", displayName: "Jane Doe" }}
          navigation={navigation}
          projects={projects}
          initialProjectId="stale-id"
        >
          <p>Page content</p>
        </AppShell>,
      );
      const select = screen.getByLabelText("Project") as HTMLSelectElement;
      expect(select.value).toBe("");
    });

    it("updates the selection when the caller picks a different project", () => {
      const projects = [
        projectSummary({ id: "p1", name: "Acme Website" }),
        projectSummary({ id: "p2", name: "Beta Portal" }),
      ];
      render(
        <AppShell
          me={{ id: "u1", email: "jane@example.com", displayName: "Jane Doe" }}
          navigation={navigation}
          projects={projects}
          initialProjectId={null}
        >
          <p>Page content</p>
        </AppShell>,
      );
      const select = screen.getByLabelText("Project") as HTMLSelectElement;
      fireEvent.change(select, { target: { value: "p2" } });
      expect(select.value).toBe("p2");
    });
  });
});
