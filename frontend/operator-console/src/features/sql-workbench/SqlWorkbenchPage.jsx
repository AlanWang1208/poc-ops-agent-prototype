import { useMemo, useState } from "react";

import { ApiError } from "../../api/client.js";
import { StatusPill } from "../../components/data-display/StatusPill.jsx";
import { FeedbackState } from "../../components/feedback/FeedbackState.jsx";
import { PageHeader } from "../../components/layout/PageHeader.jsx";
import { Button } from "../../components/primitives/Button.jsx";
import { SqlEditor } from "./SqlEditor.jsx";
import { useSqlConnections, useValidateSqlQuery } from "./use-sql-workbench.js";
import styles from "./SqlWorkbenchPage.module.css";

const defaultSql = "SELECT *\nFROM ORDERS.ORDERS\nFETCH FIRST 100 ROWS ONLY";
/** @type {import("../../schemas/sql-schemas.js").SqlConnectionSummary[]} */
const emptyConnections = [];

export function SqlWorkbenchPage() {
  const connections = useSqlConnections();
  const validation = useValidateSqlQuery();
  const safeConnections = connections.data ?? emptyConnections;
  const [connectionId, setConnectionId] = useState("");
  const selectedConnection = useMemo(
    () =>
      safeConnections.find((connection) => connection.connectionId === connectionId) ??
      safeConnections[0] ??
      null,
    [connectionId, safeConnections],
  );
  const [schema, setSchema] = useState("");
  const selectedSchema =
    selectedConnection?.allowedSchemas.includes(schema)
      ? schema
      : (selectedConnection?.allowedSchemas[0] ?? "");
  const canRunReadOnly =
    selectedConnection?.capabilities.includes("RUN_READ_ONLY") ?? false;
  const canPreflightDml =
    selectedConnection?.capabilities.includes("PREFLIGHT_DML") ?? false;
  const [sql, setSql] = useState(defaultSql);

  /**
   * @param {"RUN_READ_ONLY" | "PREFLIGHT_DML"} action
   */
  function submitValidation(action) {
    if (!selectedConnection || !selectedSchema) {
      return;
    }
    if (!selectedConnection.capabilities.includes(action)) {
      return;
    }

    validation.mutate({
      contractVersion: "1.0",
      connectionId: selectedConnection.connectionId,
      targetEnvironment: selectedConnection.targetEnvironment,
      schema: selectedSchema,
      action,
      sql,
      parameters: [],
      limits: {
        maxRows: 500,
        maxBytes: 5_000_000,
        timeoutSeconds: 30,
      },
      idempotencyKey: buildIdempotencyKey(action),
    });
  }

  return (
    <div className={styles.page}>
      <PageHeader
        description="面向开发与测试环境的 SQL 校验入口。页面只提交版本化校验请求，不提供生产连接和写执行控制。"
        title="SQL 工作台"
      />
      <SqlConnectionState query={connections}>
        <div className={styles.layout}>
          <section aria-label="SQL 连接" className={styles.panel}>
            <h2>连接</h2>
            <ConnectionList
              connections={safeConnections}
              selectedConnectionId={selectedConnection?.connectionId ?? ""}
              onSelect={(nextConnection) => {
                setConnectionId(nextConnection.connectionId);
                setSchema(nextConnection.allowedSchemas[0]);
              }}
            />
          </section>
          <section aria-label="SQL 编辑与校验" className={styles.editorPanel}>
            <h2>查询</h2>
            <div className={styles.form}>
              <label>
                Schema
                <select
                  disabled={!selectedConnection}
                  onChange={(event) => setSchema(event.target.value)}
                  value={selectedSchema}
                >
                  {(selectedConnection?.allowedSchemas ?? []).map((allowedSchema) => (
                    <option key={allowedSchema} value={allowedSchema}>
                      {allowedSchema}
                    </option>
                  ))}
                </select>
              </label>
              <div className={styles.editorFrame}>
                <SqlEditor onChange={setSql} value={sql} />
              </div>
              <div className={styles.actions}>
                <Button
                  disabled={!canRunReadOnly || validation.isPending}
                  onClick={() => submitValidation("RUN_READ_ONLY")}
                >
                  校验只读执行
                </Button>
                <Button
                  disabled={!canPreflightDml || validation.isPending}
                  onClick={() => submitValidation("PREFLIGHT_DML")}
                  variant="secondary"
                >
                  DML 预检
                </Button>
                <Button disabled variant="secondary">
                  询问 AI
                </Button>
              </div>
            </div>
            <ValidationState mutation={validation} />
          </section>
        </div>
      </SqlConnectionState>
    </div>
  );
}

/**
 * @param {{
 *   query: ReturnType<typeof useSqlConnections>,
 *   children: import("react").ReactNode
 * }} props
 */
function SqlConnectionState({ query, children }) {
  if (query.isPending) {
    return (
      <FeedbackState
        message="正在读取控制面允许的 SQL 连接。"
        state="loading"
        title="SQL 连接读取中"
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
            ? "服务端策略拒绝读取 SQL 工作台连接。"
            : "SQL 连接响应无法被操作台安全解析。"
        }
        state="error"
        title={
          isForbidden
            ? "SQL 连接读取被拒绝"
            : isContract
              ? "SQL 连接契约不兼容"
              : "SQL 连接读取失败"
        }
      />
    );
  }

  if (!query.data?.length) {
    return (
      <FeedbackState
        message="控制面当前没有返回开发或测试环境连接。"
        state="empty"
        title="没有可用 SQL 连接"
      />
    );
  }

  return children;
}

/**
 * @param {{
 *   connections: import("../../schemas/sql-schemas.js").SqlConnectionSummary[],
 *   selectedConnectionId: string,
 *   onSelect: (connection: import("../../schemas/sql-schemas.js").SqlConnectionSummary) => void
 * }} props
 */
function ConnectionList({ connections, selectedConnectionId, onSelect }) {
  return (
    <div className={styles.connectionList}>
      {connections.map((connection) => (
        <label className={styles.connectionOption} key={connection.connectionId}>
          <input
            checked={connection.connectionId === selectedConnectionId}
            name="sql-connection"
            onChange={() => onSelect(connection)}
            type="radio"
          />
          <span>
            <span className={styles.connectionTitle}>
              <strong>{connection.connectionId}</strong>
              <StatusPill tone="info">{connection.targetEnvironment}</StatusPill>
            </span>
            <span className={styles.muted}>{connection.displayName}</span>
            <span className={styles.muted}>
              {connection.platformType} · {connection.allowedSchemas.join(", ")}
            </span>
          </span>
        </label>
      ))}
    </div>
  );
}

/**
 * @param {{mutation: ReturnType<typeof useValidateSqlQuery>}} props
 */
function ValidationState({ mutation }) {
  if (mutation.isPending) {
    return (
      <FeedbackState
        message="正在等待服务端完成 SQL 校验。"
        state="loading"
        title="SQL 校验中"
      />
    );
  }

  if (mutation.isError) {
    return (
      <FeedbackState
        message={
          mutation.error instanceof ApiError && mutation.error.kind === "forbidden"
            ? "服务端策略拒绝本次 SQL 校验。"
            : "SQL 校验请求未能完成。"
        }
        state="error"
        title="SQL 校验失败"
      />
    );
  }

  if (!mutation.data) {
    return (
      <FeedbackState
        message="选择连接和 Schema 后提交校验，只会返回服务端验证报告。"
        state="empty"
        title="尚未提交 SQL 校验"
      />
    );
  }

  return <ValidationReport report={mutation.data} />;
}

/**
 * @param {{report: import("../../schemas/sql-schemas.js").SqlValidationReport}} props
 */
function ValidationReport({ report }) {
  return (
    <section aria-label="SQL 校验报告" className={styles.reportPanel}>
      <h2>校验报告</h2>
      <div className={styles.reportGrid}>
        <ReportItem label="校验等级">
          <StatusPill tone={readValidationTone(report.validationLevel)}>
            {report.validationLevel}
          </StatusPill>
        </ReportItem>
        <ReportItem label="语句类型">{report.statementType}</ReportItem>
        <ReportItem label="SQL Hash">{report.sqlHash}</ReportItem>
        <ReportItem label="引用对象">
          <ValueList values={report.referencedObjects} />
        </ReportItem>
        <ReportItem label="风险">
          <ValueList values={report.risks} />
        </ReportItem>
        <ReportItem label="拒绝原因">
          <ValueList values={report.rejectionReasons} />
        </ReportItem>
        <ReportItem label="未验证项">
          <ValueList values={report.unverifiedItems} />
        </ReportItem>
      </div>
    </section>
  );
}

/**
 * @param {{label: string, children: import("react").ReactNode}} props
 */
function ReportItem({ label, children }) {
  return (
    <div className={styles.reportItem}>
      <span>{label}</span>
      {children}
    </div>
  );
}

/**
 * @param {{values: string[]}} props
 */
function ValueList({ values }) {
  if (values.length === 0) {
    return <p className={styles.muted}>无</p>;
  }

  return (
    <ul className={styles.reportList}>
      {values.map((value) => (
        <li key={value}>{value}</li>
      ))}
    </ul>
  );
}

/**
 * @param {"VALIDATED" | "PARTIAL" | "REJECTED"} validationLevel
 * @returns {"success" | "warning" | "danger"}
 */
function readValidationTone(validationLevel) {
  if (validationLevel === "VALIDATED") {
    return "success";
  }

  if (validationLevel === "PARTIAL") {
    return "warning";
  }

  return "danger";
}

/**
 * @param {"RUN_READ_ONLY" | "PREFLIGHT_DML"} action
 */
function buildIdempotencyKey(action) {
  const randomId =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : String(Date.now());
  return `sql-workbench:${action}:${randomId}`;
}
