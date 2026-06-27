import { readFileSync } from "node:fs";

import { http, HttpResponse } from "msw";
import { render, screen, waitFor } from "@testing-library/react";
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
  installWebStorageMocks();
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

function installWebStorageMocks() {
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: storageMock(),
  });
  Object.defineProperty(window, "sessionStorage", {
    configurable: true,
    value: storageMock(),
  });
}

function storageMock() {
  /** @type {Map<string, string>} */
  const values = new Map();
  return {
    clear: () => values.clear(),
    /** @param {string} key */
    getItem: (key) => values.get(key) ?? null,
    /** @param {string} key */
    removeItem: (key) => values.delete(key),
    /** @param {string} key @param {string} value */
    setItem: (key, value) => values.set(key, String(value)),
  };
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

  test("keeps right rail summary rows visually compact and consistently aligned", () => {
    const agentLayoutRule =
      agentWorkspaceCss.match(/(?:^|\n)[.]agentLayout\s*[{][^}]+[}]/u)?.[0] ?? "";
    const agentSideRule =
      agentWorkspaceCss.match(/(?:^|\n)[.]agentSide\s*[{][^}]+[}]/u)?.[0] ?? "";
    const miniRowRule =
      agentWorkspaceCss.match(/(?:^|\n)[.]miniRow\s*[{][^}]+[}]/u)?.[0] ?? "";
    const miniRowValueRule =
      agentWorkspaceCss.match(/(?:^|\n)[.]miniRow strong\s*[{][^}]*display:\s*inline-flex;[^}]+[}]/u)?.[0] ??
      "";
    const detailButtonRule =
      agentWorkspaceCss.match(/(?:^|\n)[.]detailButton\s*[{][^}]+[}]/u)?.[0] ?? "";

    expect(agentLayoutRule).toContain("align-items: stretch");
    expect(agentSideRule).toContain("max-height: 100%");
    expect(agentSideRule).toContain("align-self: stretch");
    expect(miniRowRule).toContain("display: grid");
    expect(miniRowRule).toContain("min-height: 32px");
    expect(miniRowRule).toContain("grid-template-columns: minmax(0, 1fr) minmax(72px, 52%)");
    expect(miniRowRule).toContain("align-items: center");
    expect(miniRowValueRule).toContain("box-sizing: border-box");
    expect(miniRowValueRule).toContain("max-width: 100%");
    expect(miniRowValueRule).toContain("height: 22px");
    expect(detailButtonRule).toContain("min-height: 32px");
    expect(detailButtonRule).toContain("margin-top: 4px");
  });

  test("renders the read-only workspace from real routing candidates", async () => {
    renderPage();

    expect(await screen.findByText("工作会话")).toBeInTheDocument();
    expect(await screen.findByText("ops.reader")).toBeInTheDocument();
    expect(screen.getByText("ID operator-1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "登出当前账号" })).toBeEnabled();
    expect(await screen.findByText("health")).toBeInTheDocument();
    expect(screen.getByText("ROLE_agent-reader · policy-v1 · READ_ONLY")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "任务目标" })).toHaveValue("");
    expect(screen.getByRole("button", { name: "发送任务" })).toBeDisabled();
    expect(screen.queryByText("任务会话")).not.toBeInTheDocument();
    expect(screen.queryByText("只读模式")).not.toBeInTheDocument();
    expect(screen.queryByText("模型内部推理")).not.toBeInTheDocument();
    expect(screen.queryByText("服务依赖健康检查")).not.toBeInTheDocument();
    expect(screen.queryByText(/wf-042/u)).not.toBeInTheDocument();
    expect(screen.queryByText(/wf-043/u)).not.toBeInTheDocument();
    expect(
      screen.queryByText("帮我检查 node-a 的健康状态和关键依赖，只做只读诊断，并关联 INC-2841。"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("已拆分为两个独立只读任务。当前会话来自评审模板，符合范围的任务将在服务端策略通过后自动执行。"),
    ).not.toBeInTheDocument();
  });

  test("submits typed task goals through the main AgentScope diagnostic endpoint", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000001");
    const user = userEvent.setup();

    renderPage();

    expect(await screen.findByText("health")).toBeInTheDocument();
    await user.type(
      screen.getByRole("textbox", { name: "任务目标" }),
      "检查 node-a 健康状态并总结风险",
    );
    const sendButton = screen.getByRole("button", { name: "发送任务" });
    await waitFor(() => expect(sendButton).toBeEnabled());
    await user.click(sendButton);

    expect(await screen.findByText("已完成只读诊断，未发现阻塞风险。")).toBeInTheDocument();
    expect(await screen.findByText("AGENT_TASK_RESULT")).toBeInTheDocument();
    expect(await screen.findByText("tools 1")).toBeInTheDocument();
    expect(await screen.findByText("Shanghai")).toBeInTheDocument();
    expect(await screen.findByText("Sunny")).toBeInTheDocument();
    expect(await screen.findByText("31.2°C")).toBeInTheDocument();
    expect(await screen.findByText("对话执行状态")).toBeInTheDocument();
    expect(screen.getByText("当前输入")).toBeInTheDocument();
    expect(screen.getAllByText("检查 node-a 健康状态并总结风险")).toHaveLength(2);
    expect(await screen.findByText("已执行 Skill")).toBeInTheDocument();
    expect(screen.getByText("weather-current-read")).toBeInTheDocument();
    expect(screen.getByText("执行链")).toBeInTheDocument();
    expect(screen.getByText("READ_ONLY 策略")).toBeInTheDocument();
    expect(screen.getByText("M07 Worker")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "查看对话执行详情" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "查看 Skill 调用详情" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "查看执行链详情" })).toBeEnabled();
    expect(screen.queryByText(agentTaskResult.taskId)).not.toBeInTheDocument();
    expect(screen.queryByText("tool-call-weather-1")).not.toBeInTheDocument();
    expect(screen.queryByText("weather-current-read:1.0.0:output")).not.toBeInTheDocument();
    expect(screen.queryByText("Agent 请求入参")).not.toBeInTheDocument();
    expect(screen.queryByText(/Skill 原始入参未包含在 AgentTaskResult 中/u)).not.toBeInTheDocument();
    expect(screen.queryByText("Skill 出参")).not.toBeInTheDocument();
    expect(screen.queryByText(/"location": "Shanghai"/u)).not.toBeInTheDocument();
    expect(screen.queryByText("weather-current-read@1.0.0")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "查看对话执行详情" }));
    expect(await screen.findByRole("dialog", { name: "对话执行详情" })).toBeInTheDocument();
    expect(document.documentElement.style.overflow).toBe("hidden");
    expect(document.body.style.overflow).toBe("hidden");
    expect(screen.getByText("输入意图")).toBeInTheDocument();
    expect(screen.getByText("development")).toBeInTheDocument();
    expect(screen.getByText(agentTaskResult.taskId)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "关闭详情" }));
    expect(document.documentElement.style.overflow).toBe("");
    expect(document.body.style.overflow).toBe("");
    await user.click(screen.getByRole("button", { name: "查看 Skill 调用详情" }));
    expect(await screen.findByRole("dialog", { name: "Skill 调用详情" })).toBeInTheDocument();
    expect(screen.getByText("tool-call-weather-1")).toBeInTheDocument();
    expect(screen.getByText("weather-current-read:1.0.0:output")).toBeInTheDocument();
    expect(screen.getByText("Agent 请求入参")).toBeInTheDocument();
    expect(screen.getByText(/Skill 原始入参未包含在 AgentTaskResult 中/u)).toBeInTheDocument();
    expect(screen.getByText("Skill 出参")).toBeInTheDocument();
    expect(screen.getByText(/"location": "Shanghai"/u)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "关闭详情" }));
    await user.click(screen.getByRole("button", { name: "查看执行链详情" }));
    expect(await screen.findByRole("dialog", { name: "执行链详情" })).toBeInTheDocument();
    expect(screen.getByText("操作员意图")).toBeInTheDocument();
    expect(screen.getByText("weather-current-read@1.0.0")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "关闭详情" }));
    expect(document.documentElement.style.overflow).toBe("");
    expect(document.body.style.overflow).toBe("");
    expect(screen.queryByText("INC-2841")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("当前 Agent 诊断任务")).not.toBeInTheDocument();
    expect(window.localStorage.getItem("ops-agent:last-workflow-id")).toBe(agentTaskResult.workflowId);
    expect(JSON.parse(window.sessionStorage.getItem("ops-agent:last-agent-result") ?? "{}"))
      .toMatchObject({
        workflowId: agentTaskResult.workflowId,
        toolResults: [
          {
            outputSchemaId: "weather-current-read:1.0.0:output",
          },
        ],
      });
    expect(JSON.parse(window.sessionStorage.getItem("ops-agent:last-agent-exchange") ?? "{}"))
      .toMatchObject({
        userIntent: "检查 node-a 健康状态并总结风险",
        result: {
          workflowId: agentTaskResult.workflowId,
        },
      });
    expect(diagnosticRequests).toEqual([
      {
        targetEnvironment: "development",
        idempotencyKey:
          "agent-workspace-task-00000000-0000-4000-8000-000000000001",
        userIntent: "检查 node-a 健康状态并总结风险",
        inputParameters: {},
      },
    ]);
  });

  test("renders the submitted weather question and Agent answer as chat bubbles", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000002");
    const user = userEvent.setup();

    const { container } = renderPage();

    expect(await screen.findByText("health")).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "任务目标" }), "今天天气怎么样");
    const sendButton = screen.getByRole("button", { name: "发送任务" });
    await waitFor(() => expect(sendButton).toBeEnabled());
    await user.click(sendButton);

    await waitFor(() =>
      expect(container.querySelectorAll('[data-message-tone="operator"]')).toHaveLength(1),
    );
    await waitFor(() =>
      expect(container.querySelectorAll('[data-message-tone="agent"]')).toHaveLength(1),
    );
    const weatherQuestion = container.querySelector('[data-message-tone="operator"]');
    const weatherAnswerBubble = container.querySelector('[data-message-tone="agent"]');

    expect(weatherQuestion).toHaveTextContent("今天天气怎么样");
    expect(weatherQuestion?.className).toContain("operator");
    expect(weatherAnswerBubble).toHaveTextContent("Shanghai");
    expect(weatherAnswerBubble?.className).toContain("agent");
    expect(container.querySelectorAll('[data-message-tone="operator"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-message-tone="agent"]')).toHaveLength(1);
  });

  test("submits the task goal when pressing Enter in the composer", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000010");
    const user = userEvent.setup();

    const { container } = renderPage();

    expect(await screen.findByText("health")).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "任务目标" }), "今天天气怎么样{enter}");

    await waitFor(() => expect(diagnosticRequests).toHaveLength(1));
    expect(diagnosticRequests[0]).toMatchObject({
      targetEnvironment: "development",
      idempotencyKey:
        "agent-workspace-task-00000000-0000-4000-8000-000000000010",
      userIntent: "今天天气怎么样",
      inputParameters: {},
    });
    await waitFor(() =>
      expect(container.querySelector('[data-message-tone="operator"]')).toHaveTextContent(
        "今天天气怎么样",
      ),
    );
  });

  test("keeps the send action inside the composer shell and hides unused shortcut buttons", async () => {
    const { container } = renderPage();

    expect(await screen.findByText("工作会话")).toBeInTheDocument();

    const composerBox = container.querySelector('[class*="composerBox"]');
    const sendButton = screen.getByRole("button", { name: "发送任务" });
    expect(composerBox).toContainElement(sendButton);
    expect(container.querySelector('[class*="composerFooter"]')).toBeNull();
    expect(container.querySelector('[class*="composerTags"]')).toBeNull();
    expect(screen.queryByText("+ 服务")).not.toBeInTheDocument();
    expect(screen.queryByText("+ 告警")).not.toBeInTheDocument();
    expect(screen.queryByText("+ 工单")).not.toBeInTheDocument();
    expect(screen.queryByText("+ 历史 workflow")).not.toBeInTheDocument();
  });

  test("restores the latest Agent chat exchange when returning to the workspace", async () => {
    window.sessionStorage.setItem(
      "ops-agent:last-agent-exchange",
      JSON.stringify({
        userIntent: "今天天气怎么样",
        result: agentTaskResult,
      }),
    );

    const { container } = renderPage();

    await waitFor(() =>
      expect(container.querySelector('[data-message-tone="operator"]')).toHaveTextContent(
        "今天天气怎么样",
      ),
    );
    await waitFor(() =>
      expect(container.querySelector('[data-message-tone="agent"]')).toHaveTextContent("Shanghai"),
    );
    expect(await screen.findByText("AGENT_TASK_RESULT")).toBeInTheDocument();
  });

  test("appends a new chat exchange when sending the same weather question again", async () => {
    window.sessionStorage.setItem(
      "ops-agent:last-agent-exchange",
      JSON.stringify({
        userIntent: "今天天气怎么样",
        result: agentTaskResult,
      }),
    );
    vi.spyOn(crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000003");
    const user = userEvent.setup();

    const { container } = renderPage();

    expect(await screen.findByText("AGENT_TASK_RESULT")).toBeInTheDocument();
    expect(container.querySelectorAll('[data-message-tone="operator"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-message-tone="agent"]')).toHaveLength(1);

    await user.type(screen.getByRole("textbox", { name: "任务目标" }), "今天天气怎么样");
    const sendButton = screen.getByRole("button", { name: "发送任务" });
    await waitFor(() => expect(sendButton).toBeEnabled());
    await user.click(sendButton);

    await waitFor(() => expect(diagnosticRequests).toHaveLength(1));
    [...container.querySelectorAll('[data-message-tone="operator"]')].forEach((message) => {
      expect(message).toHaveTextContent("今天天气怎么样");
    });
    expect(container.querySelectorAll('[data-message-tone="operator"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-message-tone="agent"]')).toHaveLength(2);
    expect(diagnosticRequests).toEqual([
      {
        targetEnvironment: "development",
        idempotencyKey:
          "agent-workspace-task-00000000-0000-4000-8000-000000000003",
        userIntent: "今天天气怎么样",
        inputParameters: {},
      },
    ]);
  });

  test("restores the latest Agent result when returning to the workspace", async () => {
    window.sessionStorage.setItem(
      "ops-agent:last-agent-result",
      JSON.stringify(agentTaskResult),
    );

    renderPage();

    expect(await screen.findByText("AGENT_TASK_RESULT")).toBeInTheDocument();
    expect(await screen.findAllByText(agentTaskResult.workflowId)).toHaveLength(2);
    expect(screen.queryByText("Shanghai")).not.toBeInTheDocument();
    expect(screen.queryByText("Sunny")).not.toBeInTheDocument();
    expect(screen.queryByText("31.2°C")).not.toBeInTheDocument();
  });

  test("shows AgentScope runtime disabled response without falling back to fixed Skill", async () => {
    /** @type {unknown[]} */
    const fixedSkillRequests = [];
    server.use(
      http.post("/api/v1/agent/diagnostics", async ({ request }) => {
        diagnosticRequests.push(await request.json());
        return HttpResponse.json(
          {
            code: "AGENT_RUNTIME_DISABLED",
            message: "Agent runtime is disabled for this environment.",
          },
          { status: 503 },
        );
      }),
      http.post("/internal/diagnostics/read-only/events", async ({ request }) => {
        fixedSkillRequests.push(await request.json());
        return HttpResponse.text(sseFromEvents(readOnlyDiagnosticEvents), {
          headers: { "Content-Type": "text/event-stream" },
        });
      }),
    );
    const user = userEvent.setup();

    const { container } = renderPage();

    expect(await screen.findByText("health")).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "任务目标" }), "检查 node-a 健康状态");
    const sendButton = screen.getByRole("button", { name: "发送任务" });
    await waitFor(() => expect(sendButton).toBeEnabled());
    await user.click(sendButton);

    await waitFor(() =>
      expect(container.querySelectorAll('[data-message-tone="agent"]')).toHaveLength(1),
    );
    const agentMessages = container.querySelectorAll('[data-message-tone="agent"]');
    expect(agentMessages).toHaveLength(1);
    expect(agentMessages[0]).toHaveTextContent(
      "AGENT_RUNTIME_DISABLED: Agent runtime is disabled for this environment.",
    );
    expect(await screen.findAllByText("失败")).toHaveLength(2);
    expect(screen.queryByLabelText("当前 Agent 诊断任务")).not.toBeInTheDocument();
    expect(fixedSkillRequests).toEqual([]);
  });

  test("keeps main Agent task submission available when routing preview is unavailable", async () => {
    server.use(
      http.post("/internal/routing/skills/search", () =>
        HttpResponse.json(
          { code: "POLICY_DENIED", message: "role is not sufficient" },
          { status: 403 },
        ),
      ),
    );
    const user = userEvent.setup();

    renderPage();

    expect(await screen.findAllByText("unavailable")).not.toHaveLength(0);
    await user.type(screen.getByRole("textbox", { name: "任务目标" }), "检查 node-a 健康状态");
    const sendButton = screen.getByRole("button", { name: "发送任务" });
    await waitFor(() => expect(sendButton).toBeEnabled());
    await user.click(sendButton);

    await waitFor(() => expect(diagnosticRequests).toHaveLength(1));
    expect(await screen.findByText("已完成只读诊断，未发现阻塞风险。")).toBeInTheDocument();
    expect(screen.queryByLabelText("当前 Agent 诊断任务")).not.toBeInTheDocument();
  });

  test("does not render template message role avatars before a real exchange", async () => {
    const { container } = renderPage();

    expect(await screen.findByText("ops.reader")).toBeInTheDocument();
    expect(container.querySelectorAll('[class*="messageRoleIcon"] svg')).toHaveLength(0);
  });

  test("renders the workday countdown as a compact creative timer", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 16, 19, 0, 0));

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

  test("keeps the work session height fixed and scrolls overflowing conversation content", async () => {
    renderPage();

    expect(await screen.findByText("工作会话")).toBeInTheDocument();

    const agentCanvasRule =
      agentWorkspaceCss.match(/[.]agentCanvas\s*[{][^}]+[}]/u)?.[0] ?? "";
    const agentLayoutRule =
      agentWorkspaceCss.match(/(?:^|\n)[.]agentLayout\s*[{][^}]+[}]/u)?.[0] ?? "";
    const exchangeWindowRule =
      agentWorkspaceCss.match(/[.]exchangeWindow\s*[{][^}]+[}]/u)?.[0] ?? "";
    const exchangeBodyRule =
      agentWorkspaceCss.match(/[.]exchangeBody\s*[{][^}]+[}]/u)?.[0] ?? "";

    expect(agentCanvasRule).toMatch(/(?:^|\n)\s{2}height: calc\(100vh - 48px\);/u);
    expect(agentLayoutRule).toContain("height: 100%");
    expect(agentLayoutRule).toContain("min-height: 0");
    expect(exchangeWindowRule).toContain("height: 100%");
    expect(exchangeWindowRule).toContain("min-height: 0");
    expect(exchangeWindowRule).toContain("grid-template-rows: auto minmax(0, 1fr) auto");
    expect(exchangeWindowRule).toContain("overflow: hidden");
    expect(exchangeBodyRule).toContain("min-height: 0");
    expect(exchangeBodyRule).toContain("overflow-y: auto");
  });

  test("renders detail dialogs as centered viewport overlays without nested JSON scrolling", async () => {
    renderPage();

    expect(await screen.findByText("工作会话")).toBeInTheDocument();

    const backdropRule =
      agentWorkspaceCss.match(/[.]detailDialogBackdrop\s*[{][^}]+[}]/u)?.[0] ?? "";
    const dialogRule =
      agentWorkspaceCss.match(/[.]detailDialog\s*[{][^}]+[}]/u)?.[0] ?? "";
    const preRule =
      agentWorkspaceCss.match(/[.]ioBlock pre\s*[{][^}]+[}]/u)?.[0] ?? "";

    expect(backdropRule).toContain("position: fixed");
    expect(backdropRule).toContain("inset: 0");
    expect(backdropRule).toContain("align-items: center");
    expect(backdropRule).toContain("justify-items: center");
    expect(backdropRule).toContain("padding: 32px 40px");
    expect(dialogRule).toContain("width: min(1180px, calc(100vw - 80px))");
    expect(dialogRule).toContain("max-height: calc(100vh - 64px)");
    expect(preRule).not.toContain("max-height");
    expect(preRule).toContain("overflow: hidden");
  });

  test("renders unified badge icons for side panel headings", async () => {
    const { container } = renderPage();

    expect(await screen.findByText("对话执行状态")).toBeInTheDocument();
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

  test("shows route preview refusal without disabling main Agent submission", async () => {
    server.use(
      http.post("/internal/routing/skills/search", () =>
        HttpResponse.json(
          { code: "POLICY_DENIED", message: "role is not sufficient" },
          { status: 403 },
        ),
      ),
    );

    renderPage();

    expect(await screen.findAllByText("unavailable")).not.toHaveLength(0);
    expect(screen.getAllByText("等待发送").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "发送任务" })).toBeDisabled();
    await userEvent.type(
      screen.getByRole("textbox", { name: "任务目标" }),
      "检查 node-a 健康状态",
    );
    expect(screen.getByRole("button", { name: "发送任务" })).toBeEnabled();
  });

  test("shows an empty route preview state without disabling main Agent submission", async () => {
    server.use(
      http.post("/internal/routing/skills/search", () =>
        HttpResponse.json({ total: 0, candidates: [] }),
      ),
    );

    renderPage();

    expect(await screen.findAllByText("无候选")).not.toHaveLength(0);
    expect(screen.getAllByText("等待发送").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "发送任务" })).toBeDisabled();
    await userEvent.type(
      screen.getByRole("textbox", { name: "任务目标" }),
      "检查 node-a 健康状态",
    );
    expect(screen.getByRole("button", { name: "发送任务" })).toBeEnabled();
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
    const composerInputRule =
      agentWorkspaceCss.match(/[.]composerInput\s*[{][^}]+[}]/u)?.[0] ?? "";
    const composerInputFocusRule =
      agentWorkspaceCss.match(/[.]composerInput:focus,\s*[.]composerInput:focus-visible\s*[{][^}]+[}]/u)?.[0] ?? "";
    const composerBoxFocusWithinRule =
      agentWorkspaceCss.match(/[.]composerBox:focus-within\s*[{][^}]+[}]/u)?.[0] ?? "";
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
    expect(composerBoxRule).toContain("background: rgba(255, 255, 255, 0.86)");
    expect(composerBoxRule).toContain("border-radius: 8px");
    expect(composerBoxRule).toContain("grid-template-columns: minmax(0, 1fr) auto");
    expect(composerBoxRule).toContain("min-height: 124px");
    expect(composerBoxRule).toContain("border: 1px solid rgba(37, 132, 169, 0.14)");
    expect(composerBoxRule).toContain("box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.76)");
    expect(composerInputRule).toContain("min-height: 96px");
    expect(composerInputFocusRule).toContain("outline: none");
    expect(composerInputFocusRule).toContain("outline-width: 0");
    expect(composerInputFocusRule).toContain("outline-color: transparent");
    expect(composerInputFocusRule).toContain("box-shadow: none");
    expect(composerBoxFocusWithinRule).toContain("border-color: rgba(37, 132, 169, 0.22)");
    expect(composerBoxFocusWithinRule).toContain("0 0 0 1px rgba(37, 132, 169, 0.1)");
    expect(agentWorkspaceCss).not.toContain(".composerFooter");
    expect(agentWorkspaceCss).not.toContain(".composerTags");
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
  http.post("/api/v1/agent/diagnostics", async ({ request }) => {
    diagnosticRequests.push(await request.json());

    return HttpResponse.json(agentTaskResult);
  }),
  http.post("/internal/diagnostics/read-only/events", async ({ request }) => {
    diagnosticRequests.push(await request.json());

    return HttpResponse.text(sseFromEvents(readOnlyDiagnosticEvents), {
      headers: { "Content-Type": "text/event-stream" },
    });
  }),
];

const agentTaskResult = {
  schemaVersion: "1.0",
  taskId: "task-0001",
  workflowId: "00000000-0000-4000-8000-000000000301",
  status: "SUCCEEDED",
  summary: "已完成只读诊断，未发现阻塞风险。",
  toolCallCount: 1,
  completedAt: "2026-06-23T08:00:00Z",
  toolResults: [
    {
      schemaVersion: "1.0",
      toolCallId: "tool-call-weather-1",
      taskId: "task-0001",
      workflowId: "00000000-0000-4000-8000-000000000301",
      status: "SUCCEEDED",
      outputSchemaId: "weather-current-read:1.0.0:output",
      output: {
        location: "Shanghai",
        condition: "Sunny",
        temperatureCelsius: 31.2,
        observedAt: "2026-06-24T10:00:00+08:00",
      },
      errorCode: null,
      errorMessage: null,
      completedAt: "2026-06-23T08:00:00Z",
    },
  ],
};

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

/**
 * @param {Array<Record<string, unknown>>} events
 */
function sseFromEvents(events) {
  return events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("");
}
