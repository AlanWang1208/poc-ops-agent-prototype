import { useCallback, useMemo, useState } from "react";

import { runAgentDiagnosticTask } from "../../api/agent-api.js";
import { ApiError } from "../../api/client.js";

/**
 * @typedef {import("../../schemas/agent-schemas.js").AgentTaskResult} AgentTaskResult
 * @typedef {"idle" | "running" | "succeeded" | "failed" | "denied" | "contractError"} AgentDiagnosticTaskStatus
 * @typedef {{
 *   status: AgentDiagnosticTaskStatus,
 *   result: AgentTaskResult | null,
 *   workflowId: string | null,
 *   errorCode: string | null,
 *   errorMessage: string | null,
 * }} AgentDiagnosticTaskState
 */

/** @type {AgentDiagnosticTaskState} */
const initialState = {
  status: "idle",
  result: null,
  workflowId: null,
  errorCode: null,
  errorMessage: null,
};

export function useAgentDiagnosticTask() {
  const [state, setState] = useState(initialState);

  /** @type {(userIntent: string) => Promise<void>} */
  const run = useCallback(async (userIntent) => {
    const trimmedIntent = userIntent.trim();
    if (!trimmedIntent) {
      return;
    }

    setState({
      ...initialState,
      status: "running",
    });

    try {
      const result = await runAgentDiagnosticTask({
        targetEnvironment: "development",
        idempotencyKey: `agent-workspace-task-${crypto.randomUUID()}`,
        userIntent: trimmedIntent,
        inputParameters: {},
      });
      setState({
        ...initialState,
        status: toTaskStatus(result),
        result,
        workflowId: result.workflowId,
      });
    } catch (error) {
      setState(reduceError(error));
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
 * @param {AgentTaskResult} result
 * @returns {AgentDiagnosticTaskStatus}
 */
function toTaskStatus(result) {
  if (result.status === "SUCCEEDED") {
    return "succeeded";
  }
  if (result.status === "REJECTED") {
    return "denied";
  }
  return "failed";
}

/**
 * @param {unknown} error
 * @returns {AgentDiagnosticTaskState}
 */
function reduceError(error) {
  const status =
    error instanceof ApiError && error.kind === "forbidden"
      ? "denied"
      : error instanceof ApiError && error.kind === "contract"
        ? "contractError"
        : "failed";

  return {
    ...initialState,
    status,
    errorCode:
      error instanceof ApiError && error.code ? error.code : "AGENT_TASK_REQUEST_FAILED",
    errorMessage: error instanceof Error ? error.message : "Agent diagnostic request failed",
  };
}
