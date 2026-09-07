import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentContainer, Fact, PageHeader, StatusBadge } from "@webdesk/ui";
import { IntegrationActiveToggle } from "@/components/integration-active-toggle";
import { IntegrationEnvironmentsSection } from "@/components/integration-environments-section";
import { IntegrationSecretMetadataSection } from "@/components/integration-secret-metadata-section";
import { IntegrationVerifyAction } from "@/components/integration-verify-action";
import { IntegrationWebhookEventsSection } from "@/components/integration-webhook-events-section";
import { primaryActionLinkStyle } from "@/lib/action-link-style";
import {
  dlStyle,
  h2Style,
  h3Style,
  mutedStyle,
  sectionStyle,
  subsectionStyle,
} from "@/lib/detail-section-styles";
import {
  formatTimestamp,
  getIntegrationDetail,
  integrationActiveBadge,
  integrationStatusBadge,
  PROVIDER_LABEL,
  verificationResultBadge,
} from "@/lib/integrations";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface IntegrationDetailPageProps {
  readonly params: Promise<{ integrationId: string }>;
}

/**
 * No approved wireframe exists for this module — sections mirror the real backend field grouping
 * (Identity, Status, Environments, Secret metadata, Webhook events), the smallest honest reading of
 * an unsourced screen, matching Brand Library's own detail page precedent. `isActive` has no
 * terminal state — the "Edit" link is always shown, unlike a module with an `approvalStatus`
 * workflow (D-schema: `isActive` is a display/retirement filter, not a workflow terminus).
 */
export default async function IntegrationDetailPage({ params }: IntegrationDetailPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const { integrationId } = await params;
  const detail = await getIntegrationDetail(integrationId);
  if (!detail) {
    notFound();
  }

  const { integration, environments, secretMetadata, webhookEvents } = detail;
  const statusBadge = integrationStatusBadge(integration.status);
  const activeBadge = integrationActiveBadge(integration.isActive);
  const verificationBadge = verificationResultBadge(integration.lastVerificationResult);

  return (
    <ContentContainer>
      <PageHeader
        title={integration.displayName}
        breadcrumbs={[
          { label: "Integrations", href: "/integrations" },
          { label: integration.displayName },
        ]}
        linkComponent={Link}
        statusBadge={<StatusBadge status={statusBadge.token} label={statusBadge.label} />}
        contextActions={
          <>
            <IntegrationActiveToggle
              integrationId={integration.id}
              isActive={integration.isActive}
            />
            <Link href={`/integrations/${integration.id}/edit`} style={primaryActionLinkStyle}>
              Edit
            </Link>
          </>
        }
      />

      <section style={sectionStyle}>
        <h2 style={h2Style}>Identity</h2>
        <dl style={dlStyle}>
          <Fact label="Public ID">{integration.publicId}</Fact>
          <Fact label="Provider">{PROVIDER_LABEL[integration.provider]}</Fact>
          <Fact label="Created">{formatTimestamp(integration.createdAt)}</Fact>
          <Fact label="Updated">{formatTimestamp(integration.updatedAt)}</Fact>
        </dl>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Configuration</h2>
        <div style={subsectionStyle}>
          <h3 style={h3Style}>Config reference</h3>
          {integration.configReference ? (
            <p style={mutedStyle}>{integration.configReference}</p>
          ) : (
            <p style={mutedStyle}>Not set.</p>
          )}
        </div>
        <div style={subsectionStyle}>
          <h3 style={h3Style}>Notes</h3>
          {integration.notes ? (
            <p style={mutedStyle}>{integration.notes}</p>
          ) : (
            <p style={mutedStyle}>Not set.</p>
          )}
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Status</h2>
        <dl style={dlStyle}>
          <Fact label="Active">
            <StatusBadge status={activeBadge.token} label={activeBadge.label} />
          </Fact>
          <Fact label="Last verification result">
            <StatusBadge status={verificationBadge.token} label={verificationBadge.label} />
          </Fact>
          <Fact label="Last verified">
            {integration.lastVerifiedAt ? formatTimestamp(integration.lastVerifiedAt) : "Never"}
          </Fact>
        </dl>
        {integration.lastVerificationNotes ? (
          <div style={subsectionStyle}>
            <h3 style={h3Style}>Last verification notes</h3>
            <p style={mutedStyle}>{integration.lastVerificationNotes}</p>
          </div>
        ) : null}
        <div style={subsectionStyle}>
          <h3 style={h3Style}>Record a verification</h3>
          <IntegrationVerifyAction integrationId={integration.id} />
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Environments</h2>
        <IntegrationEnvironmentsSection
          integrationId={integration.id}
          initialEnvironments={environments}
        />
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Secret metadata</h2>
        <p style={mutedStyle}>
          Tracks which secret exists for this integration, never the value itself.
        </p>
        <IntegrationSecretMetadataSection
          integrationId={integration.id}
          initialSecretMetadata={secretMetadata}
        />
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Webhook events</h2>
        <IntegrationWebhookEventsSection webhookEvents={webhookEvents} />
      </section>
    </ContentContainer>
  );
}
