import { FormEvent, useEffect, useRef, useState } from "react";
import {
  fetchBrowserSession,
  logoutBrowserSession,
  redirectToBrowserLogin,
  resumeDiagnosticEvents,
  streamDiagnosticEvents,
} from "./api";
import type {
  BrowserSession,
  DiagnosticRequest,
  EventStreamPhase,
  SemanticEvent,
  SessionPhase,
} from "./types";
import "./styles.css";

const labels: Record<SemanticEvent["type"], string> = {
  WORKFLOW_STARTED: "工作流已开始",
  SKILL_ROUTED: "只读 Skill 已路由",
  WORKER_ACCEPTED: "受限 Worker 已接收",
  WORKFLOW_COMPLETED: "诊断已完成",
  WORKFLOW_FAILED: "诊断失败",
};

const phaseLabels: Record<EventStreamPhase, string> = {
  idle: "空闲",
  connecting: "连接中",
  streaming: "流式接收中",
  reconnecting: "恢复中",
  completed: "已完成",
  failed: "失败",
};

function isTerminalEvent(event: SemanticEvent): boolean {
  return event.type === "WORKFLOW_COMPLETED" || event.type === "WORKFLOW_FAILED";
}

function mergeRecoveredEvent(current: SemanticEvent[], incoming: SemanticEvent): SemanticEvent[] {
  if (current.some((item) => item.eventId === incoming.eventId)) {
    return current;
  }
  return [...current, incoming].sort((left, right) => left.sequence - right.sequence);
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

function canUseConsole(session: BrowserSession | null, debugToken: string): boolean {
  return Boolean(session?.authenticated || debugToken.trim());
}

export default function App() {
  const [sessionPhase, setSessionPhase] = useState<SessionPhase>("loading");
  const [session, setSession] = useState<BrowserSession | null>(null);
  const [sessionError, setSessionError] = useState("");
  const [debugToken, setDebugToken] = useState("");
  const [nodeName, setNodeName] = useState("node-a");
  const [events, setEvents] = useState<SemanticEvent[]>([]);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<EventStreamPhase>("idle");
  const [workflowId, setWorkflowId] = useState("");
  const [lastSequence, setLastSequence] = useState(0);

  const runIdRef = useRef(0);
  const workflowIdRef = useRef("");
  const lastSequenceRef = useRef(0);
  const terminalSeenRef = useRef(false);

  useEffect(() => {
    void refreshSession();
  }, []);

  async function refreshSession(): Promise<void> {
    setSessionPhase("loading");
    setSessionError("");
    try {
      const currentSession = await fetchBrowserSession();
      setSession(currentSession);
      setSessionPhase(currentSession.authenticated ? "authenticated" : "anonymous");
    } catch (caught) {
      setSession(null);
      setSessionPhase("error");
      setSessionError(caught instanceof Error ? caught.message : "读取浏览器会话失败");
    }
  }

  function resetStreamState() {
    workflowIdRef.current = "";
    lastSequenceRef.current = 0;
    terminalSeenRef.current = false;
    setWorkflowId("");
    setLastSequence(0);
    setEvents([]);
    setError("");
    setPhase("idle");
  }

  function handleSemanticEvent(expectedRunId: number, semanticEvent: SemanticEvent) {
    if (runIdRef.current !== expectedRunId) {
      return;
    }
    workflowIdRef.current = semanticEvent.workflowId;
    lastSequenceRef.current = Math.max(lastSequenceRef.current, semanticEvent.sequence);
    terminalSeenRef.current = isTerminalEvent(semanticEvent);
    setWorkflowId(semanticEvent.workflowId);
    setLastSequence((current) => Math.max(current, semanticEvent.sequence));
    setEvents((current) => mergeRecoveredEvent(current, semanticEvent));
    setPhase(terminalSeenRef.current ? "completed" : "streaming");
  }

  async function recoverCurrentWorkflow(expectedRunId: number, currentToken: string) {
    let lastFailure = "事件流已断开，且未能从持久化事件中恢复";
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      if (runIdRef.current !== expectedRunId || terminalSeenRef.current) {
        return;
      }
      const currentWorkflowId = workflowIdRef.current;
      if (!currentWorkflowId) {
        break;
      }
      setPhase("reconnecting");
      const sequenceBeforeResume = lastSequenceRef.current;
      try {
        await delay(attempt * 400);
        await resumeDiagnosticEvents(
          currentWorkflowId,
          lastSequenceRef.current,
          currentToken,
          (semanticEvent) => handleSemanticEvent(expectedRunId, semanticEvent),
        );
        if (terminalSeenRef.current) {
          return;
        }
        if (lastSequenceRef.current > sequenceBeforeResume) {
          attempt = 0;
        }
      } catch (caught) {
        lastFailure = caught instanceof Error ? caught.message : lastFailure;
      }
    }
    throw new Error(lastFailure);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canUseConsole(session, debugToken)) {
      setError("请先完成浏览器登录，或在开发调试区填写 Bearer Token");
      return;
    }

    const expectedRunId = runIdRef.current + 1;
    const currentToken = debugToken.trim();
    runIdRef.current = expectedRunId;
    resetStreamState();
    setPhase("connecting");
    setRunning(true);

    const request: DiagnosticRequest = {
      skillId: "node-health-read",
      targetEnvironment: "development",
      idempotencyKey: `node-health:${nodeName}:${Date.now()}`,
      parameters: { nodeName },
    };

    try {
      await streamDiagnosticEvents(request, currentToken, (semanticEvent) =>
        handleSemanticEvent(expectedRunId, semanticEvent),
      );
      if (!terminalSeenRef.current) {
        await recoverCurrentWorkflow(expectedRunId, currentToken);
      }
      await refreshSession();
    } catch (caught) {
      setPhase("failed");
      setError(caught instanceof Error ? caught.message : "诊断请求失败");
    } finally {
      setRunning(false);
    }
  }

  const phaseClassName = `phase phase-${phase}`;
  const consoleEnabled = canUseConsole(session, debugToken);

  return (
    <main>
      <header className="hero">
        <p className="eyebrow">P1 Read-only Diagnostics</p>
        <h1>智能运维只读操作台</h1>
        <p className="intro">
          登录后前端直接复用浏览器会话访问控制面，只按强类型语义事件展示诊断执行过程。
        </p>
      </header>

      <section className="session-grid">
        <article className="panel session-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Browser Session</p>
              <h2>登录状态</h2>
            </div>
            <span className={`session-badge session-${sessionPhase}`}>
              {sessionPhase === "loading" && "读取中"}
              {sessionPhase === "authenticated" && "已登录"}
              {sessionPhase === "anonymous" && "未登录"}
              {sessionPhase === "error" && "异常"}
            </span>
          </div>

          {sessionPhase === "authenticated" && session ? (
            <>
              <dl className="session-meta">
                <div>
                  <dt>用户名</dt>
                  <dd>{session.username ?? "未提供"}</dd>
                </div>
                <div>
                  <dt>主体</dt>
                  <dd>{session.subject ?? "未提供"}</dd>
                </div>
                <div>
                  <dt>认证类型</dt>
                  <dd>{session.authenticationType}</dd>
                </div>
              </dl>
              <div className="role-list">
                {session.roles.map((role) => (
                  <span key={role}>{role}</span>
                ))}
              </div>
              <div className="session-actions">
                <button type="button" onClick={() => void refreshSession()}>
                  刷新会话
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    void logoutBrowserSession();
                  }}
                >
                  退出登录
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="session-copy">
                {sessionPhase === "loading" && "正在读取控制面浏览器会话。"}
                {sessionPhase === "anonymous" &&
                  "当前尚未建立浏览器会话。默认联调链路要求先走本地 Mock OIDC 登录。"}
                {sessionPhase === "error" &&
                  (sessionError || "会话读取失败，请先确认本地控制面已按 local-oidc profile 启动。")}
              </p>
              <div className="session-actions">
                <button type="button" onClick={redirectToBrowserLogin}>
                  使用本地 Mock OIDC 登录
                </button>
                <button type="button" className="secondary-button" onClick={() => void refreshSession()}>
                  重试读取会话
                </button>
              </div>
            </>
          )}
        </article>

        <article className="panel console-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Console Access</p>
              <h2>诊断入口</h2>
            </div>
            <span className={`session-badge ${consoleEnabled ? "session-authenticated" : "session-anonymous"}`}>
              {consoleEnabled ? "可用" : "需登录"}
            </span>
          </div>
          <p className="session-copy">
            默认使用浏览器会话访问 `/internal/**`。开发调试时可临时填写 Bearer Token 覆盖请求头。
          </p>
          <details className="debug-panel">
            <summary>开发调试 Token 覆盖</summary>
            <label>
              Bearer Token
              <textarea
                value={debugToken}
                onChange={(inputEvent) => setDebugToken(inputEvent.target.value)}
                rows={3}
                placeholder="仅在排障时填写；留空时走浏览器会话"
              />
            </label>
          </details>
        </article>
      </section>

      <section className="panel">
        <form onSubmit={submit}>
          <label>
            节点名称
            <input value={nodeName} onChange={(inputEvent) => setNodeName(inputEvent.target.value)} required />
          </label>
          <button disabled={running || !consoleEnabled}>
            {running ? "诊断执行中" : "启动只读诊断"}
          </button>
        </form>
      </section>

      <section className="status-grid">
        <article className={phaseClassName}>
          <span className="phase-label">事件流状态</span>
          <strong>{phaseLabels[phase]}</strong>
        </article>
        <article className="phase">
          <span className="phase-label">工作流 ID</span>
          <strong>{workflowId || "尚未建立"}</strong>
        </article>
        <article className="phase">
          <span className="phase-label">最新序号</span>
          <strong>{lastSequence}</strong>
        </article>
      </section>

      {error && <p className="error">{error}</p>}

      <section className="timeline" aria-live="polite">
        {events.length === 0 ? (
          <article className="panel empty-state">
            <strong>尚无语义事件</strong>
            <p>完成登录后发起一次只读诊断，这里会按顺序渲染工作流事件。</p>
          </article>
        ) : (
          events.map((semanticEvent) => (
            <article key={semanticEvent.eventId} className={`event ${semanticEvent.type.toLowerCase()}`}>
              <div>
                <span>{semanticEvent.sequence}</span>
                <strong>{labels[semanticEvent.type]}</strong>
              </div>
              <time>{semanticEvent.timestamp}</time>
              <pre>{JSON.stringify(semanticEvent.payload, null, 2)}</pre>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
