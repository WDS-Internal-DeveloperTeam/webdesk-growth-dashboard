import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentContainer, Fact, PageHeader, StatusBadge } from "@webdesk/ui";
import { PersonaStatusActions } from "@/components/persona-status-actions";
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
import { getServerSession } from "@/lib/server-session";
import {
  formatTimestamp,
  getPersona,
  getServicesForPersonaPicker,
  personaApprovalStatusBadge,
} from "@/lib/persona-library";

export const dynamic = "force-dynamic";

interface PersonaLibraryDetailPageProps {
  readonly params: Promise<{ personaId: string }>;
}

/**
 * No approved wireframe exists for this module — sections mirror
 * `03_Detailed_Module_Specifications.md §21`'s own field grouping (Identity, Buyer profile,
 * Narrative, Relationships, Status), rendered as sections rather than client-side tabs, the same
 * simplification the Project/Business Knowledge Center/Service Library detail pages already
 * establish. `relatedServiceIds` is resolved to real service display names by cross-referencing
 * the same picker-population fetch the create/edit form uses (capped at the same 100-row bound —
 * an id outside that window falls back to showing the raw id itself, still real and honest, just
 * unresolved, matching the accepted over-fetch/pagination-bound debt this app's pickers already
 * carry elsewhere).
 */
export default async function PersonaLibraryDetailPage({ params }: PersonaLibraryDetailPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const { personaId } = await params;
  const [persona, services] = await Promise.all([
    getPersona(personaId),
    getServicesForPersonaPicker(),
  ]);
  if (!persona) {
    notFound();
  }

  const approvalBadge = personaApprovalStatusBadge(persona.approvalStatus);
  const serviceNameById = new Map(
    services.map((service) => [service.id, service.publicName ?? service.canonicalName]),
  );
  const relatedServiceNames = persona.relatedServiceIds.map((id) => serviceNameById.get(id) ?? id);

  return (
    <ContentContainer>
      <PageHeader
        title={persona.name}
        breadcrumbs={[
          { label: "Persona Library", href: "/persona-library" },
          { label: persona.name },
        ]}
        linkComponent={Link}
        statusBadge={<StatusBadge status={approvalBadge.token} label={approvalBadge.label} />}
        contextActions={
          <>
            <PersonaStatusActions personaId={persona.id} approvalStatus={persona.approvalStatus} />
            <Link href={`/persona-library/${persona.id}/edit`} style={primaryActionLinkStyle}>
              Edit
            </Link>
          </>
        }
      />

      <section style={sectionStyle}>
        <h2 style={h2Style}>Identity</h2>
        <dl style={dlStyle}>
          <Fact label="Public ID">{persona.publicId}</Fact>
          <Fact label="Version">{persona.version}</Fact>
          <Fact label="Created">{formatTimestamp(persona.createdAt)}</Fact>
          <Fact label="Updated">{formatTimestamp(persona.updatedAt)}</Fact>
        </dl>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Buyer profile</h2>
        <dl style={dlStyle}>
          <Fact label="Buyer type">{persona.buyerType ?? "—"}</Fact>
          <Fact label="Company size">{persona.companySize ?? "—"}</Fact>
          <Fact label="Geography">{persona.geography ?? "—"}</Fact>
          <Fact label="Roles">{persona.roles.length > 0 ? persona.roles.join(", ") : "None"}</Fact>
          <Fact label="Industries">
            {persona.industries.length > 0 ? persona.industries.join(", ") : "None"}
          </Fact>
        </dl>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Narrative</h2>
        <TextBlock label="Goals" value={persona.goals} />
        <TextBlock label="Pains" value={persona.pains} />
        <TextBlock label="Triggers" value={persona.triggers} />
        <TextBlock label="Objections" value={persona.objections} />
        <TextBlock label="Decision criteria" value={persona.decisionCriteria} />
        <TextBlock label="Bad-fit signals" value={persona.badFitSignals} />
        <TextBlock label="Messaging track" value={persona.messagingTrack} />
        <TextBlock label="CTA preferences" value={persona.ctaPreferences} />
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Relationships</h2>
        <dl style={dlStyle}>
          <Fact label="Related services">
            {relatedServiceNames.length > 0 ? relatedServiceNames.join(", ") : "None"}
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
    </ContentContainer>
  );
}

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
