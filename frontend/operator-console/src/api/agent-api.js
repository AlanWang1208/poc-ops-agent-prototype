import {
  agentDiagnosticRequestSchema,
  agentTaskResultSchema,
  readOnlyDiagnosticRequestSchema,
  semanticEventSchema,
  skillRoutingRequestSchema,
  skillRoutingResponseSchema,
  workflowIdParameterSchema,
} from "../schemas/agent-schemas.js";
import {
  ApiError,
  createApiErrorFromResponse,
  createSessionExpiredApiError,
  isLoginHtmlResponse,
  requestJson,
} from "./client.js";

/**
 * @param {unknown} criteria
 */
export function searchSkillCandidates(criteria) {
  const request = skillRoutingRequestSchema.parse(criteria);
  return requestJson("/internal/routing/skills/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    schema: skillRoutingResponseSchema,
  });
}

/**
 * @param {unknown} input
 * @returns {Promise<import("../schemas/agent-schemas.js").AgentTaskResult>}
 */
export function runAgentDiagnosticTask(input) {
  const request = agentDiagnosticRequestSchema.parse(input);
  return requestJson("/api/v1/agent/diagnostics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    schema: agentTaskResultSchema,
  });
}

/**
 * @param {unknown} input
 * @param {{onEvent?: (event: import("../schemas/agent-schemas.js").SemanticEvent) => void, signal?: AbortSignal}} [options]
 * @returns {Promise<import("../schemas/agent-schemas.js").SemanticEvent[]>}
 */
export async function streamReadOnlyDiagnosticEvents(input, options = {}) {
  let request;
  try {
    request = readOnlyDiagnosticRequestSchema.parse(input);
  } catch (cause) {
    throw new ApiError({
      status: 0,
      kind: "contract",
      message: "Read-only diagnostic request did not match the expected contract",
      cause,
    });
  }

  let response;
  try {
    response = await fetch("/internal/diagnostics/read-only/events", {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "text/event-stream",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
      signal: options.signal,
    });
  } catch (cause) {
    throw new ApiError({
      status: 0,
      kind: "network",
      message: "Network request failed",
      cause,
    });
  }

  if (!response.ok) {
    throw await createApiErrorFromResponse(response);
  }

  return readSemanticEventStream(response, options);
}

/**
 * @param {unknown} workflowIdInput
 * @param {{afterSequence?: number, onEvent?: (event: import("../schemas/agent-schemas.js").SemanticEvent) => void, signal?: AbortSignal}} [options]
 * @returns {Promise<import("../schemas/agent-schemas.js").SemanticEvent[]>}
 */
export async function loadWorkflowEvents(workflowIdInput, options = {}) {
  let workflowId;
  try {
    workflowId = workflowIdParameterSchema.parse(workflowIdInput);
  } catch (cause) {
    throw new ApiError({
      status: 0,
      kind: "contract",
      message: "Workflow id did not match the expected contract",
      cause,
    });
  }

  const requestedAfterSequence = options.afterSequence;
  const afterSequence = typeof requestedAfterSequence === "number" &&
    Number.isInteger(requestedAfterSequence) &&
    requestedAfterSequence >= 0
    ? requestedAfterSequence
    : 0;
  let response;
  try {
    response = await fetch(
      `/internal/diagnostics/read-only/workflows/${encodeURIComponent(workflowId)}/events?afterSequence=${afterSequence}`,
      {
        credentials: "include",
        headers: { Accept: "text/event-stream" },
        signal: options.signal,
      },
    );
  } catch (cause) {
    throw new ApiError({
      status: 0,
      kind: "network",
      message: "Network request failed",
      cause,
    });
  }

  if (!response.ok) {
    throw await createApiErrorFromResponse(response);
  }

  return readSemanticEventStream(response, options);
}

/**
 * @param {Response} response
 * @param {{onEvent?: (event: import("../schemas/agent-schemas.js").SemanticEvent) => void}} options
 */
async function readSemanticEventStream(response, options) {
  if (isLoginHtmlResponse(response)) {
    throw createSessionExpiredApiError(response);
  }

  let streamText;
  try {
    streamText = await response.text();
  } catch (cause) {
    throw new ApiError({
      status: response.status,
      kind: "contract",
      message: "Event stream body could not be read",
      cause,
    });
  }

  /** @type {import("../schemas/agent-schemas.js").SemanticEvent[]} */
  const events = [];
  let frames;
  try {
    frames = parseServerSentEventFrames(streamText);
  } catch (cause) {
    throw new ApiError({
      status: response.status,
      kind: "contract",
      message: "Event stream did not match the expected contract",
      cause,
    });
  }

  for (const frame of frames) {
    let event;
    try {
      const payload = JSON.parse(frame);
      event = semanticEventSchema.parse(payload);
    } catch (cause) {
      throw new ApiError({
        status: response.status,
        kind: "contract",
        message: "Event stream did not match the expected contract",
        cause,
      });
    }
    events.push(event);
    if (options.onEvent) {
      options.onEvent(event);
    }
  }
  return events;
}

/**
 * @param {string} text
 * @returns {string[]}
 */
function parseServerSentEventFrames(text) {
  return text
    .split(/\r?\n\r?\n/)
    .filter((frame) => frame.trim())
    .map((frame) => {
      const dataLines = frame
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice("data:".length).trimStart());
      if (dataLines.length === 0) {
        throw new Error("Server-sent event frame did not include data");
      }
      return dataLines.join("\n");
    });
}
