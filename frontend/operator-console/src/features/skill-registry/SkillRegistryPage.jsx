import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { searchSkillCandidates } from "../../api/agent-api.js";
import { ApiError } from "../../api/client.js";
import { FeedbackState } from "../../components/feedback/FeedbackState.jsx";
import { WorkspacePageFrame } from "../../components/layout/WorkspacePageFrame.jsx";
import { WorkspaceStatusBar } from "../../components/layout/WorkspaceStatusBar.jsx";
import { useSkills } from "./use-skills.js";
import styles from "./SkillRegistryPage.module.css";

/** @typedef {import("../../schemas/skill-schemas.js").RegisteredSkill} RegisteredSkill */
/** @typedef {import("../../schemas/agent-schemas.js").SkillRouteCandidate} SkillRouteCandidate */
/** @typedef {{status: "idle" | "loading" | "success" | "error", query: string, candidates: SkillRouteCandidate[], error: unknown}} CandidateSearchState */

const defaultCandidateCriteria = {
  skillId: null,
  category: null,
  maxRiskLevel: "READ_ONLY",
  requiredParameters: [],
  requiredTags: [],
  requestContextTags: [],
  publicationStatusRequired: "VALIDATED",
};

const categoryTerms = [
  {
    value: "APPLICATION_DIAGNOSTICS",
    terms: ["应用", "服务", "日志", "依赖", "app", "application", "service", "dependency", "log"],
  },
  {
    value: "INFRASTRUCTURE_DIAGNOSTICS",
    terms: ["基础设施", "节点", "主机", "服务器", "证书", "infra", "infrastructure", "node", "host", "certificate"],
  },
  {
    value: "PLATFORM_OBSERVABILITY",
    terms: ["平台", "告警", "天气", "观测", "指标", "platform", "alert", "weather", "observability", "metric"],
  },
];

const tagTerms = [
  { tag: "log", terms: ["日志", "log"] },
  { tag: "summary", terms: ["摘要", "summary"] },
  { tag: "health", terms: ["健康", "health"] },
  { tag: "dependency", terms: ["依赖", "dependency"] },
  { tag: "weather", terms: ["天气", "weather"] },
  { tag: "alert", terms: ["告警", "alert"] },
  { tag: "certificate", terms: ["证书", "certificate"] },
  { tag: "expiry", terms: ["到期", "过期", "expiry", "expiration"] },
];

const filterOptions = [
  { label: "全部", value: "ALL" },
  { label: "INFRASTRUCTURE", value: "INFRASTRUCTURE_DIAGNOSTICS" },
  { label: "APPLICATION", value: "APPLICATION_DIAGNOSTICS" },
  { label: "OBSERVABILITY", value: "PLATFORM_OBSERVABILITY" },
  { label: "READ_ONLY", value: "READ_ONLY" },
  { label: "已签名", value: "VALIDATED" },
];

export function SkillRegistryPage() {
  const skills = useSkills();
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [naturalLanguageQuery, setNaturalLanguageQuery] = useState("");
  const [candidateSearch, setCandidateSearch] = useState(
    /** @type {CandidateSearchState} */ ({
      status: "idle",
      query: "",
      candidates: [],
      error: null,
    }),
  );

  const filteredSkills = useMemo(() => {
    const catalog = skills.data?.skills ?? [];
    return catalog.filter((skill) => {
      const descriptor = skill.descriptor;
      return (
        activeFilter === "ALL" ||
        descriptor.category === activeFilter ||
        descriptor.riskLevel === activeFilter ||
        skill.publicationStatus === activeFilter
      );
    });
  }, [activeFilter, skills.data?.skills]);

  const selectedSkill = filteredSkills[0] ?? null;
  const isCandidateSearchLoading = candidateSearch.status === "loading";

  /**
   * @param {import("react").FormEvent<HTMLFormElement>} event
   */
  async function handleNaturalLanguageSubmit(event) {
    event.preventDefault();
    const query = naturalLanguageQuery.trim();
    if (query.length === 0) {
      setCandidateSearch({
        status: "idle",
        query: "",
        candidates: [],
        error: null,
      });
      return;
    }

    setCandidateSearch({
      status: "loading",
      query,
      candidates: [],
      error: null,
    });

    try {
      const response = await searchSkillCandidates(buildRoutingCriteriaFromNaturalLanguage(query));
      setCandidateSearch({
        status: "success",
        query,
        candidates: response.candidates,
        error: null,
      });
    } catch (error) {
      setCandidateSearch({
        status: "error",
        query,
        candidates: [],
        error,
      });
    }
  }

  return (
    <WorkspacePageFrame className={styles.registryCanvas}>
      <WorkspaceStatusBar title="Skill 注册中心" />

      <main className={styles.workspaceBody}>
        <section className={styles.filters} aria-label="Skill 分类筛选">
          <form
            aria-label="Skill 自然语言查询"
            className={styles.queryForm}
            onSubmit={handleNaturalLanguageSubmit}
          >
            <label className={styles.queryLabel} htmlFor="skill-natural-language-query">
              自然语言查询 Skill
            </label>
            <div className={styles.queryControls}>
              <input
                autoComplete="off"
                id="skill-natural-language-query"
                maxLength={160}
                onChange={(event) => setNaturalLanguageQuery(event.target.value)}
                placeholder="应用日志、节点健康、天气"
                type="search"
                value={naturalLanguageQuery}
              />
              <button
                disabled={isCandidateSearchLoading || naturalLanguageQuery.trim().length === 0}
                type="submit"
              >
                <Search aria-hidden="true" size={16} strokeWidth={2.4} />
                {isCandidateSearchLoading ? "查询中" : "查询候选 Skill"}
              </button>
            </div>
          </form>

          <SkillCandidateSearchState state={candidateSearch} />

          <div className={styles.filterChips}>
            {filterOptions.map((option) => (
              <button
                aria-pressed={activeFilter === option.value}
                className={activeFilter === option.value ? styles.activeChip : ""}
                key={option.value}
                onClick={() => setActiveFilter(option.value)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        </section>

        <section className={styles.registryTable} aria-label="内置 Skill 目录">
          <h2>内置 Skill</h2>
          <SkillCatalogState query={skills} rows={filteredSkills} />
        </section>

        <SkillDetail skill={selectedSkill} />
      </main>
    </WorkspacePageFrame>
  );
}

/**
 * @param {{state: CandidateSearchState}} props
 */
function SkillCandidateSearchState({ state }) {
  if (state.status === "idle") {
    return null;
  }

  if (state.status === "loading") {
    return (
      <p className={styles.searchState} role="status">
        正在查询候选 Skill
      </p>
    );
  }

  if (state.status === "error") {
    const isForbidden = state.error instanceof ApiError && state.error.kind === "forbidden";
    const isContract = state.error instanceof ApiError && state.error.kind === "contract";
    return (
      <FeedbackState
        message={
          isForbidden
            ? "服务端策略拒绝查询候选 Skill。"
            : "候选 Skill 响应无法被操作台安全解析。"
        }
        state="error"
        title={
          isForbidden
            ? "候选查询被拒绝"
            : isContract
              ? "候选查询契约不兼容"
              : "候选查询失败"
        }
      />
    );
  }

  if (state.candidates.length === 0) {
    return (
      <FeedbackState
        message={`没有返回与“${state.query}”匹配的已签名只读候选。`}
        state="empty"
        title="无候选 Skill"
      />
    );
  }

  return (
    <section aria-label="候选 Skill" className={styles.candidateResults}>
      <h2>候选 Skill</h2>
      <ul className={styles.candidateList}>
        {state.candidates.map((candidate) => (
          <li
            className={styles.candidate}
            key={`${candidate.skill.descriptor.skillId}:${candidate.skill.descriptor.version}`}
          >
            <div className={styles.candidateHeader}>
              <strong className={styles.skillId}>{candidate.skill.descriptor.skillId}</strong>
              <small>{candidate.skill.descriptor.displayName}</small>
            </div>
            <span className={styles.candidateScore}>候选分 {candidate.score}</span>
            <p className={styles.candidateRules}>{formatValues(candidate.matchedRules)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * @param {{query: ReturnType<typeof useSkills>, rows: RegisteredSkill[]}} props
 */
function SkillCatalogState({ query, rows }) {
  if (query.isPending) {
    return (
      <FeedbackState
        message="正在读取控制面 Skill 目录。"
        state="loading"
        title="Skill 目录读取中"
      />
    );
  }

  if (query.isError) {
    const isForbidden = query.error instanceof ApiError && query.error.kind === "forbidden";
    const isContract = query.error instanceof ApiError && query.error.kind === "contract";
    return (
      <FeedbackState
        message={
          isForbidden
            ? "服务端策略拒绝读取 Skill 目录。"
            : "Skill 目录响应无法被操作台安全解析。"
        }
        state="error"
        title={
          isForbidden
            ? "Skill 目录读取被拒绝"
            : isContract
              ? "Skill 目录契约不兼容"
              : "Skill 目录读取失败"
        }
      />
    );
  }

  if (rows.length === 0) {
    return (
      <FeedbackState
        message="控制面当前没有返回符合筛选条件的 Skill。"
        state="empty"
        title="没有已注册 Skill"
      />
    );
  }

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Skill ID</th>
          <th>显示名</th>
          <th>分类</th>
          <th>版本</th>
          <th>风险</th>
          <th>必要角色</th>
          <th>状态</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((skill) => (
          <tr key={`${skill.descriptor.skillId}:${skill.descriptor.version}`}>
            <td>
              <strong className={styles.skillId}>{skill.descriptor.skillId}</strong>
            </td>
            <td>{skill.descriptor.displayName}</td>
            <td>{formatCategory(skill.descriptor.category)}</td>
            <td>{skill.descriptor.version}</td>
            <td className={styles.riskCell}>{skill.descriptor.riskLevel}</td>
            <td>{formatRequiredRoles(skill.descriptor.requiredRoles)}</td>
            <td>{formatPublicationStatus(skill.publicationStatus)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * @param {{skill: RegisteredSkill | null}} props
 */
function SkillDetail({ skill }) {
  return (
    <aside className={styles.detail}>
      {skill ? (
        <>
          <h2>选中项详情： {skill.descriptor.displayName}</h2>
          <p className={styles.detailSummary}>
            Owner: {skill.descriptor.owner} · Executor: {skill.descriptor.executor} ·
            Interceptors: {formatValues(skill.descriptor.interceptors)} · 参数:{" "}
            {formatParameters(skill)} · 输出: {skill.descriptor.outputType}
          </p>
        </>
      ) : (
        <>
          <h2>选中项详情</h2>
          <p>选择列表中的 Skill 查看详情。</p>
        </>
      )}
      <p className={styles.muted}>服务端未提供受控变更接口</p>
    </aside>
  );
}

/**
 * @param {string} category
 */
function formatCategory(category) {
  if (category === "INFRASTRUCTURE_DIAGNOSTICS") {
    return "INFRA";
  }
  if (category === "APPLICATION_DIAGNOSTICS") {
    return "APP";
  }
  return "OBS";
}

/**
 * @param {string} status
 */
function formatPublicationStatus(status) {
  if (status === "VALIDATED") {
    return "已签名";
  }
  if (status === "DRAFT") {
    return "草稿";
  }
  return "已拒绝";
}

/**
 * @param {string[]} values
 */
function formatValues(values) {
  return values.length > 0 ? values.join(" / ") : "无";
}

/**
 * @param {string[]} values
 */
function formatRequiredRoles(values) {
  const displayValues = values.map((value) => value.replace(/^ROLE_/u, ""));
  return formatValues(displayValues);
}

/**
 * @param {RegisteredSkill} skill
 */
function formatParameters(skill) {
  const names = skill.descriptor.parameters.map((parameter) => parameter.name);
  return names.length > 0 ? names.join(" / ") : "无参数";
}

/**
 * @param {string} query
 */
function buildRoutingCriteriaFromNaturalLanguage(query) {
  const normalizedQuery = normalizeNaturalLanguageQuery(query);
  return {
    ...defaultCandidateCriteria,
    skillId: extractSkillId(normalizedQuery),
    category: resolveCategory(normalizedQuery),
    requiredTags: resolveTags(normalizedQuery),
  };
}

/**
 * @param {string} query
 */
function normalizeNaturalLanguageQuery(query) {
  return query.normalize("NFKC").trim().toLowerCase();
}

/**
 * @param {string} normalizedQuery
 */
function extractSkillId(normalizedQuery) {
  const match = /\b[a-z][a-z0-9-]*-read\b/u.exec(normalizedQuery);
  return match ? match[0] : null;
}

/**
 * @param {string} normalizedQuery
 */
function resolveCategory(normalizedQuery) {
  const category = categoryTerms.find((option) =>
    option.terms.some((term) => normalizedQuery.includes(term)),
  );
  return category?.value ?? null;
}

/**
 * @param {string} normalizedQuery
 */
function resolveTags(normalizedQuery) {
  return tagTerms
    .filter((option) => option.terms.some((term) => normalizedQuery.includes(term)))
    .map((option) => option.tag);
}
