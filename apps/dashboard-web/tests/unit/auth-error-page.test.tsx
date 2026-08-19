import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import AuthErrorPage from "../../app/auth/error/page.js";

describe("AuthErrorPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the generic message when no reason is given, and does not log", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const element = await AuthErrorPage({ searchParams: Promise.resolve({}) });
    render(element);

    expect(screen.getByText("Something went wrong while signing you in.")).toBeInTheDocument();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it.each([
    ["expired", "Your sign-in attempt expired. Please try again."],
    ["access_denied", "We couldn't sign you in with that Google account."],
    ["error", "Something went wrong while signing you in."],
  ])("shows the specific message for reason=%s", async (reason, expectedMessage) => {
    const element = await AuthErrorPage({ searchParams: Promise.resolve({ reason }) });
    render(element);

    expect(screen.getByText(expectedMessage)).toBeInTheDocument();
  });

  it("falls back to the generic message and logs an unrecognized reason value", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const element = await AuthErrorPage({
      searchParams: Promise.resolve({ reason: "totally-unknown" }),
    });
    render(element);

    expect(screen.getByText("Something went wrong while signing you in.")).toBeInTheDocument();
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy.mock.calls[0]?.[0]).toContain("totally-unknown");
  });

  it("does not treat an inherited Object.prototype key as a known reason", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const element = await AuthErrorPage({
      searchParams: Promise.resolve({ reason: "constructor" }),
    });
    render(element);

    expect(screen.getByText("Something went wrong while signing you in.")).toBeInTheDocument();
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
  });
});
