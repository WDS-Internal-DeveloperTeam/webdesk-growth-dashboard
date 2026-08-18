import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ModuleRegistrySummary, ProjectSummary } from "@webdesk/shared-types";
import { AppShell } from "../../components/app-shell.js";
import { fixtureModule } from "../../lib/e2e-test-session.js";

const { routerPush } = vi.hoisted(() => ({ routerPush: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/home",
  useRouter: () => ({ push: routerPush, replace: vi.fn(), refresh: vi.fn() }),
}));

// Delegates to `lib/e2e-test-session.ts`'s `fixtureModule()` — the single source of truth for
// this ~19-field default shape — instead of maintaining an independent copy that can silently
// drift from it (e.g. a previously-differing `implementationStatus` default between the two).
function navEntry(
  overrides: Partial<ModuleRegistrySummary> & { key: string },
): ModuleRegistrySummary {
  return fixtureModule({
    navigationGroup: "home",
    navigationOrder: 1,
    route: `/${overrides.key}`,
    ...overrides,
  });
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

  it("renders the user's display name, and signs out via the account menu", () => {
    routerPush.mockClear();
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
    fireEvent.click(screen.getByRole("button", { name: "Account menu" }));
    expect(screen.getByText("jane@example.com")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));
    expect(routerPush).toHaveBeenCalledWith("/auth/logout");
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

  describe("sidebar collapse toggle", () => {
    it("switches the nav links to icon-only monograms and back", () => {
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
      expect(screen.getByRole("link", { name: "Home" })).toHaveTextContent("Home");
      fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));
      expect(screen.getByRole("link", { name: "Home" })).toHaveTextContent("H");
      fireEvent.click(screen.getByRole("button", { name: "Expand sidebar" }));
      expect(screen.getByRole("link", { name: "Home" })).toHaveTextContent("Home");
    });
  });

  describe("libraries group clustering", () => {
    it("renders a cluster sub-header only in the libraries group, once per cluster boundary", () => {
      const librariesNav: ModuleRegistrySummary[] = [
        navEntry({
          key: "business_knowledge_center",
          displayName: "Business Knowledge Center",
          navigationGroup: "libraries",
        }),
        navEntry({
          key: "website_strategy_center",
          displayName: "Website Strategy Center",
          navigationGroup: "libraries",
        }),
        navEntry({
          key: "case_study_studio",
          displayName: "Case Study Studio",
          navigationGroup: "libraries",
        }),
      ];
      render(
        <AppShell
          me={{ id: "u1", email: "jane@example.com", displayName: "Jane Doe" }}
          navigation={librariesNav}
          projects={[]}
          initialProjectId={null}
        >
          <p>Page content</p>
        </AppShell>,
      );
      expect(screen.getByText("Strategy & Business")).toBeInTheDocument();
      expect(screen.getByText("Case Studies & Portfolio")).toBeInTheDocument();
    });

    it("hides cluster sub-headers when the sidebar is collapsed", () => {
      const librariesNav: ModuleRegistrySummary[] = [
        navEntry({
          key: "business_knowledge_center",
          displayName: "Business Knowledge Center",
          navigationGroup: "libraries",
        }),
      ];
      render(
        <AppShell
          me={{ id: "u1", email: "jane@example.com", displayName: "Jane Doe" }}
          navigation={librariesNav}
          projects={[]}
          initialProjectId={null}
        >
          <p>Page content</p>
        </AppShell>,
      );
      fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));
      expect(screen.queryByText("Strategy & Business")).not.toBeInTheDocument();
    });
  });

  describe("header search", () => {
    it("opens the command menu, filters modules, and navigates on selection", () => {
      routerPush.mockClear();
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
      fireEvent.click(screen.getByRole("button", { name: "Search (Ctrl+K)" }));
      const dialog = screen.getByRole("dialog", { name: "Search" });
      const input = within(dialog).getByRole("combobox");
      fireEvent.change(input, { target: { value: "settings" } });
      const option = within(dialog).getByRole("option", { name: /System Settings/ });
      fireEvent.click(within(option).getByRole("button"));
      expect(routerPush).toHaveBeenCalledWith("/system-settings");
    });
  });

  describe("help icon", () => {
    it("navigates to the help_center module's route when present in navigation", () => {
      routerPush.mockClear();
      const withHelp: ModuleRegistrySummary[] = [
        ...navigation,
        navEntry({
          key: "help_center",
          displayName: "Help Center",
          route: "/help",
          navigationGroup: "help",
        }),
      ];
      render(
        <AppShell
          me={{ id: "u1", email: "jane@example.com", displayName: "Jane Doe" }}
          navigation={withHelp}
          projects={[]}
          initialProjectId={null}
        >
          <p>Page content</p>
        </AppShell>,
      );
      fireEvent.click(screen.getByRole("button", { name: "Help" }));
      expect(routerPush).toHaveBeenCalledWith("/help");
    });

    it("omits the help icon entirely when no help-group module is visible", () => {
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
      expect(screen.queryByRole("button", { name: "Help" })).not.toBeInTheDocument();
    });
  });

  describe("notifications drawer", () => {
    it("opens to an honest not-configured state, not a fake inbox", () => {
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
      fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
      expect(screen.getByRole("dialog", { name: "Notifications" })).toBeInTheDocument();
      expect(screen.getByText(/Personal notifications aren't wired up yet/)).toBeInTheDocument();
    });
  });

  describe("environment and system-status indicators", () => {
    it("shows nothing when systemStatus is production and healthy", () => {
      render(
        <AppShell
          me={{ id: "u1", email: "jane@example.com", displayName: "Jane Doe" }}
          navigation={navigation}
          projects={[]}
          initialProjectId={null}
          systemStatus={{ environment: "production", isDegraded: false }}
        >
          <p>Page content</p>
        </AppShell>,
      );
      expect(screen.queryByText("production")).not.toBeInTheDocument();
      expect(screen.queryByText("Degraded")).not.toBeInTheDocument();
    });

    it("shows the environment badge for a non-production environment", () => {
      render(
        <AppShell
          me={{ id: "u1", email: "jane@example.com", displayName: "Jane Doe" }}
          navigation={navigation}
          projects={[]}
          initialProjectId={null}
          systemStatus={{ environment: "staging", isDegraded: false }}
        >
          <p>Page content</p>
        </AppShell>,
      );
      expect(screen.getByText("staging")).toBeInTheDocument();
    });

    it("shows the degraded system-status badge only when isDegraded is true", () => {
      render(
        <AppShell
          me={{ id: "u1", email: "jane@example.com", displayName: "Jane Doe" }}
          navigation={navigation}
          projects={[]}
          initialProjectId={null}
          systemStatus={{ environment: "production", isDegraded: true }}
        >
          <p>Page content</p>
        </AppShell>,
      );
      expect(screen.getByText("Degraded")).toBeInTheDocument();
    });
  });
});
