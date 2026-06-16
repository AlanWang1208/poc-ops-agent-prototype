import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, test } from "vitest";
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

describe("SqlWorkbenchPage", () => {
  test("renders the SQL workbench from real connection catalog data", async () => {
    server.use(
      http.get("/internal/sql-workbench/connections", () =>
        HttpResponse.json(sqlConnections),
      ),
      http.post("/internal/sql-workbench/queries/validate", () =>
        HttpResponse.json(validatedSelectReport),
      ),
    );

    renderAt("/sql");

    expect(await screen.findByText("已连接 · 开发环境")).toBeInTheDocument();
    expect(screen.getAllByText("as400-development").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("ORDERS").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("production")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "校验只读执行" }),
    ).toBeEnabled();
    expect(screen.getByRole("button", { name: "DML 预检" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "询问 AI" })).toBeDisabled();
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

    await screen.findByText("已连接 · 开发环境");
    await user.click(screen.getByRole("button", { name: "DML 预检" }));

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

    await screen.findByText("AI SQL 助手");
    expect(screen.getByRole("button", { name: "询问 AI" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "查看建议修改" })).toBeDisabled();
    expect(screen.getByText("潜在逻辑错误")).toBeInTheDocument();
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
