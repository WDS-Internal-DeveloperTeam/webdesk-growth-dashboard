import Link from "next/link";
import type { Persona } from "@webdesk/shared-types";
import { ContentContainer, EmptyState, PageHeader, StatusBadge } from "@webdesk/ui";
import { PageSizeSelect } from "@/components/page-size-select";
import { primaryActionLinkStyle } from "@/lib/action-link-style";
import { listTableCellStyle, listTableHeaderCellStyle } from "@/lib/list-table-styles";
import { buildHrefBySize } from "@/lib/pagination";
import { getServerSession } from "@/lib/server-session";
import {
  buildPersonaLibraryHref,
  formatTimestamp,
  getPersonas,
  parsePersonaLibrarySearchParams,
  personaApprovalStatusBadge,
} from "@/lib/persona-library";
import { APPROVAL_STATUS_LABEL, APPROVAL_STATUS_VALUES } from "@/lib/persona-library-query";

export const dynamic = "force-dynamic";

interface PersonaLibraryListPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * No approved wireframe/screen spec exists for this module (`03_Detailed_Module_Specifications.md
 * §21` is a flat field list, no screen description) — renders exactly what
 * `GET /persona-library/personas` returns and supports (an `approvalStatus` filter, `search`, and
 * offset pagination, no sort), matching the Projects/Business Knowledge Center list pages' own
 * "smallest honest reading" precedent for an unsourced screen.
 */
export default async function PersonaLibraryListPage({
  searchParams,
}: PersonaLibraryListPageProps) {
  // The (shell) layout already redirects unauthenticated callers to sign-in before this page
  // renders — this defensive fallback avoids firing the list fetch in parallel with a redirect
  // that would just discard the result, matching every other page in this app.
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const query = parsePersonaLibrarySearchParams(await searchParams);
  const { items: personas, hasNextPage } = await getPersonas(query);
  const hasFilters = query.approvalStatus !== null;
  const isPastLastPage = personas.length === 0 && query.offset > 0;

  return (
    <ContentContainer>
      <PageHeader
        title="Persona Library"
        contextActions={
          <Link href="/persona-library/new" style={primaryActionLinkStyle}>
            New persona
          </Link>
        }
      />

      <form
        method="get"
        style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1.5rem" }}
      >
        {/* Preserves the reader's page-size choice across a filter submit — without it, a native
            GET form submission builds its target URL purely from this form's own named fields,
            silently dropping any existing `?pageSize=` and resetting it back to the default. */}
        <input type="hidden" name="pageSize" value={query.pageSize} />
        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <span
            style={{
              fontSize: "0.75rem",
              color: "var(--webdesk-dashboard-color-foreground-muted)",
            }}
          >
            Approval status
          </span>
          {/* `key` forces a remount whenever the underlying filter value changes, including back
              to "" on Clear filters — a Next.js <Link> soft-navigation otherwise re-renders this
              same DOM node in place, and an uncontrolled <select>'s defaultValue only takes effect
              on first mount (see business-knowledge-center/page.tsx's own identical note). */}
          <select
            key={query.approvalStatus ?? "all-approval-statuses"}
            name="approvalStatus"
            defaultValue={query.approvalStatus ?? ""}
            style={selectStyle}
          >
            <option value="">All approval statuses</option>
            {APPROVAL_STATUS_VALUES.map((value) => (
              <option key={value} value={value}>
                {APPROVAL_STATUS_LABEL[value]}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <span
            style={{
              fontSize: "0.75rem",
              color: "var(--webdesk-dashboard-color-foreground-muted)",
            }}
          >
            Search
          </span>
          <input
            key={query.search ?? "no-search"}
            type="text"
            name="search"
            defaultValue={query.search ?? ""}
            maxLength={255}
            style={selectStyle}
          />
        </label>
        <button type="submit" style={submitButtonStyle}>
          Apply
        </button>
        {hasFilters || query.search ? (
          <Link
            href="/persona-library"
            style={{ alignSelf: "flex-end", fontSize: "0.875rem", padding: "0.4rem 0" }}
          >
            Clear filters
          </Link>
        ) : null}
      </form>

      {personas.length === 0 ? (
        <EmptyState
          title={
            isPastLastPage
              ? "No more personas"
              : hasFilters || query.search
                ? "No personas match your filters"
                : "No personas yet"
          }
          description={
            isPastLastPage
              ? "You've gone past the last page of results."
              : hasFilters || query.search
                ? "Try a different status or search term."
                : "Personas created for this organization will appear here."
          }
          action={
            isPastLastPage ? (
              <Link
                href={buildPersonaLibraryHref(query, {
                  offset: Math.max(0, query.offset - query.pageSize),
                })}
                style={{ fontSize: "0.875rem" }}
              >
                Previous
              </Link>
            ) : hasFilters || query.search ? (
              <Link href="/persona-library" style={{ fontSize: "0.875rem" }}>
                Clear filters
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
              <thead>
                <tr>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Buyer type</th>
                  <th style={thStyle}>Approval</th>
                  <th style={thStyle}>Updated</th>
                </tr>
              </thead>
              <tbody>
                {personas.map((persona) => (
                  <PersonaRow key={persona.id} persona={persona} />
                ))}
              </tbody>
            </table>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: "1rem",
              fontSize: "0.875rem",
            }}
          >
            <span style={{ color: "var(--webdesk-dashboard-color-foreground-muted)" }}>
              Showing {query.offset + 1}–{query.offset + personas.length}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
              <PageSizeSelect
                value={query.pageSize}
                hrefBySize={buildHrefBySize((pageSize) =>
                  buildPersonaLibraryHref(query, { pageSize }),
                )}
              />
              <div style={{ display: "flex", gap: "0.75rem" }}>
                {query.offset > 0 ? (
                  <Link
                    href={buildPersonaLibraryHref(query, {
                      offset: Math.max(0, query.offset - query.pageSize),
                    })}
                  >
                    Previous
                  </Link>
                ) : null}
                {hasNextPage ? (
                  <Link
                    href={buildPersonaLibraryHref(query, { offset: query.offset + query.pageSize })}
                  >
                    Next
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        </>
      )}
    </ContentContainer>
  );
}

const selectStyle: React.CSSProperties = {
  padding: "0.4rem 0.6rem",
  border: "1px solid var(--webdesk-dashboard-color-border)",
  borderRadius: "0.25rem",
  fontSize: "0.875rem",
  minWidth: "12rem",
};

const submitButtonStyle: React.CSSProperties = {
  alignSelf: "flex-end",
  padding: "0.4rem 0.9rem",
  border: "1px solid var(--webdesk-dashboard-color-border)",
  borderRadius: "0.25rem",
  background: "var(--webdesk-dashboard-color-surface)",
  fontSize: "0.875rem",
  cursor: "pointer",
};

const thStyle = listTableHeaderCellStyle;

const tdStyle = listTableCellStyle;

function PersonaRow({ persona }: { readonly persona: Persona }) {
  const approvalBadge = personaApprovalStatusBadge(persona.approvalStatus);
  return (
    <tr>
      <td style={tdStyle}>
        <Link href={`/persona-library/${persona.id}`}>{persona.name}</Link>
      </td>
      <td style={{ ...tdStyle, color: "var(--webdesk-dashboard-color-foreground-muted)" }}>
        {persona.buyerType ?? "—"}
      </td>
      <td style={tdStyle}>
        <StatusBadge status={approvalBadge.token} label={approvalBadge.label} />
      </td>
      <td style={{ ...tdStyle, color: "var(--webdesk-dashboard-color-foreground-muted)" }}>
        {formatTimestamp(persona.updatedAt)}
      </td>
    </tr>
  );
}
