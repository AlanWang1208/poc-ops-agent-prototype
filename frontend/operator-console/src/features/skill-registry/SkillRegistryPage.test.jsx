import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";

import App from "../../app/App.jsx";
import { AppProviders } from "../../app/providers.jsx";
import { server } from "../../test/server.js";

function renderSkillRegistry() {
  return render(
    <AppProviders Router={MemoryRouter} routerProps={{ initialEntries: ["/skills"] }}>
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

describe("SkillRegistryPage", () => {
  test("renders real read-only skills without the page intro block", async () => {
    useAuthenticatedSession();
    server.use(
      http.get("/internal/skills", () =>
        HttpResponse.json({ total: 1, skills: [registeredSkill] }),
      ),
    );

    renderSkillRegistry();

    expect(await screen.findByLabelText("当前工作台")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "主导航" })).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Skill 注册中心导航" }),
    ).not.toBeInTheDocument();
    const filterRegion = screen.getByRole("region", { name: "Skill 分类筛选" });
    expect(filterRegion.parentElement?.firstElementChild).toBe(filterRegion);
    expect(
      screen.queryByText("查看 P1 只读诊断 Skill 的版本、风险、角色、签名和治理拦截器。"),
    ).not.toBeInTheDocument();
    expect(filterRegion).toBeInTheDocument();
    expect(screen.queryByText("搜索 Skill / Owner")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "内置 Skill" })).toBeInTheDocument();
    expect(await screen.findByText("node-health-read")).toBeInTheDocument();
    expect(screen.getAllByText("READ_ONLY").length).toBeGreaterThan(0);
    expect(screen.getByText("ops-reader")).toBeInTheDocument();
    expect(screen.queryByText("ROLE_ops-reader")).not.toBeInTheDocument();
    expect(screen.getByText("选中项详情： Node health")).toBeInTheDocument();
    expect(screen.getByText(/Owner: platform-observability/u)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "安装" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "升级" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "卸载" })).not.toBeInTheDocument();
    expect(screen.getByText("服务端未提供受控变更接口")).toBeInTheDocument();
  });

  test("shows an empty registry without example skills", async () => {
    useAuthenticatedSession();
    server.use(
      http.get("/internal/skills", () => HttpResponse.json({ total: 0, skills: [] })),
    );

    renderSkillRegistry();

    expect(
      await screen.findByRole("status", { name: "没有已注册 Skill" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("example-skill")).not.toBeInTheDocument();
  });

  test("shows the server refusal for a forbidden registry request", async () => {
    useAuthenticatedSession();
    server.use(
      http.get("/internal/skills", () =>
        HttpResponse.json(
          { code: "POLICY_DENIED", message: "当前主体无权读取 Skill 目录。" },
          { status: 403 },
        ),
      ),
    );

    renderSkillRegistry();

    expect(
      await screen.findByRole("alert", { name: "Skill 目录读取被拒绝" }),
    ).toBeInTheDocument();
  });

  test("submits natural-language registry queries to the skill routing endpoint", async () => {
    useAuthenticatedSession();
    /** @type {unknown[]} */
    const requests = [];
    server.use(
      http.get("/internal/skills", () =>
        HttpResponse.json({ total: 1, skills: [registeredSkill] }),
      ),
      http.post("/internal/routing/skills/search", async ({ request }) => {
        requests.push(await request.json());
        return HttpResponse.json({
          total: 1,
          candidates: [
            {
              skill: applicationLogSkill,
              releaseSnapshot: releaseSnapshotFor(applicationLogSkill),
              score: 105,
              matchedRules: ["分类匹配", "风险等级满足约束", "发布状态匹配"],
            },
          ],
        });
      }),
    );

    renderSkillRegistry();

    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("自然语言查询 Skill"), "应用日志只读");
    await user.click(screen.getByRole("button", { name: "查询候选 Skill" }));

    expect(await screen.findByText("候选 Skill")).toBeInTheDocument();
    expect(screen.getByText("application-log-summary-read")).toBeInTheDocument();
    expect(screen.getByText("候选分 105")).toBeInTheDocument();
    expect(requests).toEqual([
      {
        skillId: null,
        category: "APPLICATION_DIAGNOSTICS",
        maxRiskLevel: "READ_ONLY",
        requiredParameters: [],
        requiredTags: ["log"],
        requestContextTags: [],
        publicationStatusRequired: "VALIDATED",
      },
    ]);
  });

  test("blocks invalid skill catalog data", async () => {
    useAuthenticatedSession();
    server.use(
      http.get("/internal/skills", () => HttpResponse.json({ total: 1, skills: [] })),
    );

    renderSkillRegistry();

    expect(
      await screen.findByRole("alert", { name: "Skill 目录契约不兼容" }),
    ).toBeInTheDocument();
  });
});

const registeredSkill = {
  descriptor: {
    skillId: "node-health-read",
    version: "1.1.0",
    displayName: "Node health",
    description: "Reads node health",
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
    parameters: [],
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

const applicationLogSkill = {
  descriptor: {
    skillId: "application-log-summary-read",
    version: "1.0.0",
    displayName: "Application log summary",
    description: "Reads recent application logs",
    category: "APPLICATION_DIAGNOSTICS",
    riskLevel: "READ_ONLY",
    executor: "HTTP",
    outputType: "MARKDOWN",
    readOnly: true,
    timeoutSeconds: 30,
    owner: "application-ops",
    requiredRoles: ["ROLE_ops-reader"],
    tags: ["application", "log", "summary"],
    interceptors: ["AUTHORIZATION", "AUDIT", "SENSITIVE_DATA_MASKING"],
    parameters: [
      {
        name: "applicationName",
        displayName: "Application name",
        description: "Application identifier",
        type: "STRING",
        required: true,
        allowedValues: [],
        defaultValue: null,
      },
    ],
  },
  publication: {
    publishedBy: "application-ops",
    publishedAt: "2026-06-14T00:00:00Z",
    checksumSha256: "b".repeat(64),
    signatureAlgorithm: "HmacSHA256",
    signature: "signed",
  },
  publicationStatus: "VALIDATED",
  manifestPath: "application-log-summary/manifest.json",
};

/**
 * @param {{descriptor: {skillId: string, version: string}}} skill
 */
function releaseSnapshotFor(skill) {
  return {
    skillId: skill.descriptor.skillId,
    version: skill.descriptor.version,
    stage: "GENERAL_AVAILABLE",
    rolloutPercentage: 100,
    targetContextTags: [],
    reason: "P1 read-only registry search",
    updatedAt: "2026-06-14T00:00:00Z",
  };
}
