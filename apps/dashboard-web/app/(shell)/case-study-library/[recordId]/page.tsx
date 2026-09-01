import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentContainer, Fact, PageHeader, StatusBadge } from "@webdesk/ui";
import { primaryActionLinkStyle } from "@/lib/action-link-style";
import { caseStudyStatusBadge } from "@/lib/case-study-studio-query";
import { formatTimestamp, getCaseStudyLibraryRecord } from "@/lib/case-study-library";
import { dlStyle, h2Style, mutedStyle, sectionStyle } from "@/lib/detail-section-styles";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface CaseStudyLibraryDetailPageProps {
  readonly params: Promise<{ recordId: string }>;
}

/**
 * No approved wireframe exists for this module — sections mirror
 * `packages/database/src/case-study-library/entities.ts`'s own field grouping (Identity, Case
 * study, Related pages, Technologies, Testimonials, Metadata), matching every sibling detail
 * page's own "sections, not client-side tabs" simplification. No status-actions component and no
 * "archived → hide Edit" guard — this record has no lifecycle of its own (D1); the parent case
 * study's own status is shown read-only via its already-shared `caseStudyStatusBadge()`.
 */
export default async function CaseStudyLibraryDetailPage({
  params,
}: CaseStudyLibraryDetailPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const { recordId } = await params;
  const record = await getCaseStudyLibraryRecord(recordId);
  if (!record) {
    notFound();
  }

  const { caseStudy } = record;
  const badge = caseStudy ? caseStudyStatusBadge(caseStudy.status) : null;

  return (
    <ContentContainer>
      <PageHeader
        title={record.publicId}
        breadcrumbs={[
          { label: "Case Study Library", href: "/case-study-library" },
          { label: record.publicId },
        ]}
        linkComponent={Link}
        statusBadge={badge ? <StatusBadge status={badge.token} label={badge.label} /> : null}
        contextActions={
          <Link href={`/case-study-library/${record.id}/edit`} style={primaryActionLinkStyle}>
            Edit
          </Link>
        }
      />

      <section style={sectionStyle}>
        <h2 style={h2Style}>Identity</h2>
        <dl style={dlStyle}>
          <Fact label="Public ID">{record.publicId}</Fact>
          <Fact label="Created">{formatTimestamp(record.createdAt)}</Fact>
          <Fact label="Updated">{formatTimestamp(record.updatedAt)}</Fact>
        </dl>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Case study</h2>
        {caseStudy ? (
          <dl style={dlStyle}>
            <Fact label="Client">{caseStudy.clientName}</Fact>
            <Fact label="Project">{caseStudy.projectTitle}</Fact>
            <Fact label="Case study">
              <Link href={`/case-study-studio/${caseStudy.id}`}>{caseStudy.publicId}</Link>
            </Fact>
          </dl>
        ) : (
          <p style={mutedStyle}>The parent case study could not be resolved.</p>
        )}
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Related pages</h2>
        {record.relatedPageIds.length > 0 ? (
          <ul>
            {record.relatedPageIds.map((pageId) => (
              <li key={pageId} style={mutedStyle}>
                {pageId}
              </li>
            ))}
          </ul>
        ) : (
          <p style={mutedStyle}>No related pages recorded.</p>
        )}
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Technologies</h2>
        {record.technologies.length > 0 ? (
          <p>{record.technologies.join(", ")}</p>
        ) : (
          <p style={mutedStyle}>No technologies recorded.</p>
        )}
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Testimonials</h2>
        {record.testimonials.length > 0 ? (
          <ul
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
              padding: 0,
              listStyle: "none",
            }}
          >
            {record.testimonials.map((testimonial, index) => (
              // A plain embedded array with no stable per-row id, matching
              // CaseStudyLibraryTestimonialsField's own key convention for the identical shape.
              <li key={index}>
                <p style={{ margin: 0, fontStyle: "italic" }}>&ldquo;{testimonial.quote}&rdquo;</p>
                {testimonial.author || testimonial.role ? (
                  <p style={mutedStyle}>
                    {[testimonial.author, testimonial.role].filter(Boolean).join(", ")}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p style={mutedStyle}>No testimonials recorded.</p>
        )}
      </section>
    </ContentContainer>
  );
}
