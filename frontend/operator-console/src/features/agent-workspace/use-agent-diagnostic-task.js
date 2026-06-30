import { useCallback, useMemo, useState } from "react";
import { z } from "zod";

import { runAgentDiagnosticTask } from "../../api/agent-api.js";
import { ApiError } from "../../api/client.js";
import { agentTaskResultSchema } from "../../schemas/agent-schemas.js";

/**
 * @typedef {import("../../schemas/agent-schemas.js").AgentTaskResult} AgentTaskResult
 * @typedef {"idle" | "running" | "succeeded" | "failed" | "denied" | "contractError"} AgentDiagnosticTaskStatus
 * @typedef {{
 *   id: string,
 *   status: AgentDiagnosticTaskStatus,
 *   result: AgentTaskResult | null,
 *   workflowId: string | null,
 *   userIntent: string,
 *   errorCode: string | null,
 *   errorMessage: string | null,
 *   startedAt?: number,
 * }} AgentDiagnosticTaskExchange
 * @typedef {{
 *   status: AgentDiagnosticTaskStatus,
 *   result: AgentTaskResult | null,
 *   workflowId: string | null,
 *   userIntent: string | null,
 *   errorCode: string | null,
 *   errorMessage: string | null,
 *   exchanges: AgentDiagnosticTaskExchange[],
 * }} AgentDiagnosticTaskState
 */

/** @type {AgentDiagnosticTaskState} */
const initialState = {
  status: "idle",
  result: null,
  workflowId: null,
  userIntent: null,
  errorCode: null,
  errorMessage: null,
  exchanges: [],
};
const lastAgentResultKey = "ops-agent:last-agent-result";
const lastAgentExchangeKey = "ops-agent:last-agent-exchange";
const agentTaskExchangeSchema = z
  .object({
    id: z.string().trim().min(1).max(120).optional(),
    userIntent: z.string().trim().min(1).max(2000),
    result: agentTaskResultSchema,
  })
  .strict();

export function useAgentDiagnosticTask() {
  const [state, setState] = useState(readInitialState);

  /** @type {(userIntent: string) => Promise<void>} */
  const run = useCallback(async (userIntent) => {
    const trimmedIntent = userIntent.trim();
    if (!trimmedIntent) {
      return;
    }
    const requestId = crypto.randomUUID();
    const exchangeId = `agent-exchange-${requestId}`;
    /** @type {AgentDiagnosticTaskExchange} */
    const runningExchange = {
      id: exchangeId,
      status: "running",
      result: null,
      workflowId: null,
      userIntent: trimmedIntent,
      errorCode: null,
      errorMessage: null,
      startedAt: Date.now(),
    };

    setState((current) => ({
      ...current,
      result: null,
      status: "running",
      workflowId: null,
      userIntent: trimmedIntent,
      errorCode: null,
      errorMessage: null,
      exchanges: upsertExchange(current.exchanges, runningExchange),
    }));

    try {
      const result = await runAgentDiagnosticTask({
        targetEnvironment: "development",
        idempotencyKey: `agent-workspace-task-${requestId}`,
        userIntent: trimmedIntent,
        inputParameters: {},
      });
      persistLastWorkflowId(result.workflowId);
      persistLastAgentResult(result);
      persistLastAgentExchange(trimmedIntent, result);
      const completedExchange = toResultExchange(exchangeId, trimmedIntent, result);
      setState((current) => ({
        ...initialState,
        status: completedExchange.status,
        result,
        workflowId: result.workflowId,
        userIntent: trimmedIntent,
        exchanges: upsertExchange(current.exchanges, completedExchange),
      }));
    } catch (error) {
      const failedState = reduceError(error, trimmedIntent);
      setState((current) => ({
        ...failedState,
        exchanges: upsertExchange(current.exchanges, {
          id: exchangeId,
          status: failedState.status,
          result: null,
          workflowId: null,
          userIntent: trimmedIntent,
          errorCode: failedState.errorCode,
          errorMessage: failedState.errorMessage,
        }),
      }));
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

function readInitialState() {
  try {
    const rawExchange = window.sessionStorage?.getItem(lastAgentExchangeKey);
    if (rawExchange) {
      const exchange = agentTaskExchangeSchema.parse(JSON.parse(rawExchange));
      const restoredExchange = toResultExchange(
        exchange.id ?? `restored-${exchange.result.workflowId}`,
        exchange.userIntent,
        exchange.result,
      );
      return {
        ...initialState,
        status: restoredExchange.status,
        result: exchange.result,
        workflowId: exchange.result.workflowId,
        userIntent: exchange.userIntent,
        exchanges: [restoredExchange],
      };
    }

    const rawResult = window.sessionStorage?.getItem(lastAgentResultKey);
    if (!rawResult) {
      return initialState;
    }
    const result = agentTaskResultSchema.parse(JSON.parse(rawResult));
    return {
      ...initialState,
      status: toTaskStatus(result),
      result,
      workflowId: result.workflowId,
    };
  } catch {
    clearLastAgentResult();
    return initialState;
  }
}

/**
 * @param {AgentDiagnosticTaskExchange[]} exchanges
 * @param {AgentDiagnosticTaskExchange} nextExchange
 * @returns {AgentDiagnosticTaskExchange[]}
 */
function upsertExchange(exchanges, nextExchange) {
  const existingIndex = exchanges.findIndex((exchange) => exchange.id === nextExchange.id);
  if (existingIndex === -1) {
    return [...exchanges, nextExchange];
  }
  return exchanges.map((exchange, index) =>
    index === existingIndex ? nextExchange : exchange,
  );
}

/**
 * @param {string} id
 * @param {string} userIntent
 * @param {AgentTaskResult} result
 * @returns {AgentDiagnosticTaskExchange}
 */
function toResultExchange(id, userIntent, result) {
  return {
    id,
    status: toTaskStatus(result),
    result,
    workflowId: result.workflowId,
    userIntent,
    errorCode: null,
    errorMessage: null,
  };
}

/**
 * @param {string} workflowId
 */
function persistLastWorkflowId(workflowId) {
  try {
    window.localStorage?.setItem("ops-agent:last-workflow-id", workflowId);
  } catch {
    // localStorage may be unavailable in hardened browser contexts.
  }
}

/**
 * @param {AgentTaskResult} result
 */
function persistLastAgentResult(result) {
  try {
    window.sessionStorage?.setItem(lastAgentResultKey, JSON.stringify(result));
  } catch {
    // sessionStorage may be unavailable in hardened browser contexts.
  }
}

/**
 * @param {string} userIntent
 * @param {AgentTaskResult} result
 */
function persistLastAgentExchange(userIntent, result) {
  try {
    window.sessionStorage?.setItem(
      lastAgentExchangeKey,
      JSON.stringify({ userIntent, result }),
    );
  } catch {
    // sessionStorage may be unavailable in hardened browser contexts.
  }
}

function clearLastAgentResult() {
  try {
    window.sessionStorage?.removeItem(lastAgentResultKey);
    window.sessionStorage?.removeItem(lastAgentExchangeKey);
  } catch {
    // sessionStorage may be unavailable in hardened browser contexts.
  }
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
 * @param {string} userIntent
 * @returns {AgentDiagnosticTaskState}
 */
function reduceError(error, userIntent) {
  const status =
    error instanceof ApiError && error.kind === "forbidden"
      ? "denied"
      : error instanceof ApiError && error.kind === "contract"
        ? "contractError"
        : "failed";

  return {
    ...initialState,
    status,
    userIntent,
    errorCode:
      error instanceof ApiError && error.code ? error.code : "AGENT_TASK_REQUEST_FAILED",
    errorMessage: error instanceof Error ? error.message : "Agent diagnostic request failed",
  };
}
