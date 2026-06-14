import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import App from "../../app/App.jsx";
import { AppProviders } from "../../app/providers.jsx";
import { server } from "../../test/server.js";

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

describe("LoginPage", () => {
  test("shows the login action for an anonymous session", async () => {
    useAnonymousSession();

    renderAt("/login");

    expect(
      await screen.findByRole("heading", { name: "操作员登录" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "使用控制面登录" }),
    ).toHaveAttribute("href", "/auth/login");
    expect(screen.getByText("P1 只读诊断 MVP")).toBeInTheDocument();
  });

  test("redirects an authenticated user from login to agent workspace", async () => {
    useAuthenticatedSession();

    renderAt("/login");

    expect(
      await screen.findByRole("heading", { name: "Agent 工作台" }),
    ).toBeInTheDocument();
  });

  test("redirects an anonymous user from protected routes to login", async () => {
    useAnonymousSession();

    renderAt("/skills");

    expect(
      await screen.findByRole("heading", { name: "操作员登录" }),
    ).toBeInTheDocument();
  });

  test("shows a stable session error when the contract is invalid", async () => {
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
      await screen.findByRole("alert", { name: "会话状态暂不可用" }),
    ).toBeInTheDocument();
  });

  test("shows the session subject and logout entry in the protected shell", async () => {
    useAuthenticatedSession();

    renderAt("/agent");

    expect(await screen.findByText("alice")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "退出登录" })).toHaveAttribute(
      "href",
      "/auth/logout",
    );
  });
});

