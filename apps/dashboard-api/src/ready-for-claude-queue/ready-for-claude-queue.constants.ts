/** NestJS DI token for the Ready for Claude Queue module — same pattern as
 *  ../internal-linking-library/internal-linking-library.constants.ts /
 *  ../review-and-approval-center/review-and-approval-center.constants.ts. */
export const READY_FOR_CLAUDE_TASK_REPOSITORY = Symbol("READY_FOR_CLAUDE_TASK_REPOSITORY");

/** The RBAC group key (`06_Roles_and_Permissions.md`, `00013-seed-rbac-matrix.ts:198-206`) —
 *  distinct from `module_registry.key = "ready_for_claude_queue"`. Declared once here, not
 *  independently in both the service and the controller, so a future RBAC-key rename can't
 *  silently diverge between the two files (the exact duplication Internal Linking Library's own
 *  code review already found and fixed once).
 *
 *  The real seeded grants for this group:
 *    super_admin                VCERAM  (view, create, edit, review, approve, configure)
 *    owner_growth_approver      VCERAM  (view, create, edit, review, approve, configure)
 *    marketing_editor           VCSE    (view, create, submit, edit)
 *    designer_creative_reviewer VCSE
 *    developer                  VCSE
 *    qa_security_reviewer       VCSE
 *    read_only                  V
 *
 *  Note the real, seeded asymmetry, recorded as-seeded rather than worked around (matching Review
 *  and Approval Center's own handling of the analogous oddity in its own row): NO role holds both
 *  `submit` AND `approve` — `super_admin`/`owner_growth_approver` have no `submit` grant, so they
 *  cannot themselves perform the `submit`-gated transitions (`draft -> ready_for_claude`,
 *  `in_progress -> awaiting_review`, `changes_requested -> ready_for_claude`), while the four
 *  mid-tier roles cannot review/approve. Driving one task through its full lifecycle therefore
 *  genuinely requires two different actors — a real separation of duties this module inherits from
 *  the approved matrix, not a bug in the transition table. */
export const READY_FOR_CLAUDE_QUEUE_MODULE_KEY = "ready_for_claude";
