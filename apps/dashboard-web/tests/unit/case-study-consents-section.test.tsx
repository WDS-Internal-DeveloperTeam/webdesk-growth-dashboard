import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CaseStudyConsent } from "@webdesk/shared-types";

import { CaseStudyConsentsSection } from "../../components/case-study-consents-section.js";

const CASE_STUDY_ID = "11111111-1111-1111-1111-111111111111";

function consentFixture(id: string, overrides: Partial<CaseStudyConsent> = {}): CaseStudyConsent {
  return {
    id,
    caseStudyId: CASE_STUDY_ID,
    consentType: "client_publication",
    consentEvidenceReference: null,
    grantedBy: null,
    grantedAt: null,
    notes: null,
    createdAt: "2026-08-27T00:00:00.000Z",
    updatedAt: "2026-08-27T00:00:00.000Z",
    ...overrides,
  };
}

describe("CaseStudyConsentsSection", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("renders 'No consent records yet.' when empty", () => {
    render(<CaseStudyConsentsSection caseStudyId={CASE_STUDY_ID} initialConsents={[]} />);
    expect(screen.getByText("No consent records yet.")).toBeInTheDocument();
  });

  it("adds a consent record — posts consentType/consentEvidenceReference/grantedBy/notes", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: consentFixture("consent-1", {
          consentType: "testimonial",
          grantedBy: "Jane Doe",
        }),
        correlationId: "corr-1",
      }),
    } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<CaseStudyConsentsSection caseStudyId={CASE_STUDY_ID} initialConsents={[]} />);
    fireEvent.change(screen.getByLabelText("Consent type"), { target: { value: "testimonial" } });
    fireEvent.change(screen.getByLabelText("Granted by"), { target: { value: "Jane Doe" } });
    fireEvent.click(screen.getByRole("button", { name: "Add consent record" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `https://api.example.com/case-study-studio/case-studies/${CASE_STUDY_ID}/consents`,
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          body: JSON.stringify({
            consentType: "testimonial",
            consentEvidenceReference: null,
            grantedBy: "Jane Doe",
            grantedAt: null,
            notes: null,
          }),
        }),
      ),
    );
    expect(await screen.findByText(/granted by Jane Doe/)).toBeInTheDocument();
  });

  it("renders a javascript: consentEvidenceReference as inert text, not a clickable link", () => {
    render(
      <CaseStudyConsentsSection
        caseStudyId={CASE_STUDY_ID}
        initialConsents={[
          consentFixture("consent-1", { consentEvidenceReference: "javascript:alert(1)" }),
        ]}
      />,
    );
    expect(screen.getByText("javascript:alert(1)")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders a real https:// consentEvidenceReference as a clickable link", () => {
    render(
      <CaseStudyConsentsSection
        caseStudyId={CASE_STUDY_ID}
        initialConsents={[
          consentFixture("consent-1", {
            consentEvidenceReference: "https://example.com/signed-release.pdf",
          }),
        ]}
      />,
    );
    expect(
      screen.getByRole("link", { name: "https://example.com/signed-release.pdf" }),
    ).toHaveAttribute("href", "https://example.com/signed-release.pdf");
  });

  it("deletes a consent record — posts to the .../:id/delete route and removes the row", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 } as Response);
    global.fetch = fetchMock as typeof fetch;

    render(
      <CaseStudyConsentsSection
        caseStudyId={CASE_STUDY_ID}
        initialConsents={[consentFixture("consent-1", { grantedBy: "Jane Doe" })]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `https://api.example.com/case-study-studio/case-studies/${CASE_STUDY_ID}/consents/consent-1/delete`,
        expect.objectContaining({ method: "POST", credentials: "include" }),
      ),
    );
    await waitFor(() => expect(screen.queryByText(/Jane Doe/)).not.toBeInTheDocument());
  });

  it("editing: Save posts the updated fields to the .../:id/update route", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: consentFixture("consent-1", { grantedBy: "New Name" }),
        correlationId: "corr-1",
      }),
    } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <CaseStudyConsentsSection
        caseStudyId={CASE_STUDY_ID}
        initialConsents={[consentFixture("consent-1", { grantedBy: "Old Name" })]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const grantedByInputs = screen.getAllByLabelText("Granted by");
    fireEvent.change(grantedByInputs[0]!, { target: { value: "New Name" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `https://api.example.com/case-study-studio/case-studies/${CASE_STUDY_ID}/consents/consent-1/update`,
        expect.objectContaining({ method: "POST", credentials: "include" }),
      ),
    );
    expect(await screen.findByText(/granted by New Name/)).toBeInTheDocument();
  });

  it("shows the backend's error message on a failed add", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        error: { code: "BadRequestException", message: "Invalid consent record" },
        correlationId: "corr-1",
      }),
    } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<CaseStudyConsentsSection caseStudyId={CASE_STUDY_ID} initialConsents={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Add consent record" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid consent record");
  });
});
