import {
  Bot,
  CircleDot,
  ClipboardCheck,
  GitBranch,
  SendHorizontal,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { WorkspaceStatusBar } from "../../components/layout/WorkspaceStatusBar.jsx";
import { Badge } from "../../components/primitives/Badge.jsx";
import { Button } from "../../components/primitives/Button.jsx";
import { weatherCurrentOutputSchema } from "../../schemas/agent-schemas.js";
import { useAgentCandidates } from "./use-agent-candidates.js";
import { useAgentDiagnosticTask } from "./use-agent-diagnostic-task.js";
import styles from "./AgentWorkspacePage.module.css";

const secondaryConversationActions = ["分享", "接管状态"];
const agentRequestScope = {
  targetEnvironment: "development",
  policy: "READ_ONLY",
  inputParameters: {},
};
const agentIonSpecs = [
  ["agentIonTiny", "agentIonBlue", "agentIonLaneOne"],
  ["agentIonSmall", "agentIonRed", "agentIonLaneTwo"],
  ["agentIonMedium", "agentIonGreen", "agentIonLaneThree"],
  ["agentIonTiny", "agentIonGold", "agentIonLaneFour"],
  ["agentIonSmall", "agentIonBlue", "agentIonLaneFive"],
  ["agentIonTiny", "agentIonGreen", "agentIonLaneSix"],
  ["agentIonMedium", "agentIonRed", "agentIonLaneSeven"],
  ["agentIonSmall", "agentIonGold", "agentIonLaneEight"],
  ["agentIonTiny", "agentIonBlue", "agentIonLaneNine"],
  ["agentIonSmall", "agentIonGreen", "agentIonLaneTen"],
  ["agentIonTiny", "agentIonRed", "agentIonLaneEleven"],
  ["agentIonMedium", "agentIonBlue", "agentIonLaneTwelve"],
];

export function AgentWorkspacePage() {
  const [isWorkspaceExpanded, setIsWorkspaceExpanded] = useState(false);
  const [taskGoal, setTaskGoal] = useState("");
  const [activeDetailPanel, setActiveDetailPanel] = useState(
    /** @type {"task" | "skill" | "chain" | null} */ (null),
  );
  const candidatesQuery = useAgentCandidates();
  const candidates = candidatesQuery.data?.candidates ?? [];
  const agentTask = useAgentDiagnosticTask();
  const canSubmitAgentTask = taskGoal.trim().length > 0 && agentTask.status !== "running";
  /**
   * @param {string} [goal]
   */
  const submitAgentTask = (goal = taskGoal) => {
    const currentGoal = goal.trim();
    if (!currentGoal || agentTask.status === "running") {
      return;
    }
    void agentTask.run(currentGoal);
    setTaskGoal("");
  };
  /**
   * @param {import("react").KeyboardEvent<HTMLTextAreaElement>} event
   */
  const handleComposerKeyDown = (event) => {
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.nativeEvent.isComposing
    ) {
      return;
    }
    event.preventDefault();
    submitAgentTask(event.currentTarget.value);
  };

  return (
    <div
      className={`${styles.agentCanvas} ${isWorkspaceExpanded ? styles.workspaceFullscreen : ""}`}
    >
      <div aria-hidden="true" className={styles.agentIonField}>
        {agentIonSpecs.map(([size, tone, lane], index) => (
          <i
            aria-hidden="true"
            className={[styles.agentIon, styles[size], styles[tone], styles[lane]]
              .filter(Boolean)
              .join(" ")}
            data-agent-ion=""
            key={`${lane}-${index}`}
          />
        ))}
      </div>
      <WorkspaceStatusBar title="Agent 工作区" />

      <ConversationToolbar
        isWorkspaceExpanded={isWorkspaceExpanded}
        onToggleWorkspace={() => setIsWorkspaceExpanded((current) => !current)}
      />

      <section className={styles.agentLayout}>
        <div className={styles.exchangeWindow}>
          <div className={styles.exchangeHead}>
            <div>
              <h2>工作会话</h2>
              <span>一会话多任务 · 2 个 workflow · policy-v1</span>
              <small className={styles.operatorScope}>ROLE_agent-reader · policy-v1 · READ_ONLY</small>
            </div>
            <Badge className={styles.liveBadge} tone="success">
              会话已确权
            </Badge>
          </div>

          <div className={styles.exchangeBody}>
            {agentTask.exchanges.map((exchange) => (
              <Fragment key={exchange.id}>
                <Message author="操作员" tone="operator">
                  {exchange.userIntent}
                </Message>
                <Message author="Agent" tone="agent">
                  <AgentTaskChatReply exchange={exchange} />
                </Message>
              </Fragment>
            ))}
          </div>

          <div className={styles.exchangeComposer}>
            <div className={styles.composerBox}>
              <textarea
                aria-label="任务目标"
                className={styles.composerInput}
                disabled={agentTask.status === "running"}
                onChange={(event) => setTaskGoal(event.target.value)}
                onKeyDown={handleComposerKeyDown}
                placeholder="输入任务目标，例如：检查 payment-api 最近错误、确认订单库慢查询趋势，并给出只读排查计划。"
                value={taskGoal}
              />
              <Button
                aria-label="发送任务"
                className={styles.sendButton}
                disabled={!canSubmitAgentTask}
                onClick={() => submitAgentTask()}
                variant="primary"
              >
                <SendHorizontal aria-hidden="true" size={18} />
              </Button>
            </div>
          </div>
        </div>

        <aside className={styles.agentSide}>
          <TaskDetailPanel
            onShowDetail={() => setActiveDetailPanel("task")}
            task={agentTask}
          />
          <SkillEventPanel
            candidates={candidates}
            onShowDetail={() => setActiveDetailPanel("skill")}
            query={candidatesQuery}
            task={agentTask}
          />
          <SessionContextPanel
            onShowDetail={() => setActiveDetailPanel("chain")}
            task={agentTask}
          />
        </aside>
      </section>

      <AgentDetailDialog
        activePanel={activeDetailPanel}
        candidates={candidates}
        onClose={() => setActiveDetailPanel(null)}
        query={candidatesQuery}
        task={agentTask}
      />
    </div>
  );
}

/**
 * @param {import("../../schemas/agent-schemas.js").AgentTaskResult} result
 * @returns {import("../../schemas/agent-schemas.js").WeatherCurrentOutput | null}
 */
function toWeatherOutput(result) {
  const weatherResult = result.toolResults.find((toolResult) =>
    toolResult.outputSchemaId.includes("weather-current-read"),
  );
  if (!weatherResult) {
    return null;
  }
  const parsed = weatherCurrentOutputSchema.safeParse(weatherResult.output);
  return parsed.success ? parsed.data : null;
}

/**
 * @param {import("./use-agent-diagnostic-task.js").AgentDiagnosticTaskStatus} status
 */
function taskStateLabel(status) {
  const labels = {
    idle: "未开始",
    running: "执行中",
    succeeded: "已完成",
    failed: "失败",
    denied: "已拒绝",
    contractError: "契约错误",
  };
  return labels[status] ?? "未知";
}

/**
 * @param {import("./use-agent-diagnostic-task.js").AgentDiagnosticTaskState} task
 */
function latestUserIntent(task) {
  return task.userIntent ?? task.exchanges.at(-1)?.userIntent ?? "等待发送";
}

/**
 * @param {import("./use-agent-diagnostic-task.js").AgentDiagnosticTaskState} task
 */
function taskTone(task) {
  if (
    task.status === "denied" ||
    task.status === "failed" ||
    task.status === "contractError" ||
    task.result?.status === "FAILED_TERMINAL" ||
    task.result?.status === "REJECTED" ||
    task.result?.status === "AGENT_RUNTIME_FAILED"
  ) {
    return "danger";
  }
  if (task.status === "succeeded" || task.result?.status === "SUCCEEDED") {
    return "ok";
  }
  return "info";
}

/**
 * @param {string} outputSchemaId
 */
function parseOutputSchemaId(outputSchemaId) {
  const [skillId = "unknown-skill", skillVersion = "unknown", schemaRole = "output"] =
    outputSchemaId.split(":");
  return { skillId, skillVersion, schemaRole };
}

/**
 * @param {import("./use-agent-diagnostic-task.js").AgentDiagnosticTaskState} task
 */
function buildChainSteps(task) {
  const toolResults = task.result?.toolResults ?? [];
  return [
    { label: "操作员意图", value: latestUserIntent(task), tone: "info" },
    { label: "Agent Runtime", value: task.status === "idle" ? "等待发送" : "已接收", tone: "info" },
    { label: "READ_ONLY 策略", value: "policy-v1", tone: "ok" },
    { label: "M05 workflow", value: task.workflowId ?? "pending", tone: "info" },
    {
      label: "M07 Worker",
      value: toolResults.length > 0 ? `${toolResults.length} 次只读调用` : "等待 Skill 调用",
      tone: "info",
    },
    ...toolResults.map((toolResult) => {
      const descriptor = parseOutputSchemaId(toolResult.outputSchemaId);
      return {
        label: `${descriptor.skillId}@${descriptor.skillVersion}`,
        value: toolResult.status,
        tone: toolResult.status === "SUCCEEDED" ? "ok" : "danger",
      };
    }),
    { label: "结果", value: task.result?.status ?? taskStateLabel(task.status), tone: taskTone(task) },
  ];
}

/**
 * @param {unknown} value
 */
function formatJson(value) {
  return JSON.stringify(value, null, 2);
}

/**
 * @param {{
 *   isWorkspaceExpanded: boolean,
 *   onToggleWorkspace: () => void,
 * }} props
 */
function ConversationToolbar({ isWorkspaceExpanded, onToggleWorkspace }) {
  return (
    <section aria-label="会话工具栏" className={styles.conversationToolbar}>
      <span className={styles.conversationToolbarButton}>
        <CircleDot aria-hidden="true" size={14} />
        会话列表 <b>2</b>
      </span>
      <div className={styles.conversationToolbarMain}>
        <i aria-hidden="true" className={styles.conversationTitleIcon} />
        <strong>node-a 健康排查</strong>
        <small>2 个 workflow · 1 分钟前更新</small>
      </div>
      <div className={styles.conversationToolbarActions}>
        <button
          aria-pressed={isWorkspaceExpanded}
          className={styles.workspaceExpand}
          onClick={onToggleWorkspace}
          type="button"
        >
          {isWorkspaceExpanded ? "收起工作区" : "展开工作区"}
        </button>
        {secondaryConversationActions.map((action) => (
          <button className={styles.conversationAction} key={action} type="button">
            {action}
          </button>
        ))}
        <button className={`${styles.conversationAction} ${styles.primaryAction}`} type="button">
          + 新建会话
        </button>
      </div>
    </section>
  );
}

/**
 * @param {{
 *   author: string,
 *   children: import("react").ReactNode,
 *   tone: "agent" | "operator",
 * }} props
 */
function Message({ author, children, tone }) {
  const RoleIcon = tone === "operator" ? UserRound : Bot;

  return (
    <article className={`${styles.message} ${styles[tone]}`} data-message-tone={tone}>
      <strong>
        <span aria-hidden="true" className={styles.messageRoleIcon}>
          <RoleIcon size={15} strokeWidth={2.6} />
        </span>
        <span className={styles.messageTitleText}>{author}</span>
      </strong>
      <span aria-hidden="true" className={styles.messageDivider} />
      <div className={styles.messageContent}>{children}</div>
    </article>
  );
}

/**
 * @param {{ exchange: import("./use-agent-diagnostic-task.js").AgentDiagnosticTaskExchange }} props
 */
function AgentTaskChatReply({ exchange }) {
  if (exchange.status === "running") {
    return <p>正在执行只读诊断。</p>;
  }

  if (exchange.result) {
    const weatherOutput = toWeatherOutput(exchange.result);
    return (
      <>
        <p>{exchange.result.summary}</p>
        {weatherOutput ? <WeatherCurrentResult output={weatherOutput} /> : null}
      </>
    );
  }

  return (
    <p>
      {exchange.errorCode ? `${exchange.errorCode}: ` : ""}
      {exchange.errorMessage ?? "Agent 诊断请求失败"}
    </p>
  );
}

/**
 * @param {{ output: import("../../schemas/agent-schemas.js").WeatherCurrentOutput }} props
 */
function WeatherCurrentResult({ output }) {
  const observedAt = output.observationTime ?? output.observedAt;
  return (
    <div className={styles.nodeHealthResult}>
      <strong>{output.location}</strong>
      <span>{output.condition}</span>
      <span>{formatTemperature(output.temperatureCelsius)}°C</span>
      {typeof output.humidityPercent === "number" ? (
        <span>湿度 {output.humidityPercent}%</span>
      ) : null}
      {typeof output.windSpeedKph === "number" ? (
        <span>风速 {output.windSpeedKph} kph</span>
      ) : null}
      {observedAt ? <small>{observedAt}</small> : null}
    </div>
  );
}

/**
 * @param {number} value
 */
function formatTemperature(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/**
 * @param {{
 *   onShowDetail: () => void,
 *   task: import("./use-agent-diagnostic-task.js").AgentDiagnosticTaskState,
 * }} props
 */
function TaskDetailPanel({ onShowDetail, task }) {
  const result = task.result;
  const hasWorkflowError = taskTone(task) === "danger";

  return (
    <section className={styles.agentPanel}>
      <h3>
        <span aria-hidden="true" className={`${styles.panelIcon} ${styles.panelIconTask}`}>
          <ClipboardCheck size={15} strokeWidth={2.6} />
        </span>
        对话执行状态
      </h3>
      <MiniRow label="状态" tone={taskTone(task)} value={result?.status ?? taskStateLabel(task.status)} />
      <MiniRow label="策略" tone="ok" value={agentRequestScope.policy} />
      <MiniRow
        label="Skill 调用"
        tone="info"
        value={result ? `${result.toolResults.length}/${result.toolCallCount}` : "0/0"}
      />
      <MiniRow label="workflow" value={task.workflowId ?? "pending"} />
      <MiniRow label="当前输入" value={latestUserIntent(task)} />
      {hasWorkflowError ? (
        <div className={`${styles.statusNote} ${styles.errorNote}`}>
          <ShieldCheck aria-hidden="true" size={16} />
          <span>
            {task.errorCode ? `${task.errorCode}: ` : ""}
            {task.errorMessage ?? result?.summary ?? "Agent 诊断请求失败"}
          </span>
        </div>
      ) : null}
      <Button
        aria-label="查看对话执行详情"
        className={styles.detailButton}
        onClick={onShowDetail}
        variant="secondary"
      >
        查看详情
      </Button>
    </section>
  );
}

/**
 * @param {{
 *   candidates: Array<{
 *     skill: { descriptor: { skillId: string, displayName: string, riskLevel: string } },
 *     score: number,
 *     matchedRules: string[],
 *   }>,
 *   query: { isLoading: boolean, error: Error | null },
 *   task: import("./use-agent-diagnostic-task.js").AgentDiagnosticTaskState,
 *   onShowDetail: () => void,
 * }} props
 */
function SkillEventPanel({ candidates, onShowDetail, query, task }) {
  const primaryCandidate = candidates[0];
  const toolResults = task.result?.toolResults ?? [];
  const candidatePreviewValue = query.isLoading
    ? "loading"
    : query.error
      ? "unavailable"
      : primaryCandidate?.skill.descriptor.skillId.split("-").slice(1, 2)[0] ?? "无候选";
  const latestEventType = task.result
    ? "AGENT_TASK_RESULT"
    : task.status === "running"
      ? "AGENT_TASK_RUNNING"
      : task.errorCode ?? "等待发送";
  const sequenceValue = task.result ? `tools ${task.result.toolCallCount}` : "main";
  const firstToolResult = toolResults[0];
  const firstToolDescriptor = firstToolResult
    ? parseOutputSchemaId(firstToolResult.outputSchemaId)
    : null;

  return (
    <section className={styles.agentPanel}>
      <h3>
        <span aria-hidden="true" className={`${styles.panelIcon} ${styles.panelIconSkill}`}>
          <GitBranch size={15} strokeWidth={2.6} />
        </span>
        {toolResults.length > 0 ? "已执行 Skill" : "候选 Skill 预览"}
      </h3>
      <MiniRow label="最近事件" tone="info" value={latestEventType} />
      <MiniRow label="sequence" tone="info" value={sequenceValue} />
      {toolResults.length > 0 ? (
        <>
          <MiniRow label="已执行" tone="info" value={`${toolResults.length} 个 Skill`} />
          <MiniRow label="首个 Skill" value={firstToolDescriptor?.skillId ?? "unknown-skill"} />
          <MiniRow
            label="状态"
            tone={firstToolResult?.status === "SUCCEEDED" ? "ok" : "danger"}
            value={firstToolResult?.status ?? "unknown"}
          />
        </>
      ) : (
        <>
          <MiniRow label="候选分类" tone="info" value={candidatePreviewValue} />
          <MiniRow
            label="候选 Skill"
            tone="info"
            value={primaryCandidate?.skill.descriptor.skillId ?? candidatePreviewValue}
          />
          <MiniRow
            label="候选风险"
            tone="ok"
            value={primaryCandidate?.skill.descriptor.riskLevel ?? agentRequestScope.policy}
          />
        </>
      )}
      <Button
        aria-label="查看 Skill 调用详情"
        className={styles.detailButton}
        onClick={onShowDetail}
        variant="secondary"
      >
        查看详情
      </Button>
    </section>
  );
}

/**
 * @param {{ toolResult: import("../../schemas/agent-schemas.js").AgentToolResult }} props
 */
function ToolResultCard({ toolResult }) {
  const descriptor = parseOutputSchemaId(toolResult.outputSchemaId);
  const hasError = Boolean(toolResult.errorCode || toolResult.errorMessage);

  return (
    <article className={styles.skillResultCard} aria-label={`Skill 调用 ${descriptor.skillId}`}>
      <div className={styles.skillResultHeader}>
        <strong>{descriptor.skillId}</strong>
        <span>{descriptor.skillVersion}</span>
      </div>
      <div className={styles.skillMetaGrid}>
        <MiniRow label="toolCall" value={toolResult.toolCallId} />
        <MiniRow label="schema" value={toolResult.outputSchemaId} />
        <MiniRow label="状态" tone={hasError ? "danger" : "ok"} value={toolResult.status} />
        <MiniRow label="完成时间" tone="info" value={toolResult.completedAt} />
      </div>
      <div className={styles.ioBlock}>
        <span>Agent 请求入参</span>
        <pre>{formatJson(agentRequestScope.inputParameters)}</pre>
        <small>Skill 原始入参未包含在 AgentTaskResult 中；当前仅展示发起请求的 inputParameters。</small>
      </div>
      <div className={styles.ioBlock}>
        <span>Skill 出参</span>
        <pre>{formatJson(toolResult.output)}</pre>
      </div>
      {hasError ? (
        <div className={`${styles.statusNote} ${styles.errorNote}`}>
          <ShieldCheck aria-hidden="true" size={16} />
          <span>
            {toolResult.errorCode ? `${toolResult.errorCode}: ` : ""}
            {toolResult.errorMessage ?? "Skill 调用失败"}
          </span>
        </div>
      ) : null}
    </article>
  );
}

/**
 * @param {{
 *   onShowDetail: () => void,
 *   task: import("./use-agent-diagnostic-task.js").AgentDiagnosticTaskState,
 * }} props
 */
function SessionContextPanel({ onShowDetail, task }) {
  const hasWorkflowError =
    task.status === "denied" || task.status === "failed" || task.status === "contractError";
  const toolResults = task.result?.toolResults ?? [];

  return (
    <section className={`${styles.agentPanel} ${styles.scanLine}`}>
      <h3>
        <span aria-hidden="true" className={`${styles.panelIcon} ${styles.panelIconSession}`}>
          <ShieldCheck size={15} strokeWidth={2.6} />
        </span>
        执行链
      </h3>
      <MiniRow label="READ_ONLY 策略" tone="ok" value="policy-v1" />
      <MiniRow label="M05 workflow" value={task.workflowId ?? "pending"} />
      <MiniRow label="M07 Worker" tone="info" value={toolResults.length > 0 ? "已执行" : "等待调用"} />
      <MiniRow label="Skill 链路" tone="info" value={toolResults.length > 0 ? `${toolResults.length} 个只读调用` : "等待调用"} />
      <MiniRow label="结果" tone={taskTone(task)} value={task.result?.status ?? taskStateLabel(task.status)} />
      <div className={`${styles.statusNote} ${hasWorkflowError ? styles.errorNote : ""}`}>
        <ShieldCheck aria-hidden="true" size={16} />
        {hasWorkflowError ? (
          <span>
            {task.errorCode ? `${task.errorCode}: ` : ""}
            {task.errorMessage ?? "Agent 诊断请求失败"}
          </span>
        ) : (
          <span>执行链来自 AgentTaskResult 和前端只读请求范围；原始 Skill 参数需由后端契约补充后才能逐项展示。</span>
        )}
      </div>
      <Button
        aria-label="查看执行链详情"
        className={styles.detailButton}
        onClick={onShowDetail}
        variant="secondary"
      >
        查看详情
      </Button>
    </section>
  );
}

/**
 * @param {{
 *   activePanel: "task" | "skill" | "chain" | null,
 *   candidates: Array<{
 *     skill: { descriptor: { skillId: string, displayName: string, riskLevel: string } },
 *     score: number,
 *     matchedRules: string[],
 *   }>,
 *   onClose: () => void,
 *   query: { isLoading: boolean, error: Error | null },
 *   task: import("./use-agent-diagnostic-task.js").AgentDiagnosticTaskState,
 * }} props
 */
function AgentDetailDialog({ activePanel, candidates, onClose, query, task }) {
  useEffect(() => {
    if (!activePanel) {
      return undefined;
    }
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousOverflow;
    };
  }, [activePanel]);

  if (!activePanel) {
    return null;
  }

  const titleByPanel = {
    task: "对话执行详情",
    skill: "Skill 调用详情",
    chain: "执行链详情",
  };
  const titleId = `agent-detail-${activePanel}`;

  return createPortal(
    <div className={styles.detailDialogBackdrop}>
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className={styles.detailDialog}
        role="dialog"
      >
        <header className={styles.detailDialogHeader}>
          <h2 id={titleId}>{titleByPanel[activePanel]}</h2>
          <button
            aria-label="关闭详情"
            className={styles.dialogCloseButton}
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" size={18} />
          </button>
        </header>
        <div className={styles.detailDialogBody}>
          {activePanel === "task" ? <TaskDetailDialogContent task={task} /> : null}
          {activePanel === "skill" ? (
            <SkillDetailDialogContent candidates={candidates} query={query} task={task} />
          ) : null}
          {activePanel === "chain" ? <ExecutionChainDialogContent task={task} /> : null}
        </div>
      </section>
    </div>,
    document.body,
  );
}

/**
 * @param {{ task: import("./use-agent-diagnostic-task.js").AgentDiagnosticTaskState }} props
 */
function TaskDetailDialogContent({ task }) {
  const result = task.result;
  const hasWorkflowError = taskTone(task) === "danger";

  return (
    <>
      <section className={styles.detailDialogSection}>
        <DetailRow label="状态" tone={taskTone(task)} value={result?.status ?? taskStateLabel(task.status)} />
        <DetailRow label="策略" tone="ok" value={agentRequestScope.policy} />
        <DetailRow label="环境" tone="info" value={agentRequestScope.targetEnvironment} />
        <DetailRow label="workflow" value={task.workflowId ?? "pending"} />
        <DetailRow label="task" value={result?.taskId ?? "pending"} />
        <DetailRow
          label="Skill 调用"
          tone="info"
          value={result ? `${result.toolResults.length}/${result.toolCallCount}` : "0/0"}
        />
        {result ? <DetailRow label="完成时间" tone="info" value={result.completedAt} /> : null}
      </section>
      <section className={styles.detailDialogSection}>
        <h4>输入意图</h4>
        <p>{latestUserIntent(task)}</p>
      </section>
      {hasWorkflowError ? (
        <div className={`${styles.statusNote} ${styles.errorNote}`}>
          <ShieldCheck aria-hidden="true" size={16} />
          <span>
            {task.errorCode ? `${task.errorCode}: ` : ""}
            {task.errorMessage ?? result?.summary ?? "Agent 诊断请求失败"}
          </span>
        </div>
      ) : null}
    </>
  );
}

/**
 * @param {{
 *   candidates: Array<{
 *     skill: { descriptor: { skillId: string, displayName: string, riskLevel: string } },
 *     score: number,
 *     matchedRules: string[],
 *   }>,
 *   query: { isLoading: boolean, error: Error | null },
 *   task: import("./use-agent-diagnostic-task.js").AgentDiagnosticTaskState,
 * }} props
 */
function SkillDetailDialogContent({ candidates, query, task }) {
  const toolResults = task.result?.toolResults ?? [];
  const primaryCandidate = candidates[0];

  if (toolResults.length > 0) {
    return (
      <div className={styles.skillResultList}>
        {toolResults.map((toolResult) => (
          <ToolResultCard key={toolResult.toolCallId} toolResult={toolResult} />
        ))}
      </div>
    );
  }

  return (
    <section className={styles.detailDialogSection}>
      <DetailRow
        label="候选状态"
        tone={query.error ? "danger" : "info"}
        value={query.isLoading ? "loading" : query.error ? "unavailable" : "ready"}
      />
      <DetailRow
        label="候选 Skill"
        tone="info"
        value={primaryCandidate?.skill.descriptor.skillId ?? "无候选"}
      />
      <DetailRow
        label="候选风险"
        tone="ok"
        value={primaryCandidate?.skill.descriptor.riskLevel ?? agentRequestScope.policy}
      />
    </section>
  );
}

/**
 * @param {{ task: import("./use-agent-diagnostic-task.js").AgentDiagnosticTaskState }} props
 */
function ExecutionChainDialogContent({ task }) {
  const chainSteps = buildChainSteps(task);

  return (
    <div className={styles.executionChain}>
      {chainSteps.map((step, index) => (
        <div className={styles.chainStep} key={`${step.label}-${index}`}>
          <span>{step.label}</span>
          <strong data-tone={step.tone}>{step.value}</strong>
        </div>
      ))}
    </div>
  );
}

/**
 * @param {{label: string, tone?: "default" | "info" | "ok" | "danger", value: string}} props
 */
function DetailRow({ label, tone = "default", value }) {
  return (
    <div className={styles.detailRow}>
      <span>{label}</span>
      <strong data-tone={tone}>{value}</strong>
    </div>
  );
}

/**
 * @param {{label: string, tone?: "default" | "info" | "ok" | "danger", value: string}} props
 */
function MiniRow({ label, tone = "default", value }) {
  return (
    <div className={styles.miniRow}>
      <span>{label}</span>
      <strong data-tone={tone}>{value}</strong>
    </div>
  );
}
