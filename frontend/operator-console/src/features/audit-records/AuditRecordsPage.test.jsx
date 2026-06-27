import { http, HttpResponse } from "msw";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test } from "vitest";

import { AppProviders } from "../../app/providers.jsx";
import { server } from "../../test/server.js";
import { AuditRecordsPage } from "./AuditRecordsPage.jsx";

beforeEach(() => {
  server.use(
    http.get("/auth/session", () =>
      HttpResponse.json({
        authenticated: true,
        subject: "operator-1",
        username: "ops.auditor",
        roles: ["ROLE_ops-auditor"],
        authenticationType: "built-in",
      }),
    ),
    http.get("/internal/audit/events", () =>
      HttpResponse.json({
        total: 2,
        events: auditEvents,
      }),
    ),
  );
});

function renderPage() {
  return render(
    <AppProviders>
      <AuditRecordsPage />
    </AppProviders>,
  );
}

describe("AuditRecordsPage", () => {
  test("does not render the removed page intro and summary cards", async () => {
    renderPage();

    expect(await screen.findByLabelText("审计记录筛选")).toBeInTheDocument();
    expect(screen.queryByText("查看身份、策略、Skill、Worker 和结果的不可篡改证据链。")).not.toBeInTheDocument();
    expect(screen.queryByText("审计证据链")).not.toBeInTheDocument();
    expect(screen.queryByText("完整性校验")).not.toBeInTheDocument();
  });

  test("loads recent audit records from the control plane", async () => {
    renderPage();

    expect(await screen.findAllByText("internal.agent.tool.execute")).toHaveLength(2);
    expect(screen.getAllByText("weather-current-read:1.0.0")).toHaveLength(2);
    expect(screen.getAllByText("ALLOW").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("trace-weather-1")).toHaveLength(2);
  });

  test("surfaces recent Skill execution audits above noisy read events", async () => {
    server.use(
      http.get("/internal/audit/events", () =>
        HttpResponse.json({
          total: 3,
          events: [
            {
              eventId: "audit-read-1",
              requestId: "request-read-1",
              traceId: "trace-read-1",
              subject: "operator-1",
              action: "internal.audit.read",
              resource: "/internal/audit/events",
              policyVersion: "rbac-v1",
              result: "ALLOW",
              reason: "role is allowed",
              timestamp: "2026-06-24T10:00:03Z",
            },
            ...auditEvents,
          ],
        }),
      ),
    );

    renderPage();

    const skillAuditPanel = await screen.findByLabelText("最近 Skill 执行审计");

    expect(skillAuditPanel).toHaveTextContent("internal.agent.tool.execute");
    expect(skillAuditPanel).toHaveTextContent("weather-current-read:1.0.0");
    expect(skillAuditPanel).toHaveTextContent("ALLOW");
    expect(skillAuditPanel).toHaveTextContent("trace-weather-1");
  });
});

const auditEvents = [
  {
    eventId: "audit-weather-1",
    requestId: "request-weather-1",
    traceId: "trace-weather-1",
    subject: "operator-1",
    action: "internal.agent.tool.execute",
    resource: "weather-current-read:1.0.0",
    policyVersion: "rbac-v1",
    result: "ALLOW",
    reason: "role is allowed",
    timestamp: "2026-06-24T10:00:01Z",
  },
  {
    eventId: "audit-agent-1",
    requestId: "request-agent-1",
    traceId: "trace-agent-1",
    subject: "operator-1",
    action: "internal.agent.diagnostics.read",
    resource: "/api/v1/agent/diagnostics",
    policyVersion: "rbac-v1",
    result: "ALLOW",
    reason: "role is allowed",
    timestamp: "2026-06-24T10:00:00Z",
  },
];
