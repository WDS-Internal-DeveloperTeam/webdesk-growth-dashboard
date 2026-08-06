# Acceptance Criteria and Test Plan

## 1. System-wide acceptance

- All protected routes require authentication.
- Backend enforces deny-by-default permissions.
- Production and Preview/Development data are isolated.
- All approvals reference an exact version.
- All production releases record commit SHAs and approvers.
- Background jobs are idempotent and retry-safe.
- Audit events exist for privileged actions.
- Retention jobs respect legal holds.
- Help documentation exists for released modules.

## 2. Authentication tests

- Google Workspace SSO succeeds for allowed domains.
- Non-allowed domain is rejected.
- SSO MFA policy is enforced through Workspace.
- Local emergency admin requires TOTP.
- Recovery requires second-admin approval.
- Session expires no later than seven days.
- Account lockout and rate limiting work.

## 3. Permission tests

- A read-only user cannot mutate records.
- A developer cannot approve their own code review.
- A marketing user cannot release production.
- Confidential fields are excluded from API responses without permission.
- Export excludes confidential fields unless separately authorized.

## 4. Page workflow tests

- Existing and new page workflows enforce stage order.
- Required approval blocks next stage.
- Revision creates a new draft version.
- Roadmap status does not mark a page deployed.
- Production verification updates release evidence, not roadmap intent.

## 5. Ready for Claude tests

- Task package contains only authorized stage and permitted files.
- Dependency blockers prevent Ready status.
- Completion requires expected output and remote commit verification where applicable.
- Retry and failure history is retained.
- Task cannot merge protected branches automatically.

## 6. Import tests

- Correct template version imports successfully.
- Wrong version is rejected or mapped explicitly.
- Dry run shows row-level errors.
- Duplicate policy is applied.
- Re-upload with same idempotency key does not duplicate.
- Partial success is clearly reported.
- Rollback limitations are shown before apply.

## 7. Scan and Change Center tests

- Manual and scheduled scans create job records.
- Scan failure does not overwrite approved data.
- Findings create change items.
- Accept/reject/defer decisions are audited.
- Applied changes require verification.

## 8. File tests

- allowed types and sizes succeed;
- blocked types fail;
- MIME mismatch fails;
- large files use direct Blob upload;
- time-limited download requires authentication;
- `Scan Not Configured` is displayed honestly;
- deleted files follow retention and legal-hold rules.

## 9. GitHub tests

- webhook signature validation;
- duplicate webhook ignored safely;
- commit verification succeeds/fails correctly;
- PR status updates dashboard;
- release manifest records exact SHAs;
- protected branch policy is respected.

## 10. WordPress tests

- least-privilege REST account reads approved data;
- draft creation/update works only when authorized;
- production WP-CLI blocks disallowed commands;
- approved migration preserves IDs, URLs, terms, media, and metadata;
- Case Study flat URLs remain valid;
- Portfolio URLs remain valid;
- old plugins can be retired only after staging verification.

## 11. Release tests

- staging checks and approvals are required;
- production uses exact approved commit;
- smoke tests record results;
- failed verification blocks completion;
- rollback records rolled-back SHA and reason;
- hotfix flow preserves approvals and audit.

## 12. Backup and retention tests

- daily backup record created;
- checksum verification stored;
- quarterly restore test completes on staging;
- retention job deletes eligible records;
- legal-held records are skipped;
- deletion run audit is retained;
- production data is not copied to Preview/Development.

## 13. Accessibility and UI tests

- keyboard navigation;
- visible focus;
- semantic landmarks;
- accessible names;
- color contrast;
- form errors and announcements;
- responsive tables and dialogs;
- no essential action depends only on color.

## 14. Performance tests

- paginated libraries avoid loading all rows;
- large scans/imports are asynchronous;
- dashboard remains responsive during background jobs;
- search uses indexes;
- Blob previews are optimized;
- API latency and error rates are monitored.

## 15. Production launch checklist

- all P0 modules accepted;
- operational contacts configured with multiple emails;
- SMTP tested;
- GitHub App installed;
- WordPress credentials verified;
- backups and restore test complete;
- retention job enabled;
- audit export verified;
- no unresolved critical security issue;
- Help Center published;
- production release and rollback rehearsal complete.
