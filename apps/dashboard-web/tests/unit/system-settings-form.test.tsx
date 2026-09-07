import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SystemSetting } from "@webdesk/shared-types";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { SystemSettingForm } from "../../components/system-settings-form.js";

const SETTING_ID = "11111111-1111-1111-1111-111111111111";

function successResponse(id: string): Response {
  return {
    ok: true,
    json: async () => ({ success: true, data: { id }, correlationId: "corr-1" }),
  } as Response;
}

function settingFixture(overrides: Partial<SystemSetting> = {}): SystemSetting {
  return {
    id: SETTING_ID,
    publicId: "SETTING-1",
    settingType: "file_limit",
    key: "max_upload_bytes",
    value: { maxBytes: 10485760 },
    description: null,
    isActive: true,
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-09-07T00:00:00.000Z",
    updatedAt: "2026-09-07T00:00:00.000Z",
    ...overrides,
  };
}

describe("SystemSettingForm", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    pushMock.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("create mode: publicId/settingType/key/value are real HTML required fields", () => {
    render(<SystemSettingForm mode="create" />);
    expect(screen.getByLabelText("Public ID")).toBeRequired();
    expect(screen.getByLabelText("Setting type")).toBeRequired();
    expect(screen.getByLabelText("Key")).toBeRequired();
    expect(screen.getByLabelText("Value (JSON)")).toBeRequired();
  });

  it("edit mode: value is not required, and shows the ', optional' suffix", () => {
    render(<SystemSettingForm mode="edit" settingId={SETTING_ID} initial={settingFixture()} />);
    expect(screen.getByLabelText("Value (JSON), optional")).not.toBeRequired();
  });

  it("renders plain textareas (never a rich-text editor) for value/description", () => {
    render(<SystemSettingForm mode="create" />);
    expect(document.querySelectorAll("textarea")).toHaveLength(2);
    expect(document.querySelectorAll('[contenteditable="true"]')).toHaveLength(0);
  });

  it("create mode: hides publicId/settingType as read-only in edit mode instead", () => {
    render(<SystemSettingForm mode="edit" settingId={SETTING_ID} initial={settingFixture()} />);
    expect(screen.queryByLabelText("Public ID")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Setting type")).not.toBeInTheDocument();
    expect(screen.getByText("SETTING-1")).toBeInTheDocument();
    expect(screen.getByText("File limit")).toBeInTheDocument();
  });

  it("create mode: submits publicId/settingType/key/parsed value, omitting untouched description entirely", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(SETTING_ID));
    global.fetch = fetchMock as typeof fetch;

    render(<SystemSettingForm mode="create" />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "SETTING-NEW" } });
    fireEvent.change(screen.getByLabelText("Setting type"), { target: { value: "git_rule" } });
    fireEvent.change(screen.getByLabelText("Key"), { target: { value: "branch_naming" } });
    fireEvent.change(screen.getByLabelText("Value (JSON)"), {
      target: { value: '{"pattern": "feature/*"}' },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create setting" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.com/system-settings/settings");
    const body = JSON.parse(init.body as string);
    expect(body.publicId).toBe("SETTING-NEW");
    expect(body.settingType).toBe("git_rule");
    expect(body.key).toBe("branch_naming");
    expect(body.value).toEqual({ pattern: "feature/*" });
    expect(body).not.toHaveProperty("description");
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith(`/system-settings/${SETTING_ID}`));
  });

  // `value` is a real HTML `required` field on create, so jsdom's own native constraint
  // validation blocks the submit event from ever firing while it's empty — the same jsdom
  // behavior this codebase's own PersonaLibraryForm/ServiceLibraryForm tests already document,
  // meaning the form's own defensive "Value is required." check (for a caller who somehow
  // bypasses HTML validation) can't be exercised via a simulated click. Covered instead by the
  // `toBeRequired()` assertion above, matching that same established precedent.

  it("rejects malformed JSON in the value field with a clear client-side error, never calling fetch", async () => {
    global.fetch = vi.fn() as typeof fetch;

    render(<SystemSettingForm mode="create" />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "SETTING-NEW" } });
    fireEvent.change(screen.getByLabelText("Setting type"), { target: { value: "git_rule" } });
    fireEvent.change(screen.getByLabelText("Key"), { target: { value: "branch_naming" } });
    fireEvent.change(screen.getByLabelText("Value (JSON)"), {
      target: { value: "{not valid json" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create setting" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Value must be valid JSON (an object).",
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("rejects a JSON array or primitive as the value, since only an object is accepted", async () => {
    global.fetch = vi.fn() as typeof fetch;

    render(<SystemSettingForm mode="create" />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "SETTING-NEW" } });
    fireEvent.change(screen.getByLabelText("Setting type"), { target: { value: "git_rule" } });
    fireEvent.change(screen.getByLabelText("Key"), { target: { value: "branch_naming" } });
    fireEvent.change(screen.getByLabelText("Value (JSON)"), {
      target: { value: "[1, 2, 3]" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create setting" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Value must be valid JSON (an object).",
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("edit mode: never sends publicId/settingType, and omits value when left unchanged", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(SETTING_ID));
    global.fetch = fetchMock as typeof fetch;

    render(
      <SystemSettingForm
        mode="edit"
        settingId={SETTING_ID}
        initial={settingFixture({ key: "max_upload_bytes" })}
      />,
    );
    fireEvent.change(screen.getByLabelText("Key"), { target: { value: "renamed_key" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.example.com/system-settings/settings/${SETTING_ID}/update`);
    const body = JSON.parse(init.body as string);
    expect(body.key).toBe("renamed_key");
    expect(body).not.toHaveProperty("publicId");
    expect(body).not.toHaveProperty("settingType");
    // The initial value round-trips through the textarea and back into the payload, unchanged —
    // this is NOT the "left blank" case (that's covered separately below).
    expect(body.value).toEqual({ maxBytes: 10485760 });
  });

  it("edit mode: clearing the value textarea entirely omits it from the payload (leaves it unchanged), rather than sending an empty object", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(SETTING_ID));
    global.fetch = fetchMock as typeof fetch;

    render(
      <SystemSettingForm
        mode="edit"
        settingId={SETTING_ID}
        initial={settingFixture({ description: "Was set" })}
      />,
    );
    fireEvent.change(screen.getByLabelText("Value (JSON), optional"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body).not.toHaveProperty("value");
  });

  it("edit mode: clearing a previously-set description sends an explicit null, not an empty string", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(SETTING_ID));
    global.fetch = fetchMock as typeof fetch;

    render(
      <SystemSettingForm
        mode="edit"
        settingId={SETTING_ID}
        initial={settingFixture({ description: "Was set" })}
      />,
    );
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.description).toBeNull();
  });

  it("shows the backend's error message on a rejected submit", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        error: {
          code: "BadRequestException",
          message: "key 'renamed_key' is already in use for this setting's settingType",
        },
        correlationId: "corr-1",
      }),
    } as Response) as typeof fetch;

    render(<SystemSettingForm mode="edit" settingId={SETTING_ID} initial={settingFixture()} />);
    fireEvent.change(screen.getByLabelText("Key"), { target: { value: "renamed_key" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/already in use/);
    expect(pushMock).not.toHaveBeenCalled();
  });
});
