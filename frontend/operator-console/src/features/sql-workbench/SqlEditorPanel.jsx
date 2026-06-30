import { Download, Play, Search, ShieldCheck, Upload } from "lucide-react";

import { SqlComparePanel } from "./SqlComparePanel.jsx";
import { SqlCodeEditor } from "./SqlCodeEditor.jsx";
import { SqlNaturalLanguagePanel } from "./SqlNaturalLanguagePanel.jsx";
import styles from "./SqlWorkbenchPage.module.css";

const SESSION_MODE_OPTIONS = [
  { label: "SQL", value: "sql" },
  { label: "自然语言", value: "natural-language" },
  { label: "Compare", value: "compare" },
];

/**
 * @typedef {import("./sql-workbench-utils.js").SqlSessionMode} SqlSessionMode
 * @typedef {import("./sql-workbench-utils.js").SqlWorkbenchSession} SqlWorkbenchSession
 * @typedef {import("./sql-workbench-utils.js").SqlCompareState} SqlCompareState
 * @typedef {import("./sql-workbench-utils.js").SqlNaturalLanguageState} SqlNaturalLanguageState
 */

/**
 * @param {{
 *   activeSchema: string,
 *   canExecuteSelect: boolean,
 *   canPreflightDml: boolean,
 *   canRunSqlStatement: boolean,
 *   canValidate: boolean,
 *   comparePending: boolean,
 *   hasMultipleSqlStatements: boolean,
 *   naturalLanguagePending: boolean,
 *   onExportSql: () => void,
 *   onGenerateNaturalLanguageSql: () => void,
 *   onImportSqlFile: (file: File) => void | Promise<void>,
 *   onNaturalLanguageChange: (patch: Partial<SqlNaturalLanguageState>) => void,
 *   onCompareChange: (patch: Partial<SqlCompareState>) => void,
 *   onModeChange: (mode: SqlSessionMode) => void,
 *   onRunCompare: () => void,
 *   onRunSelect: () => void,
 *   onRunStatement: (sqlText: string) => void,
 *   onSqlChange: (sqlText: string) => void,
 *   onValidate: (action: "VALIDATE" | "PREFLIGHT_DML") => void,
 *   session: SqlWorkbenchSession,
 *   validatePending: boolean,
 * }} props
 */
export function SqlEditorPanel({
  activeSchema,
  canExecuteSelect,
  canPreflightDml,
  canRunSqlStatement,
  canValidate,
  comparePending,
  hasMultipleSqlStatements,
  naturalLanguagePending,
  onExportSql,
  onGenerateNaturalLanguageSql,
  onImportSqlFile,
  onNaturalLanguageChange,
  onCompareChange,
  onModeChange,
  onRunCompare,
  onRunSelect,
  onRunStatement,
  onSqlChange,
  onValidate,
  session,
  validatePending,
}) {
  const currentMode = session.mode ?? "sql";

  /**
   * @param {import("react").ChangeEvent<HTMLInputElement>} event
   */
  function handleImportChange(event) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (file) {
      void onImportSqlFile(file);
    }
  }

  return (
    <section className={styles.editorCard}>
      <div
        aria-label="SQL 会话模式"
        className={styles.sessionModeTabs}
        role="tablist"
      >
        {SESSION_MODE_OPTIONS.map((mode) => (
          <button
            aria-selected={currentMode === mode.value}
            className={currentMode === mode.value ? styles.activeModeTab : ""}
            key={mode.value}
            onClick={() => onModeChange(/** @type {SqlSessionMode} */ (mode.value))}
            role="tab"
            type="button"
          >
            {mode.label}
          </button>
        ))}
      </div>

      {currentMode === "sql" ? (
        <>
          <div className={styles.editorToolbar}>
            <label className={styles.secondaryButton}>
              <Upload aria-hidden="true" size={15} />
              导入 .sql
              <input
                accept=".sql,text/plain,application/sql"
                aria-label="导入 .sql"
                className={styles.fileInput}
                onChange={handleImportChange}
                type="file"
              />
            </label>
            <button
              className={styles.secondaryButton}
              disabled={session.sql.trim().length === 0}
              onClick={onExportSql}
              type="button"
            >
              <Download aria-hidden="true" size={15} />
              导出 .sql
            </button>
            <button
              disabled={!canValidate || validatePending}
              onClick={() => onValidate("VALIDATE")}
              type="button"
            >
              <Search aria-hidden="true" size={15} />
              校验
            </button>
            <button
              className={styles.runButton}
              disabled={!canExecuteSelect}
              onClick={onRunSelect}
              title={
                hasMultipleSqlStatements
                  ? "检测到多条 SQL，请使用左侧绿色按钮执行单条语句"
                  : undefined
              }
              type="button"
            >
              <Play aria-hidden="true" size={15} />
              执行 SELECT
            </button>
            <button
              className={styles.preflightButton}
              disabled={!canPreflightDml || validatePending}
              onClick={() => onValidate("PREFLIGHT_DML")}
              type="button"
            >
              <ShieldCheck aria-hidden="true" size={15} />
              DML 预检
            </button>
            <button disabled type="button">
              停止
            </button>
          </div>
          <section className={styles.sqlEditor} aria-label={`${session.label}.sql`}>
            <span>{session.label}.sql</span>
            <SqlCodeEditor
              canRunStatements={canRunSqlStatement}
              onChange={onSqlChange}
              onRunStatement={onRunStatement}
              value={session.sql}
            />
          </section>
        </>
      ) : null}

      {currentMode === "natural-language" ? (
        <SqlNaturalLanguagePanel
          activeSchema={activeSchema}
          isPending={naturalLanguagePending}
          onChange={onNaturalLanguageChange}
          onGenerate={onGenerateNaturalLanguageSql}
          state={session.naturalLanguage}
        />
      ) : null}

      {currentMode === "compare" ? (
        <SqlComparePanel
          activeSchema={activeSchema}
          isPending={comparePending}
          onChange={onCompareChange}
          onRunCompare={onRunCompare}
          state={session.compare}
        />
      ) : null}
    </section>
  );
}
