# Low-Fidelity Dashboard Wireframes

These wireframes describe information architecture, not visual style.

## 1. Dashboard Home

```text
+--------------------------------------------------------------------------------+
| Logo | Project Switcher | Search | Notifications | User                         |
+----------------------+---------------------------------------------------------+
| Navigation           | Project Health                                           |
| Home                 | [Pages] [Approvals] [Ready for Claude] [Blockers]         |
| Projects             |                                                          |
| Pages                | My Work                                                   |
| Libraries            | - Review homepage content                                |
| Workflow             | - Run page scan                                           |
| Scans                | - Verify staging release                                  |
| Technical            |                                                          |
| Releases             | Critical Findings          Git/Release Status             |
| Help                 | [finding list]            [commit/deployment summary]     |
| Settings             |                                                          |
+----------------------+---------------------------------------------------------+
```

## 2. Page Inventory

```text
+--------------------------------------------------------------------------------+
| Page Inventory | + New Page | Scan Website | Import | Export                    |
+--------------------------------------------------------------------------------+
| Filters: Type | Existing/New | Stage | Index | Template | Owner | Last Scan      |
+--------------------------------------------------------------------------------+
| ID | Page | URL | Type | Stage | Keyword | Template | Scan | Release | Actions   |
| ...                                                                            |
+--------------------------------------------------------------------------------+
| Pagination | Saved Views                                                        |
+--------------------------------------------------------------------------------+
```

## 3. Page Workspace

```text
+--------------------------------------------------------------------------------+
| Page: AI Voice Agent Development | Status | Owner | Latest Commit | Actions      |
+--------------------------------------------------------------------------------+
| Overview | Audit | Structure | Search | Content | Design | Build | Review | QA ...|
+--------------------------------------------------------------------------------+
| Left: current artifact/version                                                 |
| Main: rendered Markdown/form/report                                            |
| Right: status, reviewer, comments, approval, related records                   |
+--------------------------------------------------------------------------------+
| Compare Version | Request Revision | Approve | Mark Ready for Next Stage        |
+--------------------------------------------------------------------------------+
```

## 4. Case Study Studio

```text
+--------------------------------------------------------------------------------+
| New Case Study | Save Draft | Submit | Ready for Claude                          |
+--------------------------------------------------------------------------------+
| Progress: Intake > Sources > Missing Info > Draft > Fact Check > Approval        |
+--------------------------------------------------------------------------------+
| Client/project | service | industry | platform | visibility | embargo            |
| Challenge | solution | implementation | results                                 |
| Claims and sources table                                                        |
| Assets and licence table                                                        |
| Consent evidence                                                                |
+--------------------------------------------------------------------------------+
| Completeness warnings | Assigned reviewer | Activity                            |
+--------------------------------------------------------------------------------+
```

## 5. Design and Component Library

```text
+--------------------------------------------------------------------------------+
| Components | Tokens | Patterns | Templates | Wireframes | Motion                 |
+--------------------------------------------------------------------------------+
| Search | Category | Status | Used by Page | Last Reviewed                        |
+--------------------------------------------------------------------------------+
| Card Grid/List: screenshot, name, version, status, code path, usage count         |
+--------------------------------------------------------------------------------+
| Detail drawer: states, tokens, accessibility, responsive behavior, tests         |
+--------------------------------------------------------------------------------+
```

## 6. Ready for Claude Queue

```text
+--------------------------------------------------------------------------------+
| Ready for Claude | Filters: Agent | Stage | Priority | Assignee | Status          |
+--------------------------------------------------------------------------------+
| Task | Record | Agent | Branch | Dependencies | Due | Status | Operator           |
+--------------------------------------------------------------------------------+
| Detail: instructions, allowed files, required inputs, expected outputs, limits   |
| Git: source SHA, feature branch, PR, review, staging, production                  |
| Activity and retries                                                             |
+--------------------------------------------------------------------------------+
```

## 7. Review and Approval Center

```text
+--------------------------------------------------------------------------------+
| My Reviews | Team Reviews | Overdue | Completed                                  |
+--------------------------------------------------------------------------------+
| Artifact | Type | Version | Submitter | Due | Risk | Status                       |
+--------------------------------------------------------------------------------+
| Compare old/new | comments | checklist | Approve | Revision | Reject              |
+--------------------------------------------------------------------------------+
```

## 8. Scan Center

```text
+--------------------------------------------------------------------------------+
| Scan Center | Full Website Scan | Selected Page | Schedule                        |
+--------------------------------------------------------------------------------+
| Scan Type | Environment | Last Run | Next Run | Status | Findings                  |
+--------------------------------------------------------------------------------+
| Run Detail: progress, steps, evidence, errors, retry, resulting change set        |
+--------------------------------------------------------------------------------+
```

## 9. Change Center

```text
+--------------------------------------------------------------------------------+
| Change Center | Source | Category | Severity | Status                             |
+--------------------------------------------------------------------------------+
| Record | Before | After | Confidence | Recommendation | Decision                  |
+--------------------------------------------------------------------------------+
| Accept | Reject | Merge Manually | Defer | Assign | Apply | Verify                 |
+--------------------------------------------------------------------------------+
```

## 10. Release Center

```text
+--------------------------------------------------------------------------------+
| Release REL-... | Type | Environment | Status | Approver                          |
+--------------------------------------------------------------------------------+
| Dashboard SHA | WordPress SHA | PRs | Checks | Staging URL                        |
| Staging approval | Production approval | Deployment log | Smoke tests             |
+--------------------------------------------------------------------------------+
| Deploy | Verify | Roll Back | Create Hotfix                                      |
+--------------------------------------------------------------------------------+
```

## 11. Users and Operational Contacts

```text
+--------------------------------------------------------------------------------+
| Users | Roles | Operational Areas | Escalation Policies                           |
+--------------------------------------------------------------------------------+
| Area: WordPress                                                                |
| Primary owner | Backup owners | Multiple emails | Phones | Hours | Escalation     |
+--------------------------------------------------------------------------------+
| Add Contact | Reorder Escalation | Test Notification | View History               |
+--------------------------------------------------------------------------------+
```
