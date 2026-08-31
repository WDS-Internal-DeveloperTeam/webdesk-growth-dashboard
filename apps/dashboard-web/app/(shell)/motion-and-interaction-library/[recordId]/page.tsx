import Link from "next/link";
import { notFound } from "next/navigation";
import type { MotionInteractionRecord } from "@webdesk/shared-types";
import { ContentContainer, Fact, PageHeader, StatusBadge } from "@webdesk/ui";
import { MotionInteractionStatusActions } from "@/components/motion-interaction-status-actions";
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
} from "@/lib/detail-section-styles";
import {
  CATEGORY_LABEL,
  formatTimestamp,
  getComponentsForMotionInteractionPicker,
  getMotionInteractionRecord,
  getMotionInteractionRecordVersions,
  motionInteractionApprovalStatusBadge,
} from "@/lib/motion-and-interaction-library";
import { buildNameById, resolveIdsToNames } from "@/lib/resolve-ids-to-names";
import { isSafeHttpUrl } from "@/lib/safe-http-url";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface MotionAndInteractionLibraryDetailPageProps {
  readonly params: Promise<{ recordId: string }>;
}

/**
 * No approved wireframe exists for this module — sections mirror the backend's own field grouping
 * (Identity, Behavior, Implementation, Accessibility, Relationships, Status, Version history),
 * rendered as sections rather than client-side tabs, the same simplification the Project/Business
 * Knowledge Center/Service Library/Section and Pattern Library/Page Template Library detail pages
 * already establish.
 *
 * "Version history" mirrors `SectionAndPatternLibraryDetailPage`'s/`PageTemplateLibraryDetailPage`'s
 * own genuinely novel requirement — every version from `GET .../:recordId/versions` (oldest first,
 * reversed here for newest-first display) is listed with its own version number/status/name/
 * updated timestamp, and its own description/timing/related components are viewable via a native
 * `<details>`/`<summary>` disclosure — zero client JS, fully server-rendered. Opening two
 * disclosures side by side is this module's answer to the canonical spec's own named "compare
 * versions" action, without inventing a real diffing UI no sibling module has ever built. The
 * CURRENT version's own content still renders in the normal sections above, exactly as every
 * sibling detail page renders its own primary content — the version-history list additionally
 * repeats it (as the "(current)"-labeled entry) so every version, including the current one, is
 * browsable through the identical mechanism (the same accepted, tracked debt
 * `SectionAndPatternLibraryDetailPage`'s/`PageTemplateLibraryDetailPage`'s own doc comments already
 * document once for the resulting double-render of the current version).
 *
 * `description`/`triggerAndBehavior`/`accessibilityNotes` render through `SanitizedRichText` (real
 * HTML from the rich-text editor, sanitized at both write time and render time).
 * `timingAndEasing`/`implementationSpec`/`fallbackBehavior` render as plain text
 * (`whiteSpace: pre-wrap`), NOT through `SanitizedRichText` — the backend stores all three fields
 * unsanitized as plain spec/code text, matching `MotionInteractionLibraryForm`'s own identical
 * reasoning for keeping them plain `<textarea>`s.
 *
 * `relatedComponentIds` is resolved to real display names by cross-referencing the same
 * `getComponentsForMotionInteractionPicker()` fetch the create/edit form uses — matching
 * `PageTemplateLibraryDetailPage`'s own `supportedComponentIds` resolution pattern. Unlike Section
 * and Pattern Library's own unvalidated `relatedComponentIds` (reasonably shown as raw ids there,
 * since nothing guarantees they resolve to anything), this module's backend
 * (`assertComponentIdsExist()`) genuinely enforces every id here, so showing only the bare id would
 * be a real, avoidable regression from that precedent. An id outside the picker's 100-row fetch
 * window falls back to showing the raw id itself, still real and honest, just unresolved — the
 * same accepted over-fetch/pagination-bound debt `ComponentLibraryDetailPage`'s/
 * `PageTemplateLibraryDetailPage`'s own resolution already carries.
 */
export default async function MotionAndInteractionLibraryDetailPage({
  params,
}: MotionAndInteractionLibraryDetailPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const { recordId } = await params;
  const [record, versions, components] = await Promise.all([
    getMotionInteractionRecord(recordId),
    getMotionInteractionRecordVersions(recordId),
    getComponentsForMotionInteractionPicker(),
  ]);
  if (!record) {
    notFound();
  }

  const approvalBadge = motionInteractionApprovalStatusBadge(record.approvalStatus);
  // Newest first for display — the backend returns oldest first (its own natural insertion order).
  const versionsNewestFirst = [...versions].sort((a, b) => b.versionNumber - a.versionNumber);

  const componentNameById = buildNameById(
    components,
    (component) => component.recordId,
    (component) => component.name,
  );
  const relatedComponentNames = resolveIdsToNames(record.relatedComponentIds, componentNameById);

  return (
    <ContentContainer>
      <PageHeader
        title={record.name}
        breadcrumbs={[
          { label: "Motion and Interaction Library", href: "/motion-and-interaction-library" },
          { label: record.name },
        ]}
        linkComponent={Link}
        statusBadge={<StatusBadge status={approvalBadge.token} label={approvalBadge.label} />}
        contextActions={
          <>
            <MotionInteractionStatusActions
              recordId={record.recordId}
              approvalStatus={record.approvalStatus}
            />
            {/* archived/superseded are terminal — the backend rejects any edit of one outright
                (motion-interactions.service.ts's own update() guard), so the link is hidden rather
                than left clickable only to 400 on submit, matching
                MotionInteractionStatusActions's own self-hiding behavior for these same two
                statuses. */}
            {record.approvalStatus !== "archived" && record.approvalStatus !== "superseded" ? (
              <Link
                href={`/motion-and-interaction-library/${record.recordId}/edit`}
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
          <Fact label="Public ID">{record.publicId}</Fact>
          <Fact label="Category">{CATEGORY_LABEL[record.category]}</Fact>
          <Fact label="Version">v{record.versionNumber}</Fact>
          <Fact label="Created">{formatTimestamp(record.createdAt)}</Fact>
          <Fact label="Updated">{formatTimestamp(record.updatedAt)}</Fact>
        </dl>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Behavior</h2>
        <div style={subsectionStyle}>
          <h3 style={h3Style}>Description</h3>
          {record.description ? (
            <SanitizedRichText html={record.description} style={richContentStyle} />
          ) : (
            <p style={mutedStyle}>Not set.</p>
          )}
        </div>
        <div style={subsectionStyle}>
          <h3 style={h3Style}>Trigger and behavior</h3>
          {record.triggerAndBehavior ? (
            <SanitizedRichText html={record.triggerAndBehavior} style={richContentStyle} />
          ) : (
            <p style={mutedStyle}>Not set.</p>
          )}
        </div>
        <div style={subsectionStyle}>
          <h3 style={h3Style}>Design reference</h3>
          {record.designReference && isSafeHttpUrl(record.designReference) ? (
            <a href={record.designReference} target="_blank" rel="noreferrer noopener">
              {record.designReference}
            </a>
          ) : record.designReference ? (
            <p style={richContentStyle}>{record.designReference}</p>
          ) : (
            <p style={mutedStyle}>Not set.</p>
          )}
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Implementation</h2>
        <PlainTextBlock label="Timing and easing" value={record.timingAndEasing} />
        <PlainTextBlock label="Implementation spec" value={record.implementationSpec} />
        <PlainTextBlock label="Fallback behavior" value={record.fallbackBehavior} />
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Accessibility</h2>
        <div style={subsectionStyle}>
          <h3 style={h3Style}>Accessibility notes</h3>
          {record.accessibilityNotes ? (
            <SanitizedRichText html={record.accessibilityNotes} style={richContentStyle} />
          ) : (
            <p style={mutedStyle}>Not set.</p>
          )}
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Relationships</h2>
        <div style={subsectionStyle}>
          <h3 style={h3Style}>Related components</h3>
          {relatedComponentNames.length > 0 ? (
            <p style={richContentStyle}>{relatedComponentNames.join(", ")}</p>
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
              <VersionEntry
                key={version.id}
                version={version}
                componentNameById={componentNameById}
              />
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
  componentNameById,
}: {
  readonly version: MotionInteractionRecord;
  readonly componentNameById: ReadonlyMap<string, string>;
}) {
  const badge = motionInteractionApprovalStatusBadge(version.approvalStatus);
  const relatedComponentNames = resolveIdsToNames(version.relatedComponentIds, componentNameById);
  // Uses the version row's own isCurrent field (populated by the same GET .../:recordId/versions
  // response every entry here already comes from) rather than comparing this row's id against a
  // SEPARATE, independently-timed getMotionInteractionRecord() fetch — the two requests aren't
  // transactionally consistent, so a concurrent edit/status transition forking a new version
  // between them could otherwise mislabel which entry is current, the exact code-review fix
  // SectionAndPatternLibraryDetailPage's/PageTemplateLibraryDetailPage's own VersionEntry already
  // established.
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
          <div style={subsectionStyle}>
            <h3 style={h3Style}>Description</h3>
            {version.description ? (
              <SanitizedRichText html={version.description} style={richContentStyle} />
            ) : (
              <p style={mutedStyle}>Not set.</p>
            )}
          </div>
          <PlainTextBlock label="Timing and easing" value={version.timingAndEasing} />
          <div style={subsectionStyle}>
            <h3 style={h3Style}>Related components</h3>
            {relatedComponentNames.length > 0 ? (
              <p style={richContentStyle}>{relatedComponentNames.join(", ")}</p>
            ) : (
              <p style={mutedStyle}>Not set.</p>
            )}
          </div>
        </div>
      </details>
    </li>
  );
}
