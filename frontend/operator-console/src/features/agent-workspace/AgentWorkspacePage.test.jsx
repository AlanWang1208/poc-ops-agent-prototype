import { readFileSync } from "node:fs";

import { http, HttpResponse } from "msw";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test } from "vitest";

import { AppProviders } from "../../app/providers.jsx";
import { server } from "../../test/server.js";
import { AgentWorkspacePage } from "./AgentWorkspacePage.jsx";

const agentWorkspaceCss = readFileSync(
  "src/features/agent-workspace/AgentWorkspacePage.module.css",
  "utf8",
);

beforeEach(() => {
  server.use(...defaultHandlers);
});

function renderPage() {
  return render(
    <AppProviders>
      <AgentWorkspacePage />
    </AppProviders>,
  );
}

describe("AgentWorkspacePage", () => {
  test("renders the read-only workspace from real routing candidates", async () => {
    renderPage();

    expect(await screen.findByText("工作会话")).toBeInTheDocument();
    expect(await screen.findByText("ops.reader")).toBeInTheDocument();
    expect(screen.getByText("ID operator-1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "登出当前账号" })).toBeEnabled();
    expect(await screen.findByText(/node-health-read/u)).toBeInTheDocument();
    expect(screen.getByText("ROLE_agent-reader · policy-v1 · READ_ONLY")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "发送任务" })).toBeDisabled();
    expect(screen.getByText("通用 Agent 对话接口尚未开放")).toBeInTheDocument();
    expect(screen.queryByText("模型内部推理")).not.toBeInTheDocument();
  });

  test("renders refined message role avatars", async () => {
    const { container } = renderPage();

    expect(await screen.findByText("ops.reader")).toBeInTheDocument();
    expect(container.querySelectorAll('[class*="messageRoleIcon"] svg')).toHaveLength(2);
  });

  test("renders unified badge icons for side panel headings", async () => {
    const { container } = renderPage();

    expect(await screen.findByText("选中任务详情")).toBeInTheDocument();
    expect(container.querySelectorAll('[class*="panelIcon"] svg')).toHaveLength(3);
  });

  test("logs out through the browser authentication endpoint", async () => {
    const user = userEvent.setup();
    /** @type {string[]} */
    const calls = [];
    server.use(
      http.post("/logout", ({ request }) => {
        calls.push(new URL(request.url).pathname);
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderPage();

    await user.click(await screen.findByRole("button", { name: "登出当前账号" }));

    expect(calls).toEqual(["/logout"]);
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
    expect(screen.getByText("WORKER_ACCEPTED")).toBeInTheDocument();
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
    expect(screen.getByText("WORKER_ACCEPTED")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "发送任务" })).toBeDisabled();
  });

  test("keeps animated brand accents without returning to glass styling", () => {
    const logoRule = agentWorkspaceCss.match(/[.]logo\s*[{][^}]+[}]/u)?.[0] ?? "";
    const logoRingRule = agentWorkspaceCss.match(/[.]logo::before\s*[{][^}]+[}]/u)?.[0] ?? "";
    const logoPulseRule =
      [...agentWorkspaceCss.matchAll(/[.]logo::after\s*[{][^}]+[}]/gu)].at(-1)?.[0] ?? "";
    const appCapsuleRule =
      agentWorkspaceCss.match(/[.]appCapsule\s*[{][^}]+[}]/u)?.[0] ?? "";
    const brandScanRule =
      agentWorkspaceCss.match(/[.]brandSignal::after\s*[{][^}]+[}]/u)?.[0] ?? "";
    const signalNodeRule =
      agentWorkspaceCss.match(/[.]brandSignal i\s*[{][^}]+[}]/u)?.[0] ?? "";
    const brandLockupRule =
      agentWorkspaceCss.match(/[.]brandLockup\s*[{][^}]+[}]/u)?.[0] ?? "";
    const brandNameRule =
      agentWorkspaceCss.match(/[.]brandName\s*[{][^}]+[}]/u)?.[0] ?? "";
    const brandNameAgentRule =
      agentWorkspaceCss.match(/[.]brandName strong\s*[{][^}]+[}]/u)?.[0] ?? "";
    const brandNameDetailRule =
      [...agentWorkspaceCss.matchAll(/[.]brandName::after\s*[{][^}]+[}]/gu)].at(-1)?.[0] ?? "";
    const userBadgeRule =
      agentWorkspaceCss.match(/[.]operatorAvatar\s*[{][^}]+[}]/u)?.[0] ?? "";
    const logoutButtonRule =
      agentWorkspaceCss.match(/[.]logoutButton\s*[{][^}]+[}]/u)?.[0] ?? "";
    const logoutIconBadgeRule =
      agentWorkspaceCss.match(/[.]logoutIconBadge\s*[{][^}]+[}]/u)?.[0] ?? "";
    const primaryActionRule =
      agentWorkspaceCss.match(/[.]primaryAction\s*[{][^}]+[}]/u)?.[0] ?? "";
    const primaryActionHoverRule =
      agentWorkspaceCss.match(/[.]primaryAction:hover\s*[{][^}]+[}]/u)?.[0] ?? "";
    const exchangeHeadingRule =
      agentWorkspaceCss.match(/[.]exchangeHead h2\s*[{][^}]+[}]/u)?.[0] ?? "";
    const capsuleHeadingRule =
      agentWorkspaceCss.match(/[.]capsuleHeading\s*[{][^}]+[}]/u)?.[0] ?? "";
    const capsuleStatusRule =
      agentWorkspaceCss.match(/[.]capsuleCurrent small,[\s\S]*?[.]capsuleCurrent span\s*[{][^}]+[}]/u)?.[0] ??
      "";
    const messageRoleIconRule =
      agentWorkspaceCss.match(/[.]messageRoleIcon\s*[{][^}]+[}]/u)?.[0] ?? "";
    const agentMessageRoleIconRule =
      agentWorkspaceCss.match(/[.]agent\s+[.]messageRoleIcon\s*[{][^}]+[}]/u)?.[0] ?? "";
    const sidePanelHeadingRule =
      agentWorkspaceCss.match(/[.]agentPanel h3\s*[{][^}]+[}]/u)?.[0] ?? "";
    const panelIconRule =
      agentWorkspaceCss.match(/[.]panelIcon\s*[{][^}]+[}]/u)?.[0] ?? "";
    const panelIconTaskRule =
      agentWorkspaceCss.match(/[.]panelIconTask\s*[{][^}]+[}]/u)?.[0] ?? "";
    const panelIconSkillRule =
      agentWorkspaceCss.match(/[.]panelIconSkill\s*[{][^}]+[}]/u)?.[0] ?? "";
    const panelIconSessionRule =
      agentWorkspaceCss.match(/[.]panelIconSession\s*[{][^}]+[}]/u)?.[0] ?? "";

    expect(agentWorkspaceCss).not.toContain("backdrop-filter");
    expect(agentWorkspaceCss).not.toContain("blur(");
    expect(appCapsuleRule).toContain("height: 76px");
    expect(appCapsuleRule).toContain("border-radius: 22px");
    expect(appCapsuleRule).toContain("background: linear-gradient");
    expect(appCapsuleRule).not.toContain("border-radius: 999px");
    expect(logoRule).toContain("animation: brand-logo-float");
    expect(logoRingRule).toContain("radial-gradient");
    expect(logoRingRule).toContain("animation: brand-orbit");
    expect(logoRingRule).not.toContain("display: none");
    expect(logoPulseRule).toContain("radial-gradient");
    expect(logoPulseRule).toContain("animation: pulse-ring");
    expect(brandScanRule).toContain("linear-gradient");
    expect(brandScanRule).toContain("animation: brand-scan");
    expect(signalNodeRule).toContain("animation: brand-node-pulse");
    expect(agentWorkspaceCss).toContain("@keyframes brand-logo-float");
    expect(agentWorkspaceCss).toContain("@keyframes brand-orbit");
    expect(agentWorkspaceCss).toContain("@keyframes pulse-ring");
    expect(agentWorkspaceCss).toContain("@keyframes brand-scan");
    expect(agentWorkspaceCss).toContain("@keyframes brand-node-pulse");
    expect(brandLockupRule).toContain("margin-left: 18px");
    expect(brandNameRule).toContain("color: #25445d");
    expect(brandNameRule).toContain("text-shadow: 0 1px 0 #fff");
    expect(brandNameAgentRule).toContain("color: var(--agent-blue)");
    expect(brandNameAgentRule).toContain("background: #eef8fb");
    expect(brandNameDetailRule).toContain("linear-gradient");
    expect(userBadgeRule).toContain("width: 42px");
    expect(userBadgeRule).toContain("background: var(--agent-blue)");
    expect(agentWorkspaceCss).toContain(".operatorAvatar::before,\n.operatorAvatar::after");
    expect(agentWorkspaceCss).toContain("content: \"\"");
    expect(logoutButtonRule).toContain("border-radius: 999px");
    expect(logoutButtonRule).toContain("box-shadow:");
    expect(logoutIconBadgeRule).toContain("width: 24px");
    expect(logoutIconBadgeRule).toContain("background: var(--agent-red)");
    expect(agentWorkspaceCss).toContain(".logoutIconBadge::before,\n.logoutIconBadge::after");
    expect(agentWorkspaceCss).toContain(".logoutIconBadge svg");
    expect(primaryActionRule).toContain("border-color: rgba(216, 11, 70, 0.2)");
    expect(primaryActionRule).toContain("background: #fff3f7");
    expect(primaryActionRule).toContain("color: var(--agent-red)");
    expect(primaryActionRule).not.toContain("background: var(--agent-red)");
    expect(primaryActionHoverRule).toContain("background: #ffeaf1");
    expect(primaryActionHoverRule).toContain("box-shadow: 0 10px 18px rgba(216, 11, 70, 0.1)");
    expect(capsuleHeadingRule).toContain("border-radius: 12px");
    expect(capsuleHeadingRule).toContain("color: #25445d");
    expect(capsuleHeadingRule).toContain("font-weight: 850");
    expect(capsuleHeadingRule).toContain("text-shadow: 0 1px 0 #fff");
    expect(capsuleHeadingRule).not.toContain("border-radius: 999px");
    expect(capsuleHeadingRule).not.toContain("color: var(--color-text)");
    expect(capsuleStatusRule).toContain("border-radius: 11px");
    expect(exchangeHeadingRule).toContain("font-size: 18px");
    expect(exchangeHeadingRule).toContain("line-height: 1.15");
    expect(messageRoleIconRule).toContain("display: grid");
    expect(messageRoleIconRule).toContain("width: 28px");
    expect(messageRoleIconRule).toContain("background: var(--agent-red)");
    expect(messageRoleIconRule).toContain("color: #fff");
    expect(agentMessageRoleIconRule).toContain("border-radius: 10px");
    expect(agentMessageRoleIconRule).toContain("background: var(--agent-blue)");
    expect(agentWorkspaceCss).toContain(".messageRoleIcon::before,\n.messageRoleIcon::after");
    expect(agentWorkspaceCss).toContain(".messageRoleIcon svg");
    expect(sidePanelHeadingRule).toContain("font-size: 15px");
    expect(sidePanelHeadingRule).toContain("font-weight: 760");
    expect(sidePanelHeadingRule).toContain("color: #1f6f8a");
    expect(sidePanelHeadingRule).toContain("line-height: 1.25");
    expect(sidePanelHeadingRule).toContain("text-shadow: none");
    expect(sidePanelHeadingRule).toContain("-webkit-font-smoothing: antialiased");
    expect(sidePanelHeadingRule).not.toContain("color: var(--color-text)");
    expect(sidePanelHeadingRule).not.toContain("text-shadow: 0 1px 0 #fff");
    expect(panelIconRule).toContain("display: grid");
    expect(panelIconRule).toContain("width: 26px");
    expect(panelIconRule).toContain("border-radius: 10px");
    expect(panelIconRule).toContain("color: #fff");
    expect(panelIconTaskRule).toContain("--panel-accent: var(--agent-red)");
    expect(panelIconSkillRule).toContain("--panel-accent: var(--agent-blue)");
    expect(panelIconSessionRule).toContain("--panel-accent: var(--agent-green)");
    expect(panelIconSessionRule).not.toContain("border-radius: 999px");
    expect(agentWorkspaceCss).toContain(".panelIcon::before,\n.panelIcon::after");
    expect(agentWorkspaceCss).toContain(".panelIcon svg");
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
];
