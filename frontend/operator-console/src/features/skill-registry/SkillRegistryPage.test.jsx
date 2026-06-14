import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
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
  test("renders real read-only skills and keeps change actions disabled", async () => {
    useAuthenticatedSession();
    server.use(
      http.get("/internal/skills", () =>
        HttpResponse.json({ total: 1, skills: [registeredSkill] }),
      ),
    );

    renderSkillRegistry();

    expect(await screen.findByText("node-health-read")).toBeInTheDocument();
    expect(screen.getByText("READ_ONLY")).toBeInTheDocument();
    expect(screen.getByText("platform-observability")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "安装" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "升级" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "卸载" })).toBeDisabled();
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

