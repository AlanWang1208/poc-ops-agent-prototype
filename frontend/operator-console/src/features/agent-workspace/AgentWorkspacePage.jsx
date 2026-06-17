import {
  Bot,
  CircleDot,
  ClipboardCheck,
  GitBranch,
  LogOut,
  SendHorizontal,
  ShieldCheck,
  TimerReset,
  UserRound,
} from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getBrowserSession, logout } from "../../api/auth-api.js";
import { Badge } from "../../components/primitives/Badge.jsx";
import { Button } from "../../components/primitives/Button.jsx";
import { useAgentCandidates } from "./use-agent-candidates.js";
import styles from "./AgentWorkspacePage.module.css";

const secondaryConversationActions = ["分享", "接管状态"];
const composerTags = ["+ 服务", "+ 告警", "+ 工单", "+ 历史 workflow"];
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
const OFF_WORK_HOUR = 18;
const WORKDAY_START_HOUR = 9;

const workflowTasks = [
  {
    actions: ["查看结果", "查看事件", "审计记录"],
    attempt: "wf-042 · node-health-read@1.1.0 · attempt 1",
    state: "已完成",
    tone: "success",
    title: "节点健康检查",
    tags: ["development", "node-a", "READ_ONLY", "健康"],
    progress: 4,
  },
  {
    actions: ["查看详情", "请求取消", "事件流接收中"],
    attempt: "wf-043 · service-dependency-health-read@1.0.0 · attempt 1",
    state: "执行中",
    tone: "info",
    title: "服务依赖健康检查",
    tags: ["payment-api", "node-a", "READ_ONLY", "sequence 3"],
    progress: 3,
  },
];

export function AgentWorkspacePage() {
  const [isWorkspaceExpanded, setIsWorkspaceExpanded] = useState(false);
  const candidatesQuery = useAgentCandidates();
  const candidates = candidatesQuery.data?.candidates ?? [];

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
      <TopCapsule />

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
            <Message author="操作员" tone="operator">
              帮我检查 node-a 的健康状态和关键依赖，只做只读诊断，并关联 INC-2841。
            </Message>
            <Message author="Agent" tone="agent">
              已拆分为两个独立只读任务。当前会话来自评审模板，符合范围的任务将在服务端策略通过后自动执行。
            </Message>

            {workflowTasks.map((task) => (
              <WorkflowTaskCard key={task.attempt} task={task} />
            ))}
          </div>

          <div className={styles.exchangeComposer}>
            <div className={styles.composerBox}>
              <p>
                输入你的任务目标，可以是研发排障、数据库巡检、发布前检查或基础设施诊断。例如：检查
                payment-api 最近错误、确认订单库慢查询趋势，并给出只读排查计划。
              </p>
              <div className={styles.composerFooter}>
                <div className={styles.composerTags}>
                  {composerTags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
                <Button
                  aria-label="发送任务"
                  className={styles.sendButton}
                  disabled
                  variant="primary"
                >
                  <SendHorizontal aria-hidden="true" size={18} />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <aside className={styles.agentSide}>
          <TaskDetailPanel />
          <SkillEventPanel candidates={candidates} query={candidatesQuery} />
          <SessionContextPanel />
        </aside>
      </section>
    </div>
  );
}

function TopCapsule() {
  const navigate = useNavigate();
  const sessionQuery = useQuery({
    queryKey: ["browser-session"],
    queryFn: getBrowserSession,
  });
  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      navigate("/login", { replace: true });
    },
  });
  const session = sessionQuery.data;
  const isAuthenticated = session?.authenticated === true;
  const username = isAuthenticated ? (session.username ?? "未登录") : "未登录";
  const operatorId = isAuthenticated ? (session.subject ?? "unavailable") : "unavailable";

  return (
    <section aria-label="当前工作台" className={styles.appCapsule}>
      <div aria-hidden="true" className={styles.logo}>
        EA
      </div>
      <div className={styles.brandLockup}>
        <span className={styles.brandName}>
          <span>企业智能</span>
          <strong>Agent</strong>
        </span>
      </div>
      <div className={styles.capsuleCurrent}>
        <h1 className={styles.capsuleHeading}>Agent 工作区</h1>
      </div>
      <div aria-hidden="true" className={styles.brandSignal}>
        <i />
        <i />
        <i />
      </div>
      <OperatorDock
        isLogoutPending={logoutMutation.isPending}
        onLogout={() => logoutMutation.mutate()}
        operatorId={operatorId}
        username={username}
      />
    </section>
  );
}

/**
 * @param {{
 *   isLogoutPending: boolean,
 *   onLogout: () => void,
 *   operatorId: string,
 *   username: string,
 * }} props
 */
function OperatorDock({ isLogoutPending, onLogout, operatorId, username }) {
  const operatorIdLabel = `ID ${operatorId}`;

  return (
    <section aria-label="当前登录人" className={styles.operatorDock}>
      <div className={styles.operatorProfile} data-operator-profile="">
        <span aria-hidden="true" className={styles.operatorAvatar} data-creative-avatar="operator">
          <span className={styles.operatorAvatarCore} />
          <span className={styles.operatorAvatarOrbit} />
        </span>
        <span className={styles.operatorIdentity}>
          <strong title={username}>{username}</strong>
          <small aria-label={operatorIdLabel} title={operatorIdLabel}>
            {operatorIdLabel}
          </small>
        </span>
      </div>
      <WorkdayCountdown />
      <button
        aria-label="登出当前账号"
        className={styles.logoutButton}
        disabled={isLogoutPending}
        onClick={onLogout}
        type="button"
      >
        <span aria-hidden="true" className={styles.logoutIconBadge}>
          <LogOut size={14} strokeWidth={2.6} />
        </span>
        <span>登出</span>
      </button>
    </section>
  );
}

/**
 * @param {Date} now
 */
function getOffWorkCountdown(now) {
  const start = new Date(now);
  start.setHours(WORKDAY_START_HOUR, 0, 0, 0);

  const target = new Date(now);
  target.setHours(OFF_WORK_HOUR, 0, 0, 0);

  const remainingMs = Math.max(target.getTime() - now.getTime(), 0);
  const workdayMs = target.getTime() - start.getTime();
  const elapsedMs = Math.min(Math.max(now.getTime() - start.getTime(), 0), workdayMs);
  const progress = workdayMs > 0 ? Math.round((elapsedMs / workdayMs) * 100) : 100;

  const hours = Math.floor(remainingMs / 3_600_000);
  const minutes = Math.floor((remainingMs % 3_600_000) / 60_000);
  const seconds = Math.floor((remainingMs % 60_000) / 1_000);

  return {
    progress,
    timeText: [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":"),
  };
}

function WorkdayCountdown() {
  const [now, setNow] = useState(() => new Date());
  const countdown = getOffWorkCountdown(now);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1_000);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <div
      aria-label={`下班倒计时：${countdown.timeText}`}
      className={styles.workdayCountdown}
      data-creative-timer="workday-countdown"
      role="timer"
    >
      <span aria-hidden="true" className={styles.countdownGlyph}>
        <TimerReset size={14} strokeWidth={2.6} />
      </span>
      <span className={styles.countdownContent}>
        <span>下班倒计时</span>
        <strong>{countdown.timeText}</strong>
      </span>
      <span aria-hidden="true" className={styles.countdownTrack}>
        <span style={{ width: `${countdown.progress}%` }} />
      </span>
    </div>
  );
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
    <article className={`${styles.message} ${styles[tone]}`}>
      <strong>
        <span aria-hidden="true" className={styles.messageRoleIcon}>
          <RoleIcon size={15} strokeWidth={2.6} />
        </span>
        <span className={styles.messageTitleText}>{author}</span>
      </strong>
      <span aria-hidden="true" className={styles.messageDivider} />
      <span className={styles.messageContent}>{children}</span>
    </article>
  );
}

/**
 * @param {{
 *   task: {
 *     actions: string[],
 *     attempt: string,
 *     progress: number,
 *     state: string,
 *     tags: string[],
 *     title: string,
 *     tone: string,
 *   },
 * }} props
 */
function WorkflowTaskCard({ task }) {
  return (
    <article className={`${styles.workflowTaskCard} ${styles[task.tone]}`}>
      <div className={styles.workflowTaskHead}>
        <div>
          <strong>{task.title}</strong>
          <small>{task.attempt}</small>
        </div>
        <span className={styles.workflowTaskState}>{task.state}</span>
      </div>
      <div className={styles.workflowTaskTags}>
        {task.tags.map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
      <div className={styles.workflowTaskProgress} aria-label={`${task.title} 进度`}>
        {Array.from({ length: 4 }, (_, index) => (
          <span className={index < task.progress ? styles.done : ""} key={index} />
        ))}
      </div>
      <div className={styles.workflowTaskActions}>
        {task.actions.map((action) => (
          <span key={action}>{action}</span>
        ))}
      </div>
    </article>
  );
}

function TaskDetailPanel() {
  return (
    <section className={styles.agentPanel}>
      <h3>
        <span aria-hidden="true" className={`${styles.panelIcon} ${styles.panelIconTask}`}>
          <ClipboardCheck size={15} strokeWidth={2.6} />
        </span>
        选中任务详情
      </h3>
      <MiniRow label="workflow" value="wf-043" />
      <MiniRow label="状态" tone="info" value="执行中" />
      <MiniRow label="策略" tone="ok" value="READ_ONLY" />
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
 * }} props
 */
function SkillEventPanel({ candidates, query }) {
  const primaryCandidate = candidates[0];
  const skillValue = query.isLoading
    ? "loading"
    : query.error
      ? "unavailable"
      : primaryCandidate?.skill.descriptor.skillId.split("-").slice(1, 2)[0] ?? "dependency";

  return (
    <section className={styles.agentPanel}>
      <h3>
        <span aria-hidden="true" className={`${styles.panelIcon} ${styles.panelIconSkill}`}>
          <GitBranch size={15} strokeWidth={2.6} />
        </span>
        Skill 与事件
      </h3>
      <MiniRow label="Skill" tone="info" value={skillValue} />
      <MiniRow label="最近事件" tone="info" value="WORKER_ACCEPTED" />
      <MiniRow label="sequence" tone="info" value="3 / continuous" />
    </section>
  );
}

function SessionContextPanel() {
  return (
    <section className={`${styles.agentPanel} ${styles.scanLine}`}>
      <h3>
        <span aria-hidden="true" className={`${styles.panelIcon} ${styles.panelIconSession}`}>
          <ShieldCheck size={15} strokeWidth={2.6} />
        </span>
        会话上下文
      </h3>
      <MiniRow label="目标" tone="info" value="node-a" />
      <MiniRow label="关联工单" tone="info" value="INC-2841" />
      <MiniRow label="自动模式" tone="ok" value="模板启用" />
      <MiniRow label="分享" tone="info" value="只读链接" />
      <div className={styles.statusNote}>
        <ShieldCheck aria-hidden="true" size={16} />
        仅展示可审计计划摘要、事件状态和服务端候选 Skill。
      </div>
    </section>
  );
}

/**
 * @param {{label: string, tone?: "default" | "info" | "ok", value: string}} props
 */
function MiniRow({ label, tone = "default", value }) {
  return (
    <div className={styles.miniRow}>
      <span>{label}</span>
      <strong data-tone={tone}>{value}</strong>
    </div>
  );
}
