import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentContainer, Fact, PageHeader, StatusBadge } from "@webdesk/ui";
import { SanitizedRichText } from "@/components/sanitized-rich-text";
import { WorkflowTaskTemplateStatusActions } from "@/components/workflow-task-template-status-actions";
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
import { TEMPLATE_TYPE_LABEL } from "@/lib/workflow-and-task-template-library-query";
import {
  formatTimestamp,
  getWorkflowTaskTemplate,
  workflowTaskTemplateApprovalStatusBadge,
} from "@/lib/workflow-and-task-template-library";

export const dynamic = "force-dynamic";

interface WorkflowTaskTemplateDetailPageProps {
  readonly params: Promise<{ templateId: string }>;
}

/**
 * No approved wireframe exists for this module — sections mirror
 * `03_Detailed_Module_Specifications.md §29`'s own field grouping (Identity, Task details,
 * Governance, Status), rendered as sections rather than client-side tabs, the same simplification
 * the Brand/Content Template/Persona/Service Library detail pages already establish.
 */
export default async function WorkflowTaskTemplateDetailPage({
  params,
}: WorkflowTaskTemplateDetailPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const { templateId } = await params;
  const template = await getWorkflowTaskTemplate(templateId);
  if (!template) {
    notFound();
  }

  const approvalBadge = workflowTaskTemplateApprovalStatusBadge(template.approvalStatus);

  return (
    <ContentContainer>
      <PageHeader
        title={template.title}
        breadcrumbs={[
          {
            label: "Workflow and Task Template Library",
            href: "/workflow-and-task-template-library",
          },
          { label: template.title },
        ]}
        linkComponent={Link}
        statusBadge={<StatusBadge status={approvalBadge.token} label={approvalBadge.label} />}
        contextActions={
          <>
            <WorkflowTaskTemplateStatusActions
              templateId={template.id}
              approvalStatus={template.approvalStatus}
            />
            {/* archived/superseded are terminal — the backend rejects any edit of one outright
                (workflow-and-task-template-library.service.ts's own update() guard), so the link is
                hidden rather than left clickable only to 400 on submit, matching
                BrandLibraryStatusActions's own self-hiding behavior for these same two statuses. */}
            {template.approvalStatus !== "archived" && template.approvalStatus !== "superseded" ? (
              <Link
                href={`/workflow-and-task-template-library/${template.id}/edit`}
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
          <Fact label="Public ID">{template.publicId}</Fact>
          <Fact label="Template type">{TEMPLATE_TYPE_LABEL[template.templateType]}</Fact>
          <Fact label="Authorized stage">{template.authorizedStage}</Fact>
          <Fact label="Version">{template.version}</Fact>
          <Fact label="Created">{formatTimestamp(template.createdAt)}</Fact>
          <Fact label="Updated">{formatTimestamp(template.updatedAt)}</Fact>
        </dl>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Task details</h2>
        <TextBlock label="Required inputs" value={template.requiredInputs} />
        <TextBlock label="Expected outputs" value={template.expectedOutputs} />
        <TextBlock label="Restrictions" value={template.restrictions} />
        <TextBlock label="Validation criteria" value={template.validationCriteria} />
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Governance</h2>
        <dl style={dlStyle}>
          <Fact label="Agent assignment">{template.agentAssignment ?? "Not set."}</Fact>
          <Fact label="Required approvals">{template.requiredApprovals ?? "Not set."}</Fact>
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
