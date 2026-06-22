import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  FileSearch,
  LockKeyhole,
  Sparkles,
} from "lucide-react";

import { ApiError } from "../../api/client.js";
import { DataTable } from "../../components/data-display/DataTable.jsx";
import { StatusPill } from "../../components/data-display/StatusPill.jsx";
import { WorkspacePageFrame } from "../../components/layout/WorkspacePageFrame.jsx";
import { WorkspaceStatusBar } from "../../components/layout/WorkspaceStatusBar.jsx";
import { useSqlConnections, useValidateSqlQuery } from "./use-sql-workbench.js";
import styles from "./SqlWorkbenchPage.module.css";

const DEFAULT_SQL = `SELECT o.order_id, o.status, o.amount, o.customer_id, o.created_at
FROM ORDERS.ORDERS o
WHERE o.status = 'PENDING'
  AND o.created_at > CURRENT_DATE - 7 DAYS
ORDER BY o.created_at DESC
FETCH FIRST 100 ROWS ONLY;

UPDATE ORDERS.ORDERS
SET status = 'REVIEW_REQUIRED'
WHERE user_id = :userId;`;

const DEFAULT_CONNECTION = {
  contractVersion: "1.0",
  connectionId: "as400-development",
  displayName: "AS/400 Development",
  targetEnvironment: "development",
  platformType: "DB2_FOR_I",
  allowedSchemas: ["ORDERS", "INVENTORY"],
  capabilities: ["VALIDATE", "RUN_READ_ONLY", "PREFLIGHT_DML"],
};

const QUERY_LIMITS = {
  maxRows: 500,
  maxBytes: 5_000_000,
  timeoutSeconds: 30,
};

const previewRows = [
  {
    amount: "428.00",
    createdAt: "2026-06-13 10:42",
    customerId: "C-***921",
    orderId: "OD-10482",
    status: "PENDING",
  },
  {
    amount: "1,280.00",
    createdAt: "2026-06-13 10:38",
    customerId: "C-***104",
    orderId: "OD-10483",
    status: "PENDING",
  },
  {
    amount: "86.50",
    createdAt: "2026-06-13 10:31",
    customerId: "C-***672",
    orderId: "OD-10491",
    status: "PENDING",
  },
];

/** @type {{header: string, key: string, render: (row: unknown) => string}[]} */
const previewColumns = [
  { header: "order_id", key: "orderId", render: (row) => getCell(row, "orderId") },
  { header: "status", key: "status", render: (row) => getCell(row, "status") },
  { header: "amount", key: "amount", render: (row) => getCell(row, "amount") },
  { header: "customer_id", key: "customerId", render: (row) => getCell(row, "customerId") },
  { header: "created_at", key: "createdAt", render: (row) => getCell(row, "createdAt") },
];

const guardrails = [
  "连接目录只允许 development / test 环境",
  "SQL 请求必须携带契约版本、幂等键和限制参数",
  "生产写执行、Commit、Rollback 不在 P1 前端暴露",
];

const aiFindings = [
  {
    action: "查看建议改写",
    body: "UPDATE 仅按 user_id 过滤，可能修改该用户全部历史订单。建议增加 status 与时间范围。",
    title: "潜在逻辑风险",
    tone: "danger",
  },
  {
    body: "当前查询按 status、created_at 过滤并排序，建议由服务端报告确认复合索引覆盖情况。",
    title: "性能观察",
    tone: "warning",
  },
  {
    body: "结果预览仅使用脱敏样例，真实数据必须由后端只读执行结果提供。",
    title: "数据边界",
    tone: "info",
  },
];

export function SqlWorkbenchPage() {
  const connectionsQuery = useSqlConnections();
  const validateMutation = useValidateSqlQuery();
  const connections = useMemo(
    () => connectionsQuery.data ?? [],
    [connectionsQuery.data],
  );
  const [selectedConnectionId, setSelectedConnectionId] = useState("");
  const [sql, setSql] = useState(DEFAULT_SQL);

  const activeConnectionId =
    selectedConnectionId || connections[0]?.connectionId || DEFAULT_CONNECTION.connectionId;
  const selectedConnection = useMemo(
    () =>
      connections.find((connection) => connection.connectionId === activeConnectionId) ??
      connections[0],
    [activeConnectionId, connections],
  );

  const activeConnection = selectedConnection ?? DEFAULT_CONNECTION;
  const selectedSchema = activeConnection.allowedSchemas[0] ?? "ORDERS";
  const canValidateReadOnly =
    Boolean(selectedConnection) && activeConnection.capabilities.includes("RUN_READ_ONLY");
  const canPreflightDml =
    Boolean(selectedConnection) && activeConnection.capabilities.includes("PREFLIGHT_DML");

  /**
   * @param {"RUN_READ_ONLY" | "PREFLIGHT_DML"} action
   */
  function submitValidation(action) {
    if (!selectedConnection) {
      return;
    }

    validateMutation.mutate({
      contractVersion: "1.0",
      connectionId: activeConnection.connectionId,
      targetEnvironment: activeConnection.targetEnvironment,
      schema: selectedSchema,
      action,
      sql,
      parameters: [],
      limits: QUERY_LIMITS,
      idempotencyKey: createSqlIdempotencyKey(action),
    });
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
    <SqlWorkbenchFrame>
      <section className={styles.workbenchGrid}>
        <aside aria-label="SQL 连接目录" className={styles.connectionPanel}>
          <PanelHeading
            detail="仅列出开发和测试环境"
            icon={Database}
            title="连接与对象"
          />
          <div className={styles.connectionList}>
            {(connections.length > 0 ? connections : [DEFAULT_CONNECTION]).map((connection) => (
              <button
                className={`${styles.connectionButton} ${
                  connection.connectionId === activeConnection.connectionId ? styles.active : ""
                }`}
                disabled={!connections.length}
                key={connection.connectionId}
                onClick={() => setSelectedConnectionId(connection.connectionId)}
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
              <strong key={schema}>{schema}</strong>
            ))}
            <span>Tables</span>
            <strong>ORDERS.ORDERS</strong>
            <strong>ORDERS.ORDER_ITEMS</strong>
          </div>
        </aside>

        <main className={styles.editorPanel}>
          <section aria-label="SQL 工作台连接状态" className={styles.connectionStrip}>
            <StatusPill tone="success">
              {connectionsQuery.isLoading
                ? `正在连接 · ${activeConnection.targetEnvironment}`
                : `已连接 · ${activeConnection.targetEnvironment}`}
            </StatusPill>
            <span>{activeConnection.connectionId}</span>
            <span>{selectedSchema}</span>
            <span>maxRows {QUERY_LIMITS.maxRows}</span>
          </section>

          <section className={styles.editorCard}>
            <div className={styles.editorToolbar}>
              <button
                disabled={!canValidateReadOnly || validateMutation.isPending}
                onClick={() => submitValidation("RUN_READ_ONLY")}
                type="button"
              >
                校验只读 SQL
              </button>
              <button
                disabled={!canPreflightDml || validateMutation.isPending}
                onClick={() => submitValidation("PREFLIGHT_DML")}
                type="button"
              >
                预检 DML 风险
              </button>
              <button disabled type="button">
                生产写执行禁用
              </button>
            </div>
            <label className={styles.sqlEditor}>
              <span>orders_pending.sql</span>
              <textarea
                aria-label="SQL 文本"
                onChange={(event) => setSql(event.target.value)}
                spellCheck="false"
                value={sql}
              />
            </label>
          </section>

          <ValidationReport
            error={validateMutation.error}
            isPending={validateMutation.isPending}
            report={validateMutation.data}
          />

          <section className={styles.resultPreview}>
            <PanelHeading
              detail="脱敏样例，不代表真实查询结果"
              icon={FileSearch}
              title="只读结果预览"
            />
            <DataTable
              ariaLabel="SQL 只读结果预览"
              columns={previewColumns}
              rows={previewRows}
            />
          </section>
        </main>

        <aside aria-label="SQL 安全边界" className={styles.guardPanel}>
          <PanelHeading detail="P1 只读 MVP" icon={LockKeyhole} title="执行边界" />
          <ul className={styles.guardList}>
            {guardrails.map((item) => (
              <li key={item}>
                <CheckCircle2 aria-hidden="true" size={15} />
                {item}
              </li>
            ))}
          </ul>

          <section className={styles.aiPanel}>
            <PanelHeading
              detail="仅展示分析建议入口"
              icon={Sparkles}
              title="AI 辅助分析"
            />
            {aiFindings.map((finding) => (
              <article className={`${styles.finding} ${styles[finding.tone]}`} key={finding.title}>
                <strong>{finding.title}</strong>
                <p>{finding.body}</p>
                {finding.action ? (
                  <button disabled type="button">
                    {finding.action}
                  </button>
                ) : null}
              </article>
            ))}
            <button className={styles.aiAction} disabled type="button">
              请求 AI 改写建议
            </button>
          </section>
        </aside>
      </section>
    </SqlWorkbenchFrame>
  );
}

/**
 * @param {{children: import("react").ReactNode}} props
 */
function SqlWorkbenchFrame({ children }) {
  return (
    <WorkspacePageFrame className={styles.sqlCanvas}>
      <WorkspaceStatusBar title="SQL 工作台" />
      {children}
    </WorkspacePageFrame>
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
 * @param {{
 *   error: Error | null,
 *   isPending: boolean,
 *   report?: {
 *     statementType: string,
 *     validationLevel: string,
 *     sqlHash: string,
 *     referencedObjects: string[],
 *     risks: string[],
 *     rejectionReasons: string[],
 *     unverifiedItems: string[],
 *   },
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
        <p>当前仅展示样例 SQL 和只读边界，未产生真实执行结果。</p>
      </section>
    );
  }

  return (
    <section className={styles.validationPanel}>
      <PanelHeading detail={report.sqlHash} icon={FileSearch} title="服务端校验" />
      <div className={styles.reportGrid}>
        <ReportItem label="语句类型" value={report.statementType} />
        <ReportItem label="校验等级" value={report.validationLevel} />
        <ReportItem label="引用对象" value={formatValues(report.referencedObjects)} />
        <ReportItem label="风险" value={formatValues(report.risks)} />
        <ReportItem label="拒绝原因" value={formatValues(report.rejectionReasons)} />
        <ReportItem label="未验证项" value={formatValues(report.unverifiedItems)} />
      </div>
    </section>
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
 * @param {unknown} row
 * @param {string} key
 */
function getCell(row, key) {
  if (!row || typeof row !== "object" || !(key in row)) {
    return "";
  }

  const value = /** @type {Record<string, unknown>} */ (row)[key];
  return typeof value === "string" ? value : "";
}

/**
 * @param {string[]} values
 */
function formatValues(values) {
  return values.length > 0 ? values.join(" / ") : "无";
}

/**
 * @param {"RUN_READ_ONLY" | "PREFLIGHT_DML"} action
 */
function createSqlIdempotencyKey(action) {
  const randomPart =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `sql:${action}:${randomPart}`;
}
