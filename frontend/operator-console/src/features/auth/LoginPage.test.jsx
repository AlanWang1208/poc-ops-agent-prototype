import { readFileSync } from "node:fs";

import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test } from "vitest";

import App from "../../app/App.jsx";
import { AppProviders } from "../../app/providers.jsx";
import { server } from "../../test/server.js";

const loginCss = readFileSync("src/features/auth/LoginPage.module.css", "utf8");

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

function useAnonymousSession() {
  server.use(
    http.get("/auth/session", () =>
      HttpResponse.json(
        {
          authenticated: false,
          subject: null,
          username: null,
          roles: [],
          authenticationType: "anonymous",
        },
        { status: 401 },
      ),
    ),
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

beforeEach(() => {
  server.use(...defaultHandlers);
});

describe("LoginPage", () => {
  test("shows the login action for an anonymous session", async () => {
    useAnonymousSession();

    renderAt("/login");

    expect(
      await screen.findByRole("heading", { name: "用户登录" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("用户名")).toBeInTheDocument();
    expect(screen.getByLabelText("密码")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "登录" })).toBeInTheDocument();
    expect(screen.getByText("P1 只读模式")).toBeInTheDocument();
  });

  test("starts with an empty username field", async () => {
    useAnonymousSession();

    renderAt("/login");

    expect(await screen.findByLabelText("用户名")).toHaveValue("");
  });

  test("keeps the password login entry visible for authenticated browser sessions", async () => {
    useAuthenticatedSession();

    renderAt("/login");

    expect(
      await screen.findByRole("heading", { name: "用户登录" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "登录" })).toBeInTheDocument();
  });

  test("toggles the password field between masked and visible text", async () => {
    const user = userEvent.setup();
    useAnonymousSession();

    renderAt("/login");

    const passwordInput = await screen.findByLabelText("密码");
    expect(passwordInput).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: "显示密码" }));
    expect(passwordInput).toHaveAttribute("type", "text");

    await user.click(screen.getByRole("button", { name: "隐藏密码" }));
    expect(passwordInput).toHaveAttribute("type", "password");
  });

  test("submits the built-in identity login contract and enters the overview after success", async () => {
    const user = userEvent.setup();
    /** @type {unknown[]} */
    const requests = [];
    let authenticated = false;
    server.use(
      http.get("/auth/session", () =>
        authenticated
          ? HttpResponse.json({
              authenticated: true,
              subject: "operator-1",
              username: "alice",
              roles: ["ROLE_ops-reader"],
              authenticationType: "built-in",
            })
          : HttpResponse.json(
              {
                authenticated: false,
                subject: null,
                username: null,
                roles: [],
                authenticationType: "anonymous",
              },
              { status: 401 },
            ),
      ),
      http.post("/auth/login", async ({ request }) => {
        requests.push(await request.json());
        // 登录成功后，受保护路由会重新读取浏览器会话；测试必须模拟控制面已经建立会话。
        authenticated = true;
        return HttpResponse.json({
          authenticated: true,
          subject: "operator-1",
          username: "alice",
          roles: ["ROLE_ops-reader"],
          passwordChangeRequired: false,
        });
      }),
    );

    renderAt("/login");

    await user.clear(screen.getByLabelText("用户名"));
    await user.type(screen.getByLabelText("用户名"), "alice");
    await user.type(screen.getByLabelText("密码"), "Start#2026");
    await user.click(screen.getByRole("button", { name: "登录" }));

    expect(requests).toEqual([{ username: "alice", password: "Start#2026" }]);
    expect(
      await screen.findByRole("heading", { name: "平台总览" }),
    ).toBeInTheDocument();
  });

  test("stays on the login page when the control plane rejects credentials", async () => {
    const user = userEvent.setup();
    server.use(
      http.post("/auth/login", () =>
        HttpResponse.json(
          {
            errorCode: "INVALID_CREDENTIALS",
            message: "Invalid username or password",
          },
          { status: 401 },
        ),
      ),
    );

    renderAt("/login");

    await user.type(screen.getByLabelText("用户名"), "alice");
    await user.type(screen.getByLabelText("密码"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "登录" }));

    expect(
      await screen.findByRole("alert", { name: "登录失败" }),
    ).toHaveTextContent("用户名或密码不正确");
    expect(screen.getByRole("heading", { name: "用户登录" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "平台总览" })).not.toBeInTheDocument();
  });

  test("explains backend connectivity failures without entering the overview", async () => {
    const user = userEvent.setup();
    server.use(
      http.post("/auth/login", () =>
        HttpResponse.json(
          {
            message: "Bad Gateway",
          },
          { status: 502 },
        ),
      ),
    );

    renderAt("/login");

    await user.type(screen.getByLabelText("用户名"), "alice");
    await user.type(screen.getByLabelText("密码"), "Start#2026");
    await user.click(screen.getByRole("button", { name: "登录" }));

    expect(
      await screen.findByRole("alert", { name: "登录失败" }),
    ).toHaveTextContent("控制面服务暂时不可用，请确认后端服务已启动后再重试。");
    expect(screen.queryByRole("heading", { name: "平台总览" })).not.toBeInTheDocument();
  });

  test("keeps the login card height fixed without a blank reserved error slot", () => {
    const loginCardRule = loginCss.match(/[.]loginCard\s*[{][^}]+[}]/u)?.[0] ?? "";
    const loginCardWithErrorRule =
      loginCss.match(/[.]loginCardWithError\s*[{][^}]+[}]/u)?.[0] ?? "";
    const loginErrorRule = loginCss.match(/[.]loginError\s*[{][^}]+[}]/u)?.[0] ?? "";

    expect(loginCardRule).toMatch(/\n\s+height:\s*344px/u);
    expect(loginCardRule).not.toContain("min-height: 344px");
    expect(loginCss).not.toContain("loginErrorSlot");
    expect(loginCardWithErrorRule).toContain("padding: 28px 36px 24px");
    expect(loginErrorRule).not.toContain("position: absolute");
    expect(loginErrorRule).not.toContain("bottom: calc(100% + 12px)");
  });

  test("keeps login labels stacked above inputs", () => {
    const loginFieldRule = loginCss.match(/[.]loginField\s*[{][^}]+[}]/u)?.[0] ?? "";

    expect(loginFieldRule).not.toContain("grid-template-columns");
    expect(loginFieldRule).toContain("display: grid");
  });

  test("redirects anonymous operators away from menu pages", async () => {
    useAnonymousSession();

    renderAt("/overview");

    expect(
      await screen.findByRole("heading", { name: "用户登录" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "平台总览" })).not.toBeInTheDocument();
  });

  test("does not block the login entry when the session contract is invalid", async () => {
    server.use(
      http.get("/auth/session", () =>
        HttpResponse.json({
          authenticated: "yes",
          subject: null,
          username: null,
          roles: [],
          authenticationType: "anonymous",
        }),
      ),
    );

    renderAt("/login");

    expect(
      await screen.findByRole("heading", { name: "用户登录" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "登录" })).toBeInTheDocument();
    expect(screen.queryByRole("alert", { name: "会话状态暂不可用" })).not.toBeInTheDocument();
  });

  test("shows the session subject and logout button in the workspace status bar", async () => {
    useAuthenticatedSession();

    renderAt("/agent");

    expect(await screen.findByText("alice")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "登出当前账号" })).toBeEnabled();
  });
});

const defaultHandlers = [
  http.get("/internal/skills", () =>
    HttpResponse.json({
      skills: [],
    }),
  ),
  http.post("/internal/routing/skills/search", () =>
    HttpResponse.json({
      total: 0,
      candidates: [],
    }),
  ),
];
