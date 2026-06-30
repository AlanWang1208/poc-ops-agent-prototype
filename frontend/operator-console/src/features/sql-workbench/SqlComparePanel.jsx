import { GitCompareArrows, Play } from "lucide-react";

import styles from "./SqlWorkbenchPage.module.css";

/**
 * @typedef {import("./sql-workbench-utils.js").SqlCompareReport} SqlCompareReport
 * @typedef {import("./sql-workbench-utils.js").SqlCompareState} SqlCompareState
 */

/**
 * @param {{
 *   activeSchema: string,
 *   isPending: boolean,
 *   onChange: (patch: Partial<SqlCompareState>) => void,
 *   onRunCompare: () => void,
 *   state: SqlCompareState,
 * }} props
 */
export function SqlComparePanel({
  activeSchema,
  isPending,
  onChange,
  onRunCompare,
  state,
}) {
  return (
    <section className={styles.modePanel}>
      <div className={styles.modeFormGrid}>
        <label>
          <span>基准库</span>
          <input
            onChange={(event) => onChange({ baseLibrary: event.target.value })}
            placeholder={activeSchema}
            value={state.baseLibrary}
          />
        </label>
        <label>
          <span>对比库</span>
          <input
            onChange={(event) => onChange({ compareLibrary: event.target.value })}
            value={state.compareLibrary}
          />
        </label>
        <label>
          <span>目标表</span>
          <input
            onChange={(event) => onChange({ tableName: event.target.value })}
            value={state.tableName}
          />
        </label>
        <label>
          <span>主键字段</span>
          <input
            onChange={(event) => onChange({ keyFields: event.target.value })}
            value={state.keyFields}
          />
        </label>
        <label>
          <span>比较字段</span>
          <input
            onChange={(event) => onChange({ fields: event.target.value })}
            value={state.fields}
          />
        </label>
        <label>
          <span>忽略字段</span>
          <input
            onChange={(event) => onChange({ ignoredFields: event.target.value })}
            value={state.ignoredFields}
          />
        </label>
        <label className={styles.modeWideField}>
          <span>WHERE 条件</span>
          <input
            onChange={(event) => onChange({ whereClause: event.target.value })}
            value={state.whereClause}
          />
        </label>
        <label>
          <span>最大行数</span>
          <input
            inputMode="numeric"
            onChange={(event) => onChange({ maxRows: event.target.value })}
            value={state.maxRows}
          />
        </label>
      </div>
      <div className={styles.modeActions}>
        <button
          className={styles.primaryButton}
          disabled={isPending}
          onClick={onRunCompare}
          type="button"
        >
          <Play aria-hidden="true" size={15} />
          执行对比
        </button>
      </div>
      {state.errorMessage ? (
        <p className={styles.modeError}>{state.errorMessage}</p>
      ) : null}
      {state.statusMessage ? (
        <p className={styles.modeStatus}>{state.statusMessage}</p>
      ) : null}
      {state.report ? <CompareReport report={state.report} /> : null}
      {state.assistant ? (
        <section className={styles.compareAiSummary}>
          <strong>AI 对比摘要</strong>
          <p>{state.assistant.summary}</p>
        </section>
      ) : null}
    </section>
  );
}

/**
 * @param {{report: SqlCompareReport}} props
 */
function CompareReport({ report }) {
  return (
    <section className={styles.compareReport}>
      <div className={styles.compareReportHeader}>
        <GitCompareArrows aria-hidden="true" size={16} />
        <strong>
          {report.baseLibrary}.{report.tableName} → {report.compareLibrary}.{report.tableName}
        </strong>
      </div>
      <div className={styles.compareMetrics}>
        <span>匹配行 {report.matchingRows}</span>
        <span>字段差异 {report.mismatchedRows.length}</span>
        <span>仅在基准存在 {report.onlyInBase.length}</span>
        <span>仅在对比存在 {report.onlyInCompare.length}</span>
      </div>
      {report.mismatchedRows.length > 0 ? (
        <div className={styles.compareSamples}>
          {report.mismatchedRows.slice(0, 3).map((row) => (
            <article key={row.key}>
              <strong>{row.key}</strong>
              {row.differences.map((difference) => (
                <p key={`${row.key}:${difference.column}`}>
                  {difference.column}: {difference.baseValue} → {difference.compareValue}
                </p>
              ))}
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
