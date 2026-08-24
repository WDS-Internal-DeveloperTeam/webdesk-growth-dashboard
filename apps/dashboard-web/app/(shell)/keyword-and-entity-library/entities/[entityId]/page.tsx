import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ContentContainer, Fact, PageHeader, typographyTokens } from "@webdesk/ui";
import { EntityDeleteButton } from "@/components/entity-delete-button";
import { SanitizedRichText } from "@/components/sanitized-rich-text";
import { primaryActionLinkStyle } from "@/lib/action-link-style";
import { dlStyle, h2Style, mutedStyle, richContentStyle, sectionStyle } from "@/lib/detail-section-styles";
import { formatTimestamp, getEntity, withProjectId } from "@/lib/keyword-and-entity-library";
import { getProject } from "@/lib/projects";
import { firstValue } from "@/lib/search-params";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface EntityDetailPageProps {
  readonly params: Promise<{ entityId: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * No approval workflow of its own (task package D3) — no status badge/status-actions component,
 * unlike the keyword detail page. `description` renders via `SanitizedRichText`, matching every
 * other rich-text field in this app.
 */
export default async function EntityDetailPage({ params, searchParams }: EntityDetailPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const rawParams = await searchParams;
  const projectIdParam = firstValue(rawParams.projectId);
  const { entityId } = await params;

  const project = projectIdParam ? await getProject(projectIdParam) : null;
  if (!project) {
    redirect("/keyword-and-entity-library/entities");
  }

  const entity = await getEntity(project.id, entityId);
  if (!entity) {
    notFound();
  }

  return (
    <ContentContainer>
      <PageHeader
        title={entity.name}
        breadcrumbs={[
          { label: "Keyword & Entity Library", href: "/keyword-and-entity-library" },
          { label: "Entities", href: "/keyword-and-entity-library/entities" },
          { label: entity.name },
        ]}
        linkComponent={Link}
        contextActions={
          <>
            <EntityDeleteButton
              projectId={project.id}
              entityId={entity.id}
              entityName={entity.name}
            />
            <Link
              href={withProjectId(
                `/keyword-and-entity-library/entities/${entity.id}/edit`,
                project.id,
              )}
              style={primaryActionLinkStyle}
            >
              Edit
            </Link>
          </>
        }
      />

      <section style={sectionStyle}>
        <h2 style={h2Style}>Identity</h2>
        <dl style={dlStyle}>
          <Fact label="Public ID">
            <span style={{ fontFamily: typographyTokens.fontFamilyMono }}>{entity.publicId}</span>
          </Fact>
          <Fact label="Entity type">{entity.entityType ?? "—"}</Fact>
        </dl>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Description</h2>
        {entity.description ? (
          <SanitizedRichText html={entity.description} style={richContentStyle} />
        ) : (
          <p style={mutedStyle}>Not set.</p>
        )}
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Status</h2>
        <dl style={dlStyle}>
          <Fact label="Created">{formatTimestamp(entity.createdAt)}</Fact>
          <Fact label="Updated">{formatTimestamp(entity.updatedAt)}</Fact>
        </dl>
      </section>
    </ContentContainer>
  );
}
