import type { Provider } from "@nestjs/common";
import { ReadyForClaudeTaskRepository } from "@webdesk/database";
import { READY_FOR_CLAUDE_TASK_REPOSITORY } from "./ready-for-claude-queue.constants.js";

/** DI wiring — same `useFactory` pattern as ../internal-linking-library/database.providers.ts. */
export const readyForClaudeQueueRepositoryProviders: Provider[] = [
  {
    provide: READY_FOR_CLAUDE_TASK_REPOSITORY,
    useFactory: () => new ReadyForClaudeTaskRepository(),
  },
];
