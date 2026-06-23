import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test } from "vitest";

import App from "../../app/App.jsx";
import { AppProviders } from "../../app/providers.jsx";
import { server } from "../../test/server.js";

/**
 * 渲染已登录操作员访问快捷连接页的完整应用路径。
 *
 * 这里经过真实路由和 ProtectedRoute，用来覆盖“已登录但能力未开放”的状态，而不是孤立渲染组件。
 */
function renderQuickLinks() {
  return render(
    <AppProviders Router={MemoryRouter} routerProps={{ initialEntries: ["/quick-links"] }}>
      <App />
    </AppProviders>,
  );
}

beforeEach(() => {
  server.use(
    http.get("/auth/session", () =>
      HttpResponse.json({
        authenticated: true,
        subject: "operator-1",
        username: "claim.reader",
        roles: ["ROLE_claim-log-reader"],
        authenticationType: "built-in",
      }),
    ),
  );
});

describe("QuickLinksPage", () => {
  test("renders a disabled capability page without calling missing quick-link APIs", async () => {
    // 如果页面误接入未定稿 API，这个计数会暴露回归，避免前端提前开放外部跳转能力。
    let templateRequestCount = 0;
    server.use(
      http.get("/internal/quick-links/splunk/templates", () => {
        templateRequestCount += 1;
        return HttpResponse.json({ contractVersion: "1.0", templates: [] });
      }),
    );

    renderQuickLinks();

    expect(await screen.findByRole("heading", { name: "快捷连接" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "快捷连接未开放" })).toBeInTheDocument();
    expect(screen.getByText("后端契约、策略授权和审计链路完成前不会开放外部跳转。")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /打开 Splunk/u })).not.toBeInTheDocument();
    expect(templateRequestCount).toBe(0);
  });
});
