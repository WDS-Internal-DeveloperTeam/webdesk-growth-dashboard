import Link from "next/link";
import { notFound } from "next/navigation";
import type { PageTemplateRecord } from "@webdesk/shared-types";
import { ContentContainer, Fact, PageHeader, StatusBadge } from "@webdesk/ui";
import { PageTemplateStatusActions } from "@/components/page-template-status-actions";
import { SanitizedRichText } from "@/components/sanitized-rich-text";
import { primaryActionLinkStyle } from "@/lib/action-link-style";
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
import {
  formatTimestamp,
  getComponentsForPageTemplatePicker,
  getPageTemplate,
  getPageTemplatesForReplacementPicker,
  getPageTemplateVersions,
  getSectionPatternsForPageTemplatePicker,
  pageTemplateApprovalStatusBadge,
} from "@/lib/page-template-library";
import { PAGE_TYPE_LABEL } from "@/lib/page-template-library-query";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface PageTemplateLibraryDetailPageProps {
  readonly params: Promise<{ recordId: string }>;
}

/**
 * No approved wireframe exists for this module — sections mirror the backend's own field grouping
 * (Identity, Sections & components, Content & conversion, WordPress & relationships, Status,
 * Version history), rendered as sections rather than client-side tabs, the same simplification the
 * Component Library/Section and Pattern Library/Project/Business Knowledge Center/Service
 * Library/Persona Library/Website Strategy Center/Design Token Library detail pages already
 * establish.
 *
 * "Version history" mirrors `ComponentLibraryDetailPage`'s/`SectionAndPatternLibraryDetailPage`'s
 * own genuinely novel requirement — every version from `GET .../:recordId/versions` (oldest
 * first, reversed here for newest-first display) is listed with its own version number/status/
 * name/updated timestamp, and its own page type/name/relationship-id/content fields are viewable
 * via a native `<details>`/`<summary>` disclosure — zero client JS, fully server-rendered. Opening
 * two disclosures side by side is this module's answer to the canonical spec's own named "compare
 * versions" action, without inventing a real diffing UI no sibling module has ever built. The
 * CURRENT version's own content still renders in the normal sections above, exactly as every
 * sibling detail page renders its own primary content — the version-history list additionally
 * repeats it (as the "(current)"-labeled entry) so every version, including the current one, is
 * browsable through the identical mechanism (the same accepted, tracked debt
 * `ComponentLibraryDetailPage`'s/`SectionAndPatternLibraryDetailPage`'s own doc comment already
 * documents once for the resulting double-render of the current version).
 *
 * `contentRequirements`/`searchRequirements`/`conversionGoal` render through the shared
 * `SanitizedRichText` component — the backend sanitizes these three fields at write time
 * (`page-templates.service.ts`), matching the standing rule that every rich-text render site in
 * this app defense-in-depth-sanitizes again at render time. `phpTemplateRelationship` renders as
 * plain text (`whiteSpace: pre-wrap`), NOT through `SanitizedRichText` — the backend stores this
 * field unsanitized as plain text, matching `PageTemplateLibraryForm`'s own identical reasoning
 * for keeping it a plain `<textarea>`.
 *
 * `requiredSectionIds`/`optionalSectionIds`/`supportedComponentIds`/`replacementRecordId` are
 * resolved to real display names by cross-referencing the same picker-population fetches the
 * create/edit form uses (each capped at the same 100-row bound — an id outside that window falls
 * back to showing the raw id itself, still real and honest, just unresolved, matching the
 * accepted over-fetch/pagination-bound debt `ComponentLibraryDetailPage`'s own `tokenIds`
 * resolution already carries).
 */
export default async function PageTemplateLibraryDetailPage({
  params,
}: PageTemplateLibraryDetailPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const { recordId } = await params;
  const [pageTemplate, versions, sectionPatterns, components, pageTemplates] = await Promise.all([
    getPageTemplate(recordId),
    getPageTemplateVersions(recordId),
    getSectionPatternsForPageTemplatePicker(),
    getComponentsForPageTemplatePicker(),
    getPageTemplatesForReplacementPicker(),
  ]);
  if (!pageTemplate) {
    notFound();
  }

  const approvalBadge = pageTemplateApprovalStatusBadge(pageTemplate.approvalStatus);
  // Newest first for display — the backend returns oldest first (its own natural insertion order).
  const versionsNewestFirst = [...versions].sort((a, b) => b.versionNumber - a.versionNumber);

  const sectionNameById = new Map(
    sectionPatterns.map((section) => [section.recordId, section.name]),
  );
  const componentNameById = new Map(
    components.map((component) => [component.recordId, component.name]),
  );
  const pageTemplateNameById = new Map(
    pageTemplates.map((template) => [template.recordId, template.name]),
  );

  const requiredSectionNames = pageTemplate.requiredSectionIds.map(
    (id) => sectionNameById.get(id) ?? id,
  );
  const optionalSectionNames = pageTemplate.optionalSectionIds.map(
    (id) => sectionNameById.get(id) ?? id,
  );
  const supportedComponentNames = pageTemplate.supportedComponentIds.map(
    (id) => componentNameById.get(id) ?? id,
  );
  const replacementName = pageTemplate.replacementRecordId
    ? (pageTemplateNameById.get(pageTemplate.replacementRecordId) ??
      pageTemplate.replacementRecordId)
    : null;

  return (
    <ContentContainer>
      <PageHeader
        title={pageTemplate.name}
        breadcrumbs={[
          { label: "Page Template Library", href: "/page-template-library" },
          { label: pageTemplate.name },
        ]}
        linkComponent={Link}
        statusBadge={<StatusBadge status={approvalBadge.token} label={approvalBadge.label} />}
        contextActions={
          <>
            <PageTemplateStatusActions
              recordId={pageTemplate.recordId}
              approvalStatus={pageTemplate.approvalStatus}
            />
            {/* archived/superseded are terminal — the backend rejects any edit of one outright
                (page-templates.service.ts's own update() guard), so the link is hidden rather
                than left clickable only to 400 on submit, matching
                PageTemplateStatusActions's own self-hiding behavior for these same two
                statuses. */}
            {pageTemplate.approvalStatus !== "archived" &&
            pageTemplate.approvalStatus !== "superseded" ? (
              <Link
                href={`/page-template-library/${pageTemplate.recordId}/edit`}
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
          <Fact label="Public ID">{pageTemplate.publicId}</Fact>
          <Fact label="Page type">{PAGE_TYPE_LABEL[pageTemplate.pageType]}</Fact>
          <Fact label="Version">v{pageTemplate.versionNumber}</Fact>
          <Fact label="Created">{formatTimestamp(pageTemplate.createdAt)}</Fact>
          <Fact label="Updated">{formatTimestamp(pageTemplate.updatedAt)}</Fact>
        </dl>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Sections &amp; components</h2>
        <dl style={dlStyle}>
          <Fact label="Required sections">
            {requiredSectionNames.length > 0 ? requiredSectionNames.join(", ") : "None"}
          </Fact>
          <Fact label="Optional sections">
            {optionalSectionNames.length > 0 ? optionalSectionNames.join(", ") : "None"}
          </Fact>
          <Fact label="Supported components">
            {supportedComponentNames.length > 0 ? supportedComponentNames.join(", ") : "None"}
          </Fact>
          <Fact label="Wireframe references">
            {pageTemplate.wireframeReferences.length > 0
              ? pageTemplate.wireframeReferences.join(", ")
              : "None"}
          </Fact>
        </dl>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Content &amp; conversion</h2>
        <RichContentBlock label="Content requirements" value={pageTemplate.contentRequirements} />
        <RichContentBlock label="Search requirements" value={pageTemplate.searchRequirements} />
        <RichContentBlock label="Conversion goal" value={pageTemplate.conversionGoal} />
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>WordPress &amp; relationships</h2>
        <div style={subsectionStyle}>
          <h3 style={h3Style}>PHP template relationship</h3>
          {pageTemplate.phpTemplateRelationship ? (
            <p style={{ ...richContentStyle, whiteSpace: "pre-wrap" }}>
              {pageTemplate.phpTemplateRelationship}
            </p>
          ) : (
            <p style={mutedStyle}>Not set.</p>
          )}
        </div>
        <dl style={dlStyle}>
          <Fact label="Replacement page template">
            {replacementName ? (
              <Link href={`/page-template-library/${pageTemplate.replacementRecordId}`}>
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
              <VersionEntry key={version.id} version={version} />
            ))}
          </ul>
        )}
      </section>
    </ContentContainer>
  );
}

function RichContentBlock({
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
        <SanitizedRichText html={value} style={richContentStyle} />
      ) : (
        <p style={mutedStyle}>Not set.</p>
      )}
    </div>
  );
}

function VersionEntry({ version }: { readonly version: PageTemplateRecord }) {
  const badge = pageTemplateApprovalStatusBadge(version.approvalStatus);
  // Uses the version row's own isCurrent field (populated by the same GET .../:recordId/versions
  // response every entry here already comes from) rather than comparing this row's id against a
  // SEPARATE, independently-timed getPageTemplate() fetch — the two requests aren't
  // transactionally consistent, so a concurrent edit/status transition forking a new version
  // between them could otherwise mislabel which entry is current, the exact code-review fix
  // ComponentLibraryDetailPage's/SectionAndPatternLibraryDetailPage's own VersionEntry already
  // established.
  const isCurrent = version.isCurrent;

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
            <Fact label="Page type">{PAGE_TYPE_LABEL[version.pageType]}</Fact>
          </dl>
          <RichContentBlock label="Content requirements" value={version.contentRequirements} />
        </div>
      </details>
    </li>
  );
}
