import { useMemo, useState } from "react";

import { ApiError } from "../../api/client.js";
import { FeedbackState } from "../../components/feedback/FeedbackState.jsx";
import { WorkspacePageFrame } from "../../components/layout/WorkspacePageFrame.jsx";
import { WorkspaceStatusBar } from "../../components/layout/WorkspaceStatusBar.jsx";
import { useSkills } from "./use-skills.js";
import styles from "./SkillRegistryPage.module.css";

/** @typedef {import("../../schemas/skill-schemas.js").RegisteredSkill} RegisteredSkill */

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

  return (
    <WorkspacePageFrame className={styles.registryCanvas}>
      <WorkspaceStatusBar title="Skill 注册中心" />

      <main className={styles.workspaceBody}>
        <section className={styles.filters} aria-label="Skill 分类筛选">
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
