import { readFileSync } from "node:fs";

import { http, HttpResponse } from "msw";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";

import App from "./App.jsx";
import { AppProviders } from "./providers.jsx";
import { server } from "../test/server.js";

const loginCss = readFileSync(
  "src/features/auth/LoginPage.module.css",
  "utf8",
);
const appShellCss = readFileSync(
  "src/components/layout/AppShell.module.css",
  "utf8",
);
const overviewCss = readFileSync(
  "src/features/overview/OverviewPage.module.css",
  "utf8",
);
const sqlWorkbenchCss = readFileSync(
  "src/features/sql-workbench/SqlWorkbenchPage.module.css",
  "utf8",
);
const skillRegistryCss = readFileSync(
  "src/features/skill-registry/SkillRegistryPage.module.css",
  "utf8",
);
const workspaceStatusBarCss = readFileSync(
  "src/components/layout/WorkspaceStatusBar.module.css",
  "utf8",
);
const agentWorkspaceCss = readFileSync(
  "src/features/agent-workspace/AgentWorkspacePage.module.css",
  "utf8",
);

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
  server.use(...defaultHandlers);
});

describe("operator console routes", () => {
  it("redirects anonymous users away from protected pages", async () => {
    server.use(
      http.get("/auth/session", () =>
        HttpResponse.json({
          authenticated: false,
          subject: null,
          username: null,
          roles: [],
          authenticationType: "anonymous",
        }),
      ),
    );

    renderAt("/agent");

    expect(await screen.findByRole("heading", { name: "用户登录" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Agent 工作区" })).not.toBeInTheDocument();
  });

  it("shows the operator navigation for protected pages", async () => {
    renderAt("/agent");

    expect(screen.getByRole("navigation", { name: "主导航" })).toBeVisible();
    expect(screen.getByRole("link", { name: "总览" })).toHaveAttribute("href", "/overview");
    expect(
      screen.getByRole("link", { name: "Agent 工作区" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Skill 注册中心" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "SQL 工作区" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "RAG 问答" })).toHaveAttribute(
      "href",
      "/rag",
    );
    expect(screen.getByRole("link", { name: "工作流事件" })).toHaveAttribute(
      "href",
      "/workflow-events",
    );
    expect(screen.getByRole("link", { name: "审计记录" })).toHaveAttribute(
      "href",
      "/audit",
    );
    expect(
      screen.getByRole("link", { name: "审计记录" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("会话列表")).toBeInTheDocument();
    expect(screen.getByText("会话上下文")).toBeInTheDocument();
  });

  it("navigates between implemented protected pages", async () => {
    const user = userEvent.setup();
    renderAt("/agent");

    await screen.findByText("会话列表");
    await user.click(screen.getByRole("link", { name: "SQL 工作区" }));

    expect(
      await screen.findByRole("heading", { name: "SQL 工作台" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "主导航" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("当前工作台")).toBeInTheDocument();
  });

  it.each([
    ["/agent", "Agent 工作区"],
    ["/overview", "平台总览"],
    ["/rag", "RAG 问答"],
    ["/workflow-events", "工作流事件"],
    ["/audit", "审计记录"],
    ["/skills", "Skill 注册中心"],
    ["/meeting-notes", "会议录制纪要"],
    ["/as400-ddl", "AS400改建表"],
    ["/quick-links", "快捷连接"],
    ["/sql", "SQL 工作台"],
  ])("renders shared navigation and status bar for %s", async (path, title) => {
    renderAt(path);

    expect(screen.getByRole("navigation", { name: "主导航" })).toBeVisible();
    expect(await screen.findByRole("heading", { name: title })).toBeInTheDocument();
    expect(screen.getByLabelText("当前工作台")).toBeInTheDocument();
  });

  it("renders the Skill registry inside the shared shell while replacing only the workspace body", async () => {
    renderAt("/skills");

    expect(screen.getByRole("navigation", { name: "主导航" })).toBeVisible();
    expect(await screen.findByRole("heading", { name: "Skill 注册中心" })).toBeInTheDocument();
    expect(screen.getByLabelText("当前工作台")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Skill 注册中心导航" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "内置 Skill" })).toBeInTheDocument();
  });

  it("renders the overview React page for the overview navigation view", async () => {
    renderAt("/overview");
    expect(await screen.findByRole("heading", { name: "平台总览" })).toBeInTheDocument();
    const availableEntries = screen.getByRole("region", { name: "可用工作入口" });
    const capabilityMap = screen.getByRole("region", { name: "后续能力地图" });
    const overviewGuide = screen.getByRole("region", { name: "怎么使用这个总览" });

    expect(
      screen.getByRole("heading", { name: "当前能用的功能" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "这里是总览页：先选择 Agent 或 SQL 工作区做只读排查；生产写入、脚本执行和绕过审批不会在这里开放。",
      ),
    ).toBeInTheDocument();
    expect(
      availableEntries,
    ).toBeInTheDocument();
    expect(overviewGuide).toBeInTheDocument();
    expect(within(overviewGuide).getByText("先选工作区")).toBeInTheDocument();
    expect(within(overviewGuide).getByText("只做诊断")).toBeInTheDocument();
    expect(within(overviewGuide).getByText("后续再接入")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "治理证据" })).not.toBeInTheDocument();
    expect(screen.queryByText("最近语义事件")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "只读诊断队列" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "运行信号" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "策略门禁矩阵" })).not.toBeInTheDocument();
    expect(screen.getByText("node-a 健康排查")).toBeInTheDocument();
    expect(screen.getByText("payment-api 依赖巡检")).toBeInTheDocument();
    expect(screen.getByText("订单库慢查询趋势")).toBeInTheDocument();
    expect(screen.queryByText("Skill 发布状态")).not.toBeInTheDocument();
    expect(screen.queryByText("SSE 事件通道")).not.toBeInTheDocument();
    expect(screen.queryByText("模型只提出计划")).not.toBeInTheDocument();
    expect(screen.queryByText("Worker 受限执行")).not.toBeInTheDocument();
    expect(screen.queryByText("WORKFLOW_STARTED")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "启动诊断" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "执行变更" })).not.toBeInTheDocument();
    expect(screen.queryByText("生产写入")).not.toBeInTheDocument();
    expect(within(availableEntries).getByRole("link", { name: /Agent 工作区/u })).toHaveAttribute("href", "/agent");
    expect(within(availableEntries).getByRole("link", { name: /SQL 工作区/u })).toHaveAttribute("href", "/sql");
    expect(within(capabilityMap).getByRole("link", { name: /RAG 问答/u })).toHaveAttribute("href", "/rag");
    expect(within(capabilityMap).getByRole("link", { name: /Skill 注册中心/u })).toHaveAttribute("href", "/skills");
    expect(within(capabilityMap).getByRole("link", { name: /会议录制纪要/u })).toHaveAttribute("href", "/meeting-notes");
    expect(within(capabilityMap).getByRole("link", { name: /AS400改建表/u })).toHaveAttribute("href", "/as400-ddl");
    expect(within(capabilityMap).getByText("快捷连接")).toBeInTheDocument();
    expect(within(capabilityMap).getByText("后续切片")).toBeInTheDocument();
    expect(within(capabilityMap).queryByRole("link", { name: /快捷连接/u })).not.toBeInTheDocument();
    expect(within(capabilityMap).getByRole("link", { name: /工作流事件/u })).toHaveAttribute("href", "/workflow-events");
    expect(within(capabilityMap).getByRole("link", { name: /审计记录/u })).toHaveAttribute("href", "/audit");
    expect(screen.queryByText("服务端策略决策")).not.toBeInTheDocument();
    expect(screen.queryByText("工作流事实源")).not.toBeInTheDocument();
    expect(screen.queryByText("审计证据链")).not.toBeInTheDocument();
    expect(screen.queryByText("工作会话")).not.toBeInTheDocument();
  });

  it("renders the RAG question page from the prototype without enabling out-of-scope actions", async () => {
    renderAt("/rag");

    expect(await screen.findByRole("heading", { name: "RAG 问答" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "RAG 问答窗口" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "知识库问答" })).toBeInTheDocument();
    expect(
      screen.getByText("payment-api 最近 7 天错误率升高时，应该先查哪些 Runbook 和历史工单？"),
    ).toBeInTheDocument();
    expect(screen.getByText("引用已开启")).toBeInTheDocument();
    expect(screen.getByText("Runbook / 运维手册")).toBeInTheDocument();
    expect(screen.getByText("故障复盘 / 工单")).toBeInTheDocument();
    expect(screen.getByText("ADR / 架构决策")).toBeInTheDocument();
    expect(screen.getByText("发布记录 / 变更说明")).toBeInTheDocument();
    expect(screen.getByText("最高相似度")).toBeInTheDocument();
    expect(screen.getByText("0.86")).toBeInTheDocument();
    expect(screen.getByText("无引用回答")).toBeInTheDocument();
    expect(screen.getByText("禁止")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "提交 RAG 问题" })).toBeDisabled();
    expect(screen.queryByText("带引用的只读知识问答")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("RAG 检索状态")).not.toBeInTheDocument();
    expect(screen.queryByText("当前页面只展示 P1 只读范围内的占位入口，后续任务再接入真实接口。")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "执行生产写操作" })).not.toBeInTheDocument();
  });

  it("renders the workflow events workspace from the prototype while keeping the shared shell", async () => {
    renderAt("/workflow-events");

    expect(screen.getByRole("navigation", { name: "主导航" })).toBeVisible();
    expect(await screen.findByRole("heading", { name: "工作流事件" })).toBeInTheDocument();
    expect(screen.getByLabelText("当前工作台")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "语义事件流" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "恢复检查" })).toBeInTheDocument();
    expect(screen.getByRole("search", { name: "工作流事件筛选" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "事件流主轴" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "状态快照" })).toBeInTheDocument();
    expect(screen.getByText("13 条事件 / 0 gap")).toBeInTheDocument();
    expect(screen.getByText("WORKFLOW_STARTED")).toBeInTheDocument();
    expect(screen.getByText("POLICY_EVALUATED")).toBeInTheDocument();
    expect(screen.getByText("SKILL_ROUTED")).toBeInTheDocument();
    expect(screen.getByText("WORKER_ACCEPTED")).toBeInTheDocument();
    expect(screen.getByText("WORKFLOW_COMPLETED")).toBeInTheDocument();
    expect(screen.getByText("connected / lastEventId=005")).toBeInTheDocument();
    expect(screen.getByText("policy-v1 / READ_ONLY")).toBeInTheDocument();
    expect(
      screen.queryByText("当前页面只展示 P1 只读范围内的占位入口，后续任务再接入真实接口。"),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "回放事件" })).not.toBeInTheDocument();
  });

  it("renders the audit records workspace from the prototype while keeping the shared shell", async () => {
    renderAt("/audit");

    expect(screen.getByRole("navigation", { name: "主导航" })).toBeVisible();
    expect(await screen.findByRole("heading", { name: "审计记录" })).toBeInTheDocument();
    expect(screen.getByLabelText("当前工作台")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "审计记录工作区" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "审计证据链" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "完整性校验" })).toBeInTheDocument();
    expect(screen.getByRole("search", { name: "审计记录筛选" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "审计账本" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "证据详情" })).toBeInTheDocument();
    expect(screen.getByText("SESSION_AUTHORIZED")).toBeInTheDocument();
    expect(screen.getByText("POLICY_EVALUATED")).toBeInTheDocument();
    expect(screen.getByText("AUDIT_SEALED")).toBeInTheDocument();
    expect(screen.getByText("sha256:e91b")).toBeInTheDocument();
    expect(screen.queryByText("当前页面只展示 P1 只读范围内的占位入口，后续任务再接入真实接口。")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "执行写操作" })).not.toBeInTheDocument();
  });

  it("uses the main branch capsule status bar on the overview page", async () => {
    const appCapsuleRule =
      workspaceStatusBarCss.match(/[.]appCapsule\s*[{][^}]+[}]/u)?.[0] ?? "";
    const capsuleHeadingRule =
      workspaceStatusBarCss.match(/[.]capsuleHeading\s*[{][^}]+[}]/u)?.[0] ?? "";
    const operatorDockRule =
      workspaceStatusBarCss.match(/[.]appCapsule [.]operatorDock\s*[{][^}]+[}]/u)?.[0] ?? "";
    const sharedBrandLockupRule =
      workspaceStatusBarCss.match(/[.]brandLockup\s*[{][^}]+[}]/u)?.[0] ?? "";
    const sharedBrandNameRule =
      workspaceStatusBarCss.match(/[.]brandName\s*[{][^}]+[}]/u)?.[0] ?? "";
    const sharedBrandNameBeforeRule =
      workspaceStatusBarCss.match(/[.]brandName::before\s*[{][^}]+[}]/u)?.[0] ?? "";
    const sharedBrandNameAfterRule =
      workspaceStatusBarCss.match(/[.]brandName::after\s*[{][^}]+[}]/u)?.[0] ?? "";
    const sharedBrandPillRule =
      workspaceStatusBarCss.match(/[.]brandName strong\s*[{][^}]+[}]/u)?.[0] ?? "";
    const sharedOperatorDockRule =
      workspaceStatusBarCss.match(/[.]operatorDock\s*[{][^}]+[}]/u)?.[0] ?? "";
    const sharedOperatorProfileRule =
      workspaceStatusBarCss.match(/[.]operatorProfile\s*[{][^}]+[}]/u)?.[0] ?? "";
    const sharedOperatorAvatarRule =
      workspaceStatusBarCss.match(/[.]operatorAvatar\s*[{][^}]+[}]/u)?.[0] ?? "";
    const sharedOperatorIdentityRule =
      workspaceStatusBarCss.match(/[.]operatorIdentity\s*[{][^}]+[}]/u)?.[0] ?? "";
    const sharedWorkdayCountdownRule =
      workspaceStatusBarCss.match(/[.]workdayCountdown\s*[{][^}]+[}]/u)?.[0] ?? "";
    const sharedCountdownGlyphRule =
      workspaceStatusBarCss.match(/[.]countdownGlyph\s*[{][^}]+[}]/u)?.[0] ?? "";
    const sharedLogoutButtonRule =
      workspaceStatusBarCss.match(/[.]logoutButton\s*[{][^}]+[}]/u)?.[0] ?? "";
    const sharedLogoutIconBadgeRule =
      workspaceStatusBarCss.match(/[.]logoutIconBadge\s*[{][^}]+[}]/u)?.[0] ?? "";
    const agentBrandLockupRule =
      agentWorkspaceCss.match(/[.]brandLockup\s*[{][^}]+[}]/u)?.[0] ?? "";
    const agentBrandNameRule =
      agentWorkspaceCss.match(/[.]brandName\s*[{][^}]+[}]/u)?.[0] ?? "";
    const agentBrandNameBeforeRule =
      agentWorkspaceCss.match(/[.]brandName::before\s*[{][^}]+[}]/u)?.[0] ?? "";
    const agentBrandNameAfterRule =
      agentWorkspaceCss.match(/[.]brandName::after\s*[{][^}]+[}]/u)?.[0] ?? "";
    const agentBrandPillRule =
      agentWorkspaceCss.match(/[.]brandName strong\s*[{][^}]+[}]/u)?.[0] ?? "";
    const agentOperatorDockRule =
      agentWorkspaceCss.match(/[.]operatorDock\s*[{][^}]+[}]/u)?.[0] ?? "";
    const agentOperatorAvatarRule =
      agentWorkspaceCss.match(/[.]operatorAvatar\s*[{][^}]+[}]/u)?.[0] ?? "";
    const agentOperatorIdentityRule =
      agentWorkspaceCss.match(/[.]operatorIdentity\s*[{][^}]+[}]/u)?.[0] ?? "";
    const agentWorkdayCountdownRule =
      agentWorkspaceCss.match(/[.]workdayCountdown\s*[{][^}]+[}]/u)?.[0] ?? "";
    const agentCountdownGlyphRule =
      agentWorkspaceCss.match(/[.]countdownGlyph\s*[{][^}]+[}]/u)?.[0] ?? "";
    const agentLogoutButtonRule =
      agentWorkspaceCss.match(/[.]logoutButton\s*[{][^}]+[}]/u)?.[0] ?? "";
    const agentLogoutIconBadgeRule =
      agentWorkspaceCss.match(/[.]logoutIconBadge\s*[{][^}]+[}]/u)?.[0] ?? "";

    renderAt("/overview");

    expect(await screen.findByRole("heading", { name: "平台总览" })).toBeInTheDocument();
    expect(screen.queryByText("READ_ONLY")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "启动诊断" })).not.toBeInTheDocument();
    expect(appCapsuleRule).toContain("height: 76px");
    expect(appCapsuleRule).toContain("border: 1px solid rgba(166, 64, 92, 0.26)");
    expect(capsuleHeadingRule).toContain("color: color-mix(in srgb, var(--agent-blue) 52%, var(--agent-ink))");
    expect(operatorDockRule).toContain("grid-template-columns: 176px 120px 84px");
    expect(sharedBrandLockupRule).toBe(agentBrandLockupRule);
    expect(sharedBrandNameRule).toBe(agentBrandNameRule);
    expect(sharedBrandNameBeforeRule).toBe(agentBrandNameBeforeRule);
    expect(sharedBrandNameAfterRule).toBe(agentBrandNameAfterRule);
    expect(sharedBrandPillRule).toBe(agentBrandPillRule);
    expect(sharedOperatorDockRule).toBe(agentOperatorDockRule);
    expect(sharedOperatorProfileRule).toContain("width: 176px");
    expect(sharedOperatorProfileRule).toContain("min-width: 0");
    expect(sharedOperatorAvatarRule).toBe(agentOperatorAvatarRule);
    expect(sharedOperatorIdentityRule).toBe(agentOperatorIdentityRule);
    expect(sharedWorkdayCountdownRule).toBe(agentWorkdayCountdownRule);
    expect(sharedCountdownGlyphRule).toBe(agentCountdownGlyphRule);
    expect(sharedLogoutButtonRule).toBe(agentLogoutButtonRule);
    expect(sharedLogoutIconBadgeRule).toBe(agentLogoutIconBadgeRule);
  });

  it("redirects the legacy agent overview query to the top-level overview route", async () => {
    renderAt("/agent?view=overview");

    expect(
      await screen.findByRole("heading", { name: "平台总览" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("工作会话")).not.toBeInTheDocument();
  });

  it.each([
    ["/agent?view=rag", "RAG 问答"],
    ["/agent?view=workflow", "工作流事件"],
    ["/agent?view=audit", "审计记录"],
  ])("redirects legacy agent query route %s to its menu page", async (path, title) => {
    renderAt(path);

    expect(await screen.findByRole("heading", { name: title })).toBeInTheDocument();
    expect(screen.getByLabelText("当前工作台")).toBeInTheDocument();
    expect(screen.queryByText("工作会话")).not.toBeInTheDocument();
  });

  it("uses the Agent workspace shell rhythm for every menu page", () => {
    const workspaceFrameCss = readFileSync(
      "src/components/layout/WorkspacePageFrame.module.css",
      "utf8",
    );
    const appContentRule = appShellCss.match(/[.]content\s*[{][^}]+[}]/u)?.[0] ?? "";
    const activeNavRule = appShellCss.match(/[.]active\s*[{][^}]+[}]/u)?.[0] ?? "";
    const frameRule = workspaceFrameCss.match(/[.]workspaceFrame\s*[{][^}]+[}]/u)?.[0] ?? "";
    const overviewSource = readFileSync("src/features/overview/OverviewPage.jsx", "utf8");
    const sqlSource = readFileSync("src/features/sql-workbench/SqlWorkbenchPage.jsx", "utf8");
    const skillSource = readFileSync("src/features/skill-registry/SkillRegistryPage.jsx", "utf8");
    const routerSource = readFileSync("src/app/router.jsx", "utf8");

    expect(appContentRule).toContain("max-width: none");
    expect(appContentRule).not.toContain("max-width: var(--content-max)");
    expect(activeNavRule).toContain("--nav-color: var(--color-info)");
    expect(activeNavRule).toContain("--nav-mark: #207fa4");
    expect(activeNavRule).toContain("--nav-icon-radius: 13px");
    expect(activeNavRule).toContain("--nav-symbol-radius: 9px");
    expect(activeNavRule).toContain("--nav-detail-radius: 5px");
    expect(frameRule).toContain("--workspace-layout-gap: 24px");
    expect(frameRule).toContain("--workspace-sidebar-width: 250px");
    expect(frameRule).toContain("width: calc(100vw - var(--workspace-canvas-left) - var(--workspace-layout-gap))");
    expect(frameRule).toContain("min-height: calc(100vh - 48px)");
    expect(frameRule).toContain("gap: var(--workspace-layout-gap)");
    expect(frameRule).toContain("padding: 12px");
    expect(frameRule).toContain("border: 1px solid rgba(166, 64, 92, 0.18)");
    expect(frameRule).toContain("border-radius: 24px");
    expect(frameRule).toContain("0 18px 56px rgba(31, 41, 51, 0.055)");
    expect(overviewSource).toContain("WorkspacePageFrame");
    expect(sqlSource).toContain("WorkspacePageFrame");
    expect(skillSource).toContain("WorkspacePageFrame");
    expect(routerSource).toContain("WorkspacePageFrame");
  });

  it("keeps overview, SQL, and Skill inner grid gaps aligned to Agent workspace", () => {
    const canvasRule = overviewCss.match(/[.]overviewCanvas\s*[{][^}]+[}]/u)?.[0] ?? "";
    const overviewGridRule =
      overviewCss.match(/[.]overviewGrid\s*[{][^}]+[}]/u)?.[0] ?? "";
    const statusStripRule =
      overviewCss.match(/[.]statusStrip\s*[{][^}]+[}]/u)?.[0] ?? "";
    const entryGridRule =
      overviewCss.match(/[.]entryGrid\s*[{][^}]+[}]/u)?.[0] ?? "";
    const queueGridRule =
      overviewCss.match(/[.]queueGrid\s*[{][^}]+[}]/u)?.[0] ?? "";
    const guideListRule =
      overviewCss.match(/[.]guideList\s*[{][^}]+[}]/u)?.[0] ?? "";
    const capabilityMapRule =
      overviewCss.match(/[.]capabilityMap\s*[{][^}]+[}]/u)?.[0] ?? "";
    const capabilityRowRule =
      overviewCss.match(/[.]capabilityRow\s*[{][^}]+[}]/u)?.[0] ?? "";
    const sqlCanvasRule = sqlWorkbenchCss.match(/[.]sqlCanvas\s*[{][^}]+[}]/u)?.[0] ?? "";
    const workbenchGridRule =
      sqlWorkbenchCss.match(/[.]workbenchGrid\s*[{][^}]+[}]/u)?.[0] ?? "";

    expect(canvasRule).toContain("grid-template-rows: auto minmax(0, 1fr)");
    expect(overviewGridRule).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(overviewGridRule).toContain("gap: var(--workspace-layout-gap)");
    expect(statusStripRule).toContain("grid-template-columns: repeat(4, minmax(0, 1fr))");
    expect(statusStripRule).toContain("gap: 10px");
    expect(guideListRule).toContain("grid-template-columns: repeat(3, minmax(0, 1fr))");
    expect(entryGridRule).toContain("grid-template-columns: repeat(2, minmax(0, 1fr))");
    expect(entryGridRule).toContain("gap: 14px");
    expect(queueGridRule).toContain("grid-template-columns: repeat(3, minmax(0, 1fr))");
    expect(queueGridRule).toContain("gap: 10px");
    expect(overviewCss).not.toContain(".signalGrid");
    expect(overviewCss).not.toContain(".policyMatrix");
    expect(overviewCss).not.toContain(".evidenceRail");
    expect(overviewCss).not.toContain(".eventTimeline");
    expect(capabilityMapRule).toContain("grid-template-columns: repeat(2, minmax(0, 1fr))");
    expect(capabilityMapRule).toContain("gap: 10px");
    expect(capabilityRowRule).toContain("grid-template-columns: 36px minmax(0, 1fr) auto");
    expect(sqlCanvasRule).toContain("grid-template-rows: auto minmax(0, 1fr)");
    expect(workbenchGridRule).toContain("gap: var(--workspace-layout-gap)");
    expect(skillRegistryCss).toContain(".registryCanvas");
    expect(skillRegistryCss).toContain(".registryTable");
  });

  it("redirects the root route to login", () => {
    renderAt("/");

    expect(
      screen.getByRole("heading", { name: "企业智能运维工作台" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "用户登录" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "登录" })).toBeInTheDocument();
  });

  it("renders the prototype login entry without enabling out-of-scope actions", () => {
    renderAt("/login");

    expect(screen.getByText("SECURE OPERATOR ENTRY")).toBeInTheDocument();
    expect(screen.getByText("受控诊断链路")).toBeInTheDocument();
    expect(screen.queryByText("内建身份登录")).not.toBeInTheDocument();
    expect(
      screen.queryByText("身份确认后，权限仍由服务端策略独立判定。"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("执行 SQL")).not.toBeInTheDocument();
    expect(screen.queryByText("Commit")).not.toBeInTheDocument();
    expect(screen.queryByText("Rollback")).not.toBeInTheDocument();
  });

  it("allows the operator account to be edited before password login", async () => {
    const user = userEvent.setup();
    renderAt("/login");

    const accountInput = screen.getByLabelText("用户名");

    await user.clear(accountInput);
    await user.type(accountInput, "ops.admin@company.internal");

    expect(accountInput).toHaveValue("ops.admin@company.internal");
  });

  it("renders one ion from each node with the skill ion emphasized", () => {
    const { container } = renderAt("/login");

    const ions = Array.from(container.querySelectorAll("[data-node-ion]"));
    const routes = new Set(ions.map((ion) => ion.getAttribute("data-node-ion")));

    expect(ions).toHaveLength(4);
    expect(routes).toEqual(new Set(["identity", "policy", "skill", "worker"]));
    expect(container.querySelector('[data-node-ion="skill"]')).toHaveAttribute(
      "data-ion-emphasis",
      "primary",
    );
    expect(ions.every((ion) => ion.getAttribute("aria-hidden") === "true")).toBe(
      true,
    );
  });

  it("renders a restrained screen-wide ion field", () => {
    const { container } = renderAt("/login");

    const screenIons = Array.from(container.querySelectorAll("[data-screen-ion]"));

    expect(screenIons.length).toBeGreaterThanOrEqual(10);
    expect(container.querySelector("[data-screen-comet]")).not.toBeInTheDocument();
    expect(screenIons.every((ion) => ion.getAttribute("aria-hidden") === "true")).toBe(
      true,
    );
  });

  it("adds a lightweight frame without changing the existing login card layout", () => {
    const screenRule = loginCss.match(/[.]screen\s*[{][^}]+[}]/u)?.[0] ?? "";
    const screenBackdropRule =
      loginCss.match(/[.]screen::after\s*[{][^}]+[}]/u)?.[0] ?? "";
    const loginHeroEffectRule =
      loginCss.match(/[.]loginHeroEffect\s*[{][^}]+[}]/u)?.[0] ?? "";
    const taskCardRule = loginCss.match(/[.]taskCard\s*[{][^}]+[}]/u)?.[0] ?? "";
    const capabilityFlowRule =
      loginCss.match(/[.]capabilityFlow\s*[{][^}]+[}]/u)?.[0] ?? "";
    const loginShellRule =
      loginCss.match(/[.]loginShell\s*[{][^}]+[}]/u)?.[0] ?? "";
    const loginShellFrameRule =
      loginCss.match(/[.]loginShell::before\s*[{][^}]+[}]/u)?.[0] ?? "";
    const loginModeStripRule =
      loginCss.match(/[.]loginModeStrip\s*[{][^}]+[}]/u)?.[0] ?? "";
    const loginShellHaloRule =
      loginCss.match(/[.]loginShell::after\s*[{][^}]+[}]/u)?.[0] ?? "";
    const frameActiveTrackRule = loginCss.match(/[.]frameActiveTrack\b/u)?.[0] ?? "";
    const frameIonTailRule =
      Array.from(loginCss.matchAll(/[.]frameIonTail\s*[{][^}]+[}]/gu))
        .map((match) => match[0])
        .find((rule) => rule.includes("width: 72px")) ?? "";
    const loginCardRule = loginCss.match(/[.]loginCard\s*[{][^}]+[}]/u)?.[0] ?? "";

    expect(loginShellRule).toContain("isolation: isolate");
    expect(loginShellRule).toContain("grid-template-columns: 720px 560px");
    expect(loginShellRule).toContain("align-items: start");
    expect(loginShellRule).toContain("padding: 90px 40px 86px");
    expect(screenRule).toContain("--login-frame-height: min(720px, calc(100vh - 132px))");
    expect(screenRule).toContain(
      "--login-frame-y: calc((100vh - var(--login-frame-height)) / 2 - var(--login-frame-top))",
    );
    expect(loginShellRule).toContain("transform: translate(-50%, var(--login-frame-y))");
    expect(loginHeroEffectRule).toContain(
      "top: calc(var(--login-frame-y) + var(--login-frame-top) - 2px)",
    );
    expect(loginHeroEffectRule).toContain("right: max(24px, calc(50% - 646px))");
    expect(loginHeroEffectRule).toContain("transform: translateY(5px)");
    expect(taskCardRule).toContain("left: 320px");
    expect(taskCardRule).toContain("width: 176px");
    expect(capabilityFlowRule).toContain("right: 51px");
    expect(capabilityFlowRule).toContain("left: 73px");
    expect(loginModeStripRule).toContain("transform: translateY(0)");
    expect(loginShellRule).toContain("--frame-height: var(--login-frame-height)");
    expect(loginShellFrameRule).toContain(
      "inset: var(--frame-top) var(--frame-inset-x) auto",
    );
    expect(loginShellFrameRule).toContain("height: var(--frame-height)");
    expect(loginShellFrameRule).toContain("border: 1px solid rgba(166, 64, 92, 0.26)");
    expect(loginShellFrameRule).toContain("background: transparent");
    expect(loginShellFrameRule).toContain("0 18px 56px rgba(31, 41, 51, 0.055)");
    expect(loginShellFrameRule).toContain("inset 0 1px 0 rgba(255, 255, 255, 0.7)");
    expect(loginShellFrameRule).not.toContain("no-repeat");
    expect(loginShellFrameRule).not.toContain("outline:");
    expect(loginShellFrameRule).not.toContain("mask-composite");
    expect(loginShellFrameRule).toContain("border-radius: 22px");
    expect(loginShellHaloRule).toContain("animation: frame-ion-track 16s linear infinite");
    expect(loginShellHaloRule).toContain("width: 22px");
    expect(loginShellHaloRule).toContain("conic-gradient");
    expect(loginShellHaloRule).toContain("rgba(34, 126, 166, 0.72)");
    expect(loginShellHaloRule).toContain("rgba(31, 154, 108, 0.62)");
    expect(loginShellHaloRule).not.toContain("filter: blur");
    expect(loginShellHaloRule).not.toContain("mask-composite");
    expect(frameActiveTrackRule).toBe("");
    expect(loginCss).not.toContain("frame-active-track");
    expect(frameIonTailRule).toContain("width: 72px");
    expect(frameIonTailRule).toContain("transform-origin: right center");
    expect(frameIonTailRule).toContain("animation: frame-ion-tail 16s linear infinite");
    expect(screenBackdropRule).toContain("radial-gradient");
    expect(screenBackdropRule).toContain("linear-gradient(180deg");
    expect(loginCardRule).toContain("align-self: start");
    expect(loginCardRule).toContain("transform: translateY(2px)");
  });
});

const registeredSkill = {
  descriptor: {
    skillId: "node-health-read",
    version: "1.1.0",
    displayName: "节点健康检查",
    description: "读取节点 CPU、内存和磁盘健康指标。",
    category: "INFRASTRUCTURE_DIAGNOSTICS",
    riskLevel: "READ_ONLY",
    executor: "HTTP",
    outputType: "JSON",
    readOnly: true,
    timeoutSeconds: 30,
    owner: "platform-observability",
    requiredRoles: ["ROLE_agent-reader"],
    tags: ["health", "node"],
    interceptors: ["AUTHORIZATION", "AUDIT"],
    parameters: [
      {
        name: "nodeName",
        displayName: "节点名称",
        description: "受控开发环境节点名。",
        type: "STRING",
        required: true,
        allowedValues: [],
        defaultValue: null,
      },
    ],
  },
  publication: {
    publishedBy: "platform-observability",
    publishedAt: "2026-06-14T00:00:00Z",
    checksumSha256: "a".repeat(64),
    signatureAlgorithm: "HmacSHA256",
    signature: "signed",
  },
  publicationStatus: "VALIDATED",
  manifestPath: "node-health/manifest.json",
};

const defaultHandlers = [
  http.get("/auth/session", () =>
    HttpResponse.json({
      authenticated: true,
      subject: "operator-1",
      username: "ops.reader",
      roles: ["ROLE_agent-reader"],
      authenticationType: "built-in",
    }),
  ),
  http.post("/logout", () => new HttpResponse(null, { status: 204 })),
  http.get("/internal/sql-workbench/connections", () =>
    HttpResponse.json(sqlConnections),
  ),
  http.get("/internal/skills", () =>
    HttpResponse.json({
      skills: [registeredSkill],
    }),
  ),
  http.post("/internal/routing/skills/search", () =>
    HttpResponse.json({
      total: 1,
      candidates: [
        {
          skill: registeredSkill,
          releaseSnapshot: {
            skillId: "node-health-read",
            version: "1.1.0",
            stage: "GENERAL_AVAILABLE",
            rolloutPercentage: 100,
            targetContextTags: ["p1", "read-only"],
            reason: "P1 read-only diagnostic baseline",
            updatedAt: "2026-06-14T00:00:00Z",
          },
          score: 98,
          matchedRules: ["risk:READ_ONLY", "publication:VALIDATED", "role:agent-reader"],
        },
      ],
    }),
  ),
];

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
];
