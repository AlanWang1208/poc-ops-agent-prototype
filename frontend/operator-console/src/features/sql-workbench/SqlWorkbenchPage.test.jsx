import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import App from "../../app/App.jsx";
import { AppProviders } from "../../app/providers.jsx";
import { server } from "../../test/server.js";

vi.mock("@monaco-editor/react", () => ({
  default: (/** @type {{value: string, onChange: (value: string) => void}} */ props) => {
    const editorProps = /** @type {{value: string, onChange: (value: string) => void}} */ (props);
    return (
      <textarea
        aria-label="SQL 编辑器"
        onChange={(event) => editorProps.onChange(event.target.value)}
        value={editorProps.value}
      />
    );
  },
}));

function renderSqlWorkbench() {
  return render(
    <AppProviders Router={MemoryRouter} routerProps={{ initialEntries: ["/sql"] }}>
      <App />
    </AppProviders>,
  );
}

function useAuthenticatedSession() {
  server.use(
    http.get("/auth/session", () =>
      HttpResponse.json({
        authenticated: true,
        subject: "alice-id",
        username: "alice",
        roles: ["ROLE_ops-reader"],
        authenticationType: "built-in",
      }),
    ),
  );
}

describe("SqlWorkbenchPage", () => {
  test("renders development and test connections with disabled AI assistant", async () => {
    useAuthenticatedSession();
    server.use(
      http.get("/internal/sql-workbench/connections", () =>
        HttpResponse.json([developmentConnection, testConnection]),
      ),
    );

    renderSqlWorkbench();

    expect(await screen.findByText("as400-development")).toBeInTheDocument();
    expect(screen.getByText("as400-test")).toBeInTheDocument();
    expect(screen.queryByText("production")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "校验只读执行" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "DML 预检" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "询问 AI" })).toBeDisabled();
  });

  test("sends a versioned validation request and renders the report", async () => {
    useAuthenticatedSession();
    const user = userEvent.setup();
    /** @type {unknown[]} */
    const requests = [];
    server.use(
      http.get("/internal/sql-workbench/connections", () =>
        HttpResponse.json([developmentConnection]),
      ),
      http.post("/internal/sql-workbench/queries/validate", async ({ request }) => {
        requests.push(await request.json());
        return HttpResponse.json(validationReport);
      }),
    );

    renderSqlWorkbench();

    await screen.findByText("as400-development");
    await user.click(screen.getByRole("button", { name: "校验只读执行" }));

    expect(await screen.findByText("VALIDATED")).toBeInTheDocument();
    expect(await screen.findByText("sha256:query")).toBeInTheDocument();
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      contractVersion: "1.0",
      connectionId: "as400-development",
      targetEnvironment: "development",
      schema: "ORDERS",
      action: "RUN_READ_ONLY",
    });
  });

  test("does not render a production connection returned by an invalid contract", async () => {
    useAuthenticatedSession();
    server.use(
      http.get("/internal/sql-workbench/connections", () =>
        HttpResponse.json([
          {
            ...developmentConnection,
            connectionId: "as400-production",
            targetEnvironment: "production",
          },
        ]),
      ),
    );

    renderSqlWorkbench();

    expect(
      await screen.findByRole("alert", { name: "SQL 连接契约不兼容" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("as400-production")).not.toBeInTheDocument();
  });

  test("renders server rejection reasons without executing SQL", async () => {
    useAuthenticatedSession();
    const user = userEvent.setup();
    server.use(
      http.get("/internal/sql-workbench/connections", () =>
        HttpResponse.json([developmentConnection]),
      ),
      http.post("/internal/sql-workbench/queries/validate", () =>
        HttpResponse.json({
          ...validationReport,
          validationLevel: "REJECTED",
          rejectionReasons: ["DML execution is not allowed in P1"],
          risks: ["WRITE_OPERATION"],
          unverifiedItems: ["Target row count"],
        }),
      ),
    );

    renderSqlWorkbench();

    await screen.findByText("as400-development");
    await user.click(screen.getByRole("button", { name: "DML 预检" }));

    expect(await screen.findByText("REJECTED")).toBeInTheDocument();
    expect(screen.getByText("DML execution is not allowed in P1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Commit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Rollback" })).not.toBeInTheDocument();
  });
});

const developmentConnection = {
  contractVersion: "1.0",
  connectionId: "as400-development",
  displayName: "AS/400 Development",
  targetEnvironment: "development",
  platformType: "DB2_FOR_I",
  allowedSchemas: ["ORDERS"],
  capabilities: ["VALIDATE", "RUN_READ_ONLY", "PREFLIGHT_DML"],
};

const testConnection = {
  ...developmentConnection,
  connectionId: "as400-test",
  displayName: "AS/400 Test",
  targetEnvironment: "test",
};

const validationReport = {
  contractVersion: "1.0",
  statementType: "SELECT",
  validationLevel: "VALIDATED",
  sqlHash: "sha256:query",
  referencedObjects: ["ORDERS.ORDERS"],
  risks: [],
  rejectionReasons: [],
  unverifiedItems: [],
};
