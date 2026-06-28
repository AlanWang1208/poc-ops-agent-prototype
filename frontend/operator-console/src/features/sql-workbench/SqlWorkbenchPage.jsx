import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
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
  useRunReadOnlySqlQuery,
  useSqlConnections,
  useSqlResultPage,
  useValidateSqlQuery,
} from "./use-sql-workbench.js";
import styles from "./SqlWorkbenchPage.module.css";

const DEFAULT_SQL = `SELECT o.order_id, o.status, o.amount, o.customer_id, o.created_at
FROM ORDERS.ORDERS o
WHERE o.status = 'PENDING'
  AND o.created_at > CURRENT_DATE - 7 DAYS
ORDER BY o.created_at DESC
FETCH FIRST 100 ROWS ONLY;`;

const EMPTY_SESSION_SQL = "SELECT * FROM ORDERS.ORDERS\nFETCH FIRST 100 ROWS ONLY";

/**
 * @typedef {import("../../schemas/sql-schemas.js").SqlConnectionSummary} SqlConnectionSummary
 * @typedef {import("../../schemas/sql-schemas.js").SqlValidationReport} SqlValidationReport
 * @typedef {import("../../schemas/sql-schemas.js").SqlQueryRunResult} SqlQueryRunResult
 * @typedef {import("../../schemas/sql-schemas.js").SqlResultPage} SqlResultPage
 * @typedef {{
 *   connectionId: string,
 *   errorMessage: string | null,
 *   execution: SqlQueryRunResult | null,
 *   id: string,
 *   label: string,
 *   resultPage: SqlResultPage | null,
 *   resultPageToken: string | null,
 *   schema: string,
 *   sql: string,
 *   validation: SqlValidationReport | null,
 * }} SqlWorkbenchSession
 */

/** @type {SqlConnectionSummary} */
const DEFAULT_CONNECTION = {
  contractVersion: "1.0",
  connectionId: "as400-development",
  displayName: "AS/400 Development",
  targetEnvironment: "development",
  platformType: "DB2_FOR_I",
  status: "READY",
  defaultSchema: "ORDERS",
  allowedSchemas: ["ORDERS", "INVENTORY"],
  capabilities: ["VALIDATE", "RUN_READ_ONLY", "PREFLIGHT_DML"],
  maxRowsDefault: 500,
  timeoutSecondsDefault: 30,
};

const DEFAULT_LIMITS = {
  maxRows: 500,
  maxBytes: 5_000_000,
  timeoutSeconds: 30,
};

const PLATFORM_FORM_DEFAULTS = {
  DB2_FOR_I: {
    host: "",
    port: "446",
    defaultSchema: "ORDERS",
    allowedSchemas: "ORDERS",
  },
  H2: {
    host: "localhost",
    port: "9092",
    defaultSchema: "PUBLIC",
    allowedSchemas: "PUBLIC",
  },
  MYSQL: {
    host: "",
    port: "3306",
    defaultSchema: "ops",
    allowedSchemas: "ops",
  },
};

const DEFAULT_CONNECTION_FORM = {
  displayName: "",
  targetEnvironment: "development",
  platformType: "DB2_FOR_I",
  host: "",
  port: "446",
  defaultSchema: "ORDERS",
  allowedSchemas: "ORDERS",
  credentialAlias: "",
  maxRowsDefault: "500",
  timeoutSecondsDefault: "30",
};

export function SqlWorkbenchPage() {
  const connectionsQuery = useSqlConnections();
  const createConnectionMutation = useCreateSqlConnection();
  const validateMutation = useValidateSqlQuery();
  const runMutation = useRunReadOnlySqlQuery();
  const [createdConnections, setCreatedConnections] = useState(
    /** @type {SqlConnectionSummary[]} */ ([]),
  );
  const connections = useMemo(
    () => [...(connectionsQuery.data ?? []), ...createdConnections],
    [connectionsQuery.data, createdConnections],
  );
  const [sessions, setSessions] = useState(
    /** @type {SqlWorkbenchSession[]} */ ([createSession(1, DEFAULT_SQL)]),
  );
  const [activeSessionId, setActiveSessionId] = useState("sql-session-1");
  const [isObjectDrawerOpen, setIsObjectDrawerOpen] = useState(false);
  const [isConnectionDialogOpen, setIsConnectionDialogOpen] = useState(false);
  const [isWorkspaceExpanded, setIsWorkspaceExpanded] = useState(false);

  const activeSession =
    sessions.find((session) => session.id === activeSessionId) ?? sessions[0];
  const activeConnection = resolveActiveConnection(connections, activeSession);
  const activeSchema =
    activeSession.schema ||
    activeConnection.defaultSchema ||
    activeConnection.allowedSchemas[0] ||
    "ORDERS";
  const resultPageQuery = useSqlResultPage(
    activeSession.execution?.resultId,
    activeSession.resultPageToken,
  );
  const currentResultPage = resultPageQuery.data ?? activeSession.resultPage;
  const isReadyConnection = activeConnection.status === "READY";
  const canValidate =
    isReadyConnection && activeConnection.capabilities.includes("VALIDATE");
  const canPreflightDml =
    isReadyConnection && activeConnection.capabilities.includes("PREFLIGHT_DML");
  const canExecuteSelect =
    isReadyConnection &&
    activeConnection.capabilities.includes("RUN_READ_ONLY") &&
    activeSession.validation?.statementType === "SELECT" &&
    activeSession.validation.validationLevel === "VALIDATED" &&
    !runMutation.isPending;

  useEffect(() => {
    if (!resultPageQuery.data) {
      return;
    }
    updateSession(activeSession.id, {
      resultPage: resultPageQuery.data,
      resultPageToken: resultPageQuery.data.nextCursor,
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
      resultPageToken: null,
      errorMessage: null,
    });
  }

  /**
   * @param {string} connectionId
   */
  function selectConnection(connectionId) {
    const connection = connections.find((item) => item.connectionId === connectionId);
    updateSession(activeSession.id, {
      connectionId,
      schema: connection?.defaultSchema ?? connection?.allowedSchemas[0] ?? activeSchema,
      validation: null,
      execution: null,
      resultPage: null,
      resultPageToken: null,
      errorMessage: null,
    });
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
      resultPageToken: null,
      errorMessage: null,
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

    validateMutation.mutate(
      {
        contractVersion: "1.0",
        connectionId: activeConnection.connectionId,
        targetEnvironment: activeConnection.targetEnvironment,
        schema: activeSchema,
        action,
        sql: activeSession.sql,
        parameters: [],
        limits: buildLimits(activeConnection),
        idempotencyKey: createSqlIdempotencyKey(action),
      },
      {
        onSuccess: (report) => {
          updateSession(activeSession.id, {
            validation: report,
            execution: null,
            resultPage: null,
            resultPageToken: null,
            errorMessage: null,
          });
        },
        onError: (error) => {
          updateSession(activeSession.id, {
            validation: null,
            execution: null,
            resultPage: null,
            resultPageToken: null,
            errorMessage: error instanceof Error ? error.message : "SQL 校验请求失败",
          });
        },
      },
    );
  }

  function runSelect() {
    if (!activeSession.validation || !canExecuteSelect) {
      return;
    }

    runMutation.mutate(
      {
        contractVersion: "1.0",
        connectionId: activeConnection.connectionId,
        targetEnvironment: activeConnection.targetEnvironment,
        schema: activeSchema,
        action: "RUN_READ_ONLY",
        sql: activeSession.sql,
        parameters: [],
        limits: buildLimits(activeConnection),
        idempotencyKey: createSqlIdempotencyKey("RUN_READ_ONLY"),
        validationHash: activeSession.validation.validationHash ?? activeSession.validation.sqlHash,
      },
      {
        onSuccess: (execution) => {
          updateSession(activeSession.id, {
            execution,
            resultPage: null,
            resultPageToken: null,
            errorMessage: execution.errorMessage ?? null,
          });
        },
        onError: (error) => {
          updateSession(activeSession.id, {
            execution: null,
            resultPage: null,
            resultPageToken: null,
            errorMessage: error instanceof Error ? error.message : "SELECT 执行请求失败",
          });
        },
      },
    );
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
              ? `正在连接 · ${activeConnection.targetEnvironment}`
              : `${isReadyConnection ? "已连接" : activeConnection.status} · ${activeConnection.targetEnvironment}`}
          </StatusPill>
          <strong>{activeConnection.connectionId}</strong>
          <span>{activeSchema}</span>
          <span>maxRows {buildLimits(activeConnection).maxRows}</span>
        </div>
        <div className={styles.connectionActions}>
          <button
            className={styles.secondaryButton}
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
            <Plus aria-hidden="true" size={15} />
            新建连接
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
        {isObjectDrawerOpen && !isWorkspaceExpanded ? (
          <ObjectBrowser
            activeConnection={activeConnection}
            activeSchema={activeSchema}
            connections={connections.length > 0 ? connections : [DEFAULT_CONNECTION]}
            onClose={() => setIsObjectDrawerOpen(false)}
            onSelectConnection={selectConnection}
            onSelectSchema={selectSchema}
          />
        ) : null}

        <main className={styles.editorPanel}>
          <SessionTabs
            activeSessionId={activeSession.id}
            onAddSession={addSession}
            onSelectSession={setActiveSessionId}
            sessions={sessions}
          />

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
            <label className={styles.sqlEditor}>
              <span>{activeSession.label}.sql</span>
              <textarea
                aria-label="SQL 文本"
                onChange={(event) => updateSql(event.target.value)}
                spellCheck="false"
                value={activeSession.sql}
              />
            </label>
          </section>

          <ResultPanel
            errorMessage={activeSession.errorMessage}
            execution={activeSession.execution}
            isLoading={runMutation.isPending || resultPageQuery.isFetching}
            resultPage={currentResultPage}
          />
        </main>

        {!isWorkspaceExpanded ? (
          <InfoPanel
            error={validateMutation.error ?? runMutation.error}
            execution={activeSession.execution}
            isPending={validateMutation.isPending}
            report={activeSession.validation}
          />
        ) : null}
      </section>

      <ConnectionDialog
        isPending={createConnectionMutation.isPending}
        key={isConnectionDialogOpen ? "connection-dialog-open" : "connection-dialog-closed"}
        onClose={() => setIsConnectionDialogOpen(false)}
        onSubmit={(request) => {
          createConnectionMutation.mutate(request, {
            onSuccess: (connection) => {
              setCreatedConnections((current) => [...current, connection]);
              updateSession(activeSession.id, {
                connectionId: connection.connectionId,
                schema: connection.defaultSchema ?? connection.allowedSchemas[0] ?? activeSchema,
                validation: null,
                execution: null,
                resultPage: null,
                resultPageToken: null,
                errorMessage: null,
              });
              setIsConnectionDialogOpen(false);
            },
          });
        }}
        open={isConnectionDialogOpen}
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
        <strong>ORDERS.ORDERS</strong>
        <strong>ORDERS.ORDER_ITEMS</strong>
        <strong>INVENTORY.STOCK</strong>
        <span>Columns</span>
        <strong>order_id · status · amount · created_at</strong>
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
 *   error: Error | null,
 *   execution: SqlQueryRunResult | null,
 *   isPending: boolean,
 *   report: SqlValidationReport | null,
 * }} props
 */
function InfoPanel({ error, execution, isPending, report }) {
  return (
    <aside aria-label="SQL 信息面板" className={styles.infoPanel}>
      <ValidationReport error={error} isPending={isPending} report={report} />
      <ExecutionFacts execution={execution} />
      <section className={styles.aiPanel}>
        <PanelHeading detail="模型评测与脱敏门禁未完成" icon={Sparkles} title="AI SQL 助手" />
        <p>当前仅保留入口状态，不参与 P1 校验或执行决策。</p>
        <button disabled type="button">
          展开 AI SQL 助手
        </button>
      </section>
    </aside>
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
        <p>{error.message}</p>
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
 *   resultPage: SqlResultPage | null | undefined,
 * }} props
 */
function ResultPanel({ errorMessage, execution, isLoading, resultPage }) {
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
        detail={execution?.resultId ?? "等待 SELECT 执行"}
        icon={FileSearch}
        title="查询结果"
      />
      {isLoading ? <p role="status">正在读取执行结果。</p> : null}
      {errorMessage ? (
        <div className={styles.errorSummary} role="alert">
          <AlertTriangle aria-hidden="true" size={16} />
          <span>{errorMessage}</span>
        </div>
      ) : null}
      {execution && execution.status !== "SUCCEEDED" ? (
        <div className={styles.errorSummary} role="alert">
          <AlertTriangle aria-hidden="true" size={16} />
          <span>
            {execution.errorCode ? `${execution.errorCode}: ` : ""}
            {execution.errorMessage ?? execution.status}
          </span>
        </div>
      ) : null}
      {resultPage && columns.length > 0 ? (
        <>
          <DataTable
            ariaLabel="SQL SELECT 查询结果"
            columns={columns}
            rows={resultPage.rows}
          />
          <div className={styles.resultFooter}>
            <span>{resultPage.resultId}</span>
            <span>{resultPage.nextCursor ? "存在下一页" : "最后一页"}</span>
            <span>{resultPage.truncated ? "已截断" : "未截断"}</span>
            <span>expiresAt {resultPage.expiresAt}</span>
          </div>
        </>
      ) : null}
      {execution?.status === "SUCCEEDED" && !resultPage && !isLoading ? (
        <p>执行完成，等待结果页返回。</p>
      ) : null}
      {!execution && !errorMessage ? (
        <p>校验通过的单条 SELECT 执行后，分页结果会显示在这里。</p>
      ) : null}
    </section>
  );
}

/**
 * @param {{
 *   isPending: boolean,
 *   onClose: () => void,
 *   onSubmit: (request: import("../../schemas/sql-schemas.js").SqlConnectionCreateRequest) => void,
 *   open: boolean,
 * }} props
 */
function ConnectionDialog({ isPending, onClose, onSubmit, open }) {
  const [form, setForm] = useState(DEFAULT_CONNECTION_FORM);

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

  /**
   * @param {import("react").FormEvent<HTMLFormElement>} event
   */
  function submitForm(event) {
    event.preventDefault();
    onSubmit({
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
    });
  }

  return (
    <Dialog
      className={styles.connectionDialog}
      closeLabel="关闭新建连接"
      description="只提交连接目录元数据和 Worker 侧 credentialAlias。"
      icon={<Database size={18} strokeWidth={2.4} />}
      onClose={onClose}
      open={open}
      size="wide"
      title="新建连接"
    >
      <form className={styles.connectionForm} onSubmit={submitForm}>
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

        <div className={styles.formActions}>
          <button className={styles.secondaryButton} onClick={onClose} type="button">
            取消
          </button>
          <button className={styles.primaryButton} disabled={isPending} type="submit">
            保存连接
          </button>
        </div>
      </form>
    </Dialog>
  );
}

/**
 * @param {{
 *   detail: string,
 *   icon: import("lucide-react").LucideIcon,
 *   title: string,
 * }} props
 */
function PanelHeading({ detail, icon: Icon, title }) {
  return (
    <header className={styles.panelHeading}>
      <span aria-hidden="true">
        <Icon size={16} strokeWidth={2.4} />
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
 * @param {number} index
 * @param {string} sql
 * @returns {SqlWorkbenchSession}
 */
function createSession(index, sql) {
  return {
    connectionId: "",
    errorMessage: null,
    execution: null,
    id: `sql-session-${index}`,
    label: `SQL ${index}`,
    resultPage: null,
    resultPageToken: null,
    schema: "",
    sql,
    validation: null,
  };
}

/**
 * @param {SqlConnectionSummary[]} connections
 * @param {SqlWorkbenchSession} session
 */
function resolveActiveConnection(connections, session) {
  return (
    connections.find((connection) => connection.connectionId === session.connectionId) ??
    connections[0] ??
    DEFAULT_CONNECTION
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
 * @param {string[]} values
 */
function formatValues(values) {
  return values.length > 0 ? values.join(" / ") : "无";
}

/**
 * @param {"VALIDATE" | "RUN_READ_ONLY" | "PREFLIGHT_DML"} action
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
