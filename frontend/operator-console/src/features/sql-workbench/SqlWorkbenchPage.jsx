import { sql } from "@codemirror/lang-sql";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { Compartment, EditorState, RangeSetBuilder } from "@codemirror/state";
import { EditorView, GutterMarker, gutter } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { basicSetup } from "codemirror";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Database,
  FileSearch,
  Maximize2,
  Minimize2,
  Play,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";

import { ApiError } from "../../api/client.js";
import { DataTable } from "../../components/data-display/DataTable.jsx";
import { StatusPill } from "../../components/data-display/StatusPill.jsx";
import { WorkspacePageFrame } from "../../components/layout/WorkspacePageFrame.jsx";
import { WorkspaceStatusBar } from "../../components/layout/WorkspaceStatusBar.jsx";
import { Dialog } from "../../components/primitives/Dialog.jsx";
import {
  useCreateSqlConnection,
  useDeleteSqlConnection,
  useRunReadOnlySqlQuery,
  useSqlAssistant,
  useSqlConnections,
  useSqlResultPage,
  useUpdateSqlConnection,
  useValidateSqlQuery,
} from "./use-sql-workbench.js";
import styles from "./SqlWorkbenchPage.module.css";

const DEFAULT_SQL = "";

const EMPTY_SESSION_SQL = "";

/**
 * @typedef {import("../../schemas/sql-schemas.js").SqlConnectionSummary} SqlConnectionSummary
 * @typedef {import("../../schemas/sql-schemas.js").SqlValidationReport} SqlValidationReport
 * @typedef {import("../../schemas/sql-schemas.js").SqlQueryRunResult} SqlQueryRunResult
 * @typedef {import("../../schemas/sql-schemas.js").SqlResultPage} SqlResultPage
 * @typedef {import("../../schemas/sql-schemas.js").SqlAssistantResponse} SqlAssistantResponse
 * @typedef {"EXPLAIN_SQL" | "OPTIMIZE_SQL" | "ANALYZE_ERROR"} SqlAssistantAction
 * @typedef {{
 *   assistant: SqlAssistantResponse | null,
 *   assistantErrorMessage: string | null,
 *   connectionId: string,
 *   errorMessage: string | null,
 *   execution: SqlQueryRunResult | null,
 *   id: string,
 *   label: string,
 *   resultPageIndex: number,
 *   resultPage: SqlResultPage | null,
 *   resultPageToken: string | null,
 *   resultPageTokens: Array<string | null>,
 *   schema: string,
 *   sql: string,
 *   validation: SqlValidationReport | null,
 * }} SqlWorkbenchSession
 */

const DEFAULT_LIMITS = {
  maxRows: 500,
  maxBytes: 5_000_000,
  timeoutSeconds: 30,
};

const DEFAULT_EDITOR_RESULT_SPLIT = 72;
const EDITOR_RESULT_SPLIT_MIN = 42;
const EDITOR_RESULT_SPLIT_MAX = 84;
const LEGACY_READ_ONLY_VALIDATION_ERROR =
  "query must pass read-only validation before execution";

const PLATFORM_FORM_DEFAULTS = {
  DB2_FOR_I: {
    host: "",
    port: "446",
    defaultSchema: "",
    allowedSchemas: "",
  },
  H2: {
    host: "localhost",
    port: "9092",
    defaultSchema: "",
    allowedSchemas: "",
  },
  MYSQL: {
    host: "",
    port: "3306",
    defaultSchema: "",
    allowedSchemas: "",
  },
};

const sqlCommentHighlightStyle = HighlightStyle.define([
  { tag: [tags.comment, tags.lineComment, tags.blockComment], class: "cm-sql-comment" },
]);

const sqlEditorTheme = EditorView.theme({
  "&": {
    height: "100%",
    background: "transparent",
    color: "var(--sql-ink)",
  },
  ".cm-scroller": {
    fontFamily: 'Consolas, "SFMono-Regular", monospace',
    lineHeight: "22px",
  },
  ".cm-content": {
    minHeight: "100%",
    padding: "12px 14px",
    caretColor: "var(--sql-ink)",
    fontFamily: 'Consolas, "SFMono-Regular", monospace',
    fontSize: "12px",
    fontWeight: "760",
    lineHeight: "22px",
  },
  ".cm-line": {
    padding: "0",
  },
  ".cm-gutters": {
    border: "0",
    background: "transparent",
    color: "var(--sql-muted)",
  },
  ".cm-lineNumbers, .cm-foldGutter": {
    display: "none",
  },
  ".cm-sql-run-gutter": {
    minWidth: "30px",
    paddingLeft: "6px",
    background: "transparent",
  },
  ".cm-focused": {
    outline: "none",
  },
  ".cm-cursor": {
    borderLeftColor: "var(--sql-ink)",
  },
  ".cm-selectionBackground": {
    background: "rgba(34, 126, 166, 0.18) !important",
  },
  ".cm-activeLine": {
    backgroundColor: "transparent",
  },
});

const DEFAULT_CONNECTION_FORM = {
  displayName: "",
  targetEnvironment: "development",
  platformType: "DB2_FOR_I",
  host: "",
  port: "446",
  defaultSchema: "",
  allowedSchemas: "",
  credentialAlias: "",
  maxRowsDefault: "500",
  timeoutSecondsDefault: "30",
};

export function SqlWorkbenchPage() {
  const connectionsQuery = useSqlConnections();
  const createConnectionMutation = useCreateSqlConnection();
  const updateConnectionMutation = useUpdateSqlConnection();
  const deleteConnectionMutation = useDeleteSqlConnection();
  const validateMutation = useValidateSqlQuery();
  const runMutation = useRunReadOnlySqlQuery();
  const assistantMutation = useSqlAssistant();
  const [connectionOverrides, setConnectionOverrides] = useState(
    /** @type {SqlConnectionSummary[]} */ ([]),
  );
  const [deletedConnectionIds, setDeletedConnectionIds] = useState(/** @type {string[]} */ ([]));
  const connections = useMemo(
    () =>
      mergeConnections(
        connectionsQuery.data ?? [],
        connectionOverrides,
        deletedConnectionIds,
      ),
    [connectionsQuery.data, connectionOverrides, deletedConnectionIds],
  );
  const [sessions, setSessions] = useState(
    /** @type {SqlWorkbenchSession[]} */ ([createSession(1, DEFAULT_SQL)]),
  );
  const [activeSessionId, setActiveSessionId] = useState("sql-session-1");
  const [isObjectDrawerOpen, setIsObjectDrawerOpen] = useState(false);
  const [isConnectionDialogOpen, setIsConnectionDialogOpen] = useState(false);
  const [isWorkspaceExpanded, setIsWorkspaceExpanded] = useState(false);
  const [editorResultSplit, setEditorResultSplit] = useState(DEFAULT_EDITOR_RESULT_SPLIT);

  const activeSession =
    sessions.find((session) => session.id === activeSessionId) ?? sessions[0];
  const activeConnection = resolveActiveConnection(connections, activeSession);
  const hasConnections = connections.length > 0;
  const activeSchema =
    activeConnection
      ? activeSession.schema ||
        activeConnection.defaultSchema ||
        activeConnection.allowedSchemas[0] ||
        ""
      : "";
  const activeLimits = activeConnection ? buildLimits(activeConnection) : DEFAULT_LIMITS;
  const resultPageQuery = useSqlResultPage(
    activeSession.execution?.resultId,
    activeSession.resultPageToken,
  );
  const currentResultPage = resultPageQuery.data ?? activeSession.resultPage;
  const isReadyConnection = activeConnection?.status === "READY";
  const hasSqlText = activeSession.sql.trim().length > 0;
  const activeSqlStatements = useMemo(
    () => findSqlEditorStatements(activeSession.sql),
    [activeSession.sql],
  );
  const hasMultipleSqlStatements = activeSqlStatements.length > 1;
  const isRunnableSelectSql = isLikelyReadOnlySql(activeSession.sql);
  const canValidate =
    isReadyConnection &&
    activeConnection?.capabilities.includes("VALIDATE") === true;
  const canPreflightDml =
    isReadyConnection &&
    activeConnection?.capabilities.includes("PREFLIGHT_DML") === true;
  const canExecuteSelect =
    isReadyConnection &&
    activeConnection?.capabilities.includes("RUN_READ_ONLY") === true &&
    hasSqlText &&
    isRunnableSelectSql &&
    !hasMultipleSqlStatements &&
    !runMutation.isPending;
  const canRunSqlStatement =
    isReadyConnection &&
    activeConnection?.capabilities.includes("RUN_READ_ONLY") === true &&
    !runMutation.isPending;
  const canUseAssistant =
    canValidate &&
    hasSqlText &&
    !assistantMutation.isPending;
  const editorPanelStyle =
    /** @type {import("react").CSSProperties} */ ({
      gridTemplateRows: `auto minmax(170px, ${editorResultSplit}fr) 8px minmax(96px, ${
        100 - editorResultSplit
      }fr)`,
    });

  useEffect(() => {
    if (!resultPageQuery.data) {
      return;
    }
    updateSession(activeSession.id, {
      resultPage: resultPageQuery.data,
    });
  }, [activeSession.id, resultPageQuery.data]);

  /**
   * @param {string} sessionId
   * @param {Partial<SqlWorkbenchSession>} patch
   */
  function updateSession(sessionId, patch) {
    setSessions((currentSessions) =>
      currentSessions.map((session) =>
        session.id === sessionId ? { ...session, ...patch } : session,
      ),
    );
  }

  /**
   * @param {string} sql
   */
  function updateSql(sql) {
    updateSession(activeSession.id, {
      sql,
      validation: null,
      execution: null,
      resultPage: null,
      resultPageIndex: 0,
      resultPageToken: null,
      resultPageTokens: [null],
      errorMessage: null,
      assistant: null,
      assistantErrorMessage: null,
    });
  }

  /**
   * @param {string} connectionId
   */
  function selectConnection(connectionId) {
    const connection = connections.find((item) => item.connectionId === connectionId);
    updateSession(
      activeSession.id,
      buildConnectionSessionPatch(connection ?? null, activeSchema, connectionId),
    );
  }

  /**
   * @param {SqlConnectionSummary} connection
   */
  function handleConnectionCreated(connection) {
    setDeletedConnectionIds((current) => current.filter((item) => item !== connection.connectionId));
    setConnectionOverrides((current) => upsertConnection(current, connection));
    updateSession(
      activeSession.id,
      buildConnectionSessionPatch(connection, activeSchema, connection.connectionId),
    );
  }

  /**
   * @param {SqlConnectionSummary} connection
   */
  function handleConnectionUpdated(connection) {
    setDeletedConnectionIds((current) => current.filter((item) => item !== connection.connectionId));
    setConnectionOverrides((current) => upsertConnection(current, connection));
    if (activeConnection?.connectionId === connection.connectionId) {
      updateSession(
        activeSession.id,
        buildConnectionSessionPatch(connection, activeSchema, connection.connectionId),
      );
    }
  }

  /**
   * @param {string} connectionId
   */
  function handleConnectionDeleted(connectionId) {
    const nextConnections = connections.filter(
      (connection) => connection.connectionId !== connectionId,
    );
    setDeletedConnectionIds((current) =>
      current.includes(connectionId) ? current : [...current, connectionId],
    );
    setConnectionOverrides((current) =>
      current.filter((connection) => connection.connectionId !== connectionId),
    );
    if (activeConnection?.connectionId === connectionId) {
      updateSession(
        activeSession.id,
        buildConnectionSessionPatch(nextConnections[0] ?? null, "", nextConnections[0]?.connectionId ?? ""),
      );
    }
  }

  /**
   * @param {string} schema
   */
  function selectSchema(schema) {
    updateSession(activeSession.id, {
      schema,
      validation: null,
      execution: null,
      resultPage: null,
      resultPageIndex: 0,
      resultPageToken: null,
      resultPageTokens: [null],
      errorMessage: null,
      assistant: null,
      assistantErrorMessage: null,
    });
  }

  function addSession() {
    const nextIndex = sessions.length + 1;
    const nextSession = createSession(nextIndex, EMPTY_SESSION_SQL);
    setSessions((currentSessions) => [...currentSessions, nextSession]);
    setActiveSessionId(nextSession.id);
  }

  /**
   * @param {"VALIDATE" | "PREFLIGHT_DML"} action
   */
  function submitValidation(action) {
    if (!activeSession || !activeConnection) {
      return;
    }
    const sessionId = activeSession.id;
    const sql = activeSession.sql;
    const schema = activeSchema;
    const connection = activeConnection;
    const request = buildSqlQueryRequest(connection, schema, action, sql, action);

    validateMutation.mutate(
      request,
      {
        onSuccess: (report) => {
          updateSession(sessionId, {
            validation: report,
            execution: null,
            resultPage: null,
            resultPageIndex: 0,
            resultPageToken: null,
            resultPageTokens: [null],
            errorMessage: null,
            assistant: null,
            assistantErrorMessage: null,
          });
          maybeRequestSyntaxErrorAnalysis({
            connection,
            errorMessage: null,
            limits: request.limits,
            report,
            schema,
            sessionId,
            sql,
          });
        },
        onError: (error) => {
          updateSession(sessionId, {
            validation: null,
            execution: null,
            resultPage: null,
            resultPageIndex: 0,
            resultPageToken: null,
            resultPageTokens: [null],
            errorMessage: error instanceof Error ? error.message : "SQL 校验请求失败",
            assistant: null,
            assistantErrorMessage: null,
          });
        },
      },
    );
  }

  function runSelect() {
    if (!activeConnection || !canExecuteSelect) {
      return;
    }
    runReadOnlySql(activeSession.sql);
  }

  /**
   * @param {string} sqlText
   */
  function runReadOnlySql(sqlText) {
    if (!activeConnection || !canRunSqlStatement) {
      return;
    }
    const sql = sqlText.trim();
    if (!isLikelyReadOnlySql(sql)) {
      return;
    }
    const sessionId = activeSession.id;
    const schema = activeSchema;
    const connection = activeConnection;
    const request = buildSqlQueryRequest(
      connection,
      schema,
      "RUN_READ_ONLY",
      sql,
      "RUN_READ_ONLY",
    );

    runMutation.mutate(
      request,
      {
        onSuccess: (execution) => {
          updateSession(sessionId, {
            execution,
            resultPage: null,
            resultPageIndex: 0,
            resultPageToken: null,
            resultPageTokens: [null],
            errorMessage: execution.errorMessage ?? null,
          });
        },
        onError: (error) => {
          const errorMessage = error instanceof Error ? error.message : "SELECT 执行请求失败";
          updateSession(sessionId, {
            execution: null,
            resultPage: null,
            resultPageIndex: 0,
            resultPageToken: null,
            resultPageTokens: [null],
            errorMessage,
            assistant: null,
            assistantErrorMessage: null,
          });
          if (shouldFetchValidationDiagnostics(error)) {
            validateMutation.mutate(
              {
                ...request,
                idempotencyKey: createSqlIdempotencyKey("RUN_READ_ONLY_DIAGNOSTIC"),
              },
              {
                onSuccess: (report) => {
                  const diagnosticMessage = buildReadOnlyValidationDiagnosticMessage(report);
                  updateSession(sessionId, {
                    validation: report,
                    execution: null,
                    resultPage: null,
                    resultPageIndex: 0,
                    resultPageToken: null,
                    resultPageTokens: [null],
                    errorMessage: diagnosticMessage,
                    assistant: null,
                    assistantErrorMessage: null,
                  });
                  maybeRequestSyntaxErrorAnalysis({
                    connection,
                    errorMessage: diagnosticMessage,
                    limits: request.limits,
                    report,
                    schema,
                    sessionId,
                    sql,
                  });
                },
                onError: (validationError) => {
                  const validationErrorMessage =
                    validationError instanceof Error
                      ? validationError.message
                      : "服务端校验报告补充失败";
                  updateSession(sessionId, {
                    errorMessage: `${errorMessage}\nvalidationDiagnosticError=${validationErrorMessage}`,
                  });
                },
              },
            );
          }
        },
      },
    );
  }

  /**
   * @param {{
   *   assistantAction: SqlAssistantAction,
   *   connection: SqlConnectionSummary,
   *   diagnosticContext?: string,
   *   limits: {maxRows: number, maxBytes: number, timeoutSeconds: number},
   *   schema: string,
   *   sessionId: string,
   *   sql: string,
   * }} input
   */
  function submitAssistantRequest(input) {
    assistantMutation.mutate(
      {
        contractVersion: "1.0",
        connectionId: input.connection.connectionId,
        targetEnvironment: input.connection.targetEnvironment,
        schema: input.schema,
        assistantAction: input.assistantAction,
        sql: input.sql,
        limits: input.limits,
        diagnosticContext: input.diagnosticContext,
        idempotencyKey: createSqlIdempotencyKey(`ASSISTANT_${input.assistantAction}`),
      },
      {
        onSuccess: (assistant) => {
          updateSession(input.sessionId, {
            assistant,
            assistantErrorMessage: null,
          });
        },
        onError: (error) => {
          updateSession(input.sessionId, {
            assistant: null,
            assistantErrorMessage:
              error instanceof Error ? error.message : "AI SQL 助手请求失败",
          });
        },
      },
    );
  }

  /**
   * @param {{
   *   connection: SqlConnectionSummary,
   *   errorMessage: string | null,
   *   limits: {maxRows: number, maxBytes: number, timeoutSeconds: number},
   *   report: SqlValidationReport,
   *   schema: string,
   *   sessionId: string,
   *   sql: string,
   * }} input
   */
  function maybeRequestSyntaxErrorAnalysis(input) {
    if (!shouldAutoAnalyzeValidation(input.report)) {
      return;
    }
    submitAssistantRequest({
      assistantAction: "ANALYZE_ERROR",
      connection: input.connection,
      diagnosticContext: buildAssistantDiagnosticContext({
        errorMessage: input.errorMessage,
        execution: null,
        validation: input.report,
      }),
      limits: input.limits,
      schema: input.schema,
      sessionId: input.sessionId,
      sql: input.sql,
    });
  }

  /**
   * @param {SqlAssistantAction} assistantAction
   */
  function requestAssistant(assistantAction) {
    if (!activeConnection || !canUseAssistant) {
      return;
    }

    submitAssistantRequest({
      assistantAction,
      connection: activeConnection,
      diagnosticContext: buildAssistantDiagnosticContext(activeSession),
      limits: buildLimits(activeConnection),
      schema: activeSchema,
      sessionId: activeSession.id,
      sql: activeSession.sql,
    });
  }

  function readNextResultPage() {
    if (!currentResultPage?.nextCursor) {
      return;
    }
    const nextIndex = activeSession.resultPageIndex + 1;
    const nextTokens = [...activeSession.resultPageTokens];
    nextTokens[nextIndex] = currentResultPage.nextCursor;
    updateSession(activeSession.id, {
      resultPageIndex: nextIndex,
      resultPageToken: currentResultPage.nextCursor,
      resultPageTokens: nextTokens,
    });
  }

  function readPreviousResultPage() {
    if (activeSession.resultPageIndex <= 0) {
      return;
    }
    const previousIndex = activeSession.resultPageIndex - 1;
    updateSession(activeSession.id, {
      resultPageIndex: previousIndex,
      resultPageToken: activeSession.resultPageTokens[previousIndex] ?? null,
    });
  }

  /**
   * @param {number} nextSplit
   */
  function updateEditorResultSplit(nextSplit) {
    setEditorResultSplit(clampNumber(
      nextSplit,
      EDITOR_RESULT_SPLIT_MIN,
      EDITOR_RESULT_SPLIT_MAX,
    ));
  }

  /**
   * @param {number} clientY
   * @param {HTMLElement} panel
   */
  function updateEditorResultSplitFromPointer(clientY, panel) {
    const panelRect = panel.getBoundingClientRect();
    const tabs = panel.querySelector('[role="tablist"]');
    const tabsHeight = tabs instanceof HTMLElement ? tabs.getBoundingClientRect().height : 0;
    const splitTop = panelRect.top + tabsHeight + 10;
    const availableHeight = Math.max(1, panelRect.height - tabsHeight - 28);
    updateEditorResultSplit(((clientY - splitTop) / availableHeight) * 100);
  }

  /**
   * @param {import("react").PointerEvent<HTMLDivElement>} event
   */
  function startEditorResultResize(event) {
    const panel = event.currentTarget.parentElement;
    if (!(panel instanceof HTMLElement)) {
      return;
    }
    const editorPanel = panel;
    event.preventDefault();
    updateEditorResultSplitFromPointer(event.clientY, editorPanel);

    /**
     * @param {PointerEvent} moveEvent
     */
    function handlePointerMove(moveEvent) {
      updateEditorResultSplitFromPointer(moveEvent.clientY, editorPanel);
    }

    function stopResize() {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", stopResize);
      document.removeEventListener("pointercancel", stopResize);
    }

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", stopResize);
    document.addEventListener("pointercancel", stopResize);
  }

  /**
   * @param {import("react").KeyboardEvent<HTMLDivElement>} event
   */
  function handleEditorResultResizeKeyDown(event) {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      updateEditorResultSplit(editorResultSplit - 4);
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      updateEditorResultSplit(editorResultSplit + 4);
    }
    if (event.key === "Home") {
      event.preventDefault();
      updateEditorResultSplit(EDITOR_RESULT_SPLIT_MIN);
    }
    if (event.key === "End") {
      event.preventDefault();
      updateEditorResultSplit(EDITOR_RESULT_SPLIT_MAX);
    }
  }

  if (connectionsQuery.error) {
    const title =
      connectionsQuery.error instanceof ApiError &&
      connectionsQuery.error.kind === "contract"
        ? "SQL 连接契约不兼容"
        : "SQL 连接加载失败";

    return (
      <SqlWorkbenchFrame>
        <Notice
          detail="页面已阻止异常连接数据进入工作台，请检查控制面返回契约。"
          title={title}
        />
      </SqlWorkbenchFrame>
    );
  }

  return (
    <SqlWorkbenchFrame expanded={isWorkspaceExpanded}>
      <section aria-label="SQL 工作区连接上下文" className={styles.connectionBar}>
        <div className={styles.connectionMeta}>
          <StatusPill tone={isReadyConnection ? "success" : "warning"}>
            {connectionsQuery.isLoading
              ? "正在加载连接目录"
              : activeConnection
                ? `${isReadyConnection ? "已连接" : activeConnection.status} · ${activeConnection.targetEnvironment}`
                : "未配置连接"}
          </StatusPill>
          <select
            aria-label="选择 SQL 连接"
            className={styles.connectionSelect}
            disabled={connectionsQuery.isLoading || !hasConnections}
            onChange={(event) => selectConnection(event.target.value)}
            value={activeConnection?.connectionId ?? ""}
          >
            {!activeConnection ? <option value="">无可用连接</option> : null}
            {connections.map((connection) => (
              <option key={connection.connectionId} value={connection.connectionId}>
                {connection.connectionId}
              </option>
            ))}
          </select>
          <span>{activeSchema || "未选择 Schema"}</span>
          <span>maxRows {activeLimits.maxRows}</span>
        </div>
        <div className={styles.connectionActions}>
          <button
            className={styles.secondaryButton}
            disabled={!hasConnections}
            onClick={() => setIsObjectDrawerOpen((current) => !current)}
            type="button"
          >
            <Database aria-hidden="true" size={15} />
            对象浏览器
          </button>
          <button
            className={styles.secondaryButton}
            onClick={() => setIsConnectionDialogOpen(true)}
            type="button"
          >
            <Database aria-hidden="true" size={15} />
            管理连接
          </button>
          <button
            aria-pressed={isWorkspaceExpanded}
            className={styles.primaryButton}
            onClick={() => {
              const nextExpanded = !isWorkspaceExpanded;
              setIsWorkspaceExpanded(nextExpanded);
              if (nextExpanded) {
                setIsObjectDrawerOpen(false);
              }
            }}
            type="button"
          >
            {isWorkspaceExpanded ? (
              <Minimize2 aria-hidden="true" size={15} />
            ) : (
              <Maximize2 aria-hidden="true" size={15} />
            )}
            {isWorkspaceExpanded ? "退出展开" : "展开工作区"}
          </button>
        </div>
      </section>

      <section
        className={`${styles.workbenchGrid} ${isWorkspaceExpanded ? styles.expandedGrid : ""} ${
          isObjectDrawerOpen ? styles.withObjectDrawer : ""
        }`}
      >
        {isObjectDrawerOpen && !isWorkspaceExpanded && activeConnection ? (
          <ObjectBrowser
            activeConnection={activeConnection}
            activeSchema={activeSchema}
            connections={connections}
            onClose={() => setIsObjectDrawerOpen(false)}
            onSelectConnection={selectConnection}
            onSelectSchema={selectSchema}
          />
        ) : null}

        <main className={styles.editorPanel} style={editorPanelStyle}>
          <SessionTabs
            activeSessionId={activeSession.id}
            onAddSession={addSession}
            onSelectSession={setActiveSessionId}
            sessions={sessions}
          />

          {!connectionsQuery.isLoading && !hasConnections ? (
            <Notice
              detail="连接目录为空。请先新建开发或测试环境连接，并完成 Worker 侧凭据绑定后再校验或执行 SQL。"
              title="尚未配置 SQL 连接"
            />
          ) : null}

          <section className={styles.editorCard}>
            <div className={styles.editorToolbar}>
              <button
                disabled={!canValidate || validateMutation.isPending}
                onClick={() => submitValidation("VALIDATE")}
                type="button"
              >
                <Search aria-hidden="true" size={15} />
                校验
              </button>
              <button
                disabled={!canExecuteSelect}
                onClick={runSelect}
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
                disabled={!canPreflightDml || validateMutation.isPending}
                onClick={() => submitValidation("PREFLIGHT_DML")}
                type="button"
              >
                <ShieldCheck aria-hidden="true" size={15} />
                DML 预检
              </button>
              <button disabled type="button">
                停止
              </button>
            </div>
            <section className={styles.sqlEditor} aria-label={`${activeSession.label}.sql`}>
              <span>{activeSession.label}.sql</span>
              <SqlCodeEditor
                canRunStatements={canRunSqlStatement}
                onChange={updateSql}
                onRunStatement={runReadOnlySql}
                value={activeSession.sql}
              />
            </section>
          </section>

          <div
            aria-label="调整 SQL 编辑区和查询结果高度"
            aria-orientation="horizontal"
            aria-valuemax={EDITOR_RESULT_SPLIT_MAX}
            aria-valuemin={EDITOR_RESULT_SPLIT_MIN}
            aria-valuenow={Math.round(editorResultSplit)}
            aria-valuetext={`SQL 编辑区 ${Math.round(editorResultSplit)}%`}
            className={styles.resultResizeHandle}
            onKeyDown={handleEditorResultResizeKeyDown}
            onPointerDown={startEditorResultResize}
            role="separator"
            tabIndex={0}
          >
            <span aria-hidden="true" />
          </div>

          <ResultPanel
            errorMessage={activeSession.errorMessage}
            execution={activeSession.execution}
            isLoading={runMutation.isPending || resultPageQuery.isFetching}
            onNextPage={() => readNextResultPage()}
            onPreviousPage={() => readPreviousResultPage()}
            pageIndex={activeSession.resultPageIndex}
            resultPage={currentResultPage}
          />
        </main>

        {!isWorkspaceExpanded ? (
          <InfoPanel
            assistant={activeSession.assistant}
            assistantErrorMessage={activeSession.assistantErrorMessage}
            assistantPending={assistantMutation.isPending}
            canUseAssistant={canUseAssistant}
            error={validateMutation.error ?? (activeSession.validation ? null : runMutation.error)}
            execution={activeSession.execution}
            isPending={validateMutation.isPending}
            onApplyAssistantSuggestion={updateSql}
            onRequestAssistant={requestAssistant}
            report={activeSession.validation}
          />
        ) : null}
      </section>

      <ConnectionManagerDialog
        activeConnectionId={activeConnection?.connectionId ?? ""}
        connections={connections}
        createPending={createConnectionMutation.isPending}
        deletePending={deleteConnectionMutation.isPending}
        key={isConnectionDialogOpen ? "connection-dialog-open" : "connection-dialog-closed"}
        onClose={() => setIsConnectionDialogOpen(false)}
        onCreate={(request) => {
          createConnectionMutation.mutate(request, {
            onSuccess: (connection) => {
              handleConnectionCreated(connection);
              setIsConnectionDialogOpen(false);
            },
          });
        }}
        onDelete={(connectionId) => {
          deleteConnectionMutation.mutate(connectionId, {
            onSuccess: handleConnectionDeleted,
          });
        }}
        onUpdate={(connectionId, request) => {
          updateConnectionMutation.mutate(
            { connectionId, request },
            {
              onSuccess: handleConnectionUpdated,
            },
          );
        }}
        open={isConnectionDialogOpen}
        updatePending={updateConnectionMutation.isPending}
      />
    </SqlWorkbenchFrame>
  );
}

/**
 * @param {{children: import("react").ReactNode, expanded?: boolean}} props
 */
function SqlWorkbenchFrame({ children, expanded = false }) {
  return (
    <WorkspacePageFrame
      className={`${styles.sqlCanvas} ${expanded ? styles.workspaceExpanded : ""}`}
    >
      <WorkspaceStatusBar title="SQL 工作台" />
      {children}
    </WorkspacePageFrame>
  );
}

/**
 * @typedef {{from: number, sql: string, to: number}} SqlEditorStatement
 */

class SqlRunGutterSpacerMarker extends GutterMarker {
  /**
   * @param {GutterMarker} other
   */
  eq(other) {
    return other instanceof SqlRunGutterSpacerMarker;
  }

  toDOM() {
    const spacer = document.createElement("span");
    spacer.className = "cm-sql-run-spacer";
    spacer.setAttribute("aria-hidden", "true");
    spacer.textContent = "▶";
    return spacer;
  }
}

const sqlRunGutterSpacerMarker = new SqlRunGutterSpacerMarker();

class SqlRunGutterMarker extends GutterMarker {
  /**
   * @param {SqlEditorStatement} statement
   * @param {boolean} canRun
   * @param {{current: (sqlText: string) => void}} onRunStatementRef
   */
  constructor(statement, canRun, onRunStatementRef) {
    super();
    this.statement = statement;
    this.canRun = canRun;
    this.onRunStatementRef = onRunStatementRef;
  }

  /**
   * @param {GutterMarker} other
   */
  eq(other) {
    return (
      other instanceof SqlRunGutterMarker &&
      other.statement.from === this.statement.from &&
      other.statement.to === this.statement.to &&
      other.statement.sql === this.statement.sql &&
      other.canRun === this.canRun
    );
  }

  toDOM() {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cm-sql-run-button";
    button.setAttribute("aria-label", "执行此 SQL");
    button.title = this.canRun
      ? "执行此 SQL"
      : "仅支持开发/测试连接上的 SELECT 或 WITH 只读 SQL";
    button.disabled = !this.canRun;
    button.textContent = "▶";
    button.addEventListener("mousedown", (event) => {
      event.preventDefault();
    });
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!this.canRun) {
        return;
      }
      this.onRunStatementRef.current(this.statement.sql);
    });
    return button;
  }
}

/**
 * @param {boolean} canRunStatements
 * @param {{current: (sqlText: string) => void}} onRunStatementRef
 */
function createSqlRunGutterExtension(canRunStatements, onRunStatementRef) {
  return gutter({
    class: "cm-sql-run-gutter",
    initialSpacer: () => sqlRunGutterSpacerMarker,
    markers(view) {
      const markers =
        /** @type {RangeSetBuilder<GutterMarker>} */ (new RangeSetBuilder());
      for (const statement of findSqlEditorStatements(view.state.doc.toString())) {
        const line = view.state.doc.lineAt(statement.from);
        markers.add(
          line.from,
          line.from,
          new SqlRunGutterMarker(
            statement,
            canRunStatements && isLikelyReadOnlySql(statement.sql),
            onRunStatementRef,
          ),
        );
      }
      return markers.finish();
    },
  });
}

/**
 * CodeMirror hides gutters from the accessibility tree by default because they
 * usually contain line numbers. This gutter contains real execution controls.
 *
 * @param {EditorView} view
 */
function exposeSqlRunGutter(view) {
  view.dom.querySelector(".cm-gutters")?.removeAttribute("aria-hidden");
}

/**
 * Splits editor text into executable SQL statements while ignoring semicolons
 * inside strings and comments. Leading comments are kept as annotations, not
 * executable statement anchors.
 *
 * @param {string} sqlText
 * @returns {SqlEditorStatement[]}
 */
function findSqlEditorStatements(sqlText) {
  /** @type {SqlEditorStatement[]} */
  const statements = [];
  let statementStart = -1;
  /** @type {"" | "'" | "\"" | "`"} */
  let quotedBy = "";

  for (let index = 0; index < sqlText.length; index += 1) {
    const current = sqlText[index];
    const next = sqlText[index + 1];

    if (quotedBy) {
      if (current === quotedBy) {
        if (next === quotedBy) {
          index += 1;
        } else {
          quotedBy = "";
        }
      }
      continue;
    }

    if (current === "-" && next === "-") {
      index = findLineEnd(sqlText, index + 2);
      continue;
    }

    if (current === "/" && next === "*") {
      const commentEnd = sqlText.indexOf("*/", index + 2);
      index = commentEnd === -1 ? sqlText.length : commentEnd + 1;
      continue;
    }

    if (current === "'" || current === "\"" || current === "`") {
      if (statementStart === -1) {
        statementStart = index;
      }
      quotedBy = current;
      continue;
    }

    if (current === ";") {
      appendSqlEditorStatement(statements, sqlText, statementStart, index);
      statementStart = -1;
      continue;
    }

    if (statementStart === -1 && !/\s/u.test(current)) {
      statementStart = index;
    }
  }

  appendSqlEditorStatement(statements, sqlText, statementStart, sqlText.length);
  return statements;
}

/**
 * @param {SqlEditorStatement[]} statements
 * @param {string} sqlText
 * @param {number} from
 * @param {number} to
 */
function appendSqlEditorStatement(statements, sqlText, from, to) {
  if (from < 0) {
    return;
  }
  let end = to;
  while (end > from && /\s/u.test(sqlText[end - 1] ?? "")) {
    end -= 1;
  }
  const sql = sqlText.slice(from, end);
  if (sql.trim().length === 0) {
    return;
  }
  statements.push({ from, sql, to: end });
}

/**
 * @param {string} value
 * @param {number} start
 */
function findLineEnd(value, start) {
  const newlineIndex = value.indexOf("\n", start);
  return newlineIndex === -1 ? value.length : newlineIndex;
}

/**
 * @param {{
 *   canRunStatements: boolean,
 *   onChange: (sqlText: string) => void,
 *   onRunStatement: (sqlText: string) => void,
 *   value: string,
 * }} props
 */
function SqlCodeEditor({ canRunStatements, onChange, onRunStatement, value }) {
  const rootRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const viewRef = useRef(/** @type {EditorView | null} */ (null));
  const onChangeRef = useRef(onChange);
  const onRunStatementRef = useRef(onRunStatement);
  const runGutterCompartmentRef = useRef(new Compartment());
  const initialValueRef = useRef(value);
  const initialCanRunStatementsRef = useRef(canRunStatements);
  const isApplyingExternalValueRef = useRef(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onRunStatementRef.current = onRunStatement;
  }, [onRunStatement]);

  useEffect(() => {
    if (!rootRef.current) {
      return undefined;
    }

    const view = new EditorView({
      parent: rootRef.current,
      state: EditorState.create({
        doc: initialValueRef.current,
        extensions: [
          basicSetup,
          runGutterCompartmentRef.current.of(
            createSqlRunGutterExtension(initialCanRunStatementsRef.current, onRunStatementRef),
          ),
          sql(),
          sqlEditorTheme,
          syntaxHighlighting(sqlCommentHighlightStyle),
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({
            "aria-label": "SQL 文本",
            "aria-multiline": "true",
            autocapitalize: "off",
            spellcheck: "false",
          }),
          EditorView.updateListener.of((update) => {
            exposeSqlRunGutter(update.view);
            if (!update.docChanged || isApplyingExternalValueRef.current) {
              return;
            }
            onChangeRef.current(update.state.doc.toString());
          }),
        ],
      }),
    });

    viewRef.current = view;
    exposeSqlRunGutter(view);
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }

    view.dispatch({
      effects: runGutterCompartmentRef.current.reconfigure(
        createSqlRunGutterExtension(canRunStatements, onRunStatementRef),
      ),
    });
  }, [canRunStatements]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }

    const currentValue = view.state.doc.toString();
    if (currentValue === value) {
      return;
    }

    isApplyingExternalValueRef.current = true;
    try {
      view.dispatch({
        changes: {
          from: 0,
          insert: value,
          to: currentValue.length,
        },
      });
    } finally {
      isApplyingExternalValueRef.current = false;
    }
  }, [value]);

  return <div className={styles.sqlCodeEditor} ref={rootRef} />;
}

/**
 * @param {{
 *   activeConnection: SqlConnectionSummary,
 *   activeSchema: string,
 *   connections: SqlConnectionSummary[],
 *   onClose: () => void,
 *   onSelectConnection: (connectionId: string) => void,
 *   onSelectSchema: (schema: string) => void,
 * }} props
 */
function ObjectBrowser({
  activeConnection,
  activeSchema,
  connections,
  onClose,
  onSelectConnection,
  onSelectSchema,
}) {
  return (
    <aside aria-label="数据库对象浏览器" className={styles.objectDrawer}>
      <div className={styles.drawerHeader}>
        <PanelHeading
          detail="连接、Schema、表与字段"
          icon={Database}
          title="连接与对象"
        />
        <button aria-label="关闭对象浏览器" onClick={onClose} type="button">
          <X aria-hidden="true" size={16} />
        </button>
      </div>
      <div className={styles.connectionList}>
        {connections.map((connection) => (
          <button
            className={`${styles.connectionButton} ${
              connection.connectionId === activeConnection.connectionId ? styles.active : ""
            }`}
            key={connection.connectionId}
            onClick={() => onSelectConnection(connection.connectionId)}
            type="button"
          >
            <strong>{connection.connectionId}</strong>
            <span>{connection.displayName}</span>
            <small>{connection.targetEnvironment}</small>
          </button>
        ))}
      </div>
      <div className={styles.schemaTree}>
        <span>Schema</span>
        {activeConnection.allowedSchemas.map((schema) => (
          <button
            className={schema === activeSchema ? styles.activeSchema : ""}
            key={schema}
            onClick={() => onSelectSchema(schema)}
            type="button"
          >
            {schema}
          </button>
        ))}
        <span>Tables</span>
        <strong>对象目录尚未接入真实元数据</strong>
        <span>Columns</span>
        <strong>完成对象目录接口后展示真实字段</strong>
      </div>
    </aside>
  );
}

/**
 * @param {{
 *   activeSessionId: string,
 *   onAddSession: () => void,
 *   onSelectSession: (sessionId: string) => void,
 *   sessions: SqlWorkbenchSession[],
 * }} props
 */
function SessionTabs({ activeSessionId, onAddSession, onSelectSession, sessions }) {
  return (
    <section aria-label="SQL 会话标签" className={styles.sessionTabs} role="tablist">
      {sessions.map((session) => (
        <button
          aria-selected={session.id === activeSessionId}
          className={session.id === activeSessionId ? styles.activeTab : ""}
          key={session.id}
          onClick={() => onSelectSession(session.id)}
          role="tab"
          type="button"
        >
          {session.label}
        </button>
      ))}
      <button className={styles.newSessionButton} onClick={onAddSession} type="button">
        + 新建会话
      </button>
    </section>
  );
}

/**
 * @param {{
 *   assistant: SqlAssistantResponse | null,
 *   assistantErrorMessage: string | null,
 *   assistantPending: boolean,
 *   canUseAssistant: boolean,
 *   error: Error | null,
 *   execution: SqlQueryRunResult | null,
 *   isPending: boolean,
 *   onApplyAssistantSuggestion: (sql: string) => void,
 *   onRequestAssistant: (action: SqlAssistantAction) => void,
 *   report: SqlValidationReport | null,
 * }} props
 */
function InfoPanel({
  assistant,
  assistantErrorMessage,
  assistantPending,
  canUseAssistant,
  error,
  execution,
  isPending,
  onApplyAssistantSuggestion,
  onRequestAssistant,
  report,
}) {
  return (
    <aside aria-label="SQL 信息面板" className={styles.infoPanel}>
      <ValidationReport error={error} isPending={isPending} report={report} />
      <ExecutionFacts execution={execution} />
      <AiSqlAssistantPanel
        assistant={assistant}
        errorMessage={assistantErrorMessage}
        isPending={assistantPending}
        canUseAssistant={canUseAssistant}
        onApplySuggestion={onApplyAssistantSuggestion}
        onRequest={onRequestAssistant}
      />
    </aside>
  );
}

/**
 * @param {{
 *   assistant: SqlAssistantResponse | null,
 *   canUseAssistant: boolean,
 *   errorMessage: string | null,
 *   isPending: boolean,
 *   onApplySuggestion: (sql: string) => void,
 *   onRequest: (action: SqlAssistantAction) => void,
 * }} props
 */
function AiSqlAssistantPanel({
  assistant,
  canUseAssistant,
  errorMessage,
  isPending,
  onApplySuggestion,
  onRequest,
}) {
  return (
    <section className={styles.aiPanel}>
      <PanelHeading detail="服务端模型建议，不参与自动执行" icon={Sparkles} title="AI SQL 助手" />
      <div className={styles.aiActions}>
        <button
          disabled={!canUseAssistant || isPending}
          onClick={() => onRequest("EXPLAIN_SQL")}
          type="button"
        >
          解释 SQL
        </button>
        <button
          disabled={!canUseAssistant || isPending}
          onClick={() => onRequest("OPTIMIZE_SQL")}
          type="button"
        >
          优化建议
        </button>
        <button
          disabled={!canUseAssistant || isPending}
          onClick={() => onRequest("ANALYZE_ERROR")}
          type="button"
        >
          分析错误
        </button>
      </div>
      {isPending ? <p role="status">正在请求 AI SQL 助手。</p> : null}
      {errorMessage ? (
        <div className={styles.errorSummary} role="alert">
          <AlertTriangle aria-hidden="true" size={16} />
          <span>{errorMessage}</span>
        </div>
      ) : null}
      {!assistant && !errorMessage && !isPending ? (
        <p>助手只生成解释、优化和错误分析建议；建议应用后必须重新校验。</p>
      ) : null}
      {assistant ? (
        <div className={styles.aiResponse}>
          <strong>{assistant.status}</strong>
          <p>{assistant.summary}</p>
          {assistant.suggestions.map((suggestion, index) => (
            <article className={styles.aiSuggestion} key={`${suggestion.title}-${index}`}>
              <h3>{suggestion.title}</h3>
              <p>{suggestion.rationale}</p>
              {suggestion.suggestedSql ? (
                <>
                  <pre>{suggestion.suggestedSql}</pre>
                  <button
                    onClick={() => onApplySuggestion(String(suggestion.suggestedSql))}
                    type="button"
                  >
                    应用建议到编辑器
                  </button>
                </>
              ) : null}
            </article>
          ))}
          {assistant.safetyNotes.length > 0 ? (
            <ul className={styles.aiSafetyNotes}>
              {assistant.safetyNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/**
 * @param {{
 *   error: Error | null,
 *   isPending: boolean,
 *   report: SqlValidationReport | null,
 * }} props
 */
function ValidationReport({ error, isPending, report }) {
  if (isPending) {
    return (
      <section className={styles.validationPanel} role="status">
        <PanelHeading detail="等待控制面返回强类型报告" icon={FileSearch} title="服务端校验" />
        <p>正在提交 SQL 校验请求。</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className={styles.validationPanel} role="alert">
        <PanelHeading detail="请求被控制面拒绝或校验失败" icon={AlertTriangle} title="服务端校验" />
        <ErrorMessageContent message={error.message} />
      </section>
    );
  }

  if (!report) {
    return (
      <section className={styles.validationPanel}>
        <PanelHeading detail="选择校验动作后展示服务端报告" icon={FileSearch} title="服务端校验" />
        <p>服务端 AST、对象引用、风险和拒绝原因会显示在这里。</p>
      </section>
    );
  }

  return (
    <section className={styles.validationPanel}>
      <PanelHeading detail={report.sqlHash} icon={FileSearch} title="服务端校验" />
      <div className={styles.reportGrid}>
        <ReportItem label="语句类型" value={report.statementType} />
        <ReportItem label="校验等级" value={report.validationLevel} />
        <ReportItem label="SQL 哈希" value={report.sqlHash} />
        <ReportItem label="校验哈希" value={report.validationHash ?? report.sqlHash} />
        <ReportItem label="引用对象" value={formatValues(report.referencedObjects)} />
        <ReportItem label="风险" value={formatValues(report.risks)} />
        <ReportItem label="拒绝原因" value={formatValues(report.rejectionReasons)} />
        <ReportItem label="未验证项" value={formatValues(report.unverifiedItems)} />
      </div>
    </section>
  );
}

/**
 * @param {{execution: SqlQueryRunResult | null}} props
 */
function ExecutionFacts({ execution }) {
  return (
    <section className={styles.executionFacts}>
      <PanelHeading detail="控制面执行请求与结果引用" icon={ShieldCheck} title="执行事实" />
      <div className={styles.reportGrid}>
        <ReportItem label="执行状态" value={execution?.status ?? "未提交"} />
        <ReportItem label="执行请求" value={execution?.executionRequestId ?? "pending"} />
        <ReportItem label="workflow" value={execution?.workflowId ?? "pending"} />
        <ReportItem label="resultId" value={execution?.resultId ?? "无"} />
        <ReportItem label="错误码" value={execution?.errorCode ?? "无"} />
        <ReportItem label="错误信息" value={execution?.errorMessage ?? "无"} />
      </div>
    </section>
  );
}

/**
 * @param {{
 *   errorMessage: string | null,
 *   execution: SqlQueryRunResult | null,
 *   isLoading: boolean,
 *   onNextPage: () => void,
 *   onPreviousPage: () => void,
 *   pageIndex: number,
 *   resultPage: SqlResultPage | null | undefined,
 * }} props
 */
function ResultPanel({
  errorMessage,
  execution,
  isLoading,
  onNextPage,
  onPreviousPage,
  pageIndex,
  resultPage,
}) {
  const columns = useMemo(
    () =>
      (resultPage?.columns ?? []).map((column, index) => ({
        key: column.name,
        header: column.name,
        render: (/** @type {unknown} */ row) => readResultCell(row, index),
      })),
    [resultPage?.columns],
  );

  return (
    <section className={styles.resultPanel}>
      <PanelHeading
        compact
        detail={execution?.resultId ?? "等待 SELECT 执行"}
        icon={FileSearch}
        title="查询结果"
      />
      {isLoading ? <p role="status">正在读取执行结果。</p> : null}
      {errorMessage ? (
        <ErrorSummary message={errorMessage} />
      ) : null}
      {execution && execution.status !== "SUCCEEDED" ? (
        <ErrorSummary
          message={`${execution.errorCode ? `${execution.errorCode}: ` : ""}${
            execution.errorMessage ?? execution.status
          }`}
        />
      ) : null}
      {resultPage && columns.length > 0 ? (
        <>
          <DataTable
            ariaLabel="SQL SELECT 查询结果"
            className={styles.resultTable}
            columns={columns}
            minWidth="620px"
            rows={resultPage.rows}
          />
          <div className={styles.resultFooter}>
            <span>第 {pageIndex + 1} 页</span>
            <span>本页 {resultPage.rows.length} 行</span>
            <span>{resultPage.truncated ? "已截断" : "未截断"}</span>
            <span>expiresAt {resultPage.expiresAt}</span>
            <div className={styles.resultPager}>
              <button
                disabled={pageIndex <= 0 || isLoading}
                onClick={onPreviousPage}
                type="button"
              >
                <ChevronLeft aria-hidden="true" size={14} />
                上一页
              </button>
              <button
                disabled={!resultPage.nextCursor || isLoading}
                onClick={onNextPage}
                type="button"
              >
                下一页
                <ChevronRight aria-hidden="true" size={14} />
              </button>
            </div>
          </div>
        </>
      ) : null}
      {execution?.status === "SUCCEEDED" && !resultPage && !isLoading ? (
        <p>执行完成，等待结果页返回。</p>
      ) : null}
    </section>
  );
}

/**
 * @param {{
 *   activeConnectionId: string,
 *   connections: SqlConnectionSummary[],
 *   createPending: boolean,
 *   deletePending: boolean,
 *   onClose: () => void,
 *   onCreate: (request: import("../../schemas/sql-schemas.js").SqlConnectionCreateRequest) => void,
 *   onDelete: (connectionId: string) => void,
 *   onUpdate: (connectionId: string, request: import("../../schemas/sql-schemas.js").SqlConnectionUpdateRequest) => void,
 *   open: boolean,
 *   updatePending: boolean,
 * }} props
 */
function ConnectionManagerDialog({
  activeConnectionId,
  connections,
  createPending,
  deletePending,
  onClose,
  onCreate,
  onDelete,
  onUpdate,
  open,
  updatePending,
}) {
  const initialConnection =
    connections.find((connection) => connection.connectionId === activeConnectionId) ??
    connections[0] ??
    null;
  const [mode, setMode] = useState(
    /** @type {"create" | "edit"} */ (initialConnection ? "edit" : "create"),
  );
  const [selectedConnectionId, setSelectedConnectionId] = useState(
    initialConnection?.connectionId ?? "",
  );
  const [form, setForm] = useState(
    initialConnection ? connectionToForm(initialConnection) : DEFAULT_CONNECTION_FORM,
  );
  const [deleteCandidateId, setDeleteCandidateId] = useState("");

  const selectedConnection =
    connections.find((connection) => connection.connectionId === selectedConnectionId) ??
    null;
  const isCreateMode = mode === "create" || !selectedConnection;
  const isPending = isCreateMode ? createPending : updatePending;

  /**
   * @param {keyof typeof DEFAULT_CONNECTION_FORM} key
   * @param {string} value
   */
  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  /**
   * @param {string} platformType
   */
  function updatePlatformType(platformType) {
    const nextDefaults =
      PLATFORM_FORM_DEFAULTS[
        /** @type {keyof typeof PLATFORM_FORM_DEFAULTS} */ (platformType)
      ];
    if (!nextDefaults) {
      updateField("platformType", platformType);
      return;
    }

    setForm((current) => {
      const currentDefaults =
        PLATFORM_FORM_DEFAULTS[
          /** @type {keyof typeof PLATFORM_FORM_DEFAULTS} */ (current.platformType)
        ];
      return {
        ...current,
        platformType,
        host:
          current.host === "" || current.host === currentDefaults?.host
            ? nextDefaults.host
            : current.host,
        port:
          current.port === "" || current.port === currentDefaults?.port
            ? nextDefaults.port
            : current.port,
        defaultSchema:
          current.defaultSchema === "" ||
          current.defaultSchema === currentDefaults?.defaultSchema
            ? nextDefaults.defaultSchema
            : current.defaultSchema,
        allowedSchemas:
          current.allowedSchemas === "" ||
          current.allowedSchemas === currentDefaults?.allowedSchemas
            ? nextDefaults.allowedSchemas
            : current.allowedSchemas,
      };
    });
  }

  function startCreate() {
    setMode("create");
    setSelectedConnectionId("");
    setForm(DEFAULT_CONNECTION_FORM);
    setDeleteCandidateId("");
  }

  /**
   * @param {SqlConnectionSummary} connection
   */
  function selectManagedConnection(connection) {
    setMode("edit");
    setSelectedConnectionId(connection.connectionId);
    setForm(connectionToForm(connection));
    setDeleteCandidateId("");
  }

  /**
   * @param {import("react").FormEvent<HTMLFormElement>} event
   */
  function submitForm(event) {
    event.preventDefault();
    const request = buildConnectionRequest(form);
    if (isCreateMode) {
      onCreate(request);
      return;
    }
    if (selectedConnection) {
      onUpdate(selectedConnection.connectionId, request);
    }
  }

  function confirmDelete() {
    if (!selectedConnection) {
      return;
    }
    const deletedConnectionId = selectedConnection.connectionId;
    const nextConnection =
      connections.find((connection) => connection.connectionId !== deletedConnectionId) ??
      null;
    onDelete(deletedConnectionId);
    if (nextConnection) {
      selectManagedConnection(nextConnection);
    } else {
      startCreate();
    }
    setDeleteCandidateId("");
  }

  return (
    <Dialog
      className={styles.connectionDialog}
      closeLabel="关闭连接管理"
      description="维护开发和测试环境的连接目录元数据，只提交 Worker 侧 credentialAlias。"
      icon={<Database size={18} strokeWidth={2.4} />}
      onClose={onClose}
      open={open}
      size="wide"
      title="管理连接"
    >
      <div className={styles.connectionManagerLayout}>
        <aside aria-label="SQL 连接目录" className={styles.connectionManagerSidebar}>
          <button
            className={styles.connectionManagerCreateButton}
            onClick={startCreate}
            type="button"
          >
            <Plus aria-hidden="true" size={15} />
            新建连接
          </button>
          <div className={styles.connectionManagerList}>
            {connections.length === 0 ? (
              <p className={styles.connectionManagerEmpty}>暂无连接</p>
            ) : null}
            {connections.map((connection) => (
              <button
                aria-label={connection.connectionId}
                className={`${styles.connectionManagerButton} ${
                  !isCreateMode && selectedConnectionId === connection.connectionId
                    ? styles.activeManagerConnection
                    : ""
                }`}
                key={connection.connectionId}
                onClick={() => selectManagedConnection(connection)}
                type="button"
              >
                <strong>{connection.connectionId}</strong>
                <span>{connection.displayName}</span>
                <small>
                  {connection.targetEnvironment} · {connection.status}
                </small>
              </button>
            ))}
          </div>
        </aside>

        <form className={styles.connectionForm} onSubmit={submitForm}>
          <div className={styles.connectionFormHeader}>
            <div>
              <h3>{isCreateMode ? "新建连接" : "连接详情"}</h3>
              <p>{isCreateMode ? "创建新的只读目录元数据" : selectedConnection?.connectionId}</p>
            </div>
            {!isCreateMode && selectedConnection ? (
              <StatusPill tone={selectedConnection.status === "READY" ? "success" : "warning"}>
                {selectedConnection.status}
              </StatusPill>
            ) : null}
          </div>

          <section className={styles.connectionFormSection}>
            <h3>连接身份</h3>
            <div className={styles.connectionFormGrid}>
              <label>
                <span>连接名称</span>
                <input
                  onChange={(event) => updateField("displayName", event.target.value)}
                  required
                  value={form.displayName}
                />
              </label>
              <label>
                <span>目标环境</span>
                <select
                  onChange={(event) => updateField("targetEnvironment", event.target.value)}
                  value={form.targetEnvironment}
                >
                  <option value="development">development</option>
                  <option value="test">test</option>
                </select>
              </label>
              <label>
                <span>平台类型</span>
                <select
                  onChange={(event) => updatePlatformType(event.target.value)}
                  value={form.platformType}
                >
                  <option value="DB2_FOR_I">DB2 for i</option>
                  <option value="H2">H2</option>
                  <option value="MYSQL">MySQL</option>
                </select>
              </label>
            </div>
          </section>

          <section className={styles.connectionFormSection}>
            <h3>目标端点</h3>
            <div className={styles.connectionFormGrid}>
              <label className={styles.wideField}>
                <span>主机</span>
                <input
                  onChange={(event) => updateField("host", event.target.value)}
                  required
                  value={form.host}
                />
              </label>
              <label>
                <span>端口</span>
                <input
                  inputMode="numeric"
                  onChange={(event) => updateField("port", event.target.value)}
                  required
                  value={form.port}
                />
              </label>
              <label>
                <span>凭据别名 credentialAlias</span>
                <input
                  onChange={(event) => updateField("credentialAlias", event.target.value)}
                  required
                  value={form.credentialAlias}
                />
              </label>
            </div>
          </section>

          <section className={styles.connectionFormSection}>
            <h3>Schema 与限制</h3>
            <div className={styles.connectionFormGrid}>
              <label>
                <span>默认 Schema</span>
                <input
                  onChange={(event) => updateField("defaultSchema", event.target.value)}
                  required
                  value={form.defaultSchema}
                />
              </label>
              <label>
                <span>允许 Schema</span>
                <input
                  onChange={(event) => updateField("allowedSchemas", event.target.value)}
                  required
                  value={form.allowedSchemas}
                />
              </label>
              <label>
                <span>maxRows</span>
                <input
                  inputMode="numeric"
                  onChange={(event) => updateField("maxRowsDefault", event.target.value)}
                  required
                  value={form.maxRowsDefault}
                />
              </label>
              <label>
                <span>timeoutSeconds</span>
                <input
                  inputMode="numeric"
                  onChange={(event) => updateField("timeoutSecondsDefault", event.target.value)}
                  required
                  value={form.timeoutSecondsDefault}
                />
              </label>
              <div className={styles.formCapabilities}>
                <span>capabilities</span>
                <strong>VALIDATE</strong>
                <strong>RUN_READ_ONLY</strong>
                <strong>PREFLIGHT_DML</strong>
              </div>
            </div>
          </section>

          {!isCreateMode && selectedConnection ? (
            <section className={styles.deleteSection}>
              <div>
                <strong>删除连接</strong>
                <p>只删除目录元数据，不触碰凭据库或目标系统。</p>
              </div>
              {deleteCandidateId === selectedConnection.connectionId ? (
                <div className={styles.deleteActions}>
                  <button
                    className={styles.secondaryButton}
                    disabled={deletePending}
                    onClick={confirmDelete}
                    type="button"
                  >
                    确认删除
                  </button>
                  <button
                    className={styles.secondaryButton}
                    disabled={deletePending}
                    onClick={() => setDeleteCandidateId("")}
                    type="button"
                  >
                    取消删除
                  </button>
                </div>
              ) : (
                <button
                  className={styles.dangerButton}
                  disabled={deletePending}
                  onClick={() => setDeleteCandidateId(selectedConnection.connectionId)}
                  type="button"
                >
                  删除连接
                </button>
              )}
            </section>
          ) : null}

          <div className={styles.formActions}>
            <button className={styles.secondaryButton} onClick={onClose} type="button">
              关闭
            </button>
            <button className={styles.primaryButton} disabled={isPending} type="submit">
              {isCreateMode ? "创建连接" : "保存修改"}
            </button>
          </div>
        </form>
      </div>
    </Dialog>
  );
}

/**
 * @param {{
 *   compact?: boolean,
 *   detail: string,
 *   icon: import("lucide-react").LucideIcon,
 *   title: string,
 * }} props
 */
function PanelHeading({ compact = false, detail, icon: Icon, title }) {
  return (
    <header className={`${styles.panelHeading} ${compact ? styles.compactPanelHeading : ""}`}>
      <span aria-hidden="true">
        <Icon size={compact ? 13 : 16} strokeWidth={2.4} />
      </span>
      <div>
        <h2>{title}</h2>
        <p>{detail}</p>
      </div>
    </header>
  );
}

/**
 * @param {{label: string, value: string}} props
 */
function ReportItem({ label, value }) {
  return (
    <div className={styles.reportItem}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

/**
 * @param {{detail: string, title: string}} props
 */
function Notice({ detail, title }) {
  return (
    <section className={styles.noticePanel}>
      <AlertTriangle aria-hidden="true" size={18} />
      <strong>{title}</strong>
      <p>{detail}</p>
    </section>
  );
}

/**
 * @param {{message: string}} props
 */
function ErrorSummary({ message }) {
  return (
    <div className={styles.errorSummary} role="alert">
      <AlertTriangle aria-hidden="true" size={16} />
      <ErrorMessageContent message={message} />
    </div>
  );
}

/**
 * @param {{message: string}} props
 */
function ErrorMessageContent({ message }) {
  const { summary, details } = splitDiagnosticMessage(message);
  return (
    <div className={styles.errorText}>
      <strong>{summary}</strong>
      {details.length > 0 ? (
        <div className={styles.errorDetails}>
          <span>排查线索</span>
          <ul>
            {details.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/**
 * @param {SqlConnectionSummary} connection
 * @returns {typeof DEFAULT_CONNECTION_FORM}
 */
function connectionToForm(connection) {
  const platformDefaults =
    PLATFORM_FORM_DEFAULTS[
      /** @type {keyof typeof PLATFORM_FORM_DEFAULTS} */ (connection.platformType)
    ];
  return {
    displayName: connection.displayName,
    targetEnvironment: connection.targetEnvironment,
    platformType: connection.platformType,
    host: connection.host ?? platformDefaults?.host ?? "",
    port: String(connection.port ?? platformDefaults?.port ?? ""),
    defaultSchema: connection.defaultSchema ?? connection.allowedSchemas[0] ?? "",
    allowedSchemas: connection.allowedSchemas.join(", "),
    credentialAlias: connection.credentialAlias ?? "",
    maxRowsDefault: String(connection.maxRowsDefault ?? DEFAULT_LIMITS.maxRows),
    timeoutSecondsDefault: String(
      connection.timeoutSecondsDefault ?? DEFAULT_LIMITS.timeoutSeconds,
    ),
  };
}

/**
 * @param {typeof DEFAULT_CONNECTION_FORM} form
 * @returns {import("../../schemas/sql-schemas.js").SqlConnectionCreateRequest}
 */
function buildConnectionRequest(form) {
  return {
    contractVersion: "1.0",
    displayName: form.displayName.trim(),
    targetEnvironment: /** @type {"development" | "test"} */ (form.targetEnvironment),
    platformType: /** @type {"DB2_FOR_I" | "H2" | "MYSQL"} */ (form.platformType),
    host: form.host.trim(),
    port: Number(form.port),
    defaultSchema: form.defaultSchema.trim(),
    allowedSchemas: splitCsv(form.allowedSchemas),
    capabilities: ["VALIDATE", "RUN_READ_ONLY", "PREFLIGHT_DML"],
    credentialAlias: form.credentialAlias.trim(),
    maxRowsDefault: Number(form.maxRowsDefault),
    timeoutSecondsDefault: Number(form.timeoutSecondsDefault),
  };
}

/**
 * Lightweight UX hint only. The server still performs the authoritative
 * read-only validation inside the RUN_READ_ONLY execution path.
 *
 * @param {string} sql
 */
function isLikelyReadOnlySql(sql) {
  return /^(?:\s|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)*(?:select|with)\b/iu.test(sql);
}

/**
 * @param {SqlConnectionSummary[]} connections
 * @param {SqlConnectionSummary} connection
 */
function upsertConnection(connections, connection) {
  const hasConnection = connections.some(
    (item) => item.connectionId === connection.connectionId,
  );
  if (!hasConnection) {
    return [...connections, connection];
  }
  return connections.map((item) =>
    item.connectionId === connection.connectionId ? connection : item,
  );
}

/**
 * @param {SqlConnectionSummary[]} baseConnections
 * @param {SqlConnectionSummary[]} overrides
 * @param {string[]} deletedConnectionIds
 */
function mergeConnections(baseConnections, overrides, deletedConnectionIds) {
  const deleted = new Set(deletedConnectionIds);
  const byId = new Map();
  baseConnections.forEach((connection) => {
    if (!deleted.has(connection.connectionId)) {
      byId.set(connection.connectionId, connection);
    }
  });
  overrides.forEach((connection) => {
    if (!deleted.has(connection.connectionId)) {
      byId.set(connection.connectionId, connection);
    }
  });
  return Array.from(byId.values());
}

/**
 * @param {SqlConnectionSummary | null} connection
 * @param {string} fallbackSchema
 * @param {string} fallbackConnectionId
 * @returns {Partial<SqlWorkbenchSession>}
 */
function buildConnectionSessionPatch(connection, fallbackSchema, fallbackConnectionId) {
  return {
    connectionId: connection?.connectionId ?? fallbackConnectionId,
    schema:
      connection?.defaultSchema ??
      connection?.allowedSchemas[0] ??
      fallbackSchema,
    validation: null,
    execution: null,
    resultPage: null,
    resultPageIndex: 0,
    resultPageToken: null,
    resultPageTokens: [null],
    errorMessage: null,
    assistant: null,
    assistantErrorMessage: null,
  };
}

/**
 * @param {number} index
 * @param {string} sql
 * @returns {SqlWorkbenchSession}
 */
function createSession(index, sql) {
  return {
    assistant: null,
    assistantErrorMessage: null,
    connectionId: "",
    errorMessage: null,
    execution: null,
    id: `sql-session-${index}`,
    label: `SQL ${index}`,
    resultPage: null,
    resultPageIndex: 0,
    resultPageToken: null,
    resultPageTokens: [null],
    schema: "",
    sql,
    validation: null,
  };
}

/**
 * @param {SqlConnectionSummary[]} connections
 * @param {SqlWorkbenchSession} session
 * @returns {SqlConnectionSummary | null}
 */
function resolveActiveConnection(connections, session) {
  return (
    connections.find((connection) => connection.connectionId === session.connectionId) ??
    connections[0] ??
    null
  );
}

/**
 * @param {SqlConnectionSummary} connection
 */
function buildLimits(connection) {
  return {
    maxRows: connection.maxRowsDefault ?? DEFAULT_LIMITS.maxRows,
    maxBytes: DEFAULT_LIMITS.maxBytes,
    timeoutSeconds: connection.timeoutSecondsDefault ?? DEFAULT_LIMITS.timeoutSeconds,
  };
}

/**
 * @param {SqlConnectionSummary} connection
 * @param {string} schema
 * @param {"VALIDATE" | "PREFLIGHT_DML" | "RUN_READ_ONLY"} action
 * @param {string} sql
 * @param {string} idempotencyAction
 */
function buildSqlQueryRequest(connection, schema, action, sql, idempotencyAction) {
  return {
    contractVersion: "1.0",
    connectionId: connection.connectionId,
    targetEnvironment: connection.targetEnvironment,
    schema,
    action,
    sql,
    parameters: [],
    limits: buildLimits(connection),
    idempotencyKey: createSqlIdempotencyKey(idempotencyAction),
  };
}

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 */
function clampNumber(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * @param {string[]} values
 */
function formatValues(values) {
  return values.length > 0 ? values.join(" / ") : "无";
}

/**
 * @param {string} message
 * @returns {{summary: string, details: string[]}}
 */
function splitDiagnosticMessage(message) {
  const lines = message
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  return {
    summary: lines[0] ?? message,
    details: lines.slice(1),
  };
}

/**
 * @param {unknown} error
 */
function shouldFetchValidationDiagnostics(error) {
  return (
    error instanceof ApiError &&
    error.message.includes(LEGACY_READ_ONLY_VALIDATION_ERROR)
  );
}

/**
 * @param {SqlValidationReport} report
 */
function buildReadOnlyValidationDiagnosticMessage(report) {
  return [
    "SELECT 执行未通过服务端只读校验。控制面没有向 Worker 提交执行请求。",
    `statementType=${report.statementType}`,
    `validationLevel=${report.validationLevel}`,
    `rejectionReasons=${formatValues(report.rejectionReasons)}`,
    `risks=${formatValues(report.risks)}`,
    `referencedObjects=${formatValues(report.referencedObjects)}`,
    `unverifiedItems=${formatValues(report.unverifiedItems)}`,
    `sqlHash=${report.sqlHash}`,
    "nextStep=先修正 SQL 语法或点击校验查看完整报告；AI SQL 助手只提供参考，不能授权执行。",
  ].join("\n");
}

/**
 * @param {SqlValidationReport} report
 */
function shouldAutoAnalyzeValidation(report) {
  if (report.validationLevel !== "REJECTED" || report.statementType !== "UNSUPPORTED") {
    return false;
  }
  return report.rejectionReasons.some((reason) => /syntax|parse|解析|语法/iu.test(reason));
}

/**
 * @param {{
 *   errorMessage: string | null,
 *   execution?: SqlQueryRunResult | null,
 *   validation?: SqlValidationReport | null,
 * }} session
 * @returns {string | undefined}
 */
function buildAssistantDiagnosticContext(session) {
  const parts = [];
  if (session.errorMessage) {
    parts.push(`errorMessage=${session.errorMessage}`);
  }
  if (session.execution?.errorCode || session.execution?.errorMessage) {
    parts.push(`executionErrorCode=${session.execution.errorCode ?? "none"}`);
    parts.push(`executionErrorMessage=${session.execution.errorMessage ?? "none"}`);
  }
  if (session.validation) {
    parts.push(`statementType=${session.validation.statementType}`);
    parts.push(`validationLevel=${session.validation.validationLevel}`);
    parts.push(`sqlHash=${session.validation.sqlHash}`);
  }
  if (session.validation?.rejectionReasons.length) {
    parts.push(`rejectionReasons=${session.validation.rejectionReasons.join(" / ")}`);
  }
  if (session.validation?.risks.length) {
    parts.push(`risks=${session.validation.risks.join(" / ")}`);
  }
  const value = parts.join("\n").trim();
  return value.length > 0 ? value : undefined;
}

/**
 * @param {string} action
 */
function createSqlIdempotencyKey(action) {
  const randomPart =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `sql:${action}:${randomPart}`;
}

/**
 * @param {unknown} row
 * @param {number} index
 */
function readResultCell(row, index) {
  if (!Array.isArray(row)) {
    return "";
  }
  const value = row[index];
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

/**
 * @param {string} value
 */
function splitCsv(value) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
