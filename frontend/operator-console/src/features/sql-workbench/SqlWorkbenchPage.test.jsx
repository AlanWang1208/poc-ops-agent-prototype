import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, test } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import App from "../../app/App.jsx";
import { AppProviders } from "../../app/providers.jsx";
import { server } from "../../test/server.js";

/**
 * @param {string} path
 */
function renderAt(path) {
  return render(
    <AppProviders Router={MemoryRouter} routerProps={{ initialEntries: [path] }}>
      <App />
    </AppProviders>,
  );
}

beforeEach(() => {
  server.use(
    http.get("/auth/session", () =>
      HttpResponse.json({
        authenticated: true,
        subject: "operator-1",
        username: "ops.reader",
        roles: ["ROLE_agent-reader"],
        authenticationType: "built-in",
      }),
    ),
  );
});

describe("SqlWorkbenchPage", () => {
  test("shows an empty connection state without runtime mock data", async () => {
    server.use(
      http.get("/internal/sql-workbench/connections", () => HttpResponse.json([])),
    );

    renderAt("/sql");

    expect(await screen.findByText("尚未配置 SQL 连接")).toBeInTheDocument();
    expect(screen.getByText("无可用连接")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新建连接" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "对象浏览器" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "校验" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "执行 SELECT" })).toBeDisabled();
    expect(screen.queryByText("as400-development")).not.toBeInTheDocument();
    expect(screen.queryByText("ORDERS.ORDERS")).not.toBeInTheDocument();
    expect(
      screen.queryByText("校验通过的单条 SELECT 执行后，分页结果会显示在这里。"),
    ).not.toBeInTheDocument();
  });

  test("renders the P1 workbench with top connection context and collapsible objects", async () => {
    const user = userEvent.setup();
    server.use(
      http.get("/internal/sql-workbench/connections", () =>
        HttpResponse.json(sqlConnections),
      ),
      http.post("/internal/sql-workbench/queries/validate", () =>
        HttpResponse.json(validatedSelectReport),
      ),
    );

    renderAt("/sql");

    expect(await screen.findByRole("heading", { name: "SQL 工作台" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "主导航" })).toBeInTheDocument();
    expect(screen.getByLabelText("当前工作台")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "SQL 工作台导航" })).not.toBeInTheDocument();

    const contextBar = await screen.findByLabelText("SQL 工作区连接上下文");
    expect(within(contextBar).getByText("已连接 · development")).toBeInTheDocument();
    expect(within(contextBar).getByText("as400-development")).toBeInTheDocument();
    expect(within(contextBar).getByText("ORDERS")).toBeInTheDocument();
    expect(within(contextBar).getByText("maxRows 500")).toBeInTheDocument();
    expect(within(contextBar).getByRole("button", { name: "新建连接" })).toBeEnabled();
    expect(within(contextBar).getByRole("button", { name: "展开工作区" })).toBeEnabled();

    expect(screen.queryByRole("complementary", { name: "SQL 连接目录" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("数据库对象浏览器")).not.toBeInTheDocument();
    expect(screen.queryByText("执行边界")).not.toBeInTheDocument();
    expect(screen.getByLabelText("SQL 信息面板")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "对象浏览器" }));
    expect(screen.getByLabelText("数据库对象浏览器")).toBeInTheDocument();
    expect(screen.getByText("对象目录尚未接入真实元数据")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "展开工作区" }));
    expect(screen.queryByLabelText("数据库对象浏览器")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("SQL 信息面板")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "退出展开" })).toBeInTheDocument();
  });

  test("creates a connection with credentialAlias metadata and no password field", async () => {
    const user = userEvent.setup();
    /** @type {unknown[]} */
    const requests = [];
    server.use(
      http.get("/internal/sql-workbench/connections", () =>
        HttpResponse.json(sqlConnections),
      ),
      http.post("/internal/sql-workbench/connections", async ({ request }) => {
        requests.push(await request.json());
        return HttpResponse.json(createdConnection);
      }),
    );

    renderAt("/sql");

    await screen.findByText("已连接 · development");
    await user.click(screen.getByRole("button", { name: "新建连接" }));

    const dialog = screen.getByRole("dialog", { name: "新建连接" });
    expect(within(dialog).getByText("连接身份")).toBeInTheDocument();
    expect(within(dialog).getByText("目标端点")).toBeInTheDocument();
    expect(within(dialog).getByText("Schema 与限制")).toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/密码/u)).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/password/i)).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/JDBC URL/u)).not.toBeInTheDocument();

    await user.clear(within(dialog).getByLabelText("连接名称"));
    await user.type(within(dialog).getByLabelText("连接名称"), "H2 Lab");
    await user.selectOptions(within(dialog).getByLabelText("目标环境"), "test");
    await user.selectOptions(within(dialog).getByLabelText("平台类型"), "H2");
    expect(within(dialog).getByLabelText("端口")).toHaveValue("9092");
    expect(within(dialog).getByLabelText("默认 Schema")).toHaveValue("");
    expect(within(dialog).getByLabelText("允许 Schema")).toHaveValue("");
    await user.clear(within(dialog).getByLabelText("主机"));
    await user.type(within(dialog).getByLabelText("主机"), "localhost");
    await user.clear(within(dialog).getByLabelText("端口"));
    await user.type(within(dialog).getByLabelText("端口"), "9092");
    await user.clear(within(dialog).getByLabelText("默认 Schema"));
    await user.type(within(dialog).getByLabelText("默认 Schema"), "PUBLIC");
    await user.clear(within(dialog).getByLabelText("允许 Schema"));
    await user.type(within(dialog).getByLabelText("允许 Schema"), "PUBLIC");
    await user.clear(within(dialog).getByLabelText("凭据别名 credentialAlias"));
    await user.type(
      within(dialog).getByLabelText("凭据别名 credentialAlias"),
      "h2-lab-readonly",
    );
    await user.click(within(dialog).getByRole("button", { name: "保存连接" }));

    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]).toMatchObject({
      contractVersion: "1.0",
      displayName: "H2 Lab",
      targetEnvironment: "test",
      platformType: "H2",
      host: "localhost",
      port: 9092,
      defaultSchema: "PUBLIC",
      allowedSchemas: ["PUBLIC"],
      capabilities: ["VALIDATE", "RUN_READ_ONLY", "PREFLIGHT_DML"],
      credentialAlias: "h2-lab-readonly",
      maxRowsDefault: 500,
      timeoutSecondsDefault: 30,
    });
    expect(JSON.stringify(requests[0]).toLowerCase()).not.toContain("password");
    expect(JSON.stringify(requests[0]).toLowerCase()).not.toContain("jdbc");
    expect(await screen.findByText("as400-lab")).toBeInTheDocument();
    expect(screen.getByText("LABORDERS")).toBeInTheDocument();
  });

  test("keeps SQL text and validation reports isolated per session tab", async () => {
    const user = userEvent.setup();
    server.use(
      http.get("/internal/sql-workbench/connections", () =>
        HttpResponse.json(sqlConnections),
      ),
      http.post("/internal/sql-workbench/queries/validate", async ({ request }) => {
        const body = await request.json();
        const sql = typeof body === "object" && body !== null && "sql" in body
          ? String(/** @type {{sql: unknown}} */ (body).sql)
          : "";
        return HttpResponse.json({
          ...validatedSelectReport,
          sqlHash: sql.includes("SESSION_ONE") ? "sha256:session-one" : "sha256:session-two",
          referencedObjects: sql.includes("SESSION_ONE")
            ? ["ORDERS.SESSION_ONE"]
            : ["ORDERS.SESSION_TWO"],
        });
      }),
    );

    renderAt("/sql");

    const editor = await screen.findByLabelText("SQL 文本");
    await user.clear(editor);
    await user.type(editor, "SELECT * FROM ORDERS.SESSION_ONE");
    await user.click(screen.getByRole("button", { name: "校验" }));
    expect(await screen.findAllByText("sha256:session-one")).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "+ 新建会话" }));
    expect(screen.getByRole("tab", { name: "SQL 2" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("SQL 文本")).not.toHaveValue("SELECT * FROM ORDERS.SESSION_ONE");
    expect(screen.queryByText("sha256:session-one")).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText("SQL 文本"));
    await user.type(screen.getByLabelText("SQL 文本"), "SELECT * FROM ORDERS.SESSION_TWO");
    await user.click(screen.getByRole("button", { name: "校验" }));
    expect(await screen.findAllByText("sha256:session-two")).toHaveLength(2);

    await user.click(screen.getByRole("tab", { name: "SQL 1" }));
    expect(screen.getByLabelText("SQL 文本")).toHaveValue("SELECT * FROM ORDERS.SESSION_ONE");
    expect(screen.getAllByText("sha256:session-one")).toHaveLength(2);
    expect(screen.queryByText("sha256:session-two")).not.toBeInTheDocument();
  });

  test("executes only server-validated single SELECT and keeps DML on preflight", async () => {
    const user = userEvent.setup();
    /** @type {unknown[]} */
    const runRequests = [];
    /** @type {unknown[]} */
    const validationRequests = [];
    server.use(
      http.get("/internal/sql-workbench/connections", () =>
        HttpResponse.json(sqlConnections),
      ),
      http.post("/internal/sql-workbench/queries/validate", async ({ request }) => {
        const body = await request.json();
        validationRequests.push(body);
        return HttpResponse.json(
          typeof body === "object" && body !== null && body.action === "PREFLIGHT_DML"
            ? rejectedDmlReport
            : validatedSelectReport,
        );
      }),
      http.post("/internal/sql-workbench/queries/run", async ({ request }) => {
        runRequests.push(await request.json());
        return HttpResponse.json(queryRunResult);
      }),
      http.get("/internal/sql-workbench/results/result-001", () =>
        HttpResponse.json(resultPage),
      ),
    );

    renderAt("/sql");

    await screen.findByText("已连接 · development");
    expect(screen.getByRole("button", { name: "执行 SELECT" })).toBeDisabled();

    await user.clear(screen.getByLabelText("SQL 文本"));
    await user.type(screen.getByLabelText("SQL 文本"), "SELECT * FROM ORDERS.ORDERS");
    await user.click(screen.getByRole("button", { name: "校验" }));
    expect(await screen.findByText("VALIDATED")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "执行 SELECT" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "执行 SELECT" }));
    expect(await screen.findByText("OD-10500")).toBeInTheDocument();
    expect(screen.getAllByText("result-001").length).toBeGreaterThanOrEqual(1);

    await waitFor(() => expect(runRequests).toHaveLength(1));
    expect(runRequests[0]).toMatchObject({
      contractVersion: "1.0",
      connectionId: "as400-development",
      targetEnvironment: "development",
      schema: "ORDERS",
      action: "RUN_READ_ONLY",
      sql: "SELECT * FROM ORDERS.ORDERS",
      validationHash: "sha256:validation-readonly",
    });

    await user.clear(screen.getByLabelText("SQL 文本"));
    await user.type(screen.getByLabelText("SQL 文本"), "UPDATE ORDERS.ORDERS SET status = 'X'");
    await user.click(screen.getByRole("button", { name: "DML 预检" }));
    expect(await screen.findByText("DML_PRECHECK_ONLY")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "执行 SELECT" })).toBeDisabled();
    expect(runRequests).toHaveLength(1);
    expect(validationRequests.at(-1)).toMatchObject({ action: "PREFLIGHT_DML" });
  });

  test("blocks invalid production connection data at the contract boundary", async () => {
    server.use(
      http.get("/internal/sql-workbench/connections", () =>
        HttpResponse.json([
          {
            ...sqlConnections[0],
            connectionId: "as400-production",
            displayName: "AS/400 Production",
            targetEnvironment: "production",
          },
        ]),
      ),
    );

    renderAt("/sql");

    expect(await screen.findByText("SQL 连接契约不兼容")).toBeInTheDocument();
    expect(screen.getByLabelText("当前工作台")).toBeInTheDocument();
    expect(screen.queryByText("as400-production")).not.toBeInTheDocument();
    expect(screen.queryByText("AS/400 Production")).not.toBeInTheDocument();
  });

  test("uses the AI SQL assistant as advisory input that must be revalidated", async () => {
    const user = userEvent.setup();
    /** @type {unknown[]} */
    const assistantRequests = [];
    server.use(
      http.get("/internal/sql-workbench/connections", () =>
        HttpResponse.json(sqlConnections),
      ),
      http.post("/internal/sql-workbench/queries/validate", () =>
        HttpResponse.json(validatedSelectReport),
      ),
      http.post("/internal/sql-workbench/assistant", async ({ request }) => {
        assistantRequests.push(await request.json());
        return HttpResponse.json(sqlAssistantResponse);
      }),
    );

    renderAt("/sql");

    const editor = await screen.findByLabelText("SQL 文本");
    await user.clear(editor);
    await user.type(editor, "SELECT * FROM ORDERS.ORDERS");
    await user.click(screen.getByRole("button", { name: "校验" }));
    expect(await screen.findByText("VALIDATED")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "优化建议" }));
    expect(await screen.findByText("Use explicit columns.")).toBeInTheDocument();
    expect(screen.getByText("Limit columns")).toBeInTheDocument();

    await waitFor(() => expect(assistantRequests).toHaveLength(1));
    expect(assistantRequests[0]).toMatchObject({
      contractVersion: "1.0",
      connectionId: "as400-development",
      targetEnvironment: "development",
      schema: "ORDERS",
      assistantAction: "OPTIMIZE_SQL",
      sql: "SELECT * FROM ORDERS.ORDERS",
    });

    await user.click(screen.getByRole("button", { name: "应用建议到编辑器" }));
    expect(screen.getByLabelText("SQL 文本")).toHaveValue(
      "select order_id, status from ORDERS.ORDERS",
    );
    expect(screen.queryByText("VALIDATED")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "执行 SELECT" })).toBeDisabled();
  });
});

const sqlConnections = [
  {
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
  },
  {
    contractVersion: "1.0",
    connectionId: "as400-test",
    displayName: "AS/400 Test",
    targetEnvironment: "test",
    platformType: "DB2_FOR_I",
    status: "READY",
    defaultSchema: "ORDERS_QA",
    allowedSchemas: ["ORDERS_QA"],
    capabilities: ["VALIDATE", "RUN_READ_ONLY", "PREFLIGHT_DML"],
    maxRowsDefault: 500,
    timeoutSecondsDefault: 30,
  },
];

const createdConnection = {
  contractVersion: "1.0",
  connectionId: "as400-lab",
  displayName: "AS/400 Lab",
  targetEnvironment: "test",
  platformType: "DB2_FOR_I",
  status: "PENDING_WORKER_BINDING",
  defaultSchema: "LABORDERS",
  allowedSchemas: ["LABORDERS", "INVENTORY_QA"],
  capabilities: ["VALIDATE", "RUN_READ_ONLY", "PREFLIGHT_DML"],
  maxRowsDefault: 500,
  timeoutSecondsDefault: 30,
};

const validatedSelectReport = {
  contractVersion: "1.0",
  statementType: "SELECT",
  validationLevel: "VALIDATED",
  sqlHash: "sha256:readonly",
  validationHash: "sha256:validation-readonly",
  referencedObjects: ["ORDERS.ORDERS"],
  risks: [],
  rejectionReasons: [],
  unverifiedItems: [],
};

const rejectedDmlReport = {
  contractVersion: "1.0",
  statementType: "UPDATE",
  validationLevel: "REJECTED",
  sqlHash: "sha256:dml",
  validationHash: "sha256:validation-dml",
  referencedObjects: ["ORDERS.ORDERS"],
  risks: ["DML_PRECHECK_ONLY"],
  rejectionReasons: ["DML execution is not allowed in P1"],
  unverifiedItems: ["affectedRows"],
};

const queryRunResult = {
  contractVersion: "1.0",
  executionRequestId: "exec-001",
  workflowId: "wf-001",
  resultId: "result-001",
  status: "SUCCEEDED",
};

const resultPage = {
  contractVersion: "1.0",
  resultId: "result-001",
  columns: [
    { name: "order_id", type: "VARCHAR", masked: false },
    { name: "status", type: "VARCHAR", masked: false },
  ],
  rows: [["OD-10500", "PENDING"]],
  nextCursor: null,
  truncated: false,
  expiresAt: "2026-06-27T09:10:00Z",
};

const sqlAssistantResponse = {
  contractVersion: "1.0",
  status: "SUCCEEDED",
  assistantAction: "OPTIMIZE_SQL",
  summary: "Use explicit columns.",
  suggestions: [
    {
      title: "Limit columns",
      rationale: "The current projection fetches every column.",
      suggestedSql: "select order_id, status from ORDERS.ORDERS",
    },
  ],
  safetyNotes: ["Validate before execution."],
  validationRequired: true,
  modelProviderFingerprint: "provider:fingerprint",
};
