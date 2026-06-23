import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import App from "../../app/App.jsx";
import { AppProviders } from "../../app/providers.jsx";
import { server } from "../../test/server.js";

function renderQuickLinks() {
  return render(
    <AppProviders Router={MemoryRouter} routerProps={{ initialEntries: ["/quick-links"] }}>
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
        username: "claim.reader",
        roles: ["ROLE_claim-log-reader"],
        authenticationType: "built-in",
      }),
    ),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("QuickLinksPage", () => {
  test("renders Claim Splunk templates instead of the placeholder page", async () => {
    server.use(
      http.get("/internal/quick-links/splunk/templates", () =>
        HttpResponse.json(templateCatalog),
      ),
    );

    renderQuickLinks();

    expect(await screen.findByRole("heading", { name: "快捷连接" })).toBeInTheDocument();
    expect(screen.getByText("Claim 系统 Splunk 日志检索")).toBeInTheDocument();
    expect(await screen.findByRole("region", { name: "Claim 日志模板" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "个人常用预设" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "最近启动记录" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Claim 号日志检索/u })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /生产 requestId 追踪/u })).toBeInTheDocument();
    expect(screen.getAllByText("测试环境").length).toBeGreaterThan(0);
    expect(screen.getAllByText("生产环境").length).toBeGreaterThan(0);
    expect(
      screen.queryByText("当前页面只展示 P1 只读范围内的占位入口，后续任务再接入真实接口。"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Agent 工作流上下文")).not.toBeInTheDocument();
  });

  test("confirms a Claim Splunk search and opens the server generated URL", async () => {
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    /** @type {unknown[]} */
    const confirmRequests = [];
    /** @type {unknown[]} */
    const launchRequests = [];
    server.use(
      http.get("/internal/quick-links/splunk/templates", () =>
        HttpResponse.json(templateCatalog),
      ),
      http.post("/internal/quick-links/splunk/confirm", async ({ request }) => {
        confirmRequests.push(await request.json());
        return HttpResponse.json(confirmResponse);
      }),
      http.post("/internal/quick-links/splunk/launch", async ({ request }) => {
        launchRequests.push(await request.json());
        return HttpResponse.json(launchResponse);
      }),
    );

    renderQuickLinks();

    await user.click(await screen.findByRole("button", { name: /Claim 号日志检索/u }));
    await user.clear(screen.getByLabelText("Claim 号"));
    await user.type(screen.getByLabelText("Claim 号"), "CLM-2026-0007");
    await user.type(screen.getByLabelText("关键字"), "payment timeout");
    await user.click(screen.getByRole("button", { name: "生成启动确认" }));

    expect(await screen.findByRole("region", { name: "启动确认" })).toBeInTheDocument();
    expect(screen.getByText("Claim CLM-2026-0007 测试日志")).toBeInTheDocument();
    expect(screen.getByText("系统将打开 Splunk 页面；如果 Splunk 未登录，需要在 Splunk 页面完成登录。")).toBeInTheDocument();
    expect(screen.getByText("AUDIT_ALLOWED")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "打开 Splunk" }));

    await waitFor(() => expect(openSpy).toHaveBeenCalledWith(launchResponse.targetUrl, "_blank", "noopener,noreferrer"));
    expect(confirmRequests).toHaveLength(1);
    expect(confirmRequests[0]).toMatchObject({
      contractVersion: "1.0",
      templateId: "claim-by-claim-no-test",
      search: {
        claimNo: "CLM-2026-0007",
        claimEnvironment: "test",
        keyword: "payment timeout",
      },
    });
    expect(launchRequests).toHaveLength(1);
    expect(launchRequests[0]).toMatchObject({
      contractVersion: "1.0",
      launchRequestId: "launch-request-1",
      resolvedParameters: {
        claimNo: "CLM-2026-0007",
        claimEnvironment: "test",
      },
    });
    expect(screen.getByText("审计编号 audit-quick-link-1")).toBeInTheDocument();
  });

  test("shows server policy refusal for production templates", async () => {
    const user = userEvent.setup();
    server.use(
      http.get("/internal/quick-links/splunk/templates", () =>
        HttpResponse.json(templateCatalog),
      ),
      http.post("/internal/quick-links/splunk/confirm", () =>
        HttpResponse.json(
          { code: "POLICY_DENIED", message: "当前主体无权启动生产环境 Claim 日志模板。" },
          { status: 403 },
        ),
      ),
    );

    renderQuickLinks();

    await user.click(await screen.findByRole("button", { name: /生产 requestId 追踪/u }));
    await user.type(screen.getByLabelText("requestId"), "req-prod-7788");
    await user.click(screen.getByRole("button", { name: "生成启动确认" }));

    const alert = await screen.findByRole("alert", { name: "Splunk 启动被拒绝" });
    expect(within(alert).getByText("当前主体无权启动生产环境 Claim 日志模板。")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "打开 Splunk" })).not.toBeInTheDocument();
  });
});

const templateCatalog = {
  contractVersion: "1.0",
  templates: [
    {
      templateId: "claim-by-claim-no-test",
      adapterId: "splunk-claim",
      displayName: "Claim 号日志检索",
      description: "按 Claim 号查看测试环境 Claim 链路日志。",
      ownerTeam: "claim-platform",
      claimEnvironment: "test",
      requiredFields: ["claimNo", "claimEnvironment"],
      optionalFields: ["keyword", "serviceName", "logLevel", "timeRange"],
      userEditableFields: ["claimNo", "keyword", "timeRange", "logLevel"],
      defaultTimeRange: "last_30_minutes",
      defaultIndex: "claim-test",
      defaultSourceType: "claim:application",
      version: "1.0.0",
      status: "ACTIVE",
      favorite: true,
    },
    {
      templateId: "claim-prod-request-id",
      adapterId: "splunk-claim",
      displayName: "生产 requestId 追踪",
      description: "按 requestId 查看生产 Claim 请求链路。",
      ownerTeam: "claim-platform",
      claimEnvironment: "production",
      requiredFields: ["requestId", "claimEnvironment"],
      optionalFields: ["keyword", "serviceName", "timeRange"],
      userEditableFields: ["requestId", "keyword", "timeRange"],
      defaultTimeRange: "last_15_minutes",
      defaultIndex: "claim-prod",
      defaultSourceType: "claim:application",
      version: "1.0.0",
      status: "ACTIVE",
      favorite: false,
    },
  ],
  personalPresets: [
    {
      presetId: "preset-test-errors",
      templateId: "claim-by-claim-no-test",
      displayName: "测试错误日志",
      claimEnvironment: "test",
      serviceName: "claim-api",
      timeRange: "last_30_minutes",
      logLevel: "ERROR",
      keyword: "exception",
    },
  ],
  recentLaunches: [
    {
      launchId: "launch-prev-1",
      templateId: "claim-by-claim-no-test",
      templateName: "Claim 号日志检索",
      claimEnvironment: "test",
      parameterSummary: "claimNo=CLM-2026-0001",
      launchedAt: "2026-06-23T00:30:00Z",
      auditEventId: "audit-prev-1",
    },
  ],
};

const confirmResponse = {
  contractVersion: "1.0",
  launchRequestId: "launch-request-1",
  adapterSummary: {
    displayName: "Claim Splunk",
    targetType: "SPLUNK",
    authMode: "BROWSER_SESSION",
  },
  templateSummary: {
    templateId: "claim-by-claim-no-test",
    displayName: "Claim 号日志检索",
    version: "1.0.0",
    claimEnvironment: "test",
  },
  claimSearchSummary: {
    title: "Claim CLM-2026-0007 测试日志",
    lines: ["index=claim-test", "claimNo=CLM-2026-0007", "keyword=payment timeout"],
  },
  resolvedParameters: {
    claimNo: "CLM-2026-0007",
    claimEnvironment: "test",
    keyword: "payment timeout",
    timeRange: "last_30_minutes",
    logLevel: "ERROR",
  },
  editableFields: ["claimNo", "keyword", "timeRange", "logLevel"],
  missingFields: [],
  warnings: ["生产环境外的测试日志检索。"],
  auditSummary: {
    policyDecision: "AUDIT_ALLOWED",
    environment: "test",
    message: "将记录 Claim Splunk 快捷检索审计。",
  },
};

const launchResponse = {
  contractVersion: "1.0",
  launchId: "launch-quick-link-1",
  targetUrl:
    "https://splunk.example.internal/app/search/search?q=search%20index%3Dclaim-test%20CLM-2026-0007",
  targetUrlHash: "sha256:splunk-url",
  auditEventId: "audit-quick-link-1",
  expiresAt: "2026-06-23T01:00:00Z",
};
