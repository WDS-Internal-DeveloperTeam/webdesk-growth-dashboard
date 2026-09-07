import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import { IntegrationEnvironmentsSection } from "../../components/integration-environments-section.js";

const INTEGRATION_ID = "11111111-1111-1111-1111-111111111111";

describe("IntegrationEnvironmentsSection", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    refreshMock.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("renders 'No environments recorded yet.' when empty", () => {
    render(
      <IntegrationEnvironmentsSection integrationId={INTEGRATION_ID} initialEnvironments={[]} />,
    );
    expect(screen.getByText("No environments recorded yet.")).toBeInTheDocument();
  });

  it("adds an environment — posting environmentName/status/configReference/notes, no refresh needed", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          id: "env-1",
          integrationId: INTEGRATION_ID,
          environmentName: "Staging",
          status: "connected",
          configReference: null,
          notes: null,
          lastVerifiedAt: null,
          createdAt: "2026-09-01T00:00:00.000Z",
          updatedAt: "2026-09-01T00:00:00.000Z",
        },
        correlationId: "corr-1",
      }),
    } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <IntegrationEnvironmentsSection integrationId={INTEGRATION_ID} initialEnvironments={[]} />,
    );
    fireEvent.change(screen.getByLabelText("Environment name"), {
      target: { value: "Staging" },
    });
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "connected" } });
    fireEvent.click(screen.getByRole("button", { name: "Add environment" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `https://api.example.com/integrations/${INTEGRATION_ID}/environments`,
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          body: JSON.stringify({
            environmentName: "Staging",
            status: "connected",
            configReference: null,
            notes: null,
          }),
        }),
      ),
    );
    expect(await screen.findByText("Staging")).toBeInTheDocument();
    // No other section on the page reads environment data, so no router.refresh() is expected.
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("deletes an environment — calls DELETE on its own id and does not error", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 } as Response);
    global.fetch = fetchMock as typeof fetch;

    render(
      <IntegrationEnvironmentsSection
        integrationId={INTEGRATION_ID}
        initialEnvironments={[
          {
            id: "env-1",
            integrationId: INTEGRATION_ID,
            environmentName: "Staging",
            status: "connected",
            configReference: null,
            notes: null,
            lastVerifiedAt: null,
            createdAt: "2026-09-01T00:00:00.000Z",
            updatedAt: "2026-09-01T00:00:00.000Z",
          },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `https://api.example.com/integrations/${INTEGRATION_ID}/environments/env-1`,
        expect.objectContaining({ method: "DELETE", credentials: "include" }),
      ),
    );
    await waitFor(() => expect(screen.queryByText("Staging")).not.toBeInTheDocument());
  });

  it("shows the backend's error message on a failed add", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        error: { code: "BadRequestException", message: "Environment name is required" },
        correlationId: "corr-1",
      }),
    } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <IntegrationEnvironmentsSection integrationId={INTEGRATION_ID} initialEnvironments={[]} />,
    );
    fireEvent.change(screen.getByLabelText("Environment name"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Add environment" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Environment name is required");
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("resyncs an open edit form's fields when the row's own updatedAt changes externally, but not on an unrelated re-render", () => {
    const base = {
      id: "env-1",
      integrationId: INTEGRATION_ID,
      environmentName: "Staging",
      status: "connected" as const,
      configReference: "old ref",
      notes: null,
      lastVerifiedAt: null,
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
    };
    const { rerender } = render(
      <IntegrationEnvironmentsSection
        integrationId={INTEGRATION_ID}
        initialEnvironments={[base]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    // Both the edit form and the always-visible add-form below it have a "Config reference"
    // field — the edit form's is the first one in DOM order.
    const [configInput] = screen.getAllByLabelText("Config reference");
    expect(configInput).toHaveValue("old ref");

    // The user types an in-progress, unsaved edit.
    fireEvent.change(configInput!, { target: { value: "typing new ref" } });
    expect(configInput).toHaveValue("typing new ref");

    // An unrelated re-render (same environment, same updatedAt) must NOT wipe the in-progress edit.
    rerender(
      <IntegrationEnvironmentsSection
        integrationId={INTEGRATION_ID}
        initialEnvironments={[{ ...base }]}
      />,
    );
    expect(configInput).toHaveValue("typing new ref");

    // A genuine external update to this exact row (new updatedAt) DOES resync.
    rerender(
      <IntegrationEnvironmentsSection
        integrationId={INTEGRATION_ID}
        initialEnvironments={[
          { ...base, configReference: "new ref", updatedAt: "2026-09-01T01:00:00.000Z" },
        ]}
      />,
    );
    expect(configInput).toHaveValue("new ref");
  });
});
