# Team Workspace Customization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the P1 internal Team Workspace customization loop so identity, policy, Skill routing, workflow persistence, audit, semantic events, and the operator console share one workspace boundary.

**Architecture:** Keep a shared deployment and shared relational database, but make `workspaceId` an explicit logical boundary across contracts and server-side enforcement. Platform safety baseline runs before workspace rules; the browser only selects and renders workspace state returned by the control plane.

**Tech Stack:** Java 21, Spring Boot WebFlux, Spring R2DBC, Jackson, JSON Schema, JUnit 5, Reactor Test, React, TypeScript, Vite

---

## File Map

**Create**

- `docs/adr/0006-internal-team-workspace-boundary.md`
- `backend/contracts/api/identity/identity-session-status-response-v2.schema.json`
- `backend/contracts/workflow/read-only-command-v2.schema.json`
- `backend/contracts/workflow/worker-execution-request-v2.schema.json`
- `backend/contracts/workflow/worker-execution-result-v2.schema.json`
- `backend/contracts/events/semantic-event-v2.schema.json`
- `backend/contracts/workflow/examples/read-only-node-health-command-v2.json`
- `backend/contracts/src/main/java/com/company/opsagent/contracts/identity/IdentitySessionStatusResponseV2.java`
- `backend/contracts/src/main/java/com/company/opsagent/contracts/identity/WorkspaceSessionView.java`
- `backend/contracts/src/main/java/com/company/opsagent/contracts/workflow/WorkspaceContext.java`
- `backend/contracts/src/main/java/com/company/opsagent/contracts/workflow/ReadOnlyCommandEnvelopeV2.java`
- `backend/contracts/src/main/java/com/company/opsagent/contracts/workflow/WorkerExecutionRequestV2.java`
- `backend/contracts/src/main/java/com/company/opsagent/contracts/workflow/WorkerExecutionResultV2.java`
- `backend/contracts/src/main/java/com/company/opsagent/contracts/events/SemanticEventV2.java`
- `backend/control-plane/modules/identity/src/main/java/com/company/opsagent/controlplane/modules/identity/TeamWorkspaceConstants.java`
- `backend/control-plane/modules/identity/src/main/java/com/company/opsagent/controlplane/modules/identity/WorkspaceMembership.java`
- `backend/control-plane/modules/policy/src/main/java/com/company/opsagent/controlplane/modules/policy/WorkspacePolicyContext.java`

**Modify**

- `AGENTS.md`
- `docs/architecture/module-map.md`
- `docs/planning/project-plan.md`
- `docs/planning/design-traceability.md`
- `docs/architecture/built-in-identity-provider-login-spec.md`
- `docs/runbooks/built-in-identity-production-mode.md`
- `backend/contracts/README.md`
- `backend/contracts/api/identity/README.md`
- `backend/contracts/workflow/README.md`
- `backend/contracts/events/README.md`
- `backend/contracts/src/main/java/com/company/opsagent/contracts/events/SemanticEvent.java`
- `backend/contracts/src/test/java/com/company/opsagent/contracts/ContractsTest.java`
- `backend/contracts/src/test/java/com/company/opsagent/contracts/IdentityContractsTest.java`
- `backend/control-plane/bootstrap/src/main/java/com/company/opsagent/controlplane/bootstrap/api/BrowserAuthenticationController.java`
- `backend/control-plane/bootstrap/src/main/java/com/company/opsagent/controlplane/bootstrap/api/BrowserSessionResponse.java`
- `backend/control-plane/bootstrap/src/main/java/com/company/opsagent/controlplane/bootstrap/api/ReadOnlyDiagnosticController.java`
- `backend/control-plane/bootstrap/src/main/java/com/company/opsagent/controlplane/bootstrap/api/ReadOnlyDiagnosticRequest.java`
- `backend/control-plane/bootstrap/src/main/java/com/company/opsagent/controlplane/bootstrap/security/PolicyEnforcementWebFilter.java`
- `backend/control-plane/modules/identity/src/main/java/com/company/opsagent/controlplane/modules/identity/OperatorIdentity.java`
- `backend/control-plane/modules/identity/src/main/resources/sql/migrations/V001__identity_schema.sql`
- `backend/control-plane/modules/policy/src/main/java/com/company/opsagent/controlplane/modules/policy/PolicyDecisionService.java`
- `backend/control-plane/modules/policy/src/main/java/com/company/opsagent/controlplane/modules/policy/RoleBasedPolicyDecider.java`
- `backend/control-plane/modules/agentrouting/src/main/java/com/company/opsagent/controlplane/modules/agentrouting/SkillRoutingCriteria.java`
- `backend/control-plane/modules/agentrouting/src/main/java/com/company/opsagent/controlplane/modules/agentrouting/RuleBasedSkillRoutingService.java`
- `backend/control-plane/modules/audit/src/main/java/com/company/opsagent/controlplane/modules/audit/ExecutionContext.java`
- `backend/control-plane/modules/audit/src/main/java/com/company/opsagent/controlplane/modules/audit/AuditEvent.java`
- `backend/control-plane/modules/workflow/src/main/java/com/company/opsagent/controlplane/modules/workflow/ReadOnlyWorkflowRequest.java`
- `backend/control-plane/modules/workflow/src/main/java/com/company/opsagent/controlplane/modules/workflow/StoredReadOnlyWorkflow.java`
- `backend/control-plane/modules/workflow/src/main/java/com/company/opsagent/controlplane/modules/workflow/ReadOnlyWorkflowStore.java`
- `backend/control-plane/modules/workflow/src/main/java/com/company/opsagent/controlplane/modules/workflow/R2dbcReadOnlyWorkflowStore.java`
- `backend/control-plane/modules/workflow/src/main/java/com/company/opsagent/controlplane/modules/workflow/ReadOnlyDiagnosticWorkflowService.java`
- `backend/control-plane/modules/workflow/src/main/java/com/company/opsagent/controlplane/modules/workflow/ReadOnlyWorkflowRecoveryService.java`
- `backend/control-plane/modules/workflow/src/main/resources/sql/migrations/V001__workflow_schema.sql`
- `frontend/operator-console/src/types.ts`
- `frontend/operator-console/src/api.ts`
- `frontend/operator-console/src/App.tsx`
- `frontend/operator-console/src/styles.css`
- `frontend/operator-console/README.md`

---

### Task 1: Update Product Boundary Documents

**Files:**
- Modify: `AGENTS.md`
- Modify: `docs/architecture/module-map.md`
- Modify: `docs/planning/project-plan.md`
- Modify: `docs/planning/design-traceability.md`
- Create: `docs/adr/0006-internal-team-workspace-boundary.md`

- [ ] **Step 1: Write ADR 0006**

Create `docs/adr/0006-internal-team-workspace-boundary.md` with the decision that internal `Team Workspace` is allowed, while external SaaS multi-tenancy, billing, external customer onboarding, and tenant operations stay out of scope.

- [ ] **Step 2: Update global rules**

In `AGENTS.md`, replace absolute “no tenant concept” wording with “allow internal Team Workspace, forbid external SaaS multi-tenancy and billing”. Keep the P1 read-only restrictions unchanged.

- [ ] **Step 3: Update module map and planning**

Add workspace responsibilities to M01, M02, M03, M04, M05, M07, M09, and M11 in `docs/architecture/module-map.md`, `docs/planning/project-plan.md`, and `docs/planning/design-traceability.md`.

- [ ] **Step 4: Verify wording**

Run:

```powershell
rg -n "外部 SaaS|Team Workspace" AGENTS.md docs -S
```

Expected: internal Team Workspace references are present; external SaaS multi-tenancy remains forbidden.

### Task 2: Add Workspace-Aware v2 Contracts

**Files:**
- Create: all v2 schema and Java contract files listed in File Map
- Modify: `backend/contracts/README.md`
- Modify: `backend/contracts/api/identity/README.md`
- Modify: `backend/contracts/workflow/README.md`
- Modify: `backend/contracts/events/README.md`
- Modify: `backend/contracts/src/main/java/com/company/opsagent/contracts/events/SemanticEvent.java`
- Modify: `backend/contracts/src/test/java/com/company/opsagent/contracts/ContractsTest.java`
- Modify: `backend/contracts/src/test/java/com/company/opsagent/contracts/IdentityContractsTest.java`

- [ ] **Step 1: Add schemas**

Add v2 JSON Schema files for identity session, read-only command, Worker execution request/result, and semantic event. Require `workspaceId` in every v2 cross-module envelope.

- [ ] **Step 2: Add Java records**

Add immutable Java records mirroring the v2 schemas. Preserve v1 records for compatibility.

- [ ] **Step 3: Extend semantic event compatibility**

Allow `SemanticEvent` to carry `workspaceId` and `contractVersion`, while keeping an overload that preserves v1 call sites through `workspace-default`.

- [ ] **Step 4: Add contract tests**

Extend contract tests so invalid v2 payloads without workspace are rejected and valid examples pass.

- [ ] **Step 5: Verify schemas**

Run:

```powershell
@'
import json
from pathlib import Path
for path in Path("backend/contracts").rglob("*.json"):
    json.loads(path.read_text(encoding="utf-8"))
print("json ok")
'@ | python -
```

Expected: `json ok`.

### Task 3: Add Team Workspace Identity Model

**Files:**
- Create: `backend/control-plane/modules/identity/src/main/java/com/company/opsagent/controlplane/modules/identity/TeamWorkspaceConstants.java`
- Create: `backend/control-plane/modules/identity/src/main/java/com/company/opsagent/controlplane/modules/identity/WorkspaceMembership.java`
- Modify: `backend/control-plane/modules/identity/src/main/java/com/company/opsagent/controlplane/modules/identity/OperatorIdentity.java`
- Modify: `backend/control-plane/modules/identity/src/main/resources/sql/migrations/V001__identity_schema.sql`
- Modify: `backend/control-plane/bootstrap/src/main/java/com/company/opsagent/controlplane/bootstrap/api/BrowserSessionResponse.java`
- Modify: `backend/control-plane/bootstrap/src/main/java/com/company/opsagent/controlplane/bootstrap/api/BrowserAuthenticationController.java`

- [ ] **Step 1: Add persistence tables**

Add `identity_workspace`, `identity_workspace_membership`, and `identity_workspace_role_grant`. Keep existing account role grants for compatibility and platform-level exceptions.

- [ ] **Step 2: Extend identity object**

Update `OperatorIdentity` to include `currentWorkspaceId`, workspace memberships, `hasWorkspace(workspaceId)`, and `rolesForWorkspace(workspaceId)`.

- [ ] **Step 3: Preserve old constructors**

Keep the existing 3-argument constructor and map it to `workspace-default` so old tests and dev token flows keep working.

- [ ] **Step 4: Return workspace session state**

Update browser session response to return accessible workspaces, selected workspace, and workspace-scoped roles.

- [ ] **Step 5: Run identity tests**

Run:

```powershell
.\mvnw -pl backend/contracts,backend/control-plane/modules/identity,backend/control-plane/bootstrap test
```

Expected: tests pass when Java and dependencies are installed.

### Task 4: Enforce Workspace in Policy and Audit

**Files:**
- Create: `backend/control-plane/modules/policy/src/main/java/com/company/opsagent/controlplane/modules/policy/WorkspacePolicyContext.java`
- Modify: `backend/control-plane/modules/policy/src/main/java/com/company/opsagent/controlplane/modules/policy/PolicyDecisionService.java`
- Modify: `backend/control-plane/modules/policy/src/main/java/com/company/opsagent/controlplane/modules/policy/RoleBasedPolicyDecider.java`
- Modify: `backend/control-plane/bootstrap/src/main/java/com/company/opsagent/controlplane/bootstrap/security/PolicyEnforcementWebFilter.java`
- Modify: `backend/control-plane/modules/audit/src/main/java/com/company/opsagent/controlplane/modules/audit/ExecutionContext.java`
- Modify: `backend/control-plane/modules/audit/src/main/java/com/company/opsagent/controlplane/modules/audit/AuditEvent.java`
- Modify: `backend/control-plane/modules/audit/src/test/java/com/company/opsagent/controlplane/modules/audit/InMemoryAuditTrailTest.java`

- [ ] **Step 1: Add workspace policy context**

Add a value object with `workspaceId`, `skillId`, and `targetEnvironment`.

- [ ] **Step 2: Update policy decision signature**

Add an overload that evaluates `OperatorIdentity + WorkspacePolicyContext + action + resource`. Keep the older method as a compatibility delegate.

- [ ] **Step 3: Deny missing membership**

In the role-based decider, reject requests when the operator does not belong to the selected workspace.

- [ ] **Step 4: Bind headers to execution context**

Read `X-Team-Workspace-Id`, `X-Ops-Agent-Skill-Id`, and `X-Ops-Agent-Target-Environment` in the policy filter and put `workspaceId` into `ExecutionContext`.

- [ ] **Step 5: Audit workspace**

Add `workspaceId` to audit records for allow and deny decisions.

- [ ] **Step 6: Run policy and audit tests**

Run:

```powershell
.\mvnw -pl backend/control-plane/modules/policy,backend/control-plane/modules/audit,backend/control-plane/bootstrap test
```

Expected: policy deny, audit, and bootstrap tests pass when Java and dependencies are installed.

### Task 5: Apply Workspace to Skill Routing

**Files:**
- Modify: `backend/control-plane/modules/agentrouting/src/main/java/com/company/opsagent/controlplane/modules/agentrouting/SkillRoutingCriteria.java`
- Modify: `backend/control-plane/modules/agentrouting/src/main/java/com/company/opsagent/controlplane/modules/agentrouting/RuleBasedSkillRoutingService.java`
- Modify: `backend/control-plane/modules/workflow/src/main/java/com/company/opsagent/controlplane/modules/workflow/ReadOnlyDiagnosticWorkflowService.java`

- [ ] **Step 1: Extend routing criteria**

Add `workspaceId` and `workspaceEnabledSkillIds` to `SkillRoutingCriteria`. Preserve the old constructor by defaulting to `workspace-default` and no explicit enablement filter.

- [ ] **Step 2: Filter disabled skills**

In `RuleBasedSkillRoutingService`, reject candidate Skills that are not in the workspace enablement list when that list is non-empty.

- [ ] **Step 3: Pass workspace from workflow request**

When constructing routing criteria, pass `ReadOnlyWorkflowRequest.workspaceId()`.

- [ ] **Step 4: Run routing tests**

Run:

```powershell
.\mvnw -pl backend/control-plane/modules/agentrouting,backend/control-plane/modules/workflow test
```

Expected: existing routing behavior still passes and disabled workspace Skill candidates are excluded.

### Task 6: Persist Workspace in Workflow, Idempotency, and Events

**Files:**
- Modify: workflow Java and SQL files listed in File Map
- Modify: workflow tests listed in File Map

- [ ] **Step 1: Add SQL columns**

Add `workspace_id` to `workflow_instance`, `workflow_idempotency`, and `workflow_event`. Include `workspace_id` in the idempotency primary key.

- [ ] **Step 2: Update domain records**

Add `workspaceId` to `ReadOnlyWorkflowRequest` and `StoredReadOnlyWorkflow`.

- [ ] **Step 3: Update store API**

Require `workspaceId` in `createWorkflow`, `findByIdempotency`, `appendEvent`, and `loadEventsAfter`.

- [ ] **Step 4: Update R2DBC implementation**

Bind and query `workspace_id` in all workflow instance, idempotency, and event operations.

- [ ] **Step 5: Emit v2 semantic events**

Create workflow events with `contractVersion="2.0"` and the selected `workspaceId`.

- [ ] **Step 6: Run workflow tests**

Run:

```powershell
.\mvnw -pl backend/control-plane/modules/workflow,backend/control-plane/bootstrap test
```

Expected: idempotency, persistence, recovery, and bootstrap tests pass when Java and dependencies are installed.

### Task 7: Carry Workspace Through Operator Console

**Files:**
- Modify: `frontend/operator-console/src/types.ts`
- Modify: `frontend/operator-console/src/api.ts`
- Modify: `frontend/operator-console/src/App.tsx`
- Modify: `frontend/operator-console/src/styles.css`
- Modify: `frontend/operator-console/README.md`

- [ ] **Step 1: Extend frontend types**

Add `WorkspaceSummary`, session workspace fields, `DiagnosticRequest.workspaceId`, and `SemanticEvent.workspaceId`.

- [ ] **Step 2: Send workspace headers and request body**

Set `X-Team-Workspace-Id` and include `workspaceId` in diagnostic requests and event recovery calls.

- [ ] **Step 3: Add workspace selector**

Render the current workspace selector from server session data and show selected workspace roles.

- [ ] **Step 4: Keep authorization server-side**

Do not add frontend permission checks. Render service responses and policy denials as returned.

- [ ] **Step 5: Build frontend**

Run:

```powershell
cd frontend/operator-console
npm run build
```

Expected: TypeScript and Vite build pass when Node dependencies are installed.

### Task 8: Verify and Document Remaining Work

**Files:**
- Modify: `docs/superpowers/specs/2026-06-07-m05-read-only-workflow-persistence-design.md`
- Modify: `docs/superpowers/specs/2026-06-07-m09-event-stream-recovery-design.md`
- Modify: `docs/superpowers/specs/2026-06-07-local-oidc-browser-login-design.md`
- Modify: `docs/superpowers/plans/2026-06-07-m05-read-only-workflow-persistence.md`
- Modify: `docs/superpowers/plans/2026-06-07-m09-event-stream-recovery.md`

- [ ] **Step 1: Revise old Superpowers specs**

Replace old “no multi-tenant capability” wording with “no external SaaS multi-tenancy or external customer access”. Link internal workspace behavior to this Team Workspace design.

- [ ] **Step 2: Add revision notes to old plans**

Mark M05 and M09 plans as superseded where their method signatures omit `workspaceId`.

- [ ] **Step 3: Run static checks**

Run:

```powershell
git diff --check
rg -n "外部 SaaS|Team Workspace|workspaceId \\+ workflowId \\+ afterSequence" docs/superpowers -S
```

Expected: Team Workspace references are present; external SaaS multi-tenancy remains out of scope; event recovery wording includes `workspaceId`.

- [ ] **Step 4: Run full verification**

Run:

```powershell
.\mvnw verify
cd frontend/operator-console
npm run build
```

Expected: both pass in a fully provisioned development environment. If Java or npm is unavailable, record the blocker and keep the code changes verifiable by static checks.

## Self-Review

- Spec coverage: covered identity, policy, Skill routing, workflow, idempotency, audit, semantic events, Worker v2 contracts, and operator console.
- Placeholder scan: no `TBD` or unspecified “implement later” steps remain.
- Type consistency: plan consistently uses `workspaceId`, `WorkspacePolicyContext`, `WorkspaceMembership`, `WorkspaceContext`, and `SemanticEventV2`.

## Known Follow-Up Slices

- Implement persistent workspace Skill enablement repository instead of using the current POC routing hook.
- Switch the Worker runtime adapter from v1 envelopes to v2 envelopes after downstream compatibility tests are in place.
- Add a dedicated workspace administration UI only after P1 read-only acceptance.
