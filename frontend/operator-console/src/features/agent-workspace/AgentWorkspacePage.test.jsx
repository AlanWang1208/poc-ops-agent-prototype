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
    expect(screen.queryByText("任务会话")).not.toBeInTheDocument();
    expect(screen.queryByText("只读模式")).not.toBeInTheDocument();
    expect(screen.queryByText("模型内部推理")).not.toBeInTheDocument();
  });

  test("renders refined message role avatars", async () => {
    const { container } = renderPage();

    expect(await screen.findByText("ops.reader")).toBeInTheDocument();
    expect(container.querySelectorAll('[class*="messageRoleIcon"] svg')).toHaveLength(2);
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

    renderPage();

    const operatorIdText = await screen.findByTitle(`ID ${longOperatorId}`);
    const operatorDockRule =
      agentWorkspaceCss.match(/[.]operatorDock\s*[{][^}]+[}]/u)?.[0] ?? "";
    const operatorIdentityRule =
      agentWorkspaceCss.match(/[.]operatorIdentity\s*[{][^}]+[}]/u)?.[0] ?? "";
    const operatorIdentityTextRule =
      agentWorkspaceCss.match(/[.]operatorIdentity strong,\s*\n[.]operatorIdentity small\s*[{][^}]+[}]/u)?.[0] ?? "";

    expect(operatorIdText).toHaveTextContent(`ID ${longOperatorId}`);
    expect(operatorDockRule).toContain("min-width: clamp(430px, 31vw, 520px)");
    expect(operatorDockRule).toContain("grid-template-columns: 42px minmax(128px, 1fr) auto auto");
    expect(operatorIdentityRule).toContain("min-width: 128px");
    expect(operatorIdentityRule).toContain("max-width: clamp(136px, 12vw, 230px)");
    expect(operatorIdentityTextRule).toContain("text-overflow: ellipsis");
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

  test("renders a login-aligned glass treatment as an alternate Agent page", async () => {
    const { container } = renderPage();

    expect(await screen.findByText("工作会话")).toBeInTheDocument();
    expect(container.querySelectorAll("[data-agent-ion]")).toHaveLength(12);
    expect(container.querySelector("[class*='agentIonField']")).toHaveAttribute("aria-hidden", "true");

    const appCapsuleRule =
      agentWorkspaceCss.match(/[.]appCapsule\s*[{][^}]+[}]/u)?.[0] ?? "";
    const agentCanvasRule =
      agentWorkspaceCss.match(/[.]agentCanvas\s*[{][^}]+[}]/u)?.[0] ?? "";
    const capsuleHeadingRule =
      agentWorkspaceCss.match(/[.]capsuleHeading\s*[{][^}]+[}]/u)?.[0] ?? "";
    const capsuleHeadingAccentRule =
      agentWorkspaceCss.match(/[.]capsuleHeading::after\s*[{][^}]+[}]/u)?.[0] ?? "";
    const exchangeWindowRule =
      agentWorkspaceCss.match(/[.]exchangeWindow\s*[{][^}]+[}]/u)?.[0] ?? "";
    const agentPanelRule =
      agentWorkspaceCss.match(/[.]agentPanel\s*[{][^}]+[}]/u)?.[0] ?? "";
    const composerBoxRule =
      agentWorkspaceCss.match(/[.]composerBox\s*[{][^}]+[}]/u)?.[0] ?? "";
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
    expect(capsuleHeadingRule).toContain("font-family: var(--agent-font-display)");
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
];
