import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentContainer, Fact, PageHeader, StatusBadge } from "@webdesk/ui";
import { AssetLibraryPublishActions } from "@/components/asset-library-publish-actions";
import { AssetLibraryStatusActions } from "@/components/asset-library-status-actions";
import { AssetRelatedRecordsSection } from "@/components/asset-related-records-section";
import { SanitizedRichText } from "@/components/sanitized-rich-text";
import {
  assetApprovalStatusBadge,
  assetPublishBadge,
  assetScanStatusBadge,
  assetVisibilityBadge,
  formatTimestamp,
  getAsset,
  getAssetRelatedRecords,
} from "@/lib/asset-library";
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
import { sortModulesForPicker } from "@/lib/review-and-approval-center-query";
import { isSafeHttpUrl } from "@/lib/safe-http-url";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface AssetDetailPageProps {
  readonly params: Promise<{ assetId: string }>;
}

/**
 * No approved wireframe exists for this module — sections mirror
 * `03_Detailed_Module_Specifications.md §12`'s own field grouping (Identity, File, Content,
 * Governance, Related records, Status), rendered as sections rather than client-side tabs, the same
 * simplification every sibling library module's detail page already establishes.
 *
 * On a `restricted` asset, `fileReference`/`consentReference` are genuinely OMITTED from the
 * response for a caller lacking `view_confidential` (D2) — `undefined`, not `null` — the same
 * `undefined`-signals-redaction convention `Service.internalDescription`/
 * `BusinessKnowledgeRecord.content` already establish (code-review finding, `dashboard-web-
asset-library` — an earlier revision of this page checked `=== null` for both fields, which is
 * always false for a genuinely redacted value and so never actually rendered the notice). `null`
 * means a real, visible, genuinely-unset value; `undefined` means redacted.
 */
export default async function AssetDetailPage({ params }: AssetDetailPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const { assetId } = await params;
  const [asset, relatedRecords] = await Promise.all([
    getAsset(assetId),
    getAssetRelatedRecords(assetId),
  ]);
  if (!asset) {
    notFound();
  }

  const approvalBadge = assetApprovalStatusBadge(asset.approvalStatus);
  const publishBadge = assetPublishBadge(asset.isPublished);
  const visibilityBadge = assetVisibilityBadge(asset.visibility);
  const scanBadge = assetScanStatusBadge(asset.scanStatus);
  const isFileReferenceRedacted = asset.fileReference === undefined;
  const isConsentReferenceRedacted = asset.consentReference === undefined;
  const hasSafeFileReference = asset.fileReference != null && isSafeHttpUrl(asset.fileReference);
  const modules = sortModulesForPicker(session.navigation);

  return (
    <ContentContainer>
      <PageHeader
        title={asset.title}
        breadcrumbs={[{ label: "Asset Library", href: "/asset-library" }, { label: asset.title }]}
        linkComponent={Link}
        statusBadge={<StatusBadge status={approvalBadge.token} label={approvalBadge.label} />}
        contextActions={
          <>
            <AssetLibraryStatusActions assetId={asset.id} approvalStatus={asset.approvalStatus} />
            <AssetLibraryPublishActions
              assetId={asset.id}
              approvalStatus={asset.approvalStatus}
              isPublished={asset.isPublished}
            />
            {/* archived/superseded are terminal — the backend rejects any edit of one outright
                (assets.service.ts's own update() guard), so the link is hidden rather than left
                clickable only to 400 on submit, matching BrandLibraryStatusActions's own
                self-hiding behavior for these same two statuses. */}
            {asset.approvalStatus !== "archived" && asset.approvalStatus !== "superseded" ? (
              <Link href={`/asset-library/${asset.id}/edit`} style={primaryActionLinkStyle}>
                Edit
              </Link>
            ) : null}
          </>
        }
      />

      <section style={sectionStyle}>
        <h2 style={h2Style}>Identity</h2>
        <dl style={dlStyle}>
          <Fact label="Public ID">{asset.publicId}</Fact>
          <Fact label="Version">{asset.version}</Fact>
          <Fact label="Created">{formatTimestamp(asset.createdAt)}</Fact>
          <Fact label="Updated">{formatTimestamp(asset.updatedAt)}</Fact>
        </dl>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>File</h2>
        <div style={subsectionStyle}>
          <h3 style={h3Style}>File reference</h3>
          {isFileReferenceRedacted ? (
            <p style={redactedStyle}>
              This asset is restricted — its file reference isn&apos;t visible to your account.
            </p>
          ) : asset.fileReference ? (
            hasSafeFileReference ? (
              <a href={asset.fileReference} target="_blank" rel="noopener noreferrer">
                {asset.fileReference}
              </a>
            ) : (
              <p style={mutedStyle}>{asset.fileReference}</p>
            )
          ) : (
            <p style={mutedStyle}>Not set.</p>
          )}
        </div>
        <dl style={dlStyle}>
          <Fact label="MIME type">{asset.mimeType ?? "—"}</Fact>
          <Fact label="File size (bytes)">{asset.fileSizeBytes ?? "—"}</Fact>
          <Fact label="Checksum">{asset.checksum ?? "—"}</Fact>
          <Fact label="Width (px)">{asset.widthPx ?? "—"}</Fact>
          <Fact label="Height (px)">{asset.heightPx ?? "—"}</Fact>
          <Fact label="Duration (seconds)">{asset.durationSeconds ?? "—"}</Fact>
        </dl>
        <p style={mutedStyle}>
          Metadata-only in this pass — these values are caller-supplied, not derived from a file
          this system actually holds. No direct upload capability exists yet.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Content</h2>
        <TextBlock label="Description" value={asset.description} />
        <TextBlock label="Licence" value={asset.licence} />
        <div style={subsectionStyle}>
          <h3 style={h3Style}>Licence holder</h3>
          <p style={asset.licenceHolder ? undefined : mutedStyle}>
            {asset.licenceHolder ?? "Not set."}
          </p>
        </div>
        {isConsentReferenceRedacted ? (
          <div style={subsectionStyle}>
            <h3 style={h3Style}>Consent reference</h3>
            <p style={redactedStyle}>
              This asset is restricted — its consent reference isn&apos;t visible to your account.
            </p>
          </div>
        ) : (
          <TextBlock label="Consent reference" value={asset.consentReference ?? null} />
        )}
        <TextBlock label="Alt text guidance" value={asset.altTextGuidance} />
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Related records</h2>
        <AssetRelatedRecordsSection
          assetId={asset.id}
          initialRecords={relatedRecords}
          modules={modules}
        />
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Governance</h2>
        <dl style={dlStyle}>
          <Fact label="Visibility">
            <StatusBadge status={visibilityBadge.token} label={visibilityBadge.label} />
          </Fact>
          <Fact label="Scan status">
            <StatusBadge status={scanBadge.token} label={scanBadge.label} />
          </Fact>
        </dl>
        <TextBlock label="Retention note" value={asset.retentionNote} />
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Status</h2>
        <dl style={dlStyle}>
          <Fact label="Approval status">
            <StatusBadge status={approvalBadge.token} label={approvalBadge.label} />
          </Fact>
          <Fact label="Publish status">
            <StatusBadge status={publishBadge.token} label={publishBadge.label} />
          </Fact>
          <Fact label="Published">
            {asset.publishedAt ? formatTimestamp(asset.publishedAt) : "Never"}
          </Fact>
        </dl>
      </section>
    </ContentContainer>
  );
}

// Same dashed-border/muted treatment every sibling module's own confidential-field notice uses
// (ServiceLibraryDetailPage's redactedStyle, ServiceLibraryForm's/AssetLibraryForm's own
// .redactedNotice CSS module class), declared locally here since this file uses inline `style`
// objects (via lib/detail-section-styles.ts) rather than a CSS module, matching
// ServiceLibraryDetailPage's own identical local-const precedent.
const redactedStyle = {
  fontSize: "0.875rem",
  color: "var(--webdesk-dashboard-color-foreground-muted)",
  background: "var(--webdesk-dashboard-color-surface)",
  border: "1px dashed var(--webdesk-dashboard-color-border)",
  borderRadius: "0.375rem",
  padding: "0.75rem",
  margin: 0,
} as const;

function TextBlock({ label, value }: { readonly label: string; readonly value: string | null }) {
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
