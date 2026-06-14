import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import App from "../../app/App.jsx";
import { AppProviders } from "../../app/providers.jsx";
import { server } from "../../test/server.js";

function renderAgentWorkspace() {
  return render(
    <AppProviders Router={MemoryRouter} routerProps={{ initialEntries: ["/agent"] }}>
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

describe("AgentWorkspacePage", () => {
  test("renders real read-only skill candidates without enabling task submission", async () => {
    useAuthenticatedSession();
    server.use(
      http.post("/internal/routing/skills/search", async ({ request }) => {
        expect(await request.json()).toMatchObject({
          maxRiskLevel: "READ_ONLY",
          publicationStatusRequired: "VALIDATED",
        });
        return HttpResponse.json({
          total: 1,
          candidates: [skillCandidate],
        });
      }),
    );

    renderAgentWorkspace();

    expect(await screen.findByText("工作会话")).toBeInTheDocument();
    expect(await screen.findByText("node-health-read")).toBeInTheDocument();
    expect(screen.getByText("platform-observability")).toBeInTheDocument();
    expect(screen.getByText("risk:read-only")).toBeInTheDocument();
    expect(screen.getByText("category-match")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "发送任务" })).toBeDisabled();
    expect(screen.getByText("通用 Agent 对话接口尚未开放")).toBeInTheDocument();
    expect(screen.queryByText("模型内部推理")).not.toBeInTheDocument();
  });

  test("shows service refusal without enabling task submission", async () => {
    useAuthenticatedSession();
    server.use(
      http.post("/internal/routing/skills/search", () =>
        HttpResponse.json(
          { code: "POLICY_DENIED", message: "当前主体无权查询候选 Skill。" },
          { status: 403 },
        ),
      ),
    );

    renderAgentWorkspace();

    expect(
      await screen.findByRole("alert", { name: "候选能力读取被拒绝" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "发送任务" })).toBeDisabled();
  });

  test("shows an empty candidate state without mock skills", async () => {
    useAuthenticatedSession();
    server.use(
      http.post("/internal/routing/skills/search", () =>
        HttpResponse.json({ total: 0, candidates: [] }),
      ),
    );

    renderAgentWorkspace();

    expect(
      await screen.findByRole("status", { name: "没有可用候选 Skill" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("example-skill")).not.toBeInTheDocument();
  });
});

const registeredSkill = {
  descriptor: {
    skillId: "node-health-read",
    version: "1.1.0",
    displayName: "Node health",
    description: "Reads node health from the controlled worker path",
    category: "INFRASTRUCTURE_DIAGNOSTICS",
    riskLevel: "READ_ONLY",
    executor: "HTTP",
    outputType: "JSON",
    readOnly: true,
    timeoutSeconds: 30,
    owner: "platform-observability",
    requiredRoles: ["ROLE_ops-reader"],
    tags: ["health"],
    interceptors: ["AUTHORIZATION", "AUDIT"],
    parameters: [
      {
        name: "nodeName",
        displayName: "Node",
        description: "Node identifier",
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

const skillCandidate = {
  skill: registeredSkill,
  releaseSnapshot: {
    skillId: "node-health-read",
    version: "1.1.0",
    stage: "GENERAL_AVAILABLE",
    rolloutPercentage: 100,
    targetContextTags: ["p1"],
    reason: "validated read-only release",
    updatedAt: "2026-06-14T00:00:00Z",
  },
  score: 80,
  matchedRules: ["risk:read-only", "category-match"],
};

