import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Integration } from "@webdesk/shared-types";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { IntegrationForm } from "../../components/integration-form.js";

const INTEGRATION_ID = "11111111-1111-1111-1111-111111111111";

function successResponse(id: string): Response {
  return {
    ok: true,
    json: async () => ({ success: true, data: { id }, correlationId: "corr-1" }),
  } as Response;
}

function integrationFixture(overrides: Partial<Integration> = {}): Integration {
  return {
    id: INTEGRATION_ID,
    publicId: "INTEG-1",
    provider: "github",
    displayName: "Primary GitHub App",
    status: "connected",
    configReference: null,
    notes: null,
    lastVerifiedAt: null,
    lastVerifiedByUserId: null,
    lastVerificationResult: null,
    lastVerificationNotes: null,
    isActive: true,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("IntegrationForm", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    pushMock.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("create mode: publicId/provider/displayName are real HTML required fields", () => {
    render(<IntegrationForm mode="create" />);
    expect(screen.getByLabelText("Public ID")).toBeRequired();
    expect(screen.getByLabelText("Provider")).toBeRequired();
    expect(screen.getByLabelText("Display name")).toBeRequired();
  });

  it("renders plain textareas/inputs for configReference/notes, never a rich-text editor", () => {
    render(<IntegrationForm mode="create" />);
    expect(document.querySelectorAll('[contenteditable="true"]')).toHaveLength(0);
    expect(document.querySelectorAll("textarea")).toHaveLength(1);
  });

  it("create mode: submits publicId/provider/displayName, omitting untouched configReference/notes entirely", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(INTEGRATION_ID));
    global.fetch = fetchMock as typeof fetch;

    render(<IntegrationForm mode="create" />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "INTEG-NEW" } });
    fireEvent.change(screen.getByLabelText("Provider"), { target: { value: "wordpress" } });
    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "Staging WordPress" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create integration" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.com/integrations");
    const body = JSON.parse(init.body as string);
    expect(body.publicId).toBe("INTEG-NEW");
    expect(body.provider).toBe("wordpress");
    expect(body.displayName).toBe("Staging WordPress");
    expect(body).not.toHaveProperty("configReference");
    expect(body).not.toHaveProperty("notes");
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith(`/integrations/${INTEGRATION_ID}`));
  });

  it("edit mode: never sends status/isActive/lastVerified*/publicId/provider", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(INTEGRATION_ID));
    global.fetch = fetchMock as typeof fetch;

    render(
      <IntegrationForm
        mode="edit"
        integrationId={INTEGRATION_ID}
        initial={integrationFixture({ displayName: "Was set" })}
      />,
    );
    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "Renamed" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.example.com/integrations/${INTEGRATION_ID}/update`);
    const body = JSON.parse(init.body as string);
    expect(body.displayName).toBe("Renamed");
    expect(body).not.toHaveProperty("status");
    expect(body).not.toHaveProperty("isActive");
    expect(body).not.toHaveProperty("lastVerifiedAt");
    expect(body).not.toHaveProperty("lastVerificationResult");
    expect(body).not.toHaveProperty("lastVerificationNotes");
    expect(body).not.toHaveProperty("publicId");
    expect(body).not.toHaveProperty("provider");
  });

  it("edit mode: clearing a previously-set config reference sends an explicit null, not an empty string", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(INTEGRATION_ID));
    global.fetch = fetchMock as typeof fetch;

    render(
      <IntegrationForm
        mode="edit"
        integrationId={INTEGRATION_ID}
        initial={integrationFixture({ configReference: "Vercel env: X" })}
      />,
    );
    fireEvent.change(screen.getByLabelText("Config reference"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.configReference).toBeNull();
  });

  it("shows the backend's error message and does not navigate on a failed submit", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        success: false,
        error: { code: "BadRequestException", message: "publicId already in use: INTEG-NEW" },
        correlationId: "corr-1",
      }),
    } as Response) as typeof fetch;

    render(<IntegrationForm mode="create" />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "INTEG-NEW" } });
    fireEvent.change(screen.getByLabelText("Provider"), { target: { value: "github" } });
    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "X" } });
    fireEvent.click(screen.getByRole("button", { name: "Create integration" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "publicId already in use: INTEG-NEW",
    );
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("edit mode: publicId and provider are both shown read-only, not as editable fields", () => {
    render(
      <IntegrationForm
        mode="edit"
        integrationId={INTEGRATION_ID}
        initial={integrationFixture({ publicId: "INTEG-READONLY", provider: "sentry" })}
      />,
    );
    expect(screen.queryByLabelText("Public ID")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Provider")).not.toBeInTheDocument();
    expect(screen.getByText("INTEG-READONLY")).toBeInTheDocument();
    expect(screen.getByText("Sentry")).toBeInTheDocument();
  });
});
