import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { ApiError } from "../../api/client.js";
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

const sampleRows = [
  ["1", "OD-10482", "PENDING", "428.00", "C-***921", "2026-06-13 10:42"],
  ["2", "OD-10483", "PENDING", "1,280.00", "C-***104", "2026-06-13 10:38"],
  ["3", "OD-10491", "PENDING", "86.50", "C-***672", "2026-06-13 10:31"],
  ["4", "OD-10496", "PENDING", "709.00", "C-***338", "2026-06-13 10:24"],
  ["5", "OD-10502", "PENDING", "219.90", "C-***517", "2026-06-13 10:18"],
  ["6", "OD-10507", "PENDING", "3,460.00", "C-***286", "2026-06-13 10:11"],
  ["7", "OD-10511", "PENDING", "156.80", "C-***843", "2026-06-13 10:05"],
  ["8", "OD-10518", "PENDING", "982.00", "C-***459", "2026-06-13 09:57"],
  ["9", "OD-10523", "PENDING", "64.50", "C-***730", "2026-06-13 09:49"],
  ["10", "OD-10529", "PENDING", "1,875.20", "C-***195", "2026-06-13 09:42"],
];

const navItems = [
  { label: "总览", accent: "var(--red)" },
  { label: "Agent 工作区", href: "/agent", accent: "var(--blue)" },
  { label: "RAG 问答", accent: "#2d8aa5" },
  { label: "SQL 工作台", href: "/sql", accent: "#256f86", active: true },
  { label: "诊断工作台", accent: "var(--yellow)" },
  { label: "Skill 注册中心", href: "/skills", accent: "var(--green)" },
  { label: "工作流事件", accent: "#7b8fa7" },
  { label: "审计记录", accent: "var(--dark)" },
];

const aiFindings = [
  {
    action: "查看建议修改",
    body: "UPDATE 仅按 user_id 过滤，可能修改该用户全部历史订单。建议增加 status 与时间范围条件。",
    title: "潜在逻辑错误",
    tone: "var(--red)",
  },
  {
    action: "生成索引建议",
    body: "查询按 status、created_at 过滤并排序。当前索引仅覆盖 status，可能产生额外排序。",
    title: "性能风险",
    tone: "var(--yellow)",
  },
  {
    action: "对比优化前后",
    body: "预计扫描 18,420 行，返回 86 行。建议复合索引 (status, created_at DESC)。",
    title: "执行计划摘要",
    tone: "var(--blue)",
  },
  {
    body: "未发现空值异常；amount 分布与过去 7 天基线一致。",
    title: "结果检查",
    tone: "var(--green)",
  },
];

export function SqlWorkbenchPage() {
  const connectionsQuery = useSqlConnections();
  const validateMutation = useValidateSqlQuery();
  const connections = useMemo(
    () => connectionsQuery.data ?? [],
    [connectionsQuery.data],
  );
  const [selectedConnectionOverride, setSelectedConnectionOverride] =
    useState("");
  const [sql] = useState(DEFAULT_SQL);

  const selectedConnectionId =
    selectedConnectionOverride || connections[0]?.connectionId || "";
  const selectedConnection = useMemo(
    () =>
      connections.find(
        (connection) => connection.connectionId === selectedConnectionId,
      ) ?? connections[0],
    [connections, selectedConnectionId],
  );

  if (connectionsQuery.error) {
    const title =
      connectionsQuery.error instanceof ApiError &&
      connectionsQuery.error.kind === "contract"
        ? "SQL 连接契约不兼容"
        : "SQL 连接加载失败";

    return (
      <PrototypeScreen>
        <Notice
          detail="页面已阻止异常连接数据进入工作台，请检查控制面返回契约。"
          title={title}
        />
      </PrototypeScreen>
    );
  }

  const activeConnection = selectedConnection ?? DEFAULT_CONNECTION;
  const selectedSchema = activeConnection.allowedSchemas[0] || "ORDERS";
  const canValidateReadOnly =
    activeConnection.capabilities.includes("RUN_READ_ONLY");
  const canPreflightDml =
    activeConnection.capabilities.includes("PREFLIGHT_DML");

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

  return (
    <PrototypeScreen
      connectionId={activeConnection.connectionId}
      environment={activeConnection.targetEnvironment}
      isLoading={connectionsQuery.isLoading}
      onConnectionChange={setSelectedConnectionOverride}
    >
      <section className={styles.sqlLayout}>
        <div className={`${styles.sqlCard} ${styles.mainCard}`}>
          <div className={styles.dbWorkbench}>
            <DatabaseObjectsPanel connection={activeConnection} />

            <section aria-label="查询编辑器" className={styles.dbMain}>
              <div className={styles.dbFileTabs}>
                <span className={styles.dbObjectRestore} title="展开数据库对象">
                  →
                </span>
                <span className={styles.active}>orders_pending.sql ×</span>
                <span>order_fix.sql ×</span>
                <span>＋</span>
                <i>Ln 7, Col 18 · UTF-8</i>
              </div>
              <div className={styles.dbEditorToolbar}>
                <button
                  aria-label="校验只读执行"
                  className={styles.run}
                  disabled={!canValidateReadOnly || validateMutation.isPending}
                  onClick={() => submitValidation("RUN_READ_ONLY")}
                  type="button"
                >
                  ▶ 执行当前语句
                </button>
                <button
                  aria-label="DML 预检"
                  disabled={!canPreflightDml || validateMutation.isPending}
                  onClick={() => submitValidation("PREFLIGHT_DML")}
                  type="button"
                >
                  ▷ 执行脚本
                </button>
                <span className={styles.stop}>■ 停止</span>
                <span>Explain</span>
                <span>格式化</span>
                <span>保存</span>
                <em>Ctrl+Enter 执行当前语句</em>
              </div>

              <SqlCodeBlock />

              <QueryResultPanel
                error={validateMutation.error}
                isPending={validateMutation.isPending}
                report={validateMutation.data}
              />
            </section>

            <AiAssistantPanel />
          </div>
        </div>
      </section>
    </PrototypeScreen>
  );
}

/**
 * @param {{
 *   children?: import("react").ReactNode,
 *   connectionId?: string,
 *   environment?: string,
 *   isLoading?: boolean,
 *   onConnectionChange?: (connectionId: string) => void,
 * }} props
 */
function PrototypeScreen({
  children,
  connectionId = "as400-development",
  environment = "development",
  isLoading = false,
  onConnectionChange,
}) {
  return (
    <main className={styles.board}>
      <section className={styles.screen} id="sql-workbench-screen">
        <h1 className={styles.srOnly}>SQL 工作台</h1>
        <PrototypeNav />
        <AppCapsule />
        <section aria-label="SQL 工作台连接状态" className={styles.sqlToolbar}>
          <button
            className={styles.filterSelect}
            onClick={() => onConnectionChange?.(connectionId)}
            title="开发环境连接目录"
            type="button"
          >
            <b>连接</b>
            <span>{connectionId}</span>
          </button>
          <div className={styles.filterSelect}>
            <b>环境</b>
            <span>{environment}</span>
          </div>
          <div className={styles.filterSelect}>
            <b>事务</b>
            <span>自动提交</span>
          </div>
          <span className={styles.workspaceExpand}>展开工作区</span>
          <span className={styles.sqlRunState}>
            {isLoading ? "正在连接 · 开发环境" : "已连接 · 开发环境"}
          </span>
        </section>
        {children}
      </section>
    </main>
  );
}

function PrototypeNav() {
  return (
    <nav aria-label="SQL 工作台导航" className={styles.nav}>
      {navItems.map((item) =>
        item.href ? (
          <Link
            aria-current={item.active ? "page" : undefined}
            className={item.active ? styles.navActive : undefined}
            key={item.label}
            to={item.href}
            style={cssVars({ "--nav-accent": item.accent })}
          >
            {item.label}
          </Link>
        ) : (
          <span
            aria-disabled="true"
            className={`${styles.navLink} ${item.active ? styles.navActive : ""}`}
            key={item.label}
            style={cssVars({ "--nav-accent": item.accent })}
          >
            {item.label}
          </span>
        ),
      )}
      <div aria-hidden="true" className={styles.navSpacer}>
        <span />
        <span />
        <span />
      </div>
      <div className={styles.navTools}>
        <div className={styles.search}>搜索连接 / 表 / SQL 指纹</div>
        <div className={styles.navActions}>
          <span className={styles.badge}>SQL 控制台</span>
          <span className={styles.button}>新建会话</span>
        </div>
      </div>
    </nav>
  );
}

function AppCapsule() {
  return (
    <div className={styles.appCapsule}>
      <div className={styles.logo}>EA</div>
      <div className={styles.brandLockup}>
        <span>企业智能 Agent</span>
      </div>
      <div className={styles.capsuleCurrent}>
        <strong>SQL 工作台</strong>
        <i aria-hidden="true" />
        <small>读写查配</small>
        <span>AI Copilot</span>
      </div>
      <div aria-hidden="true" className={styles.brandSignal}>
        <i className={styles.signalNode} />
        <i className={styles.signalNode} />
        <i className={styles.signalNode} />
      </div>
    </div>
  );
}

/**
 * @param {{connection: typeof DEFAULT_CONNECTION}} props
 */
function DatabaseObjectsPanel({ connection }) {
  return (
    <aside className={styles.dbPanel}>
      <div className={styles.dbPanelTitle}>
        数据库对象
        <span className={styles.dbObjectCollapse} title="向左收起数据库对象">
          ←
        </span>
        <small>刷新 · 新建</small>
      </div>
      <div className={styles.dbTreeSearch}>搜索表、视图、字段</div>
      <div className={styles.dbTree}>
        <div style={cssVars({ "--tree-color": "var(--green)", "--tree-icon": "'▾'" })}>
          {connection.connectionId}
        </div>
        <div style={cssVars({ "--indent": "14px", "--tree-icon": "'▾'" })}>ORDERS</div>
        <div style={cssVars({ "--indent": "28px", "--tree-icon": "'▾'" })}>Tables</div>
        <div
          className={styles.selected}
          style={cssVars({ "--indent": "42px", "--tree-icon": "'▦'" })}
        >
          ORDERS
        </div>
        <div style={cssVars({ "--indent": "42px", "--tree-icon": "'▦'" })}>
          ORDER_ITEMS
        </div>
        <div style={cssVars({ "--indent": "42px", "--tree-icon": "'▦'" })}>
          ORDER_EVENTS
        </div>
        <div style={cssVars({ "--indent": "28px", "--tree-icon": "'›'" })}>Views</div>
        <div style={cssVars({ "--indent": "28px", "--tree-icon": "'›'" })}>Indexes</div>
        <div style={cssVars({ "--indent": "28px", "--tree-icon": "'›'" })}>
          Procedures
        </div>
        <div style={cssVars({ "--indent": "14px", "--tree-icon": "'›'" })}>
          INVENTORY
        </div>
      </div>
    </aside>
  );
}

function SqlCodeBlock() {
  return (
    <div className={styles.dbEditor}>
      <div className={styles.dbGutter}>{`1
2
3
4
5
6
7
8
9
10`}</div>
      <div className={styles.dbRunMarker}>▶</div>
      <div className={styles.dbCode}>
        <span className={styles.keyword}>SELECT</span> o.order_id, o.status,
        o.amount, o.customer_id, o.created_at{"\n"}
        <span className={styles.keyword}>FROM</span> ORDERS.ORDERS o{"\n"}
        <span className={styles.keyword}>WHERE</span> o.status ={" "}
        <span className={styles.string}>'PENDING'</span>
        {"\n  "}
        <span className={styles.keyword}>AND</span> o.created_at &gt;
        CURRENT_DATE - 7 DAYS{"\n"}
        <span className={styles.keyword}>ORDER BY</span> o.created_at DESC{"\n"}
        <span className={styles.keyword}>FETCH FIRST</span> 100 ROWS ONLY;
        {"\n\n"}
        <span className={styles.warningLine}>
          <span className={styles.keyword}>UPDATE</span> ORDERS.ORDERS{" "}
          <span className={styles.keyword}>SET</span> status ={" "}
          <span className={styles.string}>'REVIEW_REQUIRED'</span>{" "}
          <span className={styles.keyword}>WHERE</span> user_id = :userId;
        </span>
      </div>
    </div>
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
 *   }
 * }} props
 */
function QueryResultPanel({ error, isPending, report }) {
  if (isPending) {
    return (
      <div className={styles.dbResults} role="status">
        <div className={styles.dbResultTabs}>
          <span className={styles.active}>服务端校验</span>
        </div>
        <div className={styles.validationReport}>
          <strong>正在提交服务端校验</strong>
          <span>等待控制面返回强类型 SQL 报告。</span>
        </div>
        <div className={styles.dbResultStatus}>
          <span>请求中</span>
          <span>只读结果 · 已脱敏</span>
          <span>--ms</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.dbResults} role="alert">
        <div className={styles.dbResultTabs}>
          <span className={styles.active}>服务端校验</span>
        </div>
        <div className={styles.validationReport}>
          <strong>SQL 校验失败</strong>
          <span>{error.message}</span>
        </div>
        <div className={styles.dbResultStatus}>
          <span>失败</span>
          <span>只读结果 · 已脱敏</span>
          <span>--ms</span>
        </div>
      </div>
    );
  }

  if (report) {
    return (
      <div className={styles.dbResults}>
        <div className={styles.dbResultTabs}>
          <span className={styles.active}>服务端校验</span>
          <span>结果 1</span>
          <span>执行计划</span>
          <span>历史</span>
          <span>导出</span>
        </div>
        <div className={styles.validationReport}>
          <strong>{report.statementType}</strong>
          <span>{report.validationLevel}</span>
          <span>{report.sqlHash}</span>
          <ReportLine label="引用对象" values={report.referencedObjects} />
          <ReportLine label="风险" values={report.risks} />
          <ReportLine label="拒绝原因" values={report.rejectionReasons} />
          <ReportLine label="未验证项" values={report.unverifiedItems} />
        </div>
        <div className={styles.dbResultStatus}>
          <span>服务端校验完成</span>
          <span>只读结果 · 已脱敏</span>
          <span>184ms</span>
          <span>每页 10 · 上一页 · 下一页</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.dbResults}>
      <div className={styles.dbResultTabs}>
        <span className={styles.active}>结果 1</span>
        <span>消息</span>
        <span>执行计划</span>
        <span>历史</span>
        <span>导出</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>order_id</th>
            <th>status</th>
            <th>amount</th>
            <th>customer_id</th>
            <th>created_at</th>
          </tr>
        </thead>
        <tbody>
          {sampleRows.map((row) => (
            <tr key={row[1]}>
              {row.map((cell) => (
                <td key={cell}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className={styles.dbResultStatus}>
        <span>86 行 · 第 1/9 页</span>
        <span>只读结果 · 已脱敏</span>
        <span>184ms</span>
        <span>每页 10 · 上一页 · 下一页</span>
      </div>
    </div>
  );
}

/**
 * @param {{label: string, values: string[]}} props
 */
function ReportLine({ label, values }) {
  return (
    <div className={styles.reportLine}>
      <b>{label}</b>
      <span>{values.length > 0 ? values.join(" / ") : "无"}</span>
    </div>
  );
}

function AiAssistantPanel() {
  return (
    <aside className={`${styles.dbPanel} ${styles.aiCopilot}`}>
      <div className={styles.dbPanelTitle}>
        AI SQL 助手 <span className={styles.aiCollapseHandle}>→</span>
      </div>
      <div className={styles.aiModeTabs}>
        <span className={styles.active}>错误分析</span>
        <span>性能优化</span>
        <span>解释 SQL</span>
      </div>
      <div className={styles.aiFindings}>
        {aiFindings.map((finding) => (
          <div
            className={styles.aiFinding}
            key={finding.title}
            style={cssVars({ "--finding": finding.tone })}
          >
            <strong>{finding.title}</strong>
            <span>{finding.body}</span>
            {finding.action ? (
              <button disabled type="button">
                {finding.action}
              </button>
            ) : null}
          </div>
        ))}
      </div>
      <button aria-label="询问 AI" className={styles.aiChat} disabled type="button">
        <div>询问 AI：为什么这个查询慢？如何避免误更新？</div>
      </button>
    </aside>
  );
}

/**
 * @param {{detail: string, title: string}} props
 */
function Notice({ detail, title }) {
  return (
    <section className={styles.sqlLayout}>
      <div className={`${styles.sqlCard} ${styles.noticeCard}`}>
        <strong>{title}</strong>
        <span>{detail}</span>
      </div>
    </section>
  );
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

/**
 * @param {Record<string, string>} variables
 * @returns {import("react").CSSProperties}
 */
function cssVars(variables) {
  return /** @type {import("react").CSSProperties} */ (
    /** @type {unknown} */ (variables)
  );
}
