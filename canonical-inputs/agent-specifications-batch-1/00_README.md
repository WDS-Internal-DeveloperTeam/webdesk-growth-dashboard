# WebDesk Agent Specification Pack — Batch 1

**Version:** 1.0 Draft  
**Batch:** System Control and Foundation  
**Project:** WebDesk Website Growth & Delivery System  
**Operating model:** Manual Claude Code execution with dashboard-controlled tasks and human approvals

## Included agents

1. Website Growth Director
2. Site Intelligence & Inventory Agent
3. Dashboard Application Engineering Agent
4. Release & Memory Coordinator

Each agent specification uses the approved 19-part structure:

1. Agent name
2. Mission
3. Business purpose
4. Responsibilities
5. Decisions it owns
6. Decisions it does not own
7. Required inputs
8. Knowledge library
9. Tools and permissions
10. Workflow
11. Output files
12. Quality checklist
13. Approval gates
14. Forbidden actions
15. Escalation rules
16. Memory read/write responsibilities
17. Dashboard interface
18. Test scenarios
19. Version and review schedule

## Shared operating rules

These rules apply to all Batch 1 agents unless a stricter rule appears in the agent specification.

### Version 1 execution model

- Agents are governed Claude roles, not autonomous dashboard users.
- The dashboard does not call Claude automatically.
- A human creates or approves a task and marks it **Ready for Claude**.
- An authorized operator invokes Claude Code from an approved development environment.
- The agent performs only the authorized stage and produces only the expected outputs.
- The agent stops at the next human approval gate.

### Source-of-truth order

When sources conflict, agents use this order unless a task explicitly provides an approved exception:

1. Current repository implementation
2. Production website
3. Approved page-state and system-state records
4. Approved component, design, service, proof, and knowledge registries
5. Approved strategy documents
6. Approved roadmap
7. Draft or advisory records
8. Conversation context

The roadmap is intent, not evidence that work exists or is deployed.

### Approval and version rules

- Approval applies to an exact artifact version.
- Approved artifacts are immutable.
- Editing an approved artifact creates a new draft version.
- Rejection, revision, exception, and override decisions require a reason.
- Agents may recommend; only authorized humans approve, publish, merge, release, or accept risk.

### Git completion rule

A Git-changing task is not complete until:

- expected files exist;
- required checks pass;
- state and handoff records are updated where required;
- changes are committed and pushed;
- the remote commit SHA is verified;
- the dashboard records the remote SHA and task result.

No agent may merge a protected branch or deploy production automatically.

### Confidentiality

- Access is deny-by-default.
- Confidential or restricted data is supplied only when the authorized task requires it.
- Agents must not copy restricted data into a general task, shared Git artifact, log, or public output.
- Pricing and confidential commercial information remain outside general developer and agent context unless an owner-authorized task explicitly includes them.

### Common escalation categories

Agents must escalate rather than guess when they encounter:

- conflicting approved sources;
- missing mandatory evidence;
- requests outside the authorized stage;
- security or confidentiality concerns;
- production changes without approval;
- repository or dashboard state disagreement;
- facts that cannot be verified;
- unsupported claims or metrics;
- required access that is not granted.

## Batch 1 dependency map

```text
Site Intelligence & Inventory Agent
        │ factual inventory, scans, discrepancies
        ▼
Website Growth Director
        │ approved strategic recommendations and priorities
        ▼
Task templates, roadmap proposals, page workflows

Dashboard Application Engineering Agent
        │ implements the approved dashboard system
        ▼
Code Review / Security / QA agents in later batches

Release & Memory Coordinator
        │ validates artifacts, handoff, state, remote SHA, and release records
        └──────────────────────── applies across every agent and stage
```

## Document status

These specifications are **Draft 1.0**. They are ready for leadership and developer review. They should not be treated as active production agent definitions until approved and entered into the Agent Specification Library.
