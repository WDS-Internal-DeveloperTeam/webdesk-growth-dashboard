import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EntityRecord, KeywordEntityRelationship } from "@webdesk/shared-types";

import { KeywordEntityRelationshipsSection } from "../../components/keyword-entity-relationships-section.js";

const PROJECT_ID = "99999999-9999-9999-9999-999999999999";
const KEYWORD_ID = "11111111-1111-1111-1111-111111111111";
const ENTITY_ID = "22222222-2222-2222-2222-222222222222";
const BASE_PATH = `https://api.example.com/keyword-and-entity-library/projects/${PROJECT_ID}/keywords/${KEYWORD_ID}/entity-relationships`;

function entityFixture(id: string, overrides: Partial<EntityRecord> = {}): EntityRecord {
  return {
    id,
    projectId: PROJECT_ID,
    publicId: `ENT-${id}`,
    name: "Acme Corp",
    entityType: "Organization",
    description: null,
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-08-24T00:00:00.000Z",
    updatedAt: "2026-08-24T00:00:00.000Z",
    ...overrides,
  };
}

function relationshipFixture(
  id: string,
  overrides: Partial<KeywordEntityRelationship> = {},
): KeywordEntityRelationship {
  return {
    id,
    keywordId: KEYWORD_ID,
    entityId: ENTITY_ID,
    createdBy: null,
    createdAt: "2026-08-24T00:00:00.000Z",
    ...overrides,
  };
}

describe("KeywordEntityRelationshipsSection", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("renders 'No entities linked yet.' when empty", () => {
    render(
      <KeywordEntityRelationshipsSection
        projectId={PROJECT_ID}
        keywordId={KEYWORD_ID}
        initialRelationships={[]}
        entities={[]}
      />,
    );
    expect(screen.getByText("No entities linked yet.")).toBeInTheDocument();
  });

  it("resolves a linked entity's name from the entities pool, and shows its type", () => {
    render(
      <KeywordEntityRelationshipsSection
        projectId={PROJECT_ID}
        keywordId={KEYWORD_ID}
        initialRelationships={[relationshipFixture("rel-1")]}
        entities={[entityFixture(ENTITY_ID, { name: "Acme Corp", entityType: "Organization" })]}
      />,
    );
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText(/Organization/)).toBeInTheDocument();
  });

  it("falls back to the raw entityId when a linked entity is outside the picker's fetch window", () => {
    render(
      <KeywordEntityRelationshipsSection
        projectId={PROJECT_ID}
        keywordId={KEYWORD_ID}
        initialRelationships={[relationshipFixture("rel-1", { entityId: "outside-window" })]}
        entities={[]}
      />,
    );
    expect(screen.getByText("outside-window")).toBeInTheDocument();
  });

  it("links an entity — picking a search result posts entityId to the sub-resource route and adds the row", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: relationshipFixture("rel-new"),
        correlationId: "corr-1",
      }),
    } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <KeywordEntityRelationshipsSection
        projectId={PROJECT_ID}
        keywordId={KEYWORD_ID}
        initialRelationships={[]}
        entities={[entityFixture(ENTITY_ID, { name: "Acme Corp" })]}
      />,
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Link an entity" }), {
      target: { value: "Acme" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Acme Corp" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        BASE_PATH,
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          body: JSON.stringify({ entityId: ENTITY_ID }),
        }),
      ),
    );
    expect(await screen.findByText("Acme Corp")).toBeInTheDocument();
  });

  it("removes a link — posts to .../:id/delete (not the DELETE method) and removes the row", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 } as Response);
    global.fetch = fetchMock as typeof fetch;

    render(
      <KeywordEntityRelationshipsSection
        projectId={PROJECT_ID}
        keywordId={KEYWORD_ID}
        initialRelationships={[relationshipFixture("rel-1")]}
        entities={[entityFixture(ENTITY_ID, { name: "Acme Corp" })]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(`${BASE_PATH}/rel-1/delete`, {
        method: "POST",
        credentials: "include",
      }),
    );
    // Not `queryByText("Acme Corp")` — once removed, the same entity legitimately reappears as a
    // selectable option in the picker's own dropdown, so that text alone is ambiguous. The row
    // itself (and its "Remove" button) going away, replaced by the empty state, is the real signal.
    await waitFor(() => expect(screen.getByText("No entities linked yet.")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
  });

  it("shows the backend's error message when linking fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        success: false,
        error: { code: "BadRequestException", message: "entityId not found: gone" },
        correlationId: "corr-1",
      }),
    } as Response) as typeof fetch;

    render(
      <KeywordEntityRelationshipsSection
        projectId={PROJECT_ID}
        keywordId={KEYWORD_ID}
        initialRelationships={[]}
        entities={[entityFixture(ENTITY_ID, { name: "Acme Corp" })]}
      />,
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Link an entity" }), {
      target: { value: "Acme" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Acme Corp" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("entityId not found: gone");
  });

  it("excludes an already-linked entity from the picker's own search results", () => {
    render(
      <KeywordEntityRelationshipsSection
        projectId={PROJECT_ID}
        keywordId={KEYWORD_ID}
        initialRelationships={[relationshipFixture("rel-1", { entityId: ENTITY_ID })]}
        entities={[
          entityFixture(ENTITY_ID, { name: "Acme Corp" }),
          entityFixture("other-id", { name: "Beta Inc" }),
        ]}
      />,
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Link an entity" }), {
      target: { value: "" },
    });
    expect(screen.queryByRole("button", { name: "Acme Corp" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Beta Inc" })).toBeInTheDocument();
  });
});
