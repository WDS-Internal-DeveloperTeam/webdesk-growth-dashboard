import type { Provider } from "@nestjs/common";
import { MotionInteractionRecordRepository } from "@webdesk/database";
import { MOTION_INTERACTION_RECORD_REPOSITORY } from "./motion-and-interaction-library.constants.js";

/** DI wiring — same `useFactory` pattern as
 *  ../section-and-pattern-library/database.providers.ts /
 *  ../page-template-library/database.providers.ts. */
export const motionAndInteractionLibraryRepositoryProviders: Provider[] = [
  {
    provide: MOTION_INTERACTION_RECORD_REPOSITORY,
    useFactory: () => new MotionInteractionRecordRepository(),
  },
];
