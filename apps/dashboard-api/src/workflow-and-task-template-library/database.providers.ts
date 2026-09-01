import type { Provider } from "@nestjs/common";
import { WorkflowTaskTemplateRepository } from "@webdesk/database";
import { WORKFLOW_TASK_TEMPLATE_REPOSITORY } from "./workflow-and-task-template-library.constants.js";

/** DI wiring — same `useFactory` pattern as ../brand-library/database.providers.ts. */
export const workflowTaskTemplateRepositoryProviders: Provider[] = [
  {
    provide: WORKFLOW_TASK_TEMPLATE_REPOSITORY,
    useFactory: () => new WorkflowTaskTemplateRepository(),
  },
];
