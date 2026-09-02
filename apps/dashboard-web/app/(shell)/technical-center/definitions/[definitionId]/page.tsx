import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ContentContainer, Fact, PageHeader, StatusBadge } from "@webdesk/ui";
import { TriggerTechnicalCheckRunButton } from "@/components/trigger-technical-check-run-button";
import { primaryActionLinkStyle } from "@/lib/action-link-style";
import { tolerateDiscard } from "@/lib/business-knowledge";
import { dlStyle, h2Style, mutedStyle, sectionStyle } from "@/lib/detail-section-styles";
import { getProject } from "@/lib/projects";
import { firstValue } from "@/lib/search-params";
import { getServerSession } from "@/lib/server-session";
import {
  formatTimestamp,
  getTechnicalCheckDefinition,
  getTechnicalCheckRunsForDefinition,
  technicalCheckRunStatusBadge,
  TECHNICAL_CHECK_MODE_LABEL,
  TECHNICAL_CHECK_RUN_TRIGGER_TYPE_LABEL,
  TECHNICAL_CHECK_TYPE_LABEL,
  withProjectId,
} from "@/lib/technical-center";

export const dynamic = "force-dynamic";

interface TechnicalCheckDefinitionDetailPageProps {
  readonly params: Promise<{ definitionId: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * No approved wireframe/screen-level spec exists for this module — sections mirror the backend's
 * own field grouping (Identity, Schedule, Status), plus a "Runs" section listing every run this
 * definition has produced (a flat, unpaginated sub-list —
 * `getTechnicalCheckRunsForDefinition()`'s own doc comment), rendered as sections rather than
 * client-side tabs, the same simplification `ScanDefinitionDetailPage` (the literal structural
 * template for this module) already establishes.
 *
 * Requires `?projectId=` — same rule as every other route in this module. A missing/unresolvable
 * `projectId` redirects to the list page's own project-picker prompt before this page ever tries
 * `getTechnicalCheckDefinition()` (which itself hard-requires a real `projectId` to build its own
 * URL).
 *
 * "Edit" is always shown — a technical check definition has no terminal/workflow state of its own
 * (only `isEnabled`, which the edit form itself can toggle), unlike every workflow-bearing sibling
 * module's own terminal-state Edit-link-hiding precedent.
 */
export default async function TechnicalCheckDefinitionDetailPage({
  params,
  searchParams,
}: TechnicalCheckDefinitionDetailPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const rawParams = await searchParams;
  const projectIdParam = firstValue(rawParams.projectId);
  const { definitionId } = await params;

  // Fired concurrently with the project-existence check below, not sequentially after it —
  // matches `ScanDefinitionDetailPage`'s own established pattern. `tolerateDiscard()` avoids an
  // unhandled-rejection warning on the branch where `project` turns out null and neither promise
  // is ever awaited.
  const definitionPromise = projectIdParam
    ? tolerateDiscard(getTechnicalCheckDefinition(projectIdParam, definitionId))
    : null;
  const runsPromise = projectIdParam
    ? tolerateDiscard(getTechnicalCheckRunsForDefinition(projectIdParam, definitionId))
    : null;

  const project = projectIdParam ? await getProject(projectIdParam) : null;
  if (!project) {
    redirect("/technical-center");
  }

  const [definition, runs] = await Promise.all([definitionPromise!, runsPromise!]);
  if (!definition) {
    notFound();
  }

  return (
    <ContentContainer>
      <PageHeader
        title={definition.name}
        breadcrumbs={[
          { label: "Technical Center", href: withProjectId("/technical-center", project.id) },
          { label: definition.name },
        ]}
        linkComponent={Link}
        statusBadge={
          definition.isEnabled ? (
            <StatusBadge status="healthy" label="Enabled" />
          ) : (
            <StatusBadge status="notConfigured" label="Disabled" />
          )
        }
        contextActions={
          <Link
            href={withProjectId(`/technical-center/definitions/${definition.id}/edit`, project.id)}
            style={primaryActionLinkStyle}
          >
            Edit
          </Link>
        }
      />

      <section style={sectionStyle}>
        <h2 style={h2Style}>Identity</h2>
        <dl style={dlStyle}>
          <Fact label="Public ID">{definition.publicId}</Fact>
          <Fact label="Check type">{TECHNICAL_CHECK_TYPE_LABEL[definition.checkType]}</Fact>
          <Fact label="Mode">{TECHNICAL_CHECK_MODE_LABEL[definition.mode]}</Fact>
          <Fact label="Environment">{definition.environment ?? "—"}</Fact>
        </dl>
        {definition.target ? (
          <p style={contentStyle}>{definition.target}</p>
        ) : (
          <p style={mutedStyle}>No target set.</p>
        )}
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Schedule</h2>
        <dl style={dlStyle}>
          <Fact label="Cron">{definition.scheduleCron ?? "—"}</Fact>
        </dl>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Trigger a run</h2>
        <TriggerTechnicalCheckRunButton
          projectId={project.id}
          technicalCheckDefinitionId={definition.id}
          isEnabled={definition.isEnabled}
        />
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Runs</h2>
        {runs.length === 0 ? (
          <p style={mutedStyle}>No runs yet.</p>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {runs.map((run) => {
              const badge = technicalCheckRunStatusBadge(run.status);
              return (
                <li
                  key={run.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: "0.5rem 0",
                    borderBottom: "1px solid var(--webdesk-dashboard-color-border)",
                    fontSize: "0.875rem",
                  }}
                >
                  <Link href={withProjectId(`/technical-center/runs/${run.id}`, project.id)}>
                    {run.publicId}
                  </Link>
                  <span style={{ color: "var(--webdesk-dashboard-color-foreground-muted)" }}>
                    {TECHNICAL_CHECK_RUN_TRIGGER_TYPE_LABEL[run.triggerType]}
                  </span>
                  <StatusBadge status={badge.token} label={badge.label} />
                  <span style={{ color: "var(--webdesk-dashboard-color-foreground-muted)" }}>
                    {formatTimestamp(run.createdAt)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Status</h2>
        <dl style={dlStyle}>
          <Fact label="Created">{formatTimestamp(definition.createdAt)}</Fact>
          <Fact label="Updated">{formatTimestamp(definition.updatedAt)}</Fact>
        </dl>
      </section>
    </ContentContainer>
  );
}

const contentStyle = {
  fontSize: "0.9375rem",
  color: "var(--webdesk-dashboard-color-foreground)",
  whiteSpace: "pre-wrap",
  margin: 0,
} as const;
