import Link from "next/link";
import { notFound } from "next/navigation";
import type { ComponentRecord } from "@webdesk/shared-types";
import { ContentContainer, Fact, PageHeader, StatusBadge } from "@webdesk/ui";
import { ComponentStatusActions } from "@/components/component-status-actions";
import { primaryActionLinkStyle } from "@/lib/action-link-style";
import {
  componentApprovalStatusBadge,
  formatTimestamp,
  getComponent,
  getComponentsForReplacementPicker,
  getComponentVersions,
  getDesignTokensForComponentPicker,
} from "@/lib/component-library";
import {
  dlStyle,
  h2Style,
  h3Style,
  mutedStyle,
  richContentStyle,
  sectionStyle,
  subsectionStyle,
  versionCardStyle,
} from "@/lib/detail-section-styles";
import { isSafeHttpUrl } from "@/lib/safe-http-url";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface ComponentLibraryDetailPageProps {
  readonly params: Promise<{ recordId: string }>;
}

/**
 * No approved wireframe exists for this module — sections mirror the backend's own field grouping
 * (Identity, Design, Implementation, Behavior, Metadata, Relationships, Status, Version history),
 * rendered as sections rather than client-side tabs, the same simplification the Project/Business
 * Knowledge Center/Service Library/Persona Library/Website Strategy Center/Design Token Library
 * detail pages already establish.
 *
 * "Version history" mirrors `DesignTokenLibraryDetailPage`'s own genuinely novel requirement —
 * every version from `GET .../:recordId/versions` (oldest first, reversed here for newest-first
 * display) is listed with its own version number/status/name/updated timestamp, and its own
 * category/name/tokens/implementation fields are viewable via a native `<details>`/`<summary>`
 * disclosure — zero client JS, fully server-rendered. Opening two disclosures side by side is this
 * module's answer to the canonical spec's own named "compare versions" action, without inventing a
 * real diffing UI no sibling module has ever built. The CURRENT version's own content still renders
 * in the normal sections above, exactly as every sibling detail page renders its own primary
 * content — the version-history list additionally repeats it (as the "(current)"-labeled entry) so
 * every version, including the current one, is browsable through the identical mechanism (the same
 * accepted, tracked debt `DesignTokenLibraryDetailPage`'s/`WebsiteStrategyCenterDetailPage`'s own
 * doc comment already documents once for the resulting double-render of the current version).
 *
 * Every long-text field renders as plain text (`whiteSpace: pre-wrap`), NOT through
 * `SanitizedRichText` — the backend stores every one of these fields unsanitized as plain text,
 * matching `ComponentLibraryForm`'s own identical reasoning for keeping them plain `<textarea>`s.
 * No `SanitizedRichText` import exists anywhere in this file.
 *
 * `tokenIds`/`replacementRecordId` are resolved to real display names by cross-referencing the same
 * picker-population fetches the create/edit form uses (each capped at the same 100-row bound — an
 * id outside that window falls back to showing the raw id itself, still real and honest, just
 * unresolved, matching the accepted over-fetch/pagination-bound debt `PersonaLibraryDetailPage`'s
 * own `relatedServiceIds` resolution already carries).
 */
export default async function ComponentLibraryDetailPage({
  params,
}: ComponentLibraryDetailPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const { recordId } = await params;
  const [component, versions, designTokens, components] = await Promise.all([
    getComponent(recordId),
    getComponentVersions(recordId),
    getDesignTokensForComponentPicker(),
    getComponentsForReplacementPicker(),
  ]);
  if (!component) {
    notFound();
  }

  const approvalBadge = componentApprovalStatusBadge(component.approvalStatus);
  // Newest first for display — the backend returns oldest first (its own natural insertion order).
  const versionsNewestFirst = [...versions].sort((a, b) => b.versionNumber - a.versionNumber);

  const tokenNameById = new Map(designTokens.map((token) => [token.recordId, token.name]));
  const componentNameById = new Map(components.map((c) => [c.recordId, c.name]));
  const tokenNames = component.tokenIds.map((id) => tokenNameById.get(id) ?? id);
  const replacementName = component.replacementRecordId
    ? (componentNameById.get(component.replacementRecordId) ?? component.replacementRecordId)
    : null;

  const hasSafeFigmaReference =
    component.figmaReference !== null && isSafeHttpUrl(component.figmaReference);

  return (
    <ContentContainer>
      <PageHeader
        title={component.name}
        breadcrumbs={[
          { label: "Component Library", href: "/component-library" },
          { label: component.name },
        ]}
        linkComponent={Link}
        statusBadge={<StatusBadge status={approvalBadge.token} label={approvalBadge.label} />}
        contextActions={
          <>
            <ComponentStatusActions
              recordId={component.recordId}
              approvalStatus={component.approvalStatus}
            />
            {/* archived/superseded are terminal — the backend rejects any edit of one outright
                (components.service.ts's own update() guard), so the link is hidden rather than
                left clickable only to 400 on submit, matching ComponentStatusActions's own
                self-hiding behavior for these same two statuses. */}
            {component.approvalStatus !== "archived" &&
            component.approvalStatus !== "superseded" ? (
              <Link
                href={`/component-library/${component.recordId}/edit`}
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
          <Fact label="Public ID">{component.publicId}</Fact>
          <Fact label="Category">{component.category}</Fact>
          <Fact label="Version">v{component.versionNumber}</Fact>
          <Fact label="Created">{formatTimestamp(component.createdAt)}</Fact>
          <Fact label="Updated">{formatTimestamp(component.updatedAt)}</Fact>
        </dl>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Design</h2>
        <div style={subsectionStyle}>
          <h3 style={h3Style}>Figma reference</h3>
          {component.figmaReference ? (
            hasSafeFigmaReference ? (
              <a href={component.figmaReference} target="_blank" rel="noopener noreferrer">
                {component.figmaReference}
              </a>
            ) : (
              <p style={mutedStyle}>{component.figmaReference}</p>
            )
          ) : (
            <p style={mutedStyle}>Not set.</p>
          )}
        </div>
        <dl style={dlStyle}>
          <Fact label="Design tokens">
            {tokenNames.length > 0 ? tokenNames.join(", ") : "None"}
          </Fact>
        </dl>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Implementation</h2>
        <PlainTextBlock label="HTML structure" value={component.htmlStructure} />
        <PlainTextBlock label="PHP path" value={component.phpPath} />
        <PlainTextBlock label="SCSS classes / path" value={component.scssClassesPath} />
        <PlainTextBlock label="JS dependencies" value={component.jsDependencies} />
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Behavior</h2>
        <PlainTextBlock label="States" value={component.states} />
        <PlainTextBlock label="Responsive behavior" value={component.responsiveBehavior} />
        <PlainTextBlock label="Browser support" value={component.browserSupport} />
        <PlainTextBlock label="Accessibility" value={component.accessibility} />
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Metadata</h2>
        <PlainTextBlock label="Schema" value={component.schema} />
        <PlainTextBlock label="Analytics" value={component.analytics} />
        <PlainTextBlock label="Tests" value={component.tests} />
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Relationships</h2>
        <dl style={dlStyle}>
          <Fact label="Replacement component">
            {replacementName ? (
              <Link href={`/component-library/${component.replacementRecordId}`}>
                {replacementName}
              </Link>
            ) : (
              "None"
            )}
          </Fact>
        </dl>
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
              <VersionEntry key={version.id} version={version} tokenNameById={tokenNameById} />
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

function VersionEntry({
  version,
  tokenNameById,
}: {
  readonly version: ComponentRecord;
  readonly tokenNameById: ReadonlyMap<string, string>;
}) {
  const badge = componentApprovalStatusBadge(version.approvalStatus);
  // Uses the version row's own isCurrent field (populated by the same GET .../:recordId/versions
  // response every entry here already comes from) rather than comparing this row's id against a
  // SEPARATE, independently-timed getComponent() fetch — the two requests aren't transactionally
  // consistent, so a concurrent edit/status transition forking a new version between them could
  // otherwise mislabel which entry is current, the exact code-review fix
  // DesignTokenLibraryDetailPage's/WebsiteStrategyCenterDetailPage's own VersionEntry already
  // established.
  const isCurrent = version.isCurrent;
  const versionTokenNames = version.tokenIds.map((id) => tokenNameById.get(id) ?? id);

  return (
    <li style={versionCardStyle}>
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
            <Fact label="Category">{version.category}</Fact>
            <Fact label="Design tokens">
              {versionTokenNames.length > 0 ? versionTokenNames.join(", ") : "None"}
            </Fact>
          </dl>
          <PlainTextBlock label="HTML structure" value={version.htmlStructure} />
          <PlainTextBlock label="States" value={version.states} />
        </div>
      </details>
    </li>
  );
}
