import type {
  BrowserSession,
  DiagnosticRequest,
  SemanticEvent,
  SemanticEventType,
} from "./types";

const eventTypes = new Set<SemanticEventType>([
  "WORKFLOW_STARTED",
  "SKILL_ROUTED",
  "WORKER_ACCEPTED",
  "WORKFLOW_COMPLETED",
  "WORKFLOW_FAILED",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseSemanticEvent(value: unknown): SemanticEvent {
  if (
    !isRecord(value) ||
    value.contractVersion !== "1.0" ||
    typeof value.eventId !== "string" ||
    typeof value.workflowId !== "string" ||
    typeof value.sequence !== "number" ||
    typeof value.timestamp !== "string" ||
    typeof value.type !== "string" ||
    !eventTypes.has(value.type as SemanticEventType) ||
    !isRecord(value.payload) ||
    value.payload.payloadType !== value.type
  ) {
    throw new Error("控制面返回了不符合语义事件契约的数据");
  }
  return value as unknown as SemanticEvent;
}

function parseBrowserSession(value: unknown): BrowserSession {
  if (
    !isRecord(value) ||
    typeof value.authenticated !== "boolean" ||
    !Array.isArray(value.roles) ||
    typeof value.authenticationType !== "string"
  ) {
    throw new Error("控制面返回了不符合会话契约的数据");
  }
  if (
    (value.subject !== null && typeof value.subject !== "string") ||
    (value.username !== null && typeof value.username !== "string") ||
    value.roles.some((role) => typeof role !== "string")
  ) {
    throw new Error("控制面返回了不符合会话契约的数据");
  }
  return value as unknown as BrowserSession;
}

function buildHeaders(authorizationToken: string | null, includeJsonBody: boolean): Headers {
  const headers = new Headers({ Accept: "text/event-stream" });
  if (includeJsonBody) {
    headers.set("Content-Type", "application/json");
  }
  if (authorizationToken) {
    headers.set("Authorization", `Bearer ${authorizationToken}`);
  }
  return headers;
}

function normalizeAuthorizationToken(token: string): string | null {
  const normalized = token.trim();
  return normalized ? normalized : null;
}

async function readEventStream(
  response: Response,
  onEvent: (event: SemanticEvent) => void,
  failureMessage: string,
): Promise<void> {
  if (!response.ok || !response.body) {
    throw new Error(`${failureMessage}，HTTP ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const frames = buffer.split(/\r?\n\r?\n/);
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const data = frame
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n");
      if (data) {
        onEvent(parseSemanticEvent(JSON.parse(data) as unknown));
      }
    }
    if (done) {
      break;
    }
  }
}

export async function fetchBrowserSession(): Promise<BrowserSession> {
  const response = await fetch("/auth/session", {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (response.status === 401) {
    return {
      authenticated: false,
      subject: null,
      username: null,
      roles: [],
      authenticationType: "anonymous",
    };
  }
  if (!response.ok) {
    throw new Error(`读取浏览器会话失败，HTTP ${response.status}`);
  }
  return parseBrowserSession((await response.json()) as unknown);
}

export function redirectToBrowserLogin(): void {
  window.location.assign("/auth/login");
}

export async function logoutBrowserSession(): Promise<void> {
  const response = await fetch("/logout", {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(`退出登录失败，HTTP ${response.status}`);
  }
  window.location.assign("/");
}

export async function streamDiagnosticEvents(
  request: DiagnosticRequest,
  token: string,
  onEvent: (event: SemanticEvent) => void,
): Promise<void> {
  const response = await fetch("/internal/diagnostics/read-only/events", {
    method: "POST",
    headers: buildHeaders(normalizeAuthorizationToken(token), true),
    credentials: "include",
    body: JSON.stringify(request),
  });
  await readEventStream(response, onEvent, "诊断事件流请求失败");
}

export async function resumeDiagnosticEvents(
  workflowId: string,
  afterSequence: number,
  token: string,
  onEvent: (event: SemanticEvent) => void,
): Promise<void> {
  const response = await fetch(
    `/internal/diagnostics/read-only/workflows/${encodeURIComponent(workflowId)}/events?afterSequence=${afterSequence}`,
    {
      method: "GET",
      headers: buildHeaders(normalizeAuthorizationToken(token), false),
      credentials: "include",
    },
  );
  await readEventStream(response, onEvent, "诊断事件流恢复失败");
}
