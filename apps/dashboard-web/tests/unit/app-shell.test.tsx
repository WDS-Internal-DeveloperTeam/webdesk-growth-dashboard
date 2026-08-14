import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ModuleRegistrySummary } from "@webdesk/shared-types";
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
      >
        <p>Page content</p>
      </AppShell>,
    );
    expect(screen.getByText("Page content")).toBeInTheDocument();
  });

  it("renders no navigation items when the caller has no visible modules", () => {
    render(
      <AppShell
        me={{ id: "u1", email: "jane@example.com", displayName: "Jane Doe" }}
        navigation={[]}
      >
        <p>Page content</p>
      </AppShell>,
    );
    expect(screen.getByRole("navigation", { name: "Primary" })).toBeEmptyDOMElement();
  });
});
