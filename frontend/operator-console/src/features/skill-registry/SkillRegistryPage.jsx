import { useMemo, useState } from "react";
import { Eye, Search } from "lucide-react";

import { ApiError } from "../../api/client.js";
import { DataTable } from "../../components/data-display/DataTable.jsx";
import { StatusPill } from "../../components/data-display/StatusPill.jsx";
import { FeedbackState } from "../../components/feedback/FeedbackState.jsx";
import { WorkspacePageFrame } from "../../components/layout/WorkspacePageFrame.jsx";
import { WorkspaceStatusBar } from "../../components/layout/WorkspaceStatusBar.jsx";
import { Dialog } from "../../components/primitives/Dialog.jsx";
import { useSkills } from "./use-skills.js";
import styles from "./SkillRegistryPage.module.css";

/** @typedef {import("../../schemas/skill-schemas.js").RegisteredSkill} RegisteredSkill */

const PAGE_SIZE = 5;

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
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [detailSkill, setDetailSkill] = useState(/** @type {RegisteredSkill | null} */ (null));

  const filteredSkills = useMemo(() => {
    const catalog = skills.data?.skills ?? [];
    const normalizedKeyword = keyword.trim().toLowerCase();
    return catalog.filter((skill) => {
      const descriptor = skill.descriptor;
      const filterMatched =
        activeFilter === "ALL" ||
        descriptor.category === activeFilter ||
        descriptor.riskLevel === activeFilter ||
        skill.publicationStatus === activeFilter;
      if (!filterMatched) {
        return false;
      }
      if (!normalizedKeyword) {
        return true;
      }
      return [
        descriptor.skillId,
        descriptor.displayName,
        descriptor.description,
        descriptor.owner,
        descriptor.executor,
        descriptor.outputType,
        ...descriptor.tags,
        ...descriptor.parameters.map((parameter) => parameter.name),
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedKeyword);
    });
  }, [activeFilter, keyword, skills.data?.skills]);

  return (
    <WorkspacePageFrame className={styles.registryCanvas}>
      <WorkspaceStatusBar title="Skill 注册中心" />

      <main className={styles.workspaceBody}>
        <section className={styles.filters} aria-label="Skill 条件匹配">
          <label className={styles.searchBox}>
            <Search aria-hidden="true" size={16} strokeWidth={2.3} />
            <span>搜索 Skill</span>
            <input
              aria-label="搜索 Skill ID、描述、Owner、参数或标签"
              onChange={(event) => {
                setKeyword(event.target.value);
                setPage(1);
              }}
              placeholder="Skill ID / 描述 / Owner / 参数 / 标签"
              type="search"
              value={keyword}
            />
          </label>

          <div className={styles.filterChips}>
            {filterOptions.map((option) => (
              <button
                aria-pressed={activeFilter === option.value}
                className={activeFilter === option.value ? styles.activeChip : ""}
                key={option.value}
                onClick={() => {
                  setActiveFilter(option.value);
                  setPage(1);
                }}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        </section>

        <section className={styles.registryTable} aria-label="内置 Skill 目录">
          <div className={styles.tableHeader}>
            <div>
              <h2>内置 Skill</h2>
              <p>
                {filteredSkills.length} 个匹配项，来源于 M03 已签名发布目录。
              </p>
            </div>
          </div>
          <SkillCatalogState
            page={page}
            query={skills}
            rows={filteredSkills}
            setPage={setPage}
            showDetail={setDetailSkill}
          />
        </section>
      </main>

      <SkillDetailDialog
        onClose={() => setDetailSkill(null)}
        skill={detailSkill}
      />
    </WorkspacePageFrame>
  );
}

/**
 * @param {{
 *   page: number,
 *   query: ReturnType<typeof useSkills>,
 *   rows: RegisteredSkill[],
 *   setPage: (page: number) => void,
 *   showDetail: (skill: RegisteredSkill) => void,
 * }} props
 */
function SkillCatalogState({ page, query, rows, setPage, showDetail }) {
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

  return (
    <DataTable
      ariaLabel="内置 Skill 表格"
      columns={skillColumns(showDetail)}
      emptyMessage="控制面当前没有返回符合筛选条件的 Skill。"
      emptyTitle="没有已注册 Skill"
      getRowKey={(row) => {
        const skill = /** @type {RegisteredSkill} */ (row);
        return `${skill.descriptor.skillId}:${skill.descriptor.version}`;
      }}
      minWidth="1040px"
      onRowClick={(row) => showDetail(/** @type {RegisteredSkill} */ (row))}
      pagination={{
        page,
        pageSize: PAGE_SIZE,
        total: rows.length,
        onPageChange: setPage,
      }}
      rows={rows}
    />
  );
}

/**
 * @param {(skill: RegisteredSkill) => void} showDetail
 * @returns {Array<{header: string, key: string, render: (row: unknown) => import("react").ReactNode, align?: "left" | "center" | "right", width?: string}>}
 */
function skillColumns(showDetail) {
  return [
    {
      header: "Skill ID",
      key: "skill",
      render: (row) => {
        const skill = /** @type {RegisteredSkill} */ (row);
        return (
          <span className={styles.primaryCell}>
            <strong className={styles.skillId}>{skill.descriptor.skillId}</strong>
            <small>{formatCategory(skill.descriptor.category)} · v{skill.descriptor.version}</small>
          </span>
        );
      },
      width: "24%",
    },
    {
      header: "描述",
      key: "description",
      render: (row) => {
        const skill = /** @type {RegisteredSkill} */ (row);
        return (
          <span className={styles.descriptionCell}>
            <strong>{skill.descriptor.displayName}</strong>
            <small>{skill.descriptor.description}</small>
          </span>
        );
      },
      width: "30%",
    },
    {
      header: "条件匹配",
      key: "match",
      render: (row) => {
        const skill = /** @type {RegisteredSkill} */ (row);
        return (
          <span className={styles.matchCell}>
            <span>参数: {formatParameters(skill)}</span>
            <span>标签: {formatValues(skill.descriptor.tags)}</span>
            <span>角色: {formatRequiredRoles(skill.descriptor.requiredRoles)}</span>
          </span>
        );
      },
      width: "26%",
    },
    {
      header: "风险",
      key: "risk",
      render: (row) => {
        const skill = /** @type {RegisteredSkill} */ (row);
        return (
          <StatusPill tone={skill.descriptor.readOnly ? "success" : "warning"}>
            {skill.descriptor.riskLevel}
          </StatusPill>
        );
      },
      width: "9%",
    },
    {
      header: "状态",
      key: "status",
      render: (row) => {
        const skill = /** @type {RegisteredSkill} */ (row);
        return formatPublicationStatus(skill.publicationStatus);
      },
      width: "7%",
    },
    {
      align: "right",
      header: "详情",
      key: "action",
      render: (row) => {
        const skill = /** @type {RegisteredSkill} */ (row);
        return (
          <button
            aria-label={`查看 ${skill.descriptor.displayName} 详情`}
            className={styles.detailButton}
            onClick={(event) => {
              event.stopPropagation();
              showDetail(skill);
            }}
            type="button"
          >
            <Eye aria-hidden="true" size={15} strokeWidth={2.35} />
            查看
          </button>
        );
      },
      width: "4%",
    },
  ];
}

/**
 * @param {{onClose: () => void, skill: RegisteredSkill | null}} props
 */
function SkillDetailDialog({ onClose, skill }) {
  return (
    <Dialog
      closeLabel="关闭 Skill 详情"
      description={skill?.descriptor.description}
      eyebrow="Skill 详情"
      icon={<Eye size={18} strokeWidth={2.35} />}
      onClose={onClose}
      open={Boolean(skill)}
      size="wide"
      title={skill?.descriptor.displayName ?? "Skill 详情"}
    >
      {skill ? (
        <div className={styles.detailDialogBody}>
          <dl className={styles.detailGrid}>
            <DetailItem label="Skill ID" value={skill.descriptor.skillId} />
            <DetailItem label="版本" value={skill.descriptor.version} />
            <DetailItem label="Owner" value={skill.descriptor.owner} />
            <DetailItem label="Executor" value={skill.descriptor.executor} />
            <DetailItem label="输出" value={skill.descriptor.outputType} />
            <DetailItem label="状态" value={formatPublicationStatus(skill.publicationStatus)} />
            <DetailItem label="角色" value={formatRequiredRoles(skill.descriptor.requiredRoles)} />
            <DetailItem label="参数" value={formatParameters(skill)} />
            <DetailItem label="标签" value={formatValues(skill.descriptor.tags)} />
            <DetailItem label="拦截器" value={formatValues(skill.descriptor.interceptors)} />
            <DetailItem label="契约路径" value={skill.manifestPath} />
          </dl>
          <p className={styles.detailNotice}>
            P1 阶段只展示已签名只读 Skill。上传、安装、升级、卸载和写执行发布不在浏览器中开放。
          </p>
        </div>
      ) : null}
    </Dialog>
  );
}

/**
 * @param {{label: string, value: string}} props
 */
function DetailItem({ label, value }) {
  return (
    <div className={styles.detailItem}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
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
