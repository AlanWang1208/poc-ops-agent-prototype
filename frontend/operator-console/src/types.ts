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
  contractVersion: "1.0";
  eventId: string;
  workflowId: string;
  sequence: number;
  timestamp: string;
  type: SemanticEventType;
  payload: SemanticEventPayload;
}

export interface DiagnosticRequest {
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
  authenticationType: string;
}

export type SessionPhase = "loading" | "authenticated" | "anonymous" | "error";

export type EventStreamPhase =
  | "idle"
  | "connecting"
  | "streaming"
  | "reconnecting"
  | "completed"
  | "failed";
