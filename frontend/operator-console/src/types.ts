export type SemanticEventType =
  | "WORKFLOW_STARTED"
  | "SKILL_ROUTED"
  | "WORKER_ACCEPTED"
  | "WORKFLOW_COMPLETED"
  | "WORKFLOW_FAILED";

export type SemanticEventPayload =
  | { payloadType: "WORKFLOW_STARTED"; commandId: string; operatorId: string }
  | { payloadType: "SKILL_ROUTED"; skillId: string; skillVersion: string }
  | { payloadType: "WORKER_ACCEPTED"; executionRequestId: string }
  | { payloadType: "WORKFLOW_COMPLETED"; outputSchemaId: string; output: Record<string, unknown> }
  | { payloadType: "WORKFLOW_FAILED"; errorCode: string; message: string };

export interface SemanticEvent {
  contractVersion: "1.0" | "2.0";
  workspaceId: string;
  eventId: string;
  workflowId: string;
  sequence: number;
  timestamp: string;
  type: SemanticEventType;
  payload: SemanticEventPayload;
}

export interface DiagnosticRequest {
  workspaceId: string;
  skillId: string;
  targetEnvironment: string;
  idempotencyKey: string;
  parameters: Record<string, unknown>;
}

export interface BrowserSession {
  authenticated: boolean;
  subject: string | null;
  username: string | null;
  roles: string[];
  workspaces: WorkspaceSummary[];
  currentWorkspaceId: string | null;
  authenticationType: string;
}

export interface WorkspaceSummary {
  workspaceId: string;
  workspaceCode: string;
  displayName: string;
  roles: string[];
}

export type SessionPhase = "loading" | "authenticated" | "anonymous" | "error";

export type EventStreamPhase =
  | "idle"
  | "connecting"
  | "streaming"
  | "reconnecting"
  | "completed"
  | "failed";
