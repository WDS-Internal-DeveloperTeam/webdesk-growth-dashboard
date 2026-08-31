import Link from "next/link";
import { notFound } from "next/navigation";
import type { DesignTokenRecord } from "@webdesk/shared-types";
import { ContentContainer, Fact, PageHeader, StatusBadge } from "@webdesk/ui";
import { DesignTokenStatusActions } from "@/components/design-token-status-actions";
import { primaryActionLinkStyle } from "@/lib/action-link-style";
import {
  designTokenApprovalStatusBadge,
  formatTimestamp,
  getDesignToken,
  getDesignTokenVersions,
  GROUP_LABEL,
} from "@/lib/design-token-library";
import {
  dlStyle,
  h2Style,
  h3Style,
  mutedStyle,
  richContentStyle,
  sectionStyle,
  subsectionStyle,
} from "@/lib/detail-section-styles";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface DesignTokenLibraryDetailPageProps {
  readonly params: Promise<{ recordId: string }>;
}

const THEME_VARIATION_LABEL: Readonly<Record<string, string>> = {
  light: "Light",
  dark: "Dark",
  both: "Both",
};

/**
 * No approved wireframe exists for this module — sections mirror the backend's own field grouping
 * (Identity, Value, Context, Status, Version history), rendered as sections rather than
 * client-side tabs, the same simplification the Project/Business Knowledge Center/Service
 * Library/Persona Library/Website Strategy Center detail pages already establish.
 *
 * "Version history" mirrors `WebsiteStrategyCenterDetailPage`'s own genuinely novel requirement —
 * every version from `GET .../:recordId/versions` (oldest first, reversed here for newest-first
 * display) is listed with its own version number/status/name/updated timestamp, and its own
 * value/unit/semantic purpose/responsive variation are viewable via a native
 * `<details>`/`<summary>` disclosure — zero client JS, fully server-rendered. Opening two
 * disclosures side by side is this module's answer to the canonical spec's own named "compare
 * versions" action, without inventing a real diffing UI no sibling module has ever built. The
 * CURRENT version's own content still renders in the normal sections above, exactly as every
 * sibling detail page renders its own primary content — the version-history list additionally
 * repeats it (as the "(current)"-labeled entry) so every version, including the current one, is
 * browsable through the identical mechanism (the same accepted, tracked debt
 * `WebsiteStrategyCenterDetailPage`'s own doc comment already documents once for the resulting
 * double-render of the current version).
 *
 * `semanticPurpose`/`responsiveVariation` render as plain text (`whiteSpace: pre-wrap`), NOT
 * through `SanitizedRichText` — the backend stores both fields unsanitized as plain text, matching
 * `DesignTokenLibraryForm`'s own identical reasoning for keeping them plain `<textarea>`s. No
 * `SanitizedRichText` import exists anywhere in this file.
 */
export default async function DesignTokenLibraryDetailPage({
  params,
}: DesignTokenLibraryDetailPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const { recordId } = await params;
  const [token, versions] = await Promise.all([
    getDesignToken(recordId),
    getDesignTokenVersions(recordId),
  ]);
  if (!token) {
    notFound();
  }

  const approvalBadge = designTokenApprovalStatusBadge(token.approvalStatus);
  // Newest first for display — the backend returns oldest first (its own natural insertion order).
  const versionsNewestFirst = [...versions].sort((a, b) => b.versionNumber - a.versionNumber);

  return (
    <ContentContainer>
      <PageHeader
        title={token.name}
        breadcrumbs={[
          { label: "Design Token Library", href: "/design-token-library" },
          { label: token.name },
        ]}
        linkComponent={Link}
        statusBadge={<StatusBadge status={approvalBadge.token} label={approvalBadge.label} />}
        contextActions={
          <>
            <DesignTokenStatusActions
              recordId={token.recordId}
              approvalStatus={token.approvalStatus}
            />
            {/* archived/superseded are terminal — the backend rejects any edit of one outright
                (design-tokens.service.ts's own update() guard), so the link is hidden rather than
                left clickable only to 400 on submit, matching DesignTokenStatusActions's own
                self-hiding behavior for these same two statuses. */}
            {token.approvalStatus !== "archived" && token.approvalStatus !== "superseded" ? (
              <Link
                href={`/design-token-library/${token.recordId}/edit`}
                style={primaryActionLinkStyle}
              >
                Edit
              </Link>
            ) : null}
          </>
        }
      />

      <section style={sectionStyle}>
        <h2 style={h2Style}>Identity</h2>
        <dl style={dlStyle}>
          <Fact label="Public ID">{token.publicId}</Fact>
          <Fact label="Group">{GROUP_LABEL[token.group]}</Fact>
          <Fact label="Version">v{token.versionNumber}</Fact>
          <Fact label="Created">{formatTimestamp(token.createdAt)}</Fact>
          <Fact label="Updated">{formatTimestamp(token.updatedAt)}</Fact>
        </dl>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Value</h2>
        <dl style={dlStyle}>
          <Fact label="Value">{token.value}</Fact>
          <Fact label="Unit">{token.unit ?? "Not set"}</Fact>
          <Fact label="Theme variation">
            {token.themeVariation ? THEME_VARIATION_LABEL[token.themeVariation] : "Not set"}
          </Fact>
        </dl>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Context</h2>
        <PlainTextBlock label="Semantic purpose" value={token.semanticPurpose} />
        <PlainTextBlock label="Responsive variation" value={token.responsiveVariation} />
        <div style={subsectionStyle}>
          <h3 style={h3Style}>Usage references</h3>
          {token.usageReferences.length > 0 ? (
            <p style={richContentStyle}>{token.usageReferences.join(", ")}</p>
          ) : (
            <p style={mutedStyle}>Not set.</p>
          )}
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Status</h2>
        <dl style={dlStyle}>
          <Fact label="Approval status">
            <StatusBadge status={approvalBadge.token} label={approvalBadge.label} />
          </Fact>
        </dl>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Version history</h2>
        {versionsNewestFirst.length === 0 ? (
          <p style={mutedStyle}>No version history available.</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {versionsNewestFirst.map((version) => (
              <VersionEntry key={version.id} version={version} />
            ))}
          </ul>
        )}
      </section>
    </ContentContainer>
  );
}

function PlainTextBlock({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string | null;
}) {
  return (
    <div style={subsectionStyle}>
      <h3 style={h3Style}>{label}</h3>
      {value ? (
        <p style={{ ...richContentStyle, whiteSpace: "pre-wrap" }}>{value}</p>
      ) : (
        <p style={mutedStyle}>Not set.</p>
      )}
    </div>
  );
}

function VersionEntry({ version }: { readonly version: DesignTokenRecord }) {
  const badge = designTokenApprovalStatusBadge(version.approvalStatus);
  // Uses the version row's own isCurrent field (populated by the same GET .../:recordId/versions
  // response every entry here already comes from) rather than comparing this row's id against a
  // SEPARATE, independently-timed getDesignToken() fetch — the two requests aren't
  // transactionally consistent, so a concurrent edit/status transition forking a new version
  // between them could otherwise mislabel which entry is current, the exact code-review fix
  // WebsiteStrategyCenterDetailPage's own VersionEntry already established.
  const isCurrent = version.isCurrent;

  return (
    <li
      style={{
        border: "1px solid var(--webdesk-dashboard-color-border)",
        borderRadius: "0.5rem",
        padding: "0.75rem 1rem",
        marginBottom: "0.75rem",
      }}
    >
      <details>
        <summary
          style={{
            cursor: "pointer",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "0.75rem",
            fontSize: "0.875rem",
          }}
        >
          <span style={{ fontWeight: 600 }}>
            Version {version.versionNumber}
            {isCurrent ? " (current)" : ""}
          </span>
          <StatusBadge status={badge.token} label={badge.label} />
          <span style={mutedStyle}>{version.name}</span>
          <span style={mutedStyle}>Updated {formatTimestamp(version.updatedAt)}</span>
        </summary>
        <div style={{ marginTop: "0.75rem" }}>
          <dl style={dlStyle}>
            <Fact label="Value">{version.value}</Fact>
            <Fact label="Unit">{version.unit ?? "Not set"}</Fact>
            <Fact label="Theme variation">
              {version.themeVariation ? THEME_VARIATION_LABEL[version.themeVariation] : "Not set"}
            </Fact>
          </dl>
          <PlainTextBlock label="Semantic purpose" value={version.semanticPurpose} />
          <PlainTextBlock label="Responsive variation" value={version.responsiveVariation} />
        </div>
      </details>
    </li>
  );
}
