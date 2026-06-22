import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, test } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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
  test("renders the rewritten SQL workbench inside the shared shell", async () => {
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
    expect(screen.queryByText("SQL 控制台")).not.toBeInTheDocument();
    expect(await screen.findByText("已连接 · development")).toBeInTheDocument();
    expect(screen.getAllByText("as400-development").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("ORDERS").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("production")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "校验只读 SQL" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "预检 DML 风险" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "请求 AI 改写建议" })).toBeDisabled();
    expect(screen.queryByText("Commit")).not.toBeInTheDocument();
    expect(screen.queryByText("Rollback")).not.toBeInTheDocument();
  });

  test("submits versioned SQL validation requests and renders server reports", async () => {
    const user = userEvent.setup();
    /** @type {unknown[]} */
    const requests = [];
    server.use(
      http.get("/internal/sql-workbench/connections", () =>
        HttpResponse.json(sqlConnections),
      ),
      http.post("/internal/sql-workbench/queries/validate", async ({ request }) => {
        requests.push(await request.json());
        return HttpResponse.json(rejectedDmlReport);
      }),
    );

    renderAt("/sql");

    await screen.findByText("已连接 · development");
    await user.click(screen.getByRole("button", { name: "预检 DML 风险" }));

    await screen.findByText("REJECTED");
    expect(screen.getByText("UPDATE_WITHOUT_BOUND_IMPACT")).toBeInTheDocument();
    expect(screen.getAllByText("ORDERS.ORDERS").length).toBeGreaterThanOrEqual(1);
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]).toMatchObject({
      contractVersion: "1.0",
      connectionId: "as400-development",
      targetEnvironment: "development",
      schema: "ORDERS",
      action: "PREFLIGHT_DML",
      parameters: [],
      limits: { maxRows: 500, maxBytes: 5000000, timeoutSeconds: 30 },
    });
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

  test("keeps the AI assistant visibly disabled", async () => {
    server.use(
      http.get("/internal/sql-workbench/connections", () =>
        HttpResponse.json(sqlConnections),
      ),
    );

    renderAt("/sql");

    await screen.findByText("AI 辅助分析");
    expect(screen.getByRole("button", { name: "请求 AI 改写建议" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "查看建议改写" })).toBeDisabled();
    expect(screen.getByText("潜在逻辑风险")).toBeInTheDocument();
  });
});

const sqlConnections = [
  {
    contractVersion: "1.0",
    connectionId: "as400-development",
    displayName: "AS/400 Development",
    targetEnvironment: "development",
    platformType: "DB2_FOR_I",
    allowedSchemas: ["ORDERS", "INVENTORY"],
    capabilities: ["VALIDATE", "RUN_READ_ONLY", "PREFLIGHT_DML"],
  },
  {
    contractVersion: "1.0",
    connectionId: "as400-test",
    displayName: "AS/400 Test",
    targetEnvironment: "test",
    platformType: "DB2_FOR_I",
    allowedSchemas: ["ORDERS_QA"],
    capabilities: ["VALIDATE", "RUN_READ_ONLY", "PREFLIGHT_DML"],
  },
];

const validatedSelectReport = {
  contractVersion: "1.0",
  statementType: "SELECT",
  validationLevel: "VALIDATED",
  sqlHash: "sha256:select-pending-orders",
  referencedObjects: ["ORDERS.ORDERS"],
  risks: [],
  rejectionReasons: [],
  unverifiedItems: [],
};

const rejectedDmlReport = {
  contractVersion: "1.0",
  statementType: "UPDATE",
  validationLevel: "REJECTED",
  sqlHash: "sha256:update-review-required",
  referencedObjects: ["ORDERS.ORDERS"],
  risks: ["DML_PRECHECK_ONLY"],
  rejectionReasons: ["UPDATE_WITHOUT_BOUND_IMPACT"],
  unverifiedItems: ["affectedRows"],
};
