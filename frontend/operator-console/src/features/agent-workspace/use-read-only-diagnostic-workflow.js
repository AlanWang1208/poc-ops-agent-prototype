import { useCallback, useMemo, useState } from "react";

import { streamReadOnlyDiagnosticEvents } from "../../api/agent-api.js";
import { ApiError } from "../../api/client.js";
import { nodeHealthOutputSchema } from "../../schemas/agent-schemas.js";

/**
 * @typedef {import("../../schemas/agent-schemas.js").NodeHealthOutput} NodeHealthOutput
 * @typedef {import("../../schemas/agent-schemas.js").SemanticEvent} SemanticEvent
 * @typedef {"idle" | "running" | "succeeded" | "failed" | "denied" | "contractError"} DiagnosticWorkflowStatus
 * @typedef {{
 *   status: DiagnosticWorkflowStatus,
 *   events: SemanticEvent[],
 *   latestEvent: SemanticEvent | null,
 *   workflowId: string | null,
 *   output: NodeHealthOutput | null,
 *   errorCode: string | null,
 *   errorMessage: string | null,
 * }} DiagnosticWorkflowState
 */

/** @type {DiagnosticWorkflowState} */
const initialState = {
  status: "idle",
  events: [],
  latestEvent: null,
  workflowId: null,
  output: null,
  errorCode: null,
  errorMessage: null,
};

export function useReadOnlyDiagnosticWorkflow() {
  const [state, setState] = useState(initialState);

  const run = useCallback(async () => {
    const request = {
      skillId: "node-health-read",
      targetEnvironment: "development",
      idempotencyKey: `agent-workspace-node-health-${crypto.randomUUID()}`,
      parameters: { nodeName: "node-a" },
    };

    setState({
      ...initialState,
      status: "running",
    });

    try {
      await streamReadOnlyDiagnosticEvents(request, {
        onEvent: (event) => {
          setState((current) => reduceEvent(current, event));
        },
      });
    } catch (error) {
      setState((current) => reduceError(current, error));
    }
  }, []);

  return useMemo(
    () => ({
      ...state,
      run,
    }),
    [run, state],
  );
}

/**
 * @param {DiagnosticWorkflowState} current
 * @param {SemanticEvent} event
 * @returns {DiagnosticWorkflowState}
 */
function reduceEvent(current, event) {
  const eventsById = new Map(
    current.events.map((existingEvent) => [existingEvent.eventId, existingEvent]),
  );
  eventsById.set(event.eventId, event);
  const events = [...eventsById.values()].sort(
    (left, right) => left.sequence - right.sequence,
  );
  const latestEvent = events.at(-1) ?? event;
  const nextState = {
    ...current,
    events,
    latestEvent,
    workflowId: latestEvent.workflowId,
    errorCode: null,
    errorMessage: null,
  };

  if (latestEvent.payload.payloadType === "WORKFLOW_COMPLETED") {
    const output = nodeHealthOutputSchema.safeParse(latestEvent.payload.output);
    if (output.success) {
      return {
        ...nextState,
        status: "succeeded",
        output: output.data,
      };
    }

    return {
      ...nextState,
      status: "contractError",
      output: null,
      errorCode: "NODE_HEALTH_OUTPUT_CONTRACT_MISMATCH",
      errorMessage: "Node health output did not match the expected contract",
    };
  }

  if (latestEvent.payload.payloadType === "WORKFLOW_FAILED") {
    return {
      ...nextState,
      status: "failed",
      output: null,
      errorCode: latestEvent.payload.errorCode,
      errorMessage: latestEvent.payload.message,
    };
  }

  return {
    ...nextState,
    status: "running",
  };
}

/**
 * @param {DiagnosticWorkflowState} current
 * @param {unknown} error
 * @returns {DiagnosticWorkflowState}
 */
function reduceError(current, error) {
  const status =
    error instanceof ApiError && error.kind === "forbidden"
      ? "denied"
      : error instanceof ApiError && error.kind === "contract"
        ? "contractError"
        : "failed";

  return {
    ...current,
    status,
    errorCode:
      error instanceof ApiError && error.code ? error.code : "DIAGNOSTIC_REQUEST_FAILED",
    errorMessage: error instanceof Error ? error.message : "Diagnostic request failed",
  };
}
