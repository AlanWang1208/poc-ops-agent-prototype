import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LockKeyhole,
  Search,
} from "lucide-react";

import { loadRecentAuditEvents } from "../../api/audit-api.js";
import { WorkspacePageFrame } from "../../components/layout/WorkspacePageFrame.jsx";
import { WorkspaceStatusBar } from "../../components/layout/WorkspaceStatusBar.jsx";
import styles from "./AuditRecordsPage.module.css";

const auditEntries = [
  {
    color: "blue",
    eventType: "SESSION_AUTHORIZED",
    hash: "sha256:a18c",
    result: "ALLOW",
    sequence: 1,
    summary: "operator=ops.reader@company.internal / role=agent-reader",
    time: "10:42:11",
  },
  {
    color: "red",
    eventType: "POLICY_EVALUATED",
    hash: "sha256:bc72",
    result: "DENY_WRITE",
    sequence: 2,
    summary: "policy-v1 返回 READ_ONLY，禁止写操作和脚本执行",
    time: "10:42:13",
  },
  {
    color: "green",
    eventType: "SKILL_SELECTED",
    hash: "sha256:73df",
    result: "VALIDATED",
    sequence: 3,
    summary: "node-health-read@1.1.0 / schema 与签名校验通过",
    time: "10:42:15",
  },
  {
    color: "yellow",
    eventType: "WORKER_ACCEPTED",
    hash: "sha256:98aa",
    result: "ACCEPTED",
    sequence: 4,
    summary: "受限 Worker 接收只读执行请求，幂等键已锁定",
    time: "10:42:18",
  },
  {
    color: "dark",
    eventType: "AUDIT_SEALED",
    hash: "sha256:e91b",
    result: "SEALED",
    sequence: 5,
    summary: "结果摘要、traceId 与参数哈希写入审计账本",
    time: "10:42:26",
  },
];

const proofItems = [
  { color: "blue", label: "Operator", value: "ops.reader@company.internal" },
  { color: "red", label: "Policy Version", value: "policy-v1 / READ_ONLY" },
  { color: "green", label: "Skill Version", value: "node-health-read@1.1.0" },
  { color: "yellow", label: "Parameter Hash", value: "node-a / development / sha256:73df" },
  { color: "dark", label: "Retention", value: "保留 180 天，支持导出与复核" },
];

const eventFilterOptions = ["全部", "SESSION", "POLICY", "SKILL", "WORKER", "AUDIT"];
const resultFilterOptions = ["全部", "ALLOW", "DENY_WRITE", "VALIDATED", "ACCEPTED", "SEALED"];

export function AuditRecordsPage() {
  const [query, setQuery] = useState("");
  const auditQuery = useQuery({
    queryKey: ["audit-events", 200],
    queryFn: () => loadRecentAuditEvents({ limit: 200 }),
  });
  const liveEntries = auditQuery.data?.events.map(toAuditEntry) ?? [];
  const displayedEntries = liveEntries.length > 0 ? liveEntries : auditEntries;
  const [eventFilter, setEventFilter] = useState("全部");
  const [resultFilter, setResultFilter] = useState("全部");
  const skillAuditEntries = useMemo(
    () => displayedEntries.filter(isSkillExecutionAudit).slice(0, 3),
    [displayedEntries],
  );

  const filteredEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return displayedEntries.filter((entry) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        [entry.eventType, entry.hash, entry.result, entry.summary, entry.time]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      const matchesEvent =
        eventFilter === "全部" || entry.eventType.startsWith(eventFilter);
      const matchesResult = resultFilter === "全部" || entry.result === resultFilter;

      return matchesQuery && matchesEvent && matchesResult;
    });
  }, [displayedEntries, eventFilter, query, resultFilter]);

  const missingCount = displayedEntries.length - filteredEntries.length;

  return (
    <WorkspacePageFrame className={styles.auditCanvas}>
      <WorkspaceStatusBar title="审计记录" />

      <section aria-label="审计记录工作区" className={styles.workspaceBody}>
        <form
          aria-label="审计记录筛选"
          className={styles.filterBar}
          onSubmit={(event) => event.preventDefault()}
          role="search"
        >
          <label className={styles.searchBox}>
            <Search aria-hidden="true" size={15} strokeWidth={2.5} />
            <span className={styles.visuallyHidden}>搜索 workflow / operator / traceId</span>
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索 workflow / operator / traceId"
              type="search"
              value={query}
            />
          </label>

          <FilterSelect
            label="事件"
            onChange={setEventFilter}
            options={eventFilterOptions}
            value={eventFilter}
          />
          <FilterSelect
            label="结果"
            onChange={setResultFilter}
            options={resultFilterOptions}
            value={resultFilter}
          />
          <FilterSelect
            label="时间"
            onChange={() => {}}
            options={["近 24h"]}
            value="近 24h"
          />

          <span className={styles.filterCount}>
            {filteredEntries.length} 条记录 / {missingCount} 缺失
          </span>
        </form>

        {skillAuditEntries.length > 0 ? (
          <SkillAuditHighlights entries={skillAuditEntries} />
        ) : null}

        <div className={styles.auditLayout}>
          <section
            aria-labelledby="audit-ledger-title"
            className={styles.ledger}
          >
            <h2 id="audit-ledger-title">审计账本</h2>
            <div className={styles.auditChain}>
              {filteredEntries.map((entry) => (
                <article
                  className={`${styles.auditEntry} ${styles[entry.color]}`}
                  key={`${entry.sequence}-${entry.hash}`}
                >
                  <div className={styles.auditTime}>
                    <strong>{entry.time}</strong>
                    <span>sequence {entry.sequence}</span>
                  </div>
                  <div className={styles.auditMain}>
                    <strong>{entry.eventType}</strong>
                    <span>{entry.summary}</span>
                  </div>
                  <span className={styles.auditHash}>{entry.hash}</span>
                  <span className={styles.auditHash}>{entry.result}</span>
                </article>
              ))}
            </div>
          </section>

          <aside aria-label="证据详情" className={styles.detail}>
            <h2>证据详情</h2>
            <div className={styles.proofList}>
              {proofItems.map((item) => (
                <article
                  className={`${styles.proofItem} ${styles[item.color]}`}
                  key={item.label}
                >
                  <strong>{item.label}</strong>
                  <span>{item.value}</span>
                </article>
              ))}
            </div>
            <div className={styles.retentionNote}>
              <LockKeyhole aria-hidden="true" size={16} strokeWidth={2.5} />
              <span>仅展示审计证据，不开放生产写执行。</span>
            </div>
          </aside>
        </div>
      </section>
    </WorkspacePageFrame>
  );
}

/**
 * @param {{ entries: ReturnType<typeof toAuditEntry>[] }} props
 */
function SkillAuditHighlights({ entries }) {
  return (
    <section aria-label="最近 Skill 执行审计" className={styles.skillAuditHighlights}>
      <div className={styles.skillAuditTitle}>
        <strong>最近 Skill 执行审计</strong>
        <span>优先展示 Agent Tool 执行授权结果</span>
      </div>
      <div className={styles.skillAuditList}>
        {entries.map((entry) => (
          <article
            className={`${styles.skillAuditItem} ${styles[entry.color]}`}
            key={`${entry.sequence}-${entry.hash}-highlight`}
          >
            <strong>{entry.summary}</strong>
            <span>{entry.eventType}</span>
            <span>{entry.result}</span>
            <small>{entry.hash}</small>
          </article>
        ))}
      </div>
    </section>
  );
}

/**
 * @param {import("../../schemas/audit-schemas.js").AuditEvent} event
 * @param {number} index
 */
function toAuditEntry(event, index) {
  return {
    color: auditTone(event.result),
    eventType: event.action,
    hash: event.traceId,
    result: event.result,
    sequence: index + 1,
    summary: event.resource,
    time: formatAuditTime(event.timestamp),
  };
}

/**
 * @param {string} result
 */
function auditTone(result) {
  if (result.startsWith("DENY")) return "red";
  if (result === "ALLOW") return "green";
  return "dark";
}

/**
 * @param {ReturnType<typeof toAuditEntry>} entry
 */
function isSkillExecutionAudit(entry) {
  return (
    entry.eventType === "internal.agent.tool.execute" ||
    entry.eventType.endsWith(".tool.execute")
  );
}

/**
 * @param {string} timestamp
 */
function formatAuditTime(timestamp) {
  const time = timestamp.match(/T(\d{2}:\d{2}:\d{2})/u);
  return time?.[1] ?? timestamp;
}

/**
 * @param {{
 *   label: string,
 *   onChange: (value: string) => void,
 *   options: string[],
 *   value: string,
 * }} props
 */
function FilterSelect({ label, onChange, options, value }) {
  return (
    <label className={styles.filterSelect}>
      <span>{label}</span>
      <select
        aria-label={`${label}筛选`}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
