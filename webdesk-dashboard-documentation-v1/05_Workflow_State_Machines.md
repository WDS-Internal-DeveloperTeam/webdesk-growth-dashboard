# Workflow State Machines

## 1. General rules

- Transitions are allowlisted.
- Permission is checked by the backend.
- Required evidence and approvals are checked before transition.
- Every transition creates an audit event.
- Rejection and revision require a reason.
- Approved versions are immutable.
- Emergency overrides require elevated permission, reason, and audit record.

## 2. Generic artifact lifecycle

```text
Draft
→ Submitted
→ Under Review
→ Approved
→ Superseded / Archived

Under Review
→ Revision Requested
→ Draft

Under Review
→ Rejected
```

**Submitter:** creator/editor  
**Reviewer:** assigned approver  
**Recorded:** previous state, new state, artifact version, actor, timestamp, reason, comments.

## 3. Page lifecycle

```text
Proposed
→ Approved for Planning
→ In Strategy
→ Search Approved
→ Content Approved
→ Design Approved
→ Ready for Development
→ In Development
→ Code Review
→ Security/QA
→ Ready for Staging
→ Staging Deployed
→ Staging Approved
→ Production Approved
→ Production Deployed
→ Verified
```

Alternative states:

- Revision Requested
- Blocked
- Paused
- Failed
- Rolled Back
- Archived

## 4. Ready for Claude task

```text
Draft
→ Ready for Claude
→ Claimed
→ In Progress
→ Awaiting Review
→ Approved
→ Completed
```

Other transitions:

- `In Progress → Failed`
- `Awaiting Review → Changes Requested → Ready for Claude`
- `Draft/Ready/Claimed → Cancelled`
- `In Progress → Paused`

Completion requires remote commit verification when the task changes Git artifacts.

## 5. Case study workflow

```text
Draft
→ Information Required
→ Fact Check
→ Awaiting Internal Approval
→ Approved
→ Scheduled
→ Published
→ Unpublished
→ Archived
```

Client approval may be inserted before `Approved` when visibility is `Client Approval Required`.

Publication blockers:

- missing consent;
- unverified claim;
- restricted asset;
- active embargo;
- unresolved confidentiality issue.

## 6. Portfolio workflow

```text
Draft
→ Under Review
→ Approved
→ Scheduled
→ Published
→ Unpublished
→ Archived
```

## 7. Scan workflow

```text
Scheduled / Requested
→ Queued
→ Running
→ Completed / Partially Completed
```

Failure states:

- Failed
- Timed Out
- Cancelled

Scan results never modify approved records directly.

## 8. Change Center workflow

```text
Detected
→ Under Review
→ Accepted / Rejected / Deferred / Manual Merge Required
→ Applying
→ Applied
→ Verified
```

Failed application becomes `Apply Failed` and records rollback guidance.

## 9. Import workflow

```text
Uploaded
→ Validating
→ Dry Run Complete
→ Ready for Approval
→ Applying
→ Applied / Partially Applied
```

Failure states:

- Validation Failed
- Apply Failed
- Cancelled
- Rolled Back where supported

Rollback limitations must be shown before approval.

## 10. Release workflow

```text
Proposed
→ Checks Running
→ Ready for Staging
→ Staging Deployed
→ Staging Verification
→ Staging Approved
→ Production Approval
→ Production Deployed
→ Production Verification
→ Completed
```

Failure/exception states:

- Checks Failed
- Deployment Failed
- Verification Failed
- Hotfix Required
- Rolled Back

## 11. Security finding workflow

```text
Open
→ Triaged
→ Assigned
→ In Remediation
→ Ready for Verification
→ Verified Closed
```

Other states:

- False Positive
- Accepted Risk
- Deferred with Expiry

Critical unresolved findings block production unless an authorized exception is documented.

## 12. Approval record requirements

Every approval stores:

- approval ID;
- entity and exact version;
- approval type;
- approver;
- decision;
- decision timestamp;
- comments;
- conditions;
- related audit event;
- Git commit SHA where applicable.
