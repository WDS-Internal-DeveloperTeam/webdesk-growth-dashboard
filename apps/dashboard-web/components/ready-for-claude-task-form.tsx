"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import type {
  ModuleRegistrySummary,
  Project,
  ReadyForClaudeTask,
  ReadyForClaudeTaskPriority,
  UserSummary,
} from "@webdesk/shared-types";
import { RelationshipPicker, type RelationshipOption } from "@webdesk/ui";
import { postMutation } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { isSafeHttpUrl } from "@/lib/safe-http-url";
import { moduleDisplayName } from "@/lib/ready-for-claude-queue-query";
import { isUuid } from "@/lib/uuid";
import { UserPicker } from "./user-picker";
import styles from "./ready-for-claude-task-form.module.css";

// Mirrors apps/dashboard-api/src/ready-for-claude-queue/ready-for-claude-queue.dto.ts — kept in
// sync by hand, same approach every sibling form in this app uses. Each of these matches the
// REAL column width, not one shared "short text" cap — the DTO's own doc comment flags exactly
// why: a looser client-side cap than the real column silently turns a valid-looking submit into
// an unhandled 500 at INSERT time (the exact bug Keyword & Entity Library's own code review
// found once).
const PUBLIC_ID_MAX_LENGTH = 64;
const TITLE_MAX_LENGTH = 500;
const VARCHAR_100_MAX_LENGTH = 100;
const VARCHAR_255_MAX_LENGTH = 255;
const LONG_TEXT_MAX_LENGTH = 20_000;
const URL_MAX_LENGTH = 500;
const DEPENDENCIES_MAX_COUNT = 50;

const PRIORITY_VALUES: readonly ReadyForClaudeTaskPriority[] = [
  "low",
  "medium",
  "high",
  "critical",
];
const PRIORITY_LABEL: Readonly<Record<ReadyForClaudeTaskPriority, string>> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

function toTaskOption(task: ReadyForClaudeTask): RelationshipOption {
  return { id: task.id, displayName: task.title };
}

export type ReadyForClaudeTaskFormProps = (
  | { readonly mode: "create" }
  | { readonly mode: "edit"; readonly taskId: string; readonly initial: ReadyForClaudeTask }
) & {
  /** Already sorted alphabetically by display name (`sortModulesForPicker()`) — real backing data
   *  for the `targetModuleKey` field, sourced from `getServerSession()`'s own already-fetched
   *  `session.navigation` rather than a dedicated `GET /authz/module-registry` fetch, matching
   *  `ReviewForm`'s own identical, already-code-reviewed reasoning (that fetch is
   *  `users_roles:view`-gated, held by only 2 of 7 seeded roles). */
  readonly modules: readonly ModuleRegistrySummary[];
  /** Projects to populate the optional `projectId` `<select>` — a task's `projectId` is an
   *  OPTIONAL context field, not an access boundary (D5); this module's RBAC stays
   *  organization-wide regardless of what's selected here. Can be empty if the underlying fetch
   *  failed (`getProjectsForTaskPicker()` degrades rather than throws) — the field just shows
   *  only the "No project" option in that case, same honest-degrade convention every other
   *  enrichment fetch in this app follows. */
  readonly projects: readonly Project[];
  /** Other Ready for Claude tasks, to populate the `dependencies` `RelationshipPicker` — this
   *  task's own id is excluded below (no self-dependency; the backend rejects it too, case-
   *  insensitively). */
  readonly otherTasks: readonly ReadyForClaudeTask[];
};

/**
 * Create/edit form for a Ready for Claude task. No approved wireframe/screen spec exists for this
 * module — sections mirror `createReadyForClaudeTaskSchema`'s own field grouping (Identity,
 * Target, Dependencies, Assignment, Development, Staging, Production, Failure & retry, Schedule),
 * the smallest honest reading of the backend's actual field set, matching every sibling module's
 * own "smallest honest reading" precedent.
 *
 * `publicId` is create-only (shown read-only on edit), matching every sibling form's own
 * precedent. `status` is NEVER a field here — only the dedicated `POST .../:id/status` route
 * (`ReadyForClaudeTaskStatusActions`) may change it. `productionApproval`/
 * `productionApproverUserId` are ALSO never fields here — both are server-managed, stamped only
 * by the `approve`-gated `approved -> completed` transition; shown read-only on the detail page
 * instead. `retryCount` is likewise NOT a form field — no explicit UI requirement names an
 * editable retry counter, and the backend's own roadmap description treats it as part of the
 * failure/retry flow the workflow itself drives, not a value an author hand-edits; shown read-only
 * on the detail page.
 *
 * Every long-text field (`description`/`dashboardReview`/`changesRequestedNotes`/
 * `productionVerification`/`failureReason`) is a PLAIN `<textarea>`, deliberately NOT
 * `RichTextEditor` — this module is an explicit, documented exception to the 2026-08-22 standing
 * rule requiring every new long-text field to use the rich-text editor: the backend DTO stores
 * these fields as unsanitized plain text on purpose (D8), and converting the frontend alone
 * without a paired backend sanitization change (out of scope for this branch) would be dishonest.
 *
 * `targetModuleKey` is a `<select>` sourced from `session.navigation` (a "None" option covers "not
 * about any specific record"); `targetId` is a plain, client-side UUID-format-checked text input,
 * not a picker — mirroring `ReviewForm`'s own identical reasoning (no generic cross-module
 * record-lookup capability exists anywhere in this app). `dependencies` is a real,
 * existence-validated `RelationshipPicker` against this same table, excluding the task's own id.
 * `operatorUserId`/`developerUserId`/`reviewerUserId` are three independent `UserPicker` fields.
 * `prUrl`/`stagingUrl` are validated client-side via `isSafeHttpUrl()` before submit, mirroring
 * every other stored-URL field in this app's own defense-in-depth convention.
 *
 * Submits via `postMutation()` (`credentials: "include"`, required for `dashboard-api`'s
 * `OriginCheckGuard`) — `POST /ready-for-claude-queue/tasks` on create,
 * `PATCH /ready-for-claude-queue/tasks/:id` on edit, matching the controller's own real HTTP-method
 * convention (`case-study-library.controller.ts`'s own `@Patch(":id")` precedent, not the older
 * `POST .../update` convention several earlier modules use).
 */
export function ReadyForClaudeTaskForm(props: ReadyForClaudeTaskFormProps): ReactNode {
  const router = useRouter();
  const initial = props.mode === "edit" ? props.initial : null;

  const [publicId, setPublicId] = useState(initial?.publicId ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [priority, setPriority] = useState<ReadyForClaudeTaskPriority>(
    initial?.priority ?? "medium",
  );
  const [agent, setAgent] = useState(initial?.agent ?? "");
  const [agentVersion, setAgentVersion] = useState(initial?.agentVersion ?? "");
  const [projectId, setProjectId] = useState(initial?.projectId ?? "");
  const [targetModuleKey, setTargetModuleKey] = useState(initial?.targetModuleKey ?? "");
  const [targetId, setTargetId] = useState(initial?.targetId ?? "");
  const [stage, setStage] = useState(initial?.stage ?? "");
  const [dependencies, setDependencies] = useState<readonly string[]>(initial?.dependencies ?? []);
  const [operator, setOperator] = useState<UserSummary | null>(null);
  const [developer, setDeveloper] = useState<UserSummary | null>(null);
  const [reviewer, setReviewer] = useState<UserSummary | null>(null);
  const [featureBranch, setFeatureBranch] = useState(initial?.featureBranch ?? "");
  const [sourceCommit, setSourceCommit] = useState(initial?.sourceCommit ?? "");
  const [prId, setPrId] = useState(initial?.prId ?? "");
  const [prUrl, setPrUrl] = useState(initial?.prUrl ?? "");
  const [prStatus, setPrStatus] = useState(initial?.prStatus ?? "");
  const [codeReviewResult, setCodeReviewResult] = useState(initial?.codeReviewResult ?? "");
  const [stagingCommit, setStagingCommit] = useState(initial?.stagingCommit ?? "");
  const [stagingDeployment, setStagingDeployment] = useState(initial?.stagingDeployment ?? "");
  const [stagingUrl, setStagingUrl] = useState(initial?.stagingUrl ?? "");
  const [dashboardReview, setDashboardReview] = useState(initial?.dashboardReview ?? "");
  const [changesRequestedNotes, setChangesRequestedNotes] = useState(
    initial?.changesRequestedNotes ?? "",
  );
  const [productionCommit, setProductionCommit] = useState(initial?.productionCommit ?? "");
  const [productionDeployment, setProductionDeployment] = useState(
    initial?.productionDeployment ?? "",
  );
  const [productionVerification, setProductionVerification] = useState(
    initial?.productionVerification ?? "",
  );
  const [rollbackVersion, setRollbackVersion] = useState(initial?.rollbackVersion ?? "");
  const [failureReason, setFailureReason] = useState(initial?.failureReason ?? "");
  const [dueDate, setDueDate] = useState(initial?.dueDate ? initial.dueDate.slice(0, 10) : "");
  const [auditReference, setAuditReference] = useState(initial?.auditReference ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [dependencyQuery, setDependencyQuery] = useState("");
  const otherTasksById = useMemo(
    () => new Map(props.otherTasks.map((task) => [task.id, task])),
    [props.otherTasks],
  );
  const selfId = props.mode === "edit" ? props.taskId : null;
  const dependencyOptions = useMemo(() => {
    const lowerQuery = dependencyQuery.trim().toLowerCase();
    return props.otherTasks
      .filter(
        (task) =>
          task.id !== selfId &&
          !dependencies.includes(task.id) &&
          (lowerQuery === "" || task.title.toLowerCase().includes(lowerQuery)),
      )
      .map(toTaskOption)
      .slice(0, 20);
  }, [props.otherTasks, selfId, dependencies, dependencyQuery]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);

    const trimmedTitle = title.trim();
    const trimmedPrUrl = prUrl.trim();
    const trimmedStagingUrl = stagingUrl.trim();
    if (trimmedPrUrl !== "" && !isSafeHttpUrl(trimmedPrUrl)) {
      setError("PR URL must be a valid http:// or https:// URL.");
      return;
    }
    if (trimmedStagingUrl !== "" && !isSafeHttpUrl(trimmedStagingUrl)) {
      setError("Staging URL must be a valid http:// or https:// URL.");
      return;
    }
    const trimmedTargetId = targetId.trim();
    if (trimmedTargetId !== "" && !isUuid(trimmedTargetId)) {
      setError("Target ID must be a valid UUID.");
      return;
    }

    setSubmitting(true);
    try {
      // Omitted entirely (create) or sent as an explicit null (edit) when empty — an omitted key
      // leaves the field unchanged on update, matching updateReadyForClaudeTaskSchema's own
      // nullish contract; an explicit null is what actually clears an existing value back to
      // "none". Matches PersonaLibraryForm's/ComponentLibraryForm's own identical `textField()`
      // helper.
      function textField(value: string): string | null | undefined {
        const trimmed = value.trim();
        if (trimmed !== "") return trimmed;
        return props.mode === "create" ? undefined : null;
      }

      function dateField(value: string): string | null | undefined {
        const trimmed = value.trim();
        if (trimmed === "") return props.mode === "create" ? undefined : null;
        // <input type="date"> yields "YYYY-MM-DD" — the backend expects a full ISO datetime
        // (`z.string().datetime()`), so this is normalized to midnight UTC on that date.
        return new Date(`${trimmed}T00:00:00.000Z`).toISOString();
      }

      const sharedFields = {
        title: trimmedTitle,
        description: textField(description),
        priority,
        agent: textField(agent),
        agentVersion: textField(agentVersion),
        targetModuleKey:
          targetModuleKey.trim() === ""
            ? props.mode === "create"
              ? undefined
              : null
            : targetModuleKey,
        targetId:
          trimmedTargetId === "" ? (props.mode === "create" ? undefined : null) : trimmedTargetId,
        stage: textField(stage),
        dependencies:
          dependencies.length > 0 ? dependencies : props.mode === "create" ? undefined : [],
        operatorUserId: operator ? operator.id : props.mode === "create" ? undefined : null,
        developerUserId: developer ? developer.id : props.mode === "create" ? undefined : null,
        featureBranch: textField(featureBranch),
        sourceCommit: textField(sourceCommit),
        prId: textField(prId),
        prUrl: trimmedPrUrl === "" ? (props.mode === "create" ? undefined : null) : trimmedPrUrl,
        prStatus: textField(prStatus),
        reviewerUserId: reviewer ? reviewer.id : props.mode === "create" ? undefined : null,
        codeReviewResult: textField(codeReviewResult),
        stagingCommit: textField(stagingCommit),
        stagingDeployment: textField(stagingDeployment),
        stagingUrl:
          trimmedStagingUrl === ""
            ? props.mode === "create"
              ? undefined
              : null
            : trimmedStagingUrl,
        dashboardReview: textField(dashboardReview),
        changesRequestedNotes: textField(changesRequestedNotes),
        productionCommit: textField(productionCommit),
        productionDeployment: textField(productionDeployment),
        productionVerification: textField(productionVerification),
        rollbackVersion: textField(rollbackVersion),
        failureReason: textField(failureReason),
        dueDate: dateField(dueDate),
        auditReference: textField(auditReference),
      };

      const payload =
        props.mode === "create"
          ? {
              ...sharedFields,
              publicId: publicId.trim(),
              projectId: projectId.trim() === "" ? undefined : projectId,
            }
          : sharedFields;

      const url =
        props.mode === "create"
          ? `${getApiBaseUrl()}/ready-for-claude-queue/tasks`
          : `${getApiBaseUrl()}/ready-for-claude-queue/tasks/${props.taskId}`;

      const result = await postMutation<ReadyForClaudeTask>(url, payload, {
        method: props.mode === "create" ? "POST" : "PATCH",
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      const taskId = props.mode === "create" ? result.data?.id : props.taskId;
      if (!taskId) {
        setError("The task was saved, but its details couldn't be loaded. Please check the list.");
        return;
      }
      router.push(`/ready-for-claude-queue/${taskId}`);
    } catch (err) {
      console.error("Failed to save Ready for Claude task", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Identity</legend>

        {props.mode === "create" ? (
          <div className={styles.field}>
            <label htmlFor="publicId" className={styles.label}>
              Public ID
            </label>
            <input
              id="publicId"
              type="text"
              required
              maxLength={PUBLIC_ID_MAX_LENGTH}
              value={publicId}
              onChange={(event) => setPublicId(event.target.value)}
              className={styles.input}
            />
            <span className={styles.helperText}>
              A stable, human-readable identifier — never regenerated once assigned.
            </span>
          </div>
        ) : (
          <div className={styles.field}>
            <span className={styles.label}>Public ID</span>
            <span className={styles.readonlyValue}>{props.initial.publicId}</span>
          </div>
        )}

        <div className={styles.field}>
          <label htmlFor="title" className={styles.label}>
            Title
          </label>
          <input
            id="title"
            type="text"
            required
            maxLength={TITLE_MAX_LENGTH}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="description" className={styles.label}>
            Description
          </label>
          <textarea
            id="description"
            maxLength={LONG_TEXT_MAX_LENGTH}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className={styles.textarea}
            rows={4}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="priority" className={styles.label}>
            Priority
          </label>
          <select
            id="priority"
            value={priority}
            onChange={(event) => setPriority(event.target.value as ReadyForClaudeTaskPriority)}
            className={styles.select}
          >
            {PRIORITY_VALUES.map((value) => (
              <option key={value} value={value}>
                {PRIORITY_LABEL[value]}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="agent" className={styles.label}>
            Agent
          </label>
          <input
            id="agent"
            type="text"
            maxLength={VARCHAR_255_MAX_LENGTH}
            value={agent}
            onChange={(event) => setAgent(event.target.value)}
            className={styles.input}
          />
          <span className={styles.helperText}>
            Plain, unvalidated text — no Agent Directory or Agent Specification Library exists yet
            to validate against.
          </span>
        </div>

        <div className={styles.field}>
          <label htmlFor="agentVersion" className={styles.label}>
            Agent version
          </label>
          <input
            id="agentVersion"
            type="text"
            maxLength={VARCHAR_100_MAX_LENGTH}
            value={agentVersion}
            onChange={(event) => setAgentVersion(event.target.value)}
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="projectId" className={styles.label}>
            Project
          </label>
          <select
            id="projectId"
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
            className={styles.select}
          >
            <option value="">No project</option>
            {props.projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <span className={styles.helperText}>
            Optional context field — this module&apos;s RBAC is organization-wide either way.
          </span>
        </div>

        <div className={styles.field}>
          <label htmlFor="stage" className={styles.label}>
            Stage
          </label>
          <input
            id="stage"
            type="text"
            maxLength={VARCHAR_255_MAX_LENGTH}
            value={stage}
            onChange={(event) => setStage(event.target.value)}
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="dueDate" className={styles.label}>
            Due date
          </label>
          <input
            id="dueDate"
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="auditReference" className={styles.label}>
            Audit reference
          </label>
          <input
            id="auditReference"
            type="text"
            maxLength={VARCHAR_255_MAX_LENGTH}
            value={auditReference}
            onChange={(event) => setAuditReference(event.target.value)}
            className={styles.input}
          />
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Target record</legend>

        <div className={styles.field}>
          <label htmlFor="targetModuleKey" className={styles.label}>
            Target module
          </label>
          <select
            id="targetModuleKey"
            value={targetModuleKey}
            onChange={(event) => setTargetModuleKey(event.target.value)}
            className={styles.select}
          >
            <option value="">Not about a specific record</option>
            {props.modules.map((module) => (
              <option key={module.key} value={module.key}>
                {moduleDisplayName(module)}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="targetId" className={styles.label}>
            Target ID
          </label>
          <input
            id="targetId"
            type="text"
            value={targetId}
            onChange={(event) => setTargetId(event.target.value)}
            className={styles.input}
            placeholder="00000000-0000-0000-0000-000000000000"
          />
          <span className={styles.helperText}>
            Optional. The target record&apos;s own id — no lookup exists yet for this module, so
            this must be entered directly.
          </span>
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Dependencies</legend>

        <RelationshipPicker
          label="Blocked by"
          query={dependencyQuery}
          onQueryChange={setDependencyQuery}
          options={dependencyOptions}
          selected={dependencies.map((id) => {
            const task = otherTasksById.get(id);
            return { id, displayName: task ? task.title : id };
          })}
          onSelect={(option) => {
            if (dependencies.length >= DEPENDENCIES_MAX_COUNT) return;
            setDependencies([...dependencies, option.id]);
          }}
          onRemove={(id) => setDependencies(dependencies.filter((existing) => existing !== id))}
          hint="Other Ready for Claude tasks that must complete before this one may move to In Progress."
        />
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Assignment</legend>
        <UserPicker
          id="operatorUserId"
          label="Operator"
          value={operator}
          onChange={setOperator}
          helperText="Optional."
        />
        <UserPicker
          id="developerUserId"
          label="Developer"
          value={developer}
          onChange={setDeveloper}
          helperText="Optional."
        />
        <UserPicker
          id="reviewerUserId"
          label="Reviewer"
          value={reviewer}
          onChange={setReviewer}
          helperText="Optional."
        />
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Development</legend>

        <div className={styles.field}>
          <label htmlFor="featureBranch" className={styles.label}>
            Feature branch
          </label>
          <input
            id="featureBranch"
            type="text"
            maxLength={VARCHAR_255_MAX_LENGTH}
            value={featureBranch}
            onChange={(event) => setFeatureBranch(event.target.value)}
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="sourceCommit" className={styles.label}>
            Source commit
          </label>
          <input
            id="sourceCommit"
            type="text"
            maxLength={VARCHAR_100_MAX_LENGTH}
            value={sourceCommit}
            onChange={(event) => setSourceCommit(event.target.value)}
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="prId" className={styles.label}>
            PR ID
          </label>
          <input
            id="prId"
            type="text"
            maxLength={VARCHAR_100_MAX_LENGTH}
            value={prId}
            onChange={(event) => setPrId(event.target.value)}
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="prUrl" className={styles.label}>
            PR URL
          </label>
          <input
            id="prUrl"
            type="url"
            maxLength={URL_MAX_LENGTH}
            value={prUrl}
            onChange={(event) => setPrUrl(event.target.value)}
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="prStatus" className={styles.label}>
            PR status
          </label>
          <input
            id="prStatus"
            type="text"
            maxLength={VARCHAR_100_MAX_LENGTH}
            value={prStatus}
            onChange={(event) => setPrStatus(event.target.value)}
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="codeReviewResult" className={styles.label}>
            Code review result
          </label>
          <input
            id="codeReviewResult"
            type="text"
            maxLength={VARCHAR_100_MAX_LENGTH}
            value={codeReviewResult}
            onChange={(event) => setCodeReviewResult(event.target.value)}
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="dashboardReview" className={styles.label}>
            Dashboard review
          </label>
          <textarea
            id="dashboardReview"
            maxLength={LONG_TEXT_MAX_LENGTH}
            value={dashboardReview}
            onChange={(event) => setDashboardReview(event.target.value)}
            className={styles.textarea}
            rows={3}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="changesRequestedNotes" className={styles.label}>
            Changes requested notes
          </label>
          <textarea
            id="changesRequestedNotes"
            maxLength={LONG_TEXT_MAX_LENGTH}
            value={changesRequestedNotes}
            onChange={(event) => setChangesRequestedNotes(event.target.value)}
            className={styles.textarea}
            rows={3}
          />
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Staging</legend>

        <div className={styles.field}>
          <label htmlFor="stagingCommit" className={styles.label}>
            Staging commit
          </label>
          <input
            id="stagingCommit"
            type="text"
            maxLength={VARCHAR_100_MAX_LENGTH}
            value={stagingCommit}
            onChange={(event) => setStagingCommit(event.target.value)}
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="stagingDeployment" className={styles.label}>
            Staging deployment
          </label>
          <input
            id="stagingDeployment"
            type="text"
            maxLength={VARCHAR_255_MAX_LENGTH}
            value={stagingDeployment}
            onChange={(event) => setStagingDeployment(event.target.value)}
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="stagingUrl" className={styles.label}>
            Staging URL
          </label>
          <input
            id="stagingUrl"
            type="url"
            maxLength={URL_MAX_LENGTH}
            value={stagingUrl}
            onChange={(event) => setStagingUrl(event.target.value)}
            className={styles.input}
          />
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Production</legend>

        <div className={styles.field}>
          <label htmlFor="productionCommit" className={styles.label}>
            Production commit
          </label>
          <input
            id="productionCommit"
            type="text"
            maxLength={VARCHAR_100_MAX_LENGTH}
            value={productionCommit}
            onChange={(event) => setProductionCommit(event.target.value)}
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="productionDeployment" className={styles.label}>
            Production deployment
          </label>
          <input
            id="productionDeployment"
            type="text"
            maxLength={VARCHAR_255_MAX_LENGTH}
            value={productionDeployment}
            onChange={(event) => setProductionDeployment(event.target.value)}
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="productionVerification" className={styles.label}>
            Production verification
          </label>
          <textarea
            id="productionVerification"
            maxLength={LONG_TEXT_MAX_LENGTH}
            value={productionVerification}
            onChange={(event) => setProductionVerification(event.target.value)}
            className={styles.textarea}
            rows={3}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="rollbackVersion" className={styles.label}>
            Rollback version
          </label>
          <input
            id="rollbackVersion"
            type="text"
            maxLength={VARCHAR_100_MAX_LENGTH}
            value={rollbackVersion}
            onChange={(event) => setRollbackVersion(event.target.value)}
            className={styles.input}
          />
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Failure</legend>

        <div className={styles.field}>
          <label htmlFor="failureReason" className={styles.label}>
            Failure reason
          </label>
          <textarea
            id="failureReason"
            maxLength={LONG_TEXT_MAX_LENGTH}
            value={failureReason}
            onChange={(event) => setFailureReason(event.target.value)}
            className={styles.textarea}
            rows={3}
          />
        </div>
      </fieldset>

      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}

      <div className={styles.actions}>
        <button type="submit" disabled={submitting} className={styles.submitButton}>
          {submitting ? "Saving…" : props.mode === "create" ? "Create task" : "Save changes"}
        </button>
        <a href="/ready-for-claude-queue" className={styles.cancelLink}>
          Cancel
        </a>
      </div>
    </form>
  );
}
