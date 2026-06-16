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

  it("adds a lightweight frame without changing the existing login card layout", () => {
    const screenRule = loginCss.match(/[.]screen\s*[{][^}]+[}]/u)?.[0] ?? "";
    const screenBackdropRule =
      loginCss.match(/[.]screen::after\s*[{][^}]+[}]/u)?.[0] ?? "";
    const loginHeroEffectRule =
      loginCss.match(/[.]loginHeroEffect\s*[{][^}]+[}]/u)?.[0] ?? "";
    const taskCardRule = loginCss.match(/[.]taskCard\s*[{][^}]+[}]/u)?.[0] ?? "";
    const capabilityFlowRule =
      loginCss.match(/[.]capabilityFlow\s*[{][^}]+[}]/u)?.[0] ?? "";
    const loginShellRule =
      loginCss.match(/[.]loginShell\s*[{][^}]+[}]/u)?.[0] ?? "";
    const loginShellFrameRule =
      loginCss.match(/[.]loginShell::before\s*[{][^}]+[}]/u)?.[0] ?? "";
    const loginModeStripRule =
      loginCss.match(/[.]loginModeStrip\s*[{][^}]+[}]/u)?.[0] ?? "";
    const loginShellHaloRule =
      loginCss.match(/[.]loginShell::after\s*[{][^}]+[}]/u)?.[0] ?? "";
    const frameActiveTrackRule = loginCss.match(/[.]frameActiveTrack\b/u)?.[0] ?? "";
    const frameIonTailRule =
      Array.from(loginCss.matchAll(/[.]frameIonTail\s*[{][^}]+[}]/gu))
        .map((match) => match[0])
        .find((rule) => rule.includes("width: 72px")) ?? "";
    const loginCardRule = loginCss.match(/[.]loginCard\s*[{][^}]+[}]/u)?.[0] ?? "";

    expect(loginShellRule).toContain("isolation: isolate");
    expect(loginShellRule).toContain("grid-template-columns: 720px 560px");
    expect(loginShellRule).toContain("align-items: start");
    expect(loginShellRule).toContain("padding: 90px 40px 86px");
    expect(screenRule).toContain("--login-frame-height: min(720px, calc(100vh - 132px))");
    expect(screenRule).toContain(
      "--login-frame-y: calc((100vh - var(--login-frame-height)) / 2 - var(--login-frame-top))",
    );
    expect(loginShellRule).toContain("transform: translate(-50%, var(--login-frame-y))");
    expect(loginHeroEffectRule).toContain(
      "top: calc(var(--login-frame-y) + var(--login-frame-top) - 2px)",
    );
    expect(loginHeroEffectRule).toContain("right: max(24px, calc(50% - 646px))");
    expect(loginHeroEffectRule).toContain("transform: translateY(5px)");
    expect(taskCardRule).toContain("left: 320px");
    expect(taskCardRule).toContain("width: 176px");
    expect(capabilityFlowRule).toContain("right: 51px");
    expect(capabilityFlowRule).toContain("left: 73px");
    expect(loginModeStripRule).toContain("transform: translateY(-2px)");
    expect(loginShellRule).toContain("--frame-height: var(--login-frame-height)");
    expect(loginShellFrameRule).toContain(
      "inset: var(--frame-top) var(--frame-inset-x) auto",
    );
    expect(loginShellFrameRule).toContain("height: var(--frame-height)");
    expect(loginShellFrameRule).toContain("border: 1px solid rgba(166, 64, 92, 0.26)");
    expect(loginShellFrameRule).toContain("background: transparent");
    expect(loginShellFrameRule).toContain("0 18px 56px rgba(31, 41, 51, 0.055)");
    expect(loginShellFrameRule).toContain("inset 0 1px 0 rgba(255, 255, 255, 0.7)");
    expect(loginShellFrameRule).not.toContain("no-repeat");
    expect(loginShellFrameRule).not.toContain("outline:");
    expect(loginShellFrameRule).not.toContain("mask-composite");
    expect(loginShellFrameRule).toContain("border-radius: 22px");
    expect(loginShellHaloRule).toContain("animation: frame-ion-track 16s linear infinite");
    expect(loginShellHaloRule).toContain("width: 22px");
    expect(loginShellHaloRule).toContain("conic-gradient");
    expect(loginShellHaloRule).toContain("rgba(34, 126, 166, 0.72)");
    expect(loginShellHaloRule).toContain("rgba(31, 154, 108, 0.62)");
    expect(loginShellHaloRule).not.toContain("filter: blur");
    expect(loginShellHaloRule).not.toContain("mask-composite");
    expect(frameActiveTrackRule).toBe("");
    expect(loginCss).not.toContain("frame-active-track");
    expect(frameIonTailRule).toContain("width: 72px");
    expect(frameIonTailRule).toContain("transform-origin: right center");
    expect(frameIonTailRule).toContain("animation: frame-ion-tail 16s linear infinite");
    expect(screenBackdropRule).toContain("radial-gradient");
    expect(screenBackdropRule).toContain("linear-gradient(180deg");
    expect(loginCardRule).toContain("align-self: start");
    expect(loginCardRule).not.toContain("transform: translateY");
  });
});
