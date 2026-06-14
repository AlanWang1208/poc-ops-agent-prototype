import { readFileSync } from "node:fs";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";

import App from "./App.jsx";
import { AppProviders } from "./providers.jsx";

const loginCss = readFileSync(
  "src/features/auth/LoginPage.module.css",
  "utf8",
);

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

describe("operator console routes", () => {
  it("shows only implemented protected-page navigation", () => {
    renderAt("/agent");

    expect(screen.getByRole("navigation", { name: "主导航" })).toBeVisible();
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
    const user = userEvent.setup();
    renderAt("/agent");

    await user.click(screen.getByRole("link", { name: "SQL 工作台" }));

    expect(
      screen.getByRole("heading", { name: "SQL 工作台" }),
    ).toBeInTheDocument();
  });

  it("redirects the root route to login", () => {
    renderAt("/");

    expect(
      screen.getByRole("heading", { name: "企业智能运维工作台" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "操作员登录" })).toBeInTheDocument();
    expect(screen.getByText("使用企业 SSO 登录")).toBeInTheDocument();
  });

  it("renders the prototype login entry without enabling out-of-scope actions", () => {
    renderAt("/login");

    expect(screen.getByText("SECURE OPERATOR ENTRY")).toBeInTheDocument();
    expect(screen.getByText("受控诊断链路")).toBeInTheDocument();
    expect(screen.getByText("企业单点登录")).toBeInTheDocument();
    expect(screen.queryByText("执行 SQL")).not.toBeInTheDocument();
    expect(screen.queryByText("Commit")).not.toBeInTheDocument();
    expect(screen.queryByText("Rollback")).not.toBeInTheDocument();
  });

  it("allows the operator account to be edited before SSO login", async () => {
    const user = userEvent.setup();
    renderAt("/login");

    const accountInput = screen.getByDisplayValue("ops.reader@company.internal");

    await user.clear(accountInput);
    await user.type(accountInput, "ops.admin@company.internal");

    expect(accountInput).toHaveValue("ops.admin@company.internal");
  });

  it("renders one ion from each node with the skill ion emphasized", () => {
    const { container } = renderAt("/login");

    const ions = Array.from(container.querySelectorAll("[data-node-ion]"));
    const routes = new Set(ions.map((ion) => ion.getAttribute("data-node-ion")));

    expect(ions).toHaveLength(4);
    expect(routes).toEqual(new Set(["identity", "policy", "skill", "worker"]));
    expect(container.querySelector('[data-node-ion="skill"]')).toHaveAttribute(
      "data-ion-emphasis",
      "primary",
    );
    expect(ions.every((ion) => ion.getAttribute("aria-hidden") === "true")).toBe(
      true,
    );
  });

  it("renders a restrained screen-wide ion field", () => {
    const { container } = renderAt("/login");

    const screenIons = Array.from(container.querySelectorAll("[data-screen-ion]"));

    expect(screenIons.length).toBeGreaterThanOrEqual(10);
    expect(container.querySelector("[data-screen-comet]")).not.toBeInTheDocument();
    expect(screenIons.every((ion) => ion.getAttribute("aria-hidden") === "true")).toBe(
      true,
    );
  });

  it("pins the login card to the content baseline instead of viewport center", () => {
    const loginCardRule = loginCss.match(/[.]loginCard\s*[{][^}]+[}]/u)?.[0] ?? "";

    expect(loginCardRule).toContain("align-self: start");
    expect(loginCardRule).not.toContain("align-self: center");
    expect(loginCardRule).not.toContain("transform: translateY");
  });
});
