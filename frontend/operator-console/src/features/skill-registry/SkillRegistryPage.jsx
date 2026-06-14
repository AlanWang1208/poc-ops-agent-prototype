import { useMemo, useState } from "react";

import { ApiError } from "../../api/client.js";
import { DataTable } from "../../components/data-display/DataTable.jsx";
import { StatusPill } from "../../components/data-display/StatusPill.jsx";
import { FeedbackState } from "../../components/feedback/FeedbackState.jsx";
import { PageHeader } from "../../components/layout/PageHeader.jsx";
import { Button } from "../../components/primitives/Button.jsx";
import { useSkills } from "./use-skills.js";
import styles from "./SkillRegistryPage.module.css";

export function SkillRegistryPage() {
  const skills = useSkills();
  const [query, setQuery] = useState("");
  const [risk, setRisk] = useState("ALL");
  const [category, setCategory] = useState("ALL");

  const filteredSkills = useMemo(() => {
    const catalog = skills.data?.skills ?? [];
    return catalog.filter((skill) => {
      const descriptor = skill.descriptor;
      const matchesQuery =
        !query.trim() ||
        descriptor.skillId.toLowerCase().includes(query.trim().toLowerCase()) ||
        descriptor.owner.toLowerCase().includes(query.trim().toLowerCase());
      const matchesRisk = risk === "ALL" || descriptor.riskLevel === risk;
      const matchesCategory = category === "ALL" || descriptor.category === category;
      return matchesQuery && matchesRisk && matchesCategory;
    });
  }, [category, query, risk, skills.data?.skills]);

  const selectedSkill = filteredSkills[0] ?? null;

  return (
    <div className={styles.page}>
      <PageHeader
        description="浏览控制面注册并发布的 Skill。变更类操作必须等待服务端受控接口、策略和审计链路开放。"
        title="Skill 注册中心"
      />
      <section className={styles.toolbar} aria-label="Skill 筛选">
        <label>
          搜索
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Skill ID 或 Owner"
            value={query}
          />
        </label>
        <label>
          分类
          <select onChange={(event) => setCategory(event.target.value)} value={category}>
            <option value="ALL">全部分类</option>
            <option value="INFRASTRUCTURE_DIAGNOSTICS">基础设施诊断</option>
            <option value="APPLICATION_DIAGNOSTICS">应用诊断</option>
            <option value="PLATFORM_OBSERVABILITY">平台可观测</option>
          </select>
        </label>
        <label>
          风险
          <select onChange={(event) => setRisk(event.target.value)} value={risk}>
            <option value="ALL">全部风险</option>
            <option value="READ_ONLY">只读</option>
            <option value="LOW">低风险</option>
            <option value="MEDIUM">中风险</option>
            <option value="HIGH">高风险</option>
          </select>
        </label>
      </section>
      <div className={styles.layout}>
        <section className={styles.panel}>
          <SkillCatalogState query={skills} rows={filteredSkills} />
        </section>
        <SkillDetail skill={selectedSkill} />
      </div>
    </div>
  );
}

/**
 * @param {{query: ReturnType<typeof useSkills>, rows: unknown[]}} props
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
    <DataTable
      ariaLabel="Skill 目录"
      columns={skillColumns}
      rows={rows}
    />
  );
}

const skillColumns = [
  {
    key: "skill",
    header: "Skill",
    render: (/** @type {unknown} */ row) => {
      const skill = /** @type {import("../../schemas/skill-schemas.js").RegisteredSkill} */ (row);
      return (
        <div>
          <strong>{skill.descriptor.skillId}</strong>
          <div className={styles.muted}>{skill.descriptor.displayName}</div>
        </div>
      );
    },
  },
  {
    key: "risk",
    header: "Risk",
    render: (/** @type {unknown} */ row) => {
      const skill = /** @type {import("../../schemas/skill-schemas.js").RegisteredSkill} */ (row);
      return <StatusPill tone="success">{skill.descriptor.riskLevel}</StatusPill>;
    },
  },
  {
    key: "owner",
    header: "Owner",
    render: (/** @type {unknown} */ row) => {
      const skill = /** @type {import("../../schemas/skill-schemas.js").RegisteredSkill} */ (row);
      return skill.descriptor.owner;
    },
  },
  {
    key: "status",
    header: "Status",
    render: (/** @type {unknown} */ row) => {
      const skill = /** @type {import("../../schemas/skill-schemas.js").RegisteredSkill} */ (row);
      return <StatusPill tone="info">{skill.publicationStatus}</StatusPill>;
    },
  },
];

/**
 * @param {{skill: import("../../schemas/skill-schemas.js").RegisteredSkill | null}} props
 */
function SkillDetail({ skill }) {
  return (
    <aside className={styles.detail}>
      <h2>Skill 详情</h2>
      {skill ? (
        <>
          <p>{skill.descriptor.description}</p>
          <div className={styles.tagList}>
            <span>{skill.descriptor.category}</span>
            <span>{skill.descriptor.executor}</span>
            <span>{skill.descriptor.outputType}</span>
          </div>
        </>
      ) : (
        <p>选择列表中的 Skill 查看详情。</p>
      )}
      <p className={styles.muted}>服务端未提供受控变更接口</p>
      <div className={styles.actionStack}>
        <Button disabled variant="secondary">安装</Button>
        <Button disabled variant="secondary">升级</Button>
        <Button disabled variant="danger">卸载</Button>
      </div>
    </aside>
  );
}
