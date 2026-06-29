import { http, HttpResponse } from "msw";
import { EditorView } from "@codemirror/view";
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

/**
 * @param {ReturnType<typeof userEvent.setup>} user
 * @param {string} sql
 */
async function replaceSqlText(user, sql) {
  const editor = await screen.findByLabelText("SQL 文本");
  if (editor instanceof HTMLTextAreaElement) {
    await user.clear(editor);
    await user.type(editor, sql);
    return;
  }

  const view = EditorView.findFromDOM(editor);
  if (!view) {
    throw new Error("Expected a CodeMirror SQL editor");
  }
  view.dispatch({
    changes: {
      from: 0,
      insert: sql,
      to: view.state.doc.length,
    },
  });
  await waitFor(() => expect(view.state.doc.toString()).toBe(sql));
}

function readSqlText() {
  const editor = screen.getByLabelText("SQL 文本");
  if (editor instanceof HTMLTextAreaElement) {
    return editor.value;
  }

  const view = EditorView.findFromDOM(editor);
  if (view) {
    return view.state.doc.toString();
  }
  return editor.textContent ?? "";
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
    expect(screen.getByRole("button", { name: "管理连接" })).toBeEnabled();
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
    expect(within(contextBar).getByRole("button", { name: "管理连接" })).toBeEnabled();
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

  test("switches the active connection from the top connection selector", async () => {
    const user = userEvent.setup();
    const connections = [
      sqlConnections[0],
      {
        ...sqlConnections[1],
        maxRowsDefault: 250,
      },
    ];
    server.use(
      http.get("/internal/sql-workbench/connections", () =>
        HttpResponse.json(connections),
      ),
    );

    renderAt("/sql");

    const contextBar = await screen.findByLabelText("SQL 工作区连接上下文");
    const connectionSelect = within(contextBar).getByRole("combobox", {
      name: "选择 SQL 连接",
    });
    await waitFor(() => expect(connectionSelect).toHaveValue("as400-development"));
    expect(within(contextBar).getByText("ORDERS")).toBeInTheDocument();
    expect(within(contextBar).getByText("maxRows 500")).toBeInTheDocument();

    await user.selectOptions(connectionSelect, "as400-test");

    expect(connectionSelect).toHaveValue("as400-test");
    expect(within(contextBar).getByText("ORDERS_QA")).toBeInTheDocument();
    expect(within(contextBar).getByText("maxRows 250")).toBeInTheDocument();
  });

  test("creates a connection from the connection manager with credentialAlias metadata and no password field", async () => {
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
    await user.click(screen.getByRole("button", { name: "管理连接" }));

    const dialog = screen.getByRole("dialog", { name: "管理连接" });
    await user.click(within(dialog).getByRole("button", { name: "新建连接" }));
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
    await user.click(within(dialog).getByRole("button", { name: "创建连接" }));

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
    await waitFor(() => expect(screen.getByLabelText("选择 SQL 连接")).toHaveValue("as400-lab"));
    expect(screen.getByText("LABORDERS")).toBeInTheDocument();
  });

  test("updates and deletes connections from the connection manager", async () => {
    const user = userEvent.setup();
    /** @type {{connectionId: string, body: unknown}[]} */
    const updateRequests = [];
    /** @type {string[]} */
    const deleteRequests = [];
    server.use(
      http.get("/internal/sql-workbench/connections", () =>
        HttpResponse.json(sqlConnections),
      ),
      http.put("/internal/sql-workbench/connections/:connectionId", async ({ params, request }) => {
        updateRequests.push({
          connectionId: String(params.connectionId),
          body: await request.json(),
        });
        return HttpResponse.json({
          ...sqlConnections[0],
          displayName: "AS/400 Reporting",
          targetEnvironment: "test",
          defaultSchema: "REPORTING",
          allowedSchemas: ["REPORTING"],
          credentialAlias: "as400-reporting-readonly",
          status: "PENDING_WORKER_BINDING",
          maxRowsDefault: 250,
        });
      }),
      http.delete("/internal/sql-workbench/connections/:connectionId", ({ params }) => {
        deleteRequests.push(String(params.connectionId));
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderAt("/sql");

    await screen.findByText("已连接 · development");
    await user.click(screen.getByRole("button", { name: "管理连接" }));

    const dialog = screen.getByRole("dialog", { name: "管理连接" });
    expect(within(dialog).getByRole("button", { name: "as400-development" }))
      .toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "as400-test" }))
      .toBeInTheDocument();

    await user.clear(within(dialog).getByLabelText("连接名称"));
    await user.type(within(dialog).getByLabelText("连接名称"), "AS/400 Reporting");
    await user.selectOptions(within(dialog).getByLabelText("目标环境"), "test");
    await user.clear(within(dialog).getByLabelText("默认 Schema"));
    await user.type(within(dialog).getByLabelText("默认 Schema"), "REPORTING");
    await user.clear(within(dialog).getByLabelText("允许 Schema"));
    await user.type(within(dialog).getByLabelText("允许 Schema"), "REPORTING");
    await user.clear(within(dialog).getByLabelText("maxRows"));
    await user.type(within(dialog).getByLabelText("maxRows"), "250");
    await user.clear(within(dialog).getByLabelText("凭据别名 credentialAlias"));
    await user.type(
      within(dialog).getByLabelText("凭据别名 credentialAlias"),
      "as400-reporting-readonly",
    );
    await user.click(within(dialog).getByRole("button", { name: "保存修改" }));

    await waitFor(() => expect(updateRequests).toHaveLength(1));
    expect(updateRequests[0]).toMatchObject({
      connectionId: "as400-development",
      body: {
        contractVersion: "1.0",
        displayName: "AS/400 Reporting",
        targetEnvironment: "test",
        defaultSchema: "REPORTING",
        allowedSchemas: ["REPORTING"],
        credentialAlias: "as400-reporting-readonly",
        maxRowsDefault: 250,
      },
    });
    expect(screen.getByText("REPORTING")).toBeInTheDocument();
    expect(screen.getByText("maxRows 250")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "删除连接" }));
    await user.click(within(dialog).getByRole("button", { name: "确认删除" }));

    await waitFor(() => expect(deleteRequests).toEqual(["as400-development"]));
    await waitFor(() => expect(screen.getByLabelText("选择 SQL 连接")).toHaveValue("as400-test"));
    expect(screen.getByText("ORDERS_QA")).toBeInTheDocument();
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

    await replaceSqlText(user, "SELECT * FROM ORDERS.SESSION_ONE");
    await user.click(screen.getByRole("button", { name: "校验" }));
    expect(await screen.findAllByText("sha256:session-one")).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "+ 新建会话" }));
    expect(screen.getByRole("tab", { name: "SQL 2" })).toHaveAttribute("aria-selected", "true");
    expect(readSqlText()).not.toBe("SELECT * FROM ORDERS.SESSION_ONE");
    expect(screen.queryByText("sha256:session-one")).not.toBeInTheDocument();

    await replaceSqlText(user, "SELECT * FROM ORDERS.SESSION_TWO");
    await user.click(screen.getByRole("button", { name: "校验" }));
    expect(await screen.findAllByText("sha256:session-two")).toHaveLength(2);

    await user.click(screen.getByRole("tab", { name: "SQL 1" }));
    expect(readSqlText()).toBe("SELECT * FROM ORDERS.SESSION_ONE");
    expect(screen.getAllByText("sha256:session-one")).toHaveLength(2);
    expect(screen.queryByText("sha256:session-two")).not.toBeInTheDocument();
  });

  test("executes SELECT directly through server-side validation and keeps DML on preflight", async () => {
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

    await replaceSqlText(user, "SELECT * FROM ORDERS.ORDERS");
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
    });
    expect(runRequests[0]).not.toHaveProperty("validationHash");
    expect(validationRequests).toHaveLength(0);

    await replaceSqlText(user, "UPDATE ORDERS.ORDERS SET status = 'X'");
    expect(screen.getByRole("button", { name: "执行 SELECT" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "DML 预检" }));
    expect(await screen.findByText("DML_PRECHECK_ONLY")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "执行 SELECT" })).toBeDisabled();
    expect(runRequests).toHaveLength(1);
    expect(validationRequests.at(-1)).toMatchObject({ action: "PREFLIGHT_DML" });
  });

  test("highlights line comments and keeps commented SELECT runnable", async () => {
    const user = userEvent.setup();
    /** @type {unknown[]} */
    const runRequests = [];
    const commentedSql = "-- run this read-only smoke check\nSELECT * FROM ORDERS.ORDERS";
    server.use(
      http.get("/internal/sql-workbench/connections", () =>
        HttpResponse.json(sqlConnections),
      ),
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
    await replaceSqlText(user, commentedSql);

    const editor = screen.getByLabelText("SQL 文本");
    expect(editor).toHaveClass("cm-content");
    expect(editor.querySelector(".cm-sql-comment")).toHaveTextContent(
      "-- run this read-only smoke check",
    );
    expect(screen.getByRole("button", { name: "执行 SELECT" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "执行 SELECT" }));

    await waitFor(() => expect(runRequests).toHaveLength(1));
    expect(runRequests[0]).toMatchObject({
      action: "RUN_READ_ONLY",
      sql: commentedSql,
    });
  });

  test("runs only the statement next to a CodeMirror gutter run button", async () => {
    const user = userEvent.setup();
    /** @type {unknown[]} */
    const runRequests = [];
    const multiStatementSql = [
      "-- first query",
      "SELECT * FROM ORDERS.ORDERS;",
      "",
      "SELECT * FROM INVENTORY.ITEMS",
    ].join("\n");
    server.use(
      http.get("/internal/sql-workbench/connections", () =>
        HttpResponse.json(sqlConnections),
      ),
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
    await replaceSqlText(user, multiStatementSql);

    const runStatementButtons = await screen.findAllByRole("button", {
      name: "执行此 SQL",
    });
    expect(runStatementButtons).toHaveLength(2);
    expect(screen.getByRole("button", { name: "执行 SELECT" })).toBeDisabled();

    await user.click(runStatementButtons[1]);

    await waitFor(() => expect(runRequests).toHaveLength(1));
    expect(runRequests[0]).toMatchObject({
      action: "RUN_READ_ONLY",
      sql: "SELECT * FROM INVENTORY.ITEMS",
    });
    expect(String(/** @type {{sql: unknown}} */ (runRequests[0]).sql)).not.toContain(
      "ORDERS.ORDERS",
    );
  });

  test("disables gutter run buttons for non-read-only SQL statements", async () => {
    const user = userEvent.setup();
    server.use(
      http.get("/internal/sql-workbench/connections", () =>
        HttpResponse.json(sqlConnections),
      ),
    );

    renderAt("/sql");

    await screen.findByText("已连接 · development");
    await replaceSqlText(
      user,
      "UPDATE ORDERS.ORDERS SET STATUS = 'X';\nSELECT * FROM ORDERS.ORDERS",
    );

    const runStatementButtons = await screen.findAllByRole("button", {
      name: "执行此 SQL",
    });
    expect(runStatementButtons).toHaveLength(2);
    expect(runStatementButtons[0]).toBeDisabled();
    expect(runStatementButtons[1]).toBeEnabled();
  });

  test("shows server-side validation diagnostics when SELECT execution is rejected", async () => {
    const user = userEvent.setup();
    server.use(
      http.get("/internal/sql-workbench/connections", () =>
        HttpResponse.json(sqlConnections),
      ),
      http.post("/internal/sql-workbench/queries/run", () =>
        HttpResponse.json(
          {
            code: "INVALID_ARGUMENT",
            message: [
              "SELECT 执行未通过服务端只读校验。",
              "statementType=UNSUPPORTED",
              "validationLevel=REJECTED",
              "rejectionReasons=SQL syntax is not supported",
              "sqlHash=sha256:bad",
            ].join("\n"),
          },
          { status: 400 },
        ),
      ),
    );

    renderAt("/sql");

    await screen.findByText("已连接 · development");
    await replaceSqlText(user, "SELECT * FROM ORDERS.ORDERS");
    await user.click(screen.getByRole("button", { name: "执行 SELECT" }));

    const alerts = await screen.findAllByRole("alert");
    const alert = alerts.find((element) =>
      element.textContent?.includes("statementType=UNSUPPORTED"),
    );
    if (!alert) {
      throw new Error("Expected a SQL execution validation alert");
    }
    expect(alert.textContent).toContain("SELECT 执行未通过服务端只读校验。");
    expect(within(alert).getByText("排查线索")).toBeInTheDocument();
    expect(within(alert).getByText("statementType=UNSUPPORTED")).toBeInTheDocument();
    expect(within(alert).getByText("validationLevel=REJECTED")).toBeInTheDocument();
    expect(within(alert).getByText("rejectionReasons=SQL syntax is not supported")).toBeInTheDocument();
    expect(within(alert).getByText("sqlHash=sha256:bad")).toBeInTheDocument();
    expect(screen.getAllByText("排查线索")).toHaveLength(2);
  });

  test("automatically asks AI assistant for syntax-error analysis after rejected SELECT execution", async () => {
    const user = userEvent.setup();
    /** @type {unknown[]} */
    const validationRequests = [];
    /** @type {unknown[]} */
    const assistantRequests = [];
    const syntaxSql = "select ORDER_ID, STATUS\nform PUBLIC.ORDERS";
    const syntaxAssistantResponse = {
      ...sqlAssistantResponse,
      assistantAction: "ANALYZE_ERROR",
      summary: "SQL 语法错误：FORM 应改为 FROM。",
      suggestions: [
        {
          title: "修正 FROM 关键字",
          rationale: "第二行的 form 不是 SQL 查询子句关键字。",
          suggestedSql: "select ORDER_ID, STATUS\nfrom PUBLIC.ORDERS",
        },
      ],
      safetyNotes: ["修正后必须重新执行服务端校验。"],
    };
    server.use(
      http.get("/internal/sql-workbench/connections", () =>
        HttpResponse.json(sqlConnections),
      ),
      http.post("/internal/sql-workbench/queries/run", () =>
        HttpResponse.json(
          {
            code: "INVALID_ARGUMENT",
            message: "query must pass read-only validation before execution",
          },
          { status: 400 },
        ),
      ),
      http.post("/internal/sql-workbench/queries/validate", async ({ request }) => {
        validationRequests.push(await request.json());
        return HttpResponse.json(rejectedSyntaxReport);
      }),
      http.post("/internal/sql-workbench/assistant", async ({ request }) => {
        assistantRequests.push(await request.json());
        return HttpResponse.json(syntaxAssistantResponse);
      }),
    );

    renderAt("/sql");

    await screen.findByText("已连接 · development");
    await replaceSqlText(user, syntaxSql);
    await user.click(screen.getByRole("button", { name: "执行 SELECT" }));

    expect(await screen.findByText("SQL syntax is not supported")).toBeInTheDocument();
    expect(await screen.findByText("SQL 语法错误：FORM 应改为 FROM。")).toBeInTheDocument();
    expect(screen.getByText("修正 FROM 关键字")).toBeInTheDocument();

    await waitFor(() => expect(validationRequests).toHaveLength(1));
    expect(validationRequests[0]).toMatchObject({
      action: "RUN_READ_ONLY",
      sql: syntaxSql,
    });
    await waitFor(() => expect(assistantRequests).toHaveLength(1));
    expect(assistantRequests[0]).toMatchObject({
      assistantAction: "ANALYZE_ERROR",
      sql: syntaxSql,
    });
    const assistantRequest = /** @type {Record<string, unknown>} */ (assistantRequests[0]);
    expect(String(assistantRequest.diagnosticContext)).toContain(
      "statementType=UNSUPPORTED",
    );
    expect(String(assistantRequest.diagnosticContext)).toContain(
      "SQL syntax is not supported",
    );
  });

  test("paginates SQL result pages with explicit cursor navigation", async () => {
    const user = userEvent.setup();
    /** @type {(string | null)[]} */
    const pageTokens = [];
    const firstPage = {
      ...resultPage,
      rows: [["OD-10500", "PENDING"]],
      nextCursor: "cursor-page-2",
    };
    const secondPage = {
      ...resultPage,
      rows: [["OD-10501", "READY"]],
      nextCursor: null,
    };

    server.use(
      http.get("/internal/sql-workbench/connections", () =>
        HttpResponse.json(sqlConnections),
      ),
      http.post("/internal/sql-workbench/queries/run", () =>
        HttpResponse.json(queryRunResult),
      ),
      http.get("/internal/sql-workbench/results/result-001", ({ request }) => {
        const pageToken = new URL(request.url).searchParams.get("pageToken");
        pageTokens.push(pageToken);
        return HttpResponse.json(pageToken === "cursor-page-2" ? secondPage : firstPage);
      }),
    );

    renderAt("/sql");

    await screen.findByText("已连接 · development");
    await replaceSqlText(user, "SELECT * FROM ORDERS.ORDERS");
    await user.click(screen.getByRole("button", { name: "执行 SELECT" }));

    expect(await screen.findByText("OD-10500")).toBeInTheDocument();
    expect(screen.getByText("第 1 页")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "上一页" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "下一页" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "下一页" }));
    expect(await screen.findByText("OD-10501")).toBeInTheDocument();
    expect(screen.getByText("第 2 页")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "上一页" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "下一页" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "上一页" }));
    expect(await screen.findByText("OD-10500")).toBeInTheDocument();
    expect(screen.getByText("第 1 页")).toBeInTheDocument();
    expect(pageTokens).toContain("cursor-page-2");
  });

  test("resizes the SQL editor and result split with keyboard controls", async () => {
    const user = userEvent.setup();

    server.use(
      http.get("/internal/sql-workbench/connections", () =>
        HttpResponse.json(sqlConnections),
      ),
    );

    renderAt("/sql");

    const separator = await screen.findByRole("separator", { name: /SQL/ });
    expect(separator).toHaveAttribute("aria-valuenow", "72");

    separator.focus();
    await user.keyboard("{ArrowUp}");
    await waitFor(() => expect(separator).toHaveAttribute("aria-valuenow", "68"));

    await user.keyboard("{Home}");
    await waitFor(() => expect(separator).toHaveAttribute("aria-valuenow", "42"));

    await user.keyboard("{End}");
    await waitFor(() => expect(separator).toHaveAttribute("aria-valuenow", "84"));
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

  test("uses the AI SQL assistant as advisory input that is revalidated on execution", async () => {
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

    await replaceSqlText(user, "SELECT * FROM ORDERS.ORDERS");
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
    expect(readSqlText()).toBe("select order_id, status from ORDERS.ORDERS");
    expect(screen.queryByText("VALIDATED")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "执行 SELECT" })).toBeEnabled();
  });
});

const sqlConnections = [
  {
    contractVersion: "1.0",
    connectionId: "as400-development",
    displayName: "AS/400 Development",
    targetEnvironment: "development",
    platformType: "DB2_FOR_I",
    host: "as400-dev.internal",
    port: 446,
    status: "READY",
    defaultSchema: "ORDERS",
    allowedSchemas: ["ORDERS", "INVENTORY"],
    capabilities: ["VALIDATE", "RUN_READ_ONLY", "PREFLIGHT_DML"],
    credentialAlias: "as400-development-readonly",
    maxRowsDefault: 500,
    timeoutSecondsDefault: 30,
  },
  {
    contractVersion: "1.0",
    connectionId: "as400-test",
    displayName: "AS/400 Test",
    targetEnvironment: "test",
    platformType: "DB2_FOR_I",
    host: "as400-test.internal",
    port: 446,
    status: "READY",
    defaultSchema: "ORDERS_QA",
    allowedSchemas: ["ORDERS_QA"],
    capabilities: ["VALIDATE", "RUN_READ_ONLY", "PREFLIGHT_DML"],
    credentialAlias: "as400-test-readonly",
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

const rejectedSyntaxReport = {
  contractVersion: "1.0",
  statementType: "UNSUPPORTED",
  validationLevel: "REJECTED",
  sqlHash: "sha256:syntax",
  validationHash: "sha256:validation-syntax",
  referencedObjects: [],
  risks: [],
  rejectionReasons: ["SQL syntax is not supported"],
  unverifiedItems: [],
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
