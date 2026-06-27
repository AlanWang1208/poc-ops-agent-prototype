import { readFileSync } from "node:fs";

import { http, HttpResponse } from "msw";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { AppProviders } from "../../app/providers.jsx";
import { server } from "../../test/server.js";
import { WorkspaceStatusBar } from "./WorkspaceStatusBar.jsx";

const source = readFileSync("src/components/layout/WorkspaceStatusBar.jsx", "utf8");
const css = readFileSync("src/components/layout/WorkspaceStatusBar.module.css", "utf8");
const tokensCss = readFileSync("src/styles/tokens.css", "utf8");

function renderStatusBar() {
  server.use(
    http.get("/auth/session", () =>
      HttpResponse.json({
        authenticated: true,
        subject: "account-admin-1",
        username: "admin",
        roles: ["ROLE_ops-admin"],
        authenticationType: "built-in",
      }),
    ),
  );

  return render(
    <AppProviders Router={MemoryRouter} routerProps={{ initialEntries: ["/agent"] }}>
      <WorkspaceStatusBar title="Agent 工作区" />
    </AppProviders>,
  );
}

describe("WorkspaceStatusBar", () => {
  it("renders a refined operator toolbar without module-chain labels", async () => {
    renderStatusBar();

    const statusBar = screen.getByLabelText("当前工作台");
    const workspaceStatus = within(statusBar).getByLabelText("工作台状态");
    const profile = await within(statusBar).findByLabelText("当前登录人");

    expect(within(statusBar).getByText("企业智能 Agent")).toBeInTheDocument();
    expect(within(statusBar).getByRole("heading", { name: "Agent 工作区" })).toBeInTheDocument();
    expect(within(statusBar).queryByRole("list", { name: "只读执行链路" })).not.toBeInTheDocument();
    expect(within(statusBar).queryByText("M01")).not.toBeInTheDocument();
    expect(within(statusBar).queryByText("M02")).not.toBeInTheDocument();
    expect(within(statusBar).queryByText("M05")).not.toBeInTheDocument();
    expect(within(statusBar).queryByText("M07")).not.toBeInTheDocument();
    expect(within(statusBar).queryByText("身份")).not.toBeInTheDocument();
    expect(within(statusBar).queryByText("策略")).not.toBeInTheDocument();
    expect(within(statusBar).queryByText("工作流")).not.toBeInTheDocument();
    expect(within(statusBar).queryByText("Worker")).not.toBeInTheDocument();
    expect(within(workspaceStatus).getByText("P1 只读控制台")).toBeInTheDocument();
    expect(within(workspaceStatus).getByText("会话在线")).toBeInTheDocument();
    expect(await within(profile).findByText("admin")).toBeInTheDocument();
    expect(within(statusBar).getByRole("timer", { name: /下班倒计时：/u })).toBeInTheDocument();
    expect(within(statusBar).getByRole("button", { name: "登出当前账号" })).toBeEnabled();
  });

  it("keeps the richer toolbar as one explicit product surface", () => {
    expect(source).toContain("className={styles.brandPlate}");
    expect(source).toContain("className={styles.workspaceContext}");
    expect(source).toContain("className={styles.signalRail}");
    expect(source).toContain("className={styles.operatorDock}");
    expect(source).not.toContain("READ_ONLY_TRAIL");
    expect(source).not.toContain("workspaceTrail");
    expect(source).not.toContain("trailItem");
    expect(css).toContain("grid-template-columns: minmax(260px, 360px) minmax(360px, 1fr) max-content");
    expect(css).toContain("background: oklch");
    expect(css).toContain("border-radius: 18px");
    const brandPlateRule = css.match(/[.]brandPlate\s*[{][^}]+[}]/u)?.[0] ?? "";
    const brandPlateBeforeRule = css.match(/[.]brandPlate::before\s*[{][^}]+[}]/u)?.[0] ?? "";
    const brandPlateAfterRule = css.match(/[.]brandPlate::after\s*[{][^}]+[}]/u)?.[0] ?? "";
    const brandNameRule = css.match(/[.]brandName\s*[{][^}]+[}]/u)?.[0] ?? "";
    const headingRule = css.match(/[.]capsuleHeading\s*[{][^}]+[}]/u)?.[0] ?? "";

    expect(tokensCss).toContain('--font-heading: Inter, "HarmonyOS Sans SC", MiSans');
    expect(brandPlateRule).toContain("position: relative");
    expect(brandPlateRule).toContain("isolation: isolate");
    expect(brandPlateRule).toContain("overflow: hidden");
    expect(brandPlateRule).toContain("radial-gradient");
    expect(brandPlateRule).not.toContain("repeating-linear-gradient");
    expect(brandPlateBeforeRule).toContain("radial-gradient");
    expect(brandPlateBeforeRule).toContain("mask-image: linear-gradient");
    expect(brandPlateBeforeRule).not.toContain("repeating-linear-gradient");
    expect(brandPlateBeforeRule).not.toContain("linear-gradient(90deg, transparent 0 60px");
    expect(brandPlateAfterRule).toContain("height: 2px");
    expect(brandPlateAfterRule).toContain("var(--toolbar-blue)");
    expect(brandNameRule).toContain("font-weight: 830");
    expect(headingRule).toContain("font-size: 1.06rem");
    expect(headingRule).toContain("font-family: var(--font-heading");
    expect(headingRule).toContain("font-synthesis-weight: none");
    expect(headingRule).toContain("font-weight: 680");
    expect(headingRule).toContain("line-height: 1.16");
    expect(headingRule).toContain("-webkit-font-smoothing: antialiased");
    expect(headingRule).not.toContain("font-weight: 520");
    expect(headingRule).not.toContain("font-weight: 600");
    expect(headingRule).not.toContain("font-weight: 880");
    expect(css).toContain("conic-gradient");
    expect(css).not.toContain(".logoMark::before");
    expect(css).toContain("animation: logo-mark-breathe");
    expect(css).toContain("animation: logo-mark-orbit");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).not.toContain(".appCapsule::after");
    expect(css).not.toContain("brand-scan");
    expect(css).not.toContain("frame-glass-sheen");
  });
});
