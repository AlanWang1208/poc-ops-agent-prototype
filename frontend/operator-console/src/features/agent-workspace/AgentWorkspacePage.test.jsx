import { readFileSync } from "node:fs";

import { http, HttpResponse } from "msw";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { AppProviders } from "../../app/providers.jsx";
import { server } from "../../test/server.js";
import { AgentWorkspacePage } from "./AgentWorkspacePage.jsx";

const agentWorkspaceCss = readFileSync(
  "src/features/agent-workspace/AgentWorkspacePage.module.css",
  "utf8",
);
const workspaceStatusBarCss = readFileSync(
  "src/components/layout/WorkspaceStatusBar.module.css",
  "utf8",
);
const agentWorkspaceSource = readFileSync(
  "src/features/agent-workspace/AgentWorkspacePage.jsx",
  "utf8",
);

/** @type {unknown[]} */
let diagnosticRequests = [];

beforeEach(() => {
  diagnosticRequests = [];
  server.use(...defaultHandlers);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function renderPage() {
  return render(
    <AppProviders>
      <AgentWorkspacePage />
    </AppProviders>,
  );
}

describe("AgentWorkspacePage", () => {
  test("uses the shared workspace status bar instead of a local capsule implementation", () => {
    expect(agentWorkspaceSource).toContain("WorkspaceStatusBar");
    expect(agentWorkspaceSource).toContain('<WorkspaceStatusBar title="Agent 工作区" />');
    expect(agentWorkspaceSource).not.toContain("function TopCapsule");
    expect(agentWorkspaceSource).not.toContain("function OperatorDock");
    expect(agentWorkspaceSource).not.toContain("function WorkdayCountdown");
    expect(agentWorkspaceSource).not.toContain("getBrowserSession");
    expect(agentWorkspaceSource).not.toContain("logoutMutation");
  });

  test("renders the read-only workspace from real routing candidates", async () => {
    renderPage();

    expect(await screen.findByText("工作会话")).toBeInTheDocument();
    expect(await screen.findByText("ops.reader")).toBeInTheDocument();
    expect(screen.getByText("ID operator-1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "登出当前账号" })).toBeEnabled();
    expect(await screen.findByText(/node-health-read/u)).toBeInTheDocument();
    expect(screen.getByText("ROLE_agent-reader · policy-v1 · READ_ONLY")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "发送任务" })).toBeEnabled();
    expect(screen.queryByText("任务会话")).not.toBeInTheDocument();
    expect(screen.queryByText("只读模式")).not.toBeInTheDocument();
    expect(screen.queryByText("模型内部推理")).not.toBeInTheDocument();
  });

  test("streams a read-only node health diagnostic workflow from the control plane", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000001");
    const user = userEvent.setup();

    renderPage();

    expect(await screen.findByText(/node-health-read/u)).toBeInTheDocument();
    const sendButton = screen.getByRole("button", { name: "发送任务" });
    await waitFor(() => expect(sendButton).toBeEnabled());
    await user.click(sendButton);

    const currentWorkflowCard = await screen.findByLabelText("当前诊断工作流");
    expect(within(currentWorkflowCard).getByText("WORKFLOW_STARTED")).toBeInTheDocument();
    expect(within(currentWorkflowCard).getByText("SKILL_ROUTED")).toBeInTheDocument();
    expect(within(currentWorkflowCard).getByText("WORKER_ACCEPTED")).toBeInTheDocument();
    expect(within(currentWorkflowCard).getByText("WORKFLOW_COMPLETED")).toBeInTheDocument();
    expect(await screen.findByText("CPU 18%")).toBeInTheDocument();
    expect(await screen.findByText("内存 42%")).toBeInTheDocument();
    expect(await screen.findByText("磁盘 37%")).toBeInTheDocument();
    expect(await screen.findByText("HEALTHY")).toBeInTheDocument();
    expect(diagnosticRequests).toEqual([
      {
        skillId: "node-health-read",
        targetEnvironment: "development",
        idempotencyKey:
          "agent-workspace-node-health-00000000-0000-4000-8000-000000000001",
        parameters: { nodeName: "node-a" },
      },
    ]);
  });

  test("keeps completed diagnostics terminal when replayed lower sequence events arrive later", async () => {
    server.use(
      http.post("/internal/diagnostics/read-only/events", async ({ request }) => {
        diagnosticRequests.push(await request.json());

        return HttpResponse.text(
          sseFromEvents([readOnlyDiagnosticEvents[3], readOnlyDiagnosticEvents[0]]),
          {
            headers: { "Content-Type": "text/event-stream" },
          },
        );
      }),
    );
    const user = userEvent.setup();

    renderPage();

    expect(await screen.findByText(/node-health-read/u)).toBeInTheDocument();
    const sendButton = screen.getByRole("button", { name: "发送任务" });
    await waitFor(() => expect(sendButton).toBeEnabled());
    await user.click(sendButton);

    const currentWorkflowCard = await screen.findByLabelText("当前诊断工作流");
    expect(within(currentWorkflowCard).getByText("已完成")).toBeInTheDocument();
    expect(within(currentWorkflowCard).queryByText("执行中")).not.toBeInTheDocument();
    expect(within(currentWorkflowCard).getByText("CPU 18%")).toBeInTheDocument();
    expect(within(currentWorkflowCard).getByText("HEALTHY")).toBeInTheDocument();
  });

  test("shows policy denial from the diagnostic event endpoint", async () => {
    server.use(
      http.post("/internal/diagnostics/read-only/events", () =>
        HttpResponse.json(
          { code: "POLICY_DENIED", message: "role is not sufficient" },
          { status: 403 },
        ),
      ),
    );
    const user = userEvent.setup();

    renderPage();

    expect(await screen.findByText(/node-health-read/u)).toBeInTheDocument();
    const sendButton = screen.getByRole("button", { name: "发送任务" });
    await waitFor(() => expect(sendButton).toBeEnabled());
    await user.click(sendButton);

    const currentWorkflowCard = await screen.findByLabelText("当前诊断工作流");
    expect(within(currentWorkflowCard).getByText("已拒绝")).toBeInTheDocument();
    expect(within(currentWorkflowCard).getByText("POLICY_DENIED")).toBeInTheDocument();
    expect(within(currentWorkflowCard).getByText("role is not sufficient")).toBeInTheDocument();
  });

  test("renders workflow failure returned by the read-only diagnostic stream", async () => {
    server.use(
      http.post("/internal/diagnostics/read-only/events", () =>
        HttpResponse.text(sseFromEvents([readOnlyDiagnosticEvents[0], workflowFailedEvent]), {
          headers: { "Content-Type": "text/event-stream" },
        }),
      ),
    );
    const user = userEvent.setup();

    renderPage();

    expect(await screen.findByText(/node-health-read/u)).toBeInTheDocument();
    const sendButton = screen.getByRole("button", { name: "发送任务" });
    await waitFor(() => expect(sendButton).toBeEnabled());
    await user.click(sendButton);

    const currentWorkflowCard = await screen.findByLabelText("当前诊断工作流");
    expect(within(currentWorkflowCard).getByText("WORKFLOW_FAILED")).toBeInTheDocument();
    expect(within(currentWorkflowCard).getByText("失败")).toBeInTheDocument();
    expect(within(currentWorkflowCard).getByText("INVALID_PARAMETERS")).toBeInTheDocument();
    expect(within(currentWorkflowCard).getByText("nodeName is required")).toBeInTheDocument();
  });

  test("shows contract error when completed node health output is invalid", async () => {
    const invalidCompletedEvent = {
      ...readOnlyDiagnosticEvents[3],
      payload: {
        payloadType: "WORKFLOW_COMPLETED",
        outputSchemaId: "node-health-output-v1",
        output: { nodeName: "node-a", status: "HEALTHY" },
      },
    };
    server.use(
      http.post("/internal/diagnostics/read-only/events", () =>
        HttpResponse.text(sseFromEvents([readOnlyDiagnosticEvents[0], invalidCompletedEvent]), {
          headers: { "Content-Type": "text/event-stream" },
        }),
      ),
    );
    const user = userEvent.setup();

    renderPage();

    expect(await screen.findByText(/node-health-read/u)).toBeInTheDocument();
    const sendButton = screen.getByRole("button", { name: "发送任务" });
    await waitFor(() => expect(sendButton).toBeEnabled());
    await user.click(sendButton);

    const currentWorkflowCard = await screen.findByLabelText("当前诊断工作流");
    expect(within(currentWorkflowCard).getByText("契约错误")).toBeInTheDocument();
    expect(
      within(currentWorkflowCard).getByText("NODE_HEALTH_OUTPUT_CONTRACT_MISMATCH"),
    ).toBeInTheDocument();
    expect(
      within(currentWorkflowCard).getByText(
        "Node health output did not match the expected contract",
      ),
    ).toBeInTheDocument();
  });

  test("renders refined message role avatars", async () => {
    const { container } = renderPage();

    expect(await screen.findByText("ops.reader")).toBeInTheDocument();
    expect(container.querySelectorAll('[class*="messageRoleIcon"] svg')).toHaveLength(2);
  });

  test("renders the workday countdown as a compact creative timer", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-16T19:00:00+08:00"));

    renderPage();

    const workdayCountdown = screen.getByRole("timer", { name: "下班倒计时：00:00:00" });

    expect(screen.queryByRole("img", { name: "下班倒计时创意头像" })).not.toBeInTheDocument();
    expect(workdayCountdown).toHaveAttribute("data-creative-timer", "workday-countdown");
    expect(workdayCountdown).toHaveTextContent("下班倒计时");
    expect(workdayCountdown).toHaveTextContent("00:00:00");
    expect(workdayCountdown.children).toHaveLength(2);
    expect(workspaceStatusBarCss).toContain(".workdayCountdown");
    expect(workspaceStatusBarCss).toContain(".countdownGlyph");
    expect(workspaceStatusBarCss).not.toContain(".countdownTrack");
    expect(workspaceStatusBarCss).not.toContain(".workdayCountdown::before");
    expect(workspaceStatusBarCss).not.toContain(".workdayCountdown::after");
    expect(workspaceStatusBarCss).not.toContain(".workdayCountdownAvatar");
  });

  test("keeps long operator IDs contained and inspectable in the operator dock", async () => {
    const longOperatorId =
      "operator-central-observability-readonly-user-20260616-abcdef1234567890";
    server.use(
      http.get("/auth/session", () =>
        HttpResponse.json({
          authenticated: true,
          subject: longOperatorId,
          username: "ops.reader",
          roles: ["ROLE_agent-reader"],
          authenticationType: "built-in",
        }),
      ),
    );

    const { container } = renderPage();

    const operatorIdText = await screen.findByTitle(`ID ${longOperatorId}`);
    const operatorProfile = container.querySelector("[data-operator-profile]");
    const operatorDockRule =
      workspaceStatusBarCss.match(/[.]operatorDock\s*[{][^}]+[}]/u)?.[0] ?? "";
    const operatorProfileRule =
      workspaceStatusBarCss.match(/[.]operatorProfile\s*[{][^}]+[}]/u)?.[0] ?? "";
    const operatorAvatarRule =
      workspaceStatusBarCss.match(/[.]operatorAvatar\s*[{][^}]+[}]/u)?.[0] ?? "";
    const operatorIdentityRule =
      workspaceStatusBarCss.match(/[.]operatorIdentity\s*[{][^}]+[}]/u)?.[0] ?? "";
    const workdayCountdownRule =
      workspaceStatusBarCss.match(/[.]workdayCountdown\s*[{][^}]+[}]/u)?.[0] ?? "";
    const countdownGlyphRule =
      workspaceStatusBarCss.match(/[.]countdownGlyph\s*[{][^}]+[}]/u)?.[0] ?? "";
    const logoutButtonRule =
      workspaceStatusBarCss.match(/[.]logoutButton\s*[{][^}]+[}]/u)?.[0] ?? "";
    const logoutIconBadgeRule =
      workspaceStatusBarCss.match(/[.]logoutIconBadge\s*[{][^}]+[}]/u)?.[0] ?? "";
    const operatorIdentityTextRule =
      workspaceStatusBarCss.match(/[.]operatorIdentity strong,\s*\n[.]operatorIdentity small\s*[{][^}]+[}]/u)?.[0] ?? "";

    expect(operatorIdText).toHaveTextContent(`ID ${longOperatorId}`);
    expect(operatorProfile).toBeInTheDocument();
    expect(operatorDockRule).toContain("width: max-content");
    expect(operatorDockRule).toContain("min-width: 0");
    expect(operatorDockRule).toContain("grid-template-columns: 198px 128px 92px");
    expect(operatorDockRule).toContain("column-gap: 12px");
    expect(operatorDockRule).toContain("background: transparent");
    expect(operatorDockRule).toContain("box-shadow: none");
    expect(operatorDockRule).not.toContain("backdrop-filter");
    expect(operatorProfileRule).toContain("width: 176px");
    expect(operatorProfileRule).toContain("min-width: 0");
    expect(operatorProfileRule).toContain("grid-template-columns: 42px minmax(0, 1fr)");
    expect(operatorProfileRule).toContain("height: 42px");
    expect(operatorProfileRule).toContain("border: 1px solid rgba(37, 132, 169, 0.14)");
    expect(operatorProfileRule).toContain("border-radius: 14px");
    expect(operatorAvatarRule).toContain("width: 32px");
    expect(operatorAvatarRule).toContain("height: 32px");
    expect(operatorIdentityRule).toContain("min-width: 0");
    expect(operatorIdentityRule).toContain("max-width: clamp(136px, 12vw, 230px)");
    expect(operatorIdentityRule).not.toContain("border-right");
    expect(workdayCountdownRule).toContain("width: 128px");
    expect(workdayCountdownRule).toContain("height: 42px");
    expect(logoutButtonRule).toContain("width: 92px");
    expect(logoutButtonRule).toContain("height: 42px");
    expect(logoutButtonRule).toContain("border: 1px solid rgba(216, 11, 70, 0.18)");
    expect(logoutButtonRule).toContain("border-radius: 14px");
    expect(logoutButtonRule).toContain("radial-gradient(circle at 88% 22%, rgba(216, 11, 70, 0.16), transparent 2.4rem)");
    expect(logoutButtonRule).toContain("box-shadow:");
    expect(countdownGlyphRule).toContain("width: 32px");
    expect(countdownGlyphRule).toContain("height: 32px");
    expect(logoutIconBadgeRule).toContain("width: 32px");
    expect(logoutIconBadgeRule).toContain("height: 32px");
    expect(logoutIconBadgeRule).toContain("border-radius: 11px");
    expect(operatorIdentityTextRule).toContain("text-overflow: ellipsis");
  });

  test("renders the operator avatar as a creative mark instead of text initials", async () => {
    const { container } = renderPage();

    expect(await screen.findByText("ops.reader")).toBeInTheDocument();

    const operatorAvatar = container.querySelector("[data-creative-avatar='operator']");

    expect(operatorAvatar).toBeInTheDocument();
    expect(operatorAvatar?.textContent).toBe("");
    expect(operatorAvatar?.children).toHaveLength(2);
    expect(workspaceStatusBarCss).toContain(".operatorAvatarCore");
    expect(workspaceStatusBarCss).toContain(".operatorAvatarOrbit");
  });

  test("keeps the outer glass frame separated from inner card borders", async () => {
    renderPage();

    expect(await screen.findByText("Agent 工作区")).toBeInTheDocument();

    const agentCanvasRule =
      agentWorkspaceCss.match(/[.]agentCanvas\s*[{][^}]+[}]/u)?.[0] ?? "";

    expect(agentCanvasRule).toContain("box-sizing: border-box");
    expect(agentCanvasRule).toContain("padding: 12px");
    expect(agentCanvasRule).toContain("border: 1px solid rgba(166, 64, 92, 0.18)");
    expect(agentCanvasRule).toContain("border-radius: 24px");
  });

  test("renders unified badge icons for side panel headings", async () => {
    const { container } = renderPage();

    expect(await screen.findByText("选中任务详情")).toBeInTheDocument();
    expect(container.querySelectorAll('[class*="panelIcon"] svg')).toHaveLength(3);
  });

  test("logs out through the browser authentication endpoint and returns to login", async () => {
    const user = userEvent.setup();
    /** @type {string[]} */
    const calls = [];
    server.use(
      http.get("/auth/logout", ({ request }) => {
        calls.push(new URL(request.url).pathname);
        return HttpResponse.text("<!doctype html><title>Operator console</title>", {
          headers: { "Content-Type": "text/html" },
        });
      }),
    );
    window.history.pushState({}, "", "/overview");

    renderPage();

    await user.click(await screen.findByRole("button", { name: "登出当前账号" }));

    expect(calls).toEqual(["/auth/logout"]);
    await waitFor(() => expect(window.location.pathname).toBe("/login"));
  });

  test("shows service refusal without enabling task submission", async () => {
    server.use(
      http.post("/internal/routing/skills/search", () =>
        HttpResponse.json(
          { code: "POLICY_DENIED", message: "role is not sufficient" },
          { status: 403 },
        ),
      ),
    );

    renderPage();

    expect(await screen.findByText("unavailable")).toBeInTheDocument();
    expect(screen.getByText("等待发送")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "发送任务" })).toBeDisabled();
  });

  test("shows an empty candidate state without mock skills", async () => {
    server.use(
      http.post("/internal/routing/skills/search", () =>
        HttpResponse.json({ total: 0, candidates: [] }),
      ),
    );

    renderPage();

    expect(await screen.findByText("dependency")).toBeInTheDocument();
    expect(screen.getByText("等待发送")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "发送任务" })).toBeDisabled();
  });

  test("renders a login-aligned glass treatment as an alternate Agent page", async () => {
    const { container } = renderPage();

    expect(await screen.findByText("工作会话")).toBeInTheDocument();
    expect(container.querySelectorAll("[data-agent-ion]")).toHaveLength(12);
    expect(container.querySelector("[class*='agentIonField']")).toHaveAttribute("aria-hidden", "true");

    const appCapsuleRule =
      workspaceStatusBarCss.match(/[.]appCapsule\s*[{][^}]+[}]/u)?.[0] ?? "";
    const brandLockupRule =
      workspaceStatusBarCss.match(/[.]brandLockup\s*[{][^}]+[}]/u)?.[0] ?? "";
    const brandNameRule =
      workspaceStatusBarCss.match(/[.]brandName\s*[{][^}]+[}]/u)?.[0] ?? "";
    const brandNameBeforeRule =
      [...workspaceStatusBarCss.matchAll(/[.]brandName::before\s*[{][^}]+[}]/gu)].at(-1)?.[0] ??
      "";
    const brandNameAfterRule =
      [...workspaceStatusBarCss.matchAll(/[.]brandName::after\s*[{][^}]+[}]/gu)].at(-1)?.[0] ??
      "";
    const brandAgentPillRule =
      workspaceStatusBarCss.match(/[.]brandName strong\s*[{][^}]+[}]/u)?.[0] ?? "";
    const agentCanvasRule =
      agentWorkspaceCss.match(/[.]agentCanvas\s*[{][^}]+[}]/u)?.[0] ?? "";
    const capsuleHeadingRule =
      workspaceStatusBarCss.match(/[.]capsuleHeading\s*[{][^}]+[}]/u)?.[0] ?? "";
    const capsuleHeadingAccentRule =
      workspaceStatusBarCss.match(/[.]capsuleHeading::after\s*[{][^}]+[}]/u)?.[0] ?? "";
    const exchangeWindowRule =
      agentWorkspaceCss.match(/[.]exchangeWindow\s*[{][^}]+[}]/u)?.[0] ?? "";
    const agentPanelRule =
      agentWorkspaceCss.match(/[.]agentPanel\s*[{][^}]+[}]/u)?.[0] ?? "";
    const composerBoxRule =
      agentWorkspaceCss.match(/[.]composerBox\s*[{][^}]+[}]/u)?.[0] ?? "";
    const composerFooterRule =
      agentWorkspaceCss.match(/[.]composerFooter\s*[{][^}]+[}]/u)?.[0] ?? "";
    const composerTagsRule =
      agentWorkspaceCss.match(/[.]composerTags\s*[{][^}]+[}]/u)?.[0] ?? "";
    const agentIonFieldRule =
      agentWorkspaceCss.match(/[.]agentIonField\s*[{][^}]+[}]/u)?.[0] ?? "";
    const primaryActionRule =
      agentWorkspaceCss.match(/[.]primaryAction\s*[{][^}]+[}]/u)?.[0] ?? "";
    const sendButtonRule =
      agentWorkspaceCss.match(/[.]sendButton\s*[{][^}]+[}]/u)?.[0] ?? "";

    expect(agentWorkspaceCss).toContain("--agent-bg-base: #f6f7f9;");
    expect(agentWorkspaceCss).toContain("--agent-red: #d31145;");
    expect(agentWorkspaceCss).not.toContain("--agent-lime");
    expect(agentWorkspaceCss).toContain("backdrop-filter: blur(18px)");
    expect(agentWorkspaceCss).toContain("@keyframes agent-ion-drift");
    expect(agentWorkspaceCss).toContain("@keyframes frame-glass-sheen");
    expect(agentWorkspaceCss).toContain("radial-gradient(circle at 78% 14%, rgba(14, 165, 183, 0.14), transparent 18rem)");
    expect(agentCanvasRule).toContain("border: 1px solid rgba(166, 64, 92, 0.18)");
    expect(agentCanvasRule).toContain("border-radius: 24px");
    expect(agentCanvasRule).toContain("overflow: hidden");
    expect(agentCanvasRule).toContain("background: var(--agent-bg-base)");
    expect(agentCanvasRule).toContain("font-family: var(--agent-font-sans)");
    expect(agentCanvasRule).toContain("0 18px 56px rgba(31, 41, 51, 0.055)");
    expect(agentIonFieldRule).toContain("pointer-events: none");
    expect(appCapsuleRule).toContain("rgba(166, 64, 92, 0.26)");
    expect(appCapsuleRule).toContain("rgba(255, 255, 255, 0.78)");
    expect(appCapsuleRule).toContain("backdrop-filter: blur(18px)");
    expect(brandLockupRule).toContain("border: 1px solid rgba(37, 132, 169, 0.14)");
    expect(brandLockupRule).toContain("background:");
    expect(brandLockupRule).toContain("rgba(255, 255, 255, 0.48)");
    expect(brandLockupRule).toContain("border-radius: 999px");
    expect(brandNameRule).toContain("font-size: 15px");
    expect(brandNameRule).toContain("font-weight: 820");
    expect(brandNameRule).toContain("color: color-mix(in srgb, var(--agent-blue) 58%, var(--agent-ink))");
    expect(brandNameRule).not.toContain("font-weight: 950");
    expect(brandNameBeforeRule).toContain("linear-gradient(180deg, var(--agent-red), var(--agent-blue))");
    expect(brandNameAfterRule).toMatch(
      /linear-gradient[(]\s*90deg,\s*transparent,\s*rgba[(]216,\s*11,\s*70,\s*0[.]42[)],\s*rgba[(]37,\s*132,\s*169,\s*0[.]35[)],\s*transparent\s*[)]/u,
    );
    expect(brandAgentPillRule).toContain("background: rgba(255, 255, 255, 0.68)");
    expect(brandAgentPillRule).toContain("color: var(--agent-red)");
    expect(capsuleHeadingRule).toContain("font-family: var(--agent-font-display)");
    expect(capsuleHeadingRule).toContain("color: color-mix(in srgb, var(--agent-blue) 52%, var(--agent-ink))");
    expect(capsuleHeadingRule).toContain("font-weight: 760");
    expect(capsuleHeadingRule).not.toContain("color: var(--agent-ink)");
    expect(capsuleHeadingRule).not.toContain("font-weight: 850");
    expect(capsuleHeadingAccentRule).toContain("width: clamp(16px, 3vw, 62px)");
    expect(capsuleHeadingAccentRule).toContain("border: 2px solid var(--agent-red)");
    expect(capsuleHeadingAccentRule).toContain("radial-gradient(circle, var(--agent-red) 0 3px, transparent 4px)");
    expect(primaryActionRule).toContain("linear-gradient(90deg, var(--agent-red), #e01851 48%, var(--agent-red-dark))");
    expect(exchangeWindowRule).toContain("rgba(255, 255, 255, 0.68)");
    expect(exchangeWindowRule).toContain("backdrop-filter: blur(18px)");
    expect(agentPanelRule).toContain("rgba(255, 255, 255, 0.66)");
    expect(agentPanelRule).toContain("backdrop-filter: blur(18px)");
    expect(composerBoxRule).toContain("background: #fff");
    expect(composerBoxRule).toContain("border-radius: 8px");
    expect(composerBoxRule).toContain("backdrop-filter: blur(14px)");
    expect(composerBoxRule).toContain("grid-template-rows: minmax(0, 1fr) auto");
    expect(composerFooterRule).toContain("align-self: end");
    expect(composerFooterRule).toContain("align-items: end");
    expect(composerTagsRule).toContain("flex-wrap: nowrap");
    expect(composerTagsRule).toContain("align-self: end");
    expect(composerTagsRule).toContain("overflow-x: auto");
    expect(sendButtonRule).toContain("linear-gradient(90deg, var(--agent-red), #e01851 48%, var(--agent-red-dark))");
    expect(sendButtonRule).toContain("border-radius: 999px");
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
  http.post("/internal/routing/skills/search", async ({ request }) => {
    expect(await request.json()).toEqual({
      skillId: null,
      category: null,
      maxRiskLevel: "READ_ONLY",
      requiredParameters: [],
      requiredTags: [],
      requestContextTags: [],
      publicationStatusRequired: "VALIDATED",
    });

    return HttpResponse.json({
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
    });
  }),
  http.post("/internal/diagnostics/read-only/events", async ({ request }) => {
    diagnosticRequests.push(await request.json());

    return HttpResponse.text(sseFromEvents(readOnlyDiagnosticEvents), {
      headers: { "Content-Type": "text/event-stream" },
    });
  }),
];

const workflowId = "00000000-0000-4000-8000-000000000101";

const readOnlyDiagnosticEvents = [
  {
    contractVersion: "1.0",
    eventId: "00000000-0000-4000-8000-000000000201",
    workflowId,
    sequence: 1,
    timestamp: "2026-06-16T10:00:00+08:00",
    type: "WORKFLOW_STARTED",
    payload: {
      payloadType: "WORKFLOW_STARTED",
      commandId: "cmd-node-health-1",
      operatorId: "operator-1",
    },
  },
  {
    contractVersion: "1.0",
    eventId: "00000000-0000-4000-8000-000000000202",
    workflowId,
    sequence: 2,
    timestamp: "2026-06-16T10:00:01+08:00",
    type: "SKILL_ROUTED",
    payload: {
      payloadType: "SKILL_ROUTED",
      skillId: "node-health-read",
      skillVersion: "1.1.0",
    },
  },
  {
    contractVersion: "1.0",
    eventId: "00000000-0000-4000-8000-000000000203",
    workflowId,
    sequence: 3,
    timestamp: "2026-06-16T10:00:02+08:00",
    type: "WORKER_ACCEPTED",
    payload: {
      payloadType: "WORKER_ACCEPTED",
      executionRequestId: "exec-node-health-1",
    },
  },
  {
    contractVersion: "1.0",
    eventId: "00000000-0000-4000-8000-000000000204",
    workflowId,
    sequence: 4,
    timestamp: "2026-06-16T10:00:03+08:00",
    type: "WORKFLOW_COMPLETED",
    payload: {
      payloadType: "WORKFLOW_COMPLETED",
      outputSchemaId: "node-health-output-v1",
      output: {
        nodeName: "node-a",
        status: "HEALTHY",
        cpuUsagePercent: 18,
        memoryUsagePercent: 42,
        diskUsagePercent: 37,
        lastHeartbeatAt: "2026-06-16T10:00:00+08:00",
      },
    },
  },
];

const workflowFailedEvent = {
  contractVersion: "1.0",
  eventId: "00000000-0000-4000-8000-000000000205",
  workflowId,
  sequence: 2,
  timestamp: "2026-06-16T10:00:01+08:00",
  type: "WORKFLOW_FAILED",
  payload: {
    payloadType: "WORKFLOW_FAILED",
    errorCode: "INVALID_PARAMETERS",
    message: "nodeName is required",
  },
};

/**
 * @param {Array<Record<string, unknown>>} events
 */
function sseFromEvents(events) {
  return events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("");
}
