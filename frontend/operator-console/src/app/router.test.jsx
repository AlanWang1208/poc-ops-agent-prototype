import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";

import App from "./App.jsx";
import { AppProviders } from "./providers.jsx";
import { server } from "../test/server.js";

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

describe("operator console routes", () => {
  it("shows only implemented protected-page navigation", async () => {
    useAuthenticatedSession();
    renderAt("/agent");

    expect(
      await screen.findByRole("navigation", { name: "主导航" }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Agent 工作台" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Skill 注册中心" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "SQL 工作台" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "审计记录" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("安全模式")).toBeInTheDocument();
    expect(screen.getByText("当前会话")).toBeInTheDocument();
  });

  it("navigates between implemented protected pages", async () => {
    useAuthenticatedSession();
    const user = userEvent.setup();
    renderAt("/agent");

    await screen.findByRole("heading", { name: "Agent 工作台" });
    await user.click(screen.getByRole("link", { name: "SQL 工作台" }));

    expect(
      await screen.findByRole("heading", { name: "SQL 工作台" }),
    ).toBeInTheDocument();
  });

  it("redirects the root route to login", async () => {
    useAnonymousSession();
    renderAt("/");

    expect(
      await screen.findByRole("heading", { name: "操作员登录" }),
    ).toBeInTheDocument();
  });
});
