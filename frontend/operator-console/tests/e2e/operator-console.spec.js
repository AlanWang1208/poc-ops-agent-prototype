/* global document */
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await mockConsoleApi(page);
});

test("登录页在桌面视口中保持安全边界可见", async ({ page }, testInfo) => {
  await page.route("**/auth/session", async (route) => {
    await route.fulfill({
      json: {
        authenticated: false,
        subject: null,
        username: null,
        roles: [],
        authenticationType: "anonymous",
      },
    });
  });

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "操作员登录" })).toBeVisible();
  await expect(page.getByRole("link", { name: "使用控制面登录" })).toHaveAttribute(
    "href",
    "/auth/login",
  );
  await expect(page.getByText("浏览器不承载授权决策。")).toBeVisible();
  await assertNoHorizontalOverflow(page);
  await attachVisualEvidence(page, testInfo, "login");
});

test("受保护页面导航、层级和禁用态在桌面视口中稳定", async ({ page }, testInfo) => {
  await page.goto("/agent");

  await expect(page.getByRole("heading", { name: "Agent 工作台" })).toBeVisible();
  await expect(page.getByText("node-health-read")).toBeVisible();
  await expect(page.getByRole("button", { name: "发送任务" })).toBeDisabled();
  await assertNoHorizontalOverflow(page);
  await attachVisualEvidence(page, testInfo, "agent");

  await page.getByRole("link", { name: "Skill 注册中心" }).click();
  await expect(page.getByRole("heading", { name: "Skill 注册中心" })).toBeVisible();
  await page.getByLabel("Skill 筛选").getByLabel("搜索").fill("node");
  await expect(page.getByText("node-health-read")).toBeVisible();
  await expect(page.getByRole("button", { name: "安装" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "升级" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "卸载" })).toBeDisabled();
  await assertNoHorizontalOverflow(page);
  await attachVisualEvidence(page, testInfo, "skills");

  await page.getByRole("link", { name: "SQL 工作台" }).click();
  await expect(page.getByRole("heading", { name: "SQL 工作台" })).toBeVisible();
  await expect(page.getByText("as400-development")).toBeVisible();
  await expect(page.getByText("as400-test")).toBeVisible();
  await expect(page.getByRole("button", { name: "询问 AI" })).toBeDisabled();
  await assertNoHorizontalOverflow(page);
  await attachVisualEvidence(page, testInfo, "sql");
});

test("SQL 工作台只提交校验请求并展示服务端报告", async ({ page }) => {
  await page.goto("/sql");

  await expect(page.getByRole("heading", { name: "SQL 工作台" })).toBeVisible();
  await page.getByRole("button", { name: "校验只读执行" }).click();

  await expect(page.getByText("VALIDATED")).toBeVisible();
  await expect(page.getByText("sha256:readonly")).toBeVisible();

  await page.getByRole("button", { name: "DML 预检" }).click();

  await expect(page.getByText("REJECTED")).toBeVisible();
  await expect(page.getByText("DML execution is not allowed in P1")).toBeVisible();
  await expect(page.getByRole("button", { name: "询问 AI" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "校验只读执行" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "DML 预检" })).toBeEnabled();
});

/**
 * @param {import("@playwright/test").Page} page
 */
async function mockConsoleApi(page) {
  await page.route("**/auth/session", async (route) => {
    await route.fulfill({
      json: {
        authenticated: true,
        subject: "alice-id",
        username: "alice",
        roles: ["ROLE_ops-reader"],
        authenticationType: "built-in",
      },
    });
  });

  await page.route("**/internal/routing/skills/search", async (route) => {
    await route.fulfill({
      json: {
        total: 1,
        candidates: [
          {
            skill: registeredSkill,
            releaseSnapshot: {
              skillId: "node-health-read",
              version: "1.1.0",
              stage: "GENERAL_AVAILABLE",
              rolloutPercentage: 100,
              targetContextTags: ["p1", "readonly"],
              reason: "P1 read-only diagnostic baseline",
              updatedAt: "2026-06-14T00:00:00Z",
            },
            score: 96,
            matchedRules: ["risk<=READ_ONLY", "publication=VALIDATED"],
          },
        ],
      },
    });
  });

  await page.route("**/internal/skills", async (route) => {
    await route.fulfill({
      json: {
        total: 1,
        skills: [registeredSkill],
      },
    });
  });

  await page.route("**/internal/sql-workbench/connections", async (route) => {
    await route.fulfill({
      json: [
        {
          contractVersion: "1.0",
          connectionId: "as400-development",
          displayName: "AS/400 Development",
          targetEnvironment: "development",
          platformType: "DB2_FOR_I",
          allowedSchemas: ["ORDERS"],
          capabilities: ["VALIDATE", "RUN_READ_ONLY", "PREFLIGHT_DML"],
        },
        {
          contractVersion: "1.0",
          connectionId: "as400-test",
          displayName: "AS/400 Test",
          targetEnvironment: "test",
          platformType: "DB2_FOR_I",
          allowedSchemas: ["ORDERS"],
          capabilities: ["VALIDATE", "RUN_READ_ONLY", "PREFLIGHT_DML"],
        },
      ],
    });
  });

  await page.route("**/internal/sql-workbench/queries/validate", async (route) => {
    const request = route.request().postDataJSON();
    expect(request).toMatchObject({
      contractVersion: "1.0",
      connectionId: "as400-development",
      targetEnvironment: "development",
      schema: "ORDERS",
    });

    await route.fulfill({
      json:
        request.action === "PREFLIGHT_DML"
          ? {
              ...validationReport,
              validationLevel: "REJECTED",
              sqlHash: "sha256:dml",
              rejectionReasons: ["DML execution is not allowed in P1"],
              risks: ["WRITE_OPERATION"],
              unverifiedItems: ["Target row count"],
            }
          : validationReport,
    });
  });
}

/**
 * @param {import("@playwright/test").Page} page
 */
async function assertNoHorizontalOverflow(page) {
  const layout = await page.evaluate(() => {
    const root = document.documentElement;
    return {
      clientWidth: root.clientWidth,
      scrollWidth: root.scrollWidth,
    };
  });

  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
}

/**
 * @param {import("@playwright/test").Page} page
 * @param {import("@playwright/test").TestInfo} testInfo
 * @param {string} name
 */
async function attachVisualEvidence(page, testInfo, name) {
  const screenshot = await page.screenshot({ fullPage: true });
  await testInfo.attach(`${testInfo.project.name}-${name}`, {
    body: screenshot,
    contentType: "image/png",
  });
}

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

const validationReport = {
  contractVersion: "1.0",
  statementType: "SELECT",
  validationLevel: "VALIDATED",
  sqlHash: "sha256:readonly",
  referencedObjects: ["ORDERS.ORDERS"],
  risks: [],
  rejectionReasons: [],
  unverifiedItems: [],
};
