import { ApiError } from "../../api/client.js";
import { DisabledFeature } from "../../components/feedback/DisabledFeature.jsx";
import { FeedbackState } from "../../components/feedback/FeedbackState.jsx";
import { PageHeader } from "../../components/layout/PageHeader.jsx";
import { useAgentCandidates } from "./use-agent-candidates.js";
import styles from "./AgentWorkspacePage.module.css";

export function AgentWorkspacePage() {
  const candidates = useAgentCandidates();

  return (
    <div className={styles.workspace}>
      <PageHeader
        description="查看只读 Skill 候选、匹配规则和可审计计划摘要；任务发送入口在真实工作流接口开放前保持禁用。"
        title="Agent 工作台"
      />
      <div className={styles.grid}>
        <section className={styles.sessionCard}>
          <div className={styles.cardHeader}>
            <div>
              <h2>工作会话</h2>
              <p>
                当前仅呈现控制面返回的候选能力。通用 Agent 对话、计划生成和执行提交尚未开放。
              </p>
            </div>
            <span className="badge badge--success">READ_ONLY</span>
          </div>

          <div className={styles.composer}>
            <div aria-label="任务输入预览" className={styles.promptBox}>
              描述一次只读诊断意图后，后续版本将由控制面生成可审计计划摘要。
            </div>
            <DisabledFeature
              actionLabel="发送任务"
              reason="通用 Agent 对话接口尚未开放"
              title="任务发送已禁用"
            />
          </div>

          <CandidatePanel query={candidates} />
        </section>

        <aside className={styles.rail}>
          <section className={styles.sideCard}>
            <h2>会话上下文</h2>
            <p>
              页面不读取模型内部推理，也不把浏览器缓存作为授权或执行事实源。
            </p>
          </section>
          <section className={styles.sideCard}>
            <h2>审计摘要</h2>
            <ul className={styles.auditList}>
              <li>候选 Skill 来自 M04 路由搜索接口。</li>
              <li>风险上限固定为 READ_ONLY。</li>
              <li>任务执行仍需后续持久化工作流入口。</li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}

/**
 * @param {{query: ReturnType<typeof useAgentCandidates>}} props
 */
function CandidatePanel({ query }) {
  if (query.isPending) {
    return (
      <FeedbackState
        message="正在读取控制面返回的只读候选能力。"
        state="loading"
        title="候选能力读取中"
      />
    );
  }

  if (query.isError) {
    const isForbidden = query.error instanceof ApiError && query.error.kind === "forbidden";
    return (
      <FeedbackState
        message={
          isForbidden
            ? "服务端策略拒绝了候选能力查询。"
            : "候选能力响应无法被安全读取。"
        }
        state="error"
        title={isForbidden ? "候选能力读取被拒绝" : "候选能力读取失败"}
      />
    );
  }

  if (query.data.candidates.length === 0) {
    return (
      <FeedbackState
        message="控制面当前没有返回符合 P1 只读条件的候选 Skill。"
        state="empty"
        title="没有可用候选 Skill"
      />
    );
  }

  return (
    <ul className={styles.candidateList} aria-label="候选 Skill">
      {query.data.candidates.map((candidate) => (
        <CandidateCard
          candidate={candidate}
          key={`${candidate.skill.descriptor.skillId}:${candidate.skill.descriptor.version}`}
        />
      ))}
    </ul>
  );
}

/**
 * @param {{candidate: import("../../schemas/agent-schemas.js").SkillRouteCandidate}} props
 */
function CandidateCard({ candidate }) {
  const descriptor = candidate.skill.descriptor;
  return (
    <li className={styles.candidate}>
      <div className={styles.candidateTitle}>
        <div>
          <h3>{descriptor.skillId}</h3>
          <p>{descriptor.description}</p>
        </div>
        <span className="badge badge--info">score {candidate.score}</span>
      </div>
      <div className={styles.metaGrid}>
        <div>
          <strong>Owner</strong>
          <span>{descriptor.owner}</span>
        </div>
        <div>
          <strong>Version</strong>
          <span>{descriptor.version}</span>
        </div>
        <div>
          <strong>Release</strong>
          <span>{candidate.releaseSnapshot.stage}</span>
        </div>
      </div>
      <div className={styles.ruleList} aria-label="匹配规则">
        {candidate.matchedRules.map((rule) => (
          <span key={rule}>{rule}</span>
        ))}
      </div>
    </li>
  );
}
