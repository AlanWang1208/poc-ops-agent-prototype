import { http, HttpResponse } from "msw";
import { describe, expect, test, vi } from "vitest";
import { z } from "zod";

import {
  getLogoutUrl,
  getBrowserSession,
  getLoginUrl,
  loginWithPassword,
  logout,
} from "./auth-api.js";
import { searchSkillCandidates } from "./agent-api.js";
import { ApiError, requestJson } from "./client.js";
import { getSkill, listSkills } from "./skill-api.js";
import { listSqlConnections, validateSqlQuery } from "./sql-api.js";
import { server } from "../test/server.js";

describe("requestJson", () => {
  test("classifies a structured 403 response without inferring status from its message", async () => {
    server.use(
      http.get("/forbidden", () =>
        HttpResponse.json(
          {
            code: "POLICY_DENIED",
            message: "The display text says unauthorized, but HTTP is authoritative.",
          },
          { status: 403 },
        ),
      ),
    );

    await expect(
      requestJson("/forbidden", { schema: z.object({ ok: z.boolean() }) }),
    ).rejects.toMatchObject({
      name: "ApiError",
      status: 403,
      kind: "forbidden",
      code: "POLICY_DENIED",
      message: "The display text says unauthorized, but HTTP is authoritative.",
    });
  });

  test("classifies fetch failures as network errors", async () => {
    server.use(http.get("/offline", () => HttpResponse.error()));

    await expect(
      requestJson("/offline", { schema: z.object({ ok: z.boolean() }) }),
    ).rejects.toMatchObject({
      name: "ApiError",
      status: 0,
      kind: "network",
    });
  });

  test("classifies invalid successful responses as contract errors", async () => {
    server.use(http.get("/invalid-contract", () => HttpResponse.json({ ok: "yes" })));

    await expect(
      requestJson("/invalid-contract", { schema: z.object({ ok: z.boolean() }) }),
    ).rejects.toMatchObject({
      name: "ApiError",
      status: 200,
      kind: "contract",
    });
  });

  test("classifies malformed successful JSON as a contract error", async () => {
    server.use(
      http.get(
        "/malformed-contract",
        () =>
          new HttpResponse("{", {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );

    await expect(
      requestJson("/malformed-contract", { schema: z.object({ ok: z.boolean() }) }),
    ).rejects.toMatchObject({
      name: "ApiError",
      status: 200,
      kind: "contract",
    });
  });

  test("includes browser credentials and JSON accept headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await requestJson("/credential-check", {
      schema: z.object({ ok: z.boolean() }),
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/credential-check",
      expect.objectContaining({
        credentials: "include",
        headers: expect.objectContaining({ Accept: "application/json" }),
      }),
    );
    vi.unstubAllGlobals();
  });

  test("ApiError preserves its stable fields", () => {
    const error = new ApiError({
      status: 400,
      kind: "request",
      code: "INVALID_ARGUMENT",
      message: "Invalid request",
    });

    expect(error).toMatchObject({
      name: "ApiError",
      status: 400,
      kind: "request",
      code: "INVALID_ARGUMENT",
      message: "Invalid request",
    });
  });
});

describe("feature API modules", () => {
  test("maps authentication endpoints to the browser session and built-in login contract", async () => {
    /** @type {unknown[]} */
    const loginRequests = [];
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
      http.post("/auth/login", async ({ request }) => {
        loginRequests.push(await request.json());
        return HttpResponse.json({
          authenticated: true,
          subject: "alice-id",
          username: "alice",
          roles: ["ROLE_ops-reader"],
          passwordChangeRequired: false,
        });
      }),
      http.get("/auth/logout", () => new HttpResponse(null, { status: 204 })),
    );

    await expect(getBrowserSession()).resolves.toMatchObject({ username: "alice" });
    await expect(
      loginWithPassword({ username: "alice", password: "Start#2026" }),
    ).resolves.toMatchObject({ username: "alice" });
    await expect(logout()).resolves.toBeUndefined();
    expect(loginRequests).toEqual([{ username: "alice", password: "Start#2026" }]);
    expect(getLoginUrl()).toBe("/auth/login");
    expect(getLogoutUrl()).toBe("/auth/logout");
  });

  test("treats redirected browser logout HTML as a completed logout", async () => {
    server.use(
      http.get("/auth/logout", () =>
        HttpResponse.text("<!doctype html><title>Operator console</title>", {
          headers: { "Content-Type": "text/html" },
        }),
      ),
    );

    await expect(logout()).resolves.toBeUndefined();
  });

  test("maps skill, routing, and SQL endpoints to their real control-plane paths", async () => {
    /** @type {Array<[string, string] | [string, string, unknown]>} */
    const calls = [];
    server.use(
      http.get("/internal/skills", ({ request }) => {
        calls.push([request.method, new URL(request.url).pathname]);
        return HttpResponse.json({ total: 0, skills: [] });
      }),
      http.get("/internal/skills/node-health-read", ({ request }) => {
        calls.push([request.method, new URL(request.url).pathname]);
        return HttpResponse.json({ skill: registeredSkill });
      }),
      http.post("/internal/routing/skills/search", async ({ request }) => {
        calls.push([request.method, new URL(request.url).pathname, await request.json()]);
        return HttpResponse.json({ total: 0, candidates: [] });
      }),
      http.get("/internal/sql-workbench/connections", ({ request }) => {
        calls.push([request.method, new URL(request.url).pathname]);
        return HttpResponse.json([]);
      }),
      http.post("/internal/sql-workbench/queries/validate", async ({ request }) => {
        calls.push([request.method, new URL(request.url).pathname, await request.json()]);
        return HttpResponse.json(validationReport);
      }),
    );

    await listSkills();
    await getSkill("node-health-read");
    await searchSkillCandidates(routingRequest);
    await listSqlConnections();
    await validateSqlQuery(sqlRequest);

    expect(calls).toEqual([
      ["GET", "/internal/skills"],
      ["GET", "/internal/skills/node-health-read"],
      ["POST", "/internal/routing/skills/search", routingRequest],
      ["GET", "/internal/sql-workbench/connections"],
      ["POST", "/internal/sql-workbench/queries/validate", sqlRequest],
    ]);
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

const routingRequest = {
  skillId: null,
  category: null,
  maxRiskLevel: "READ_ONLY",
  requiredParameters: [],
  requiredTags: [],
  requestContextTags: [],
  publicationStatusRequired: "VALIDATED",
};

const sqlRequest = {
  contractVersion: "1.0",
  connectionId: "as400-development",
  targetEnvironment: "development",
  schema: "ORDERS",
  action: "VALIDATE",
  sql: "select * from ORDERS.ORDERS",
  parameters: [],
  limits: { maxRows: 500, maxBytes: 5000000, timeoutSeconds: 30 },
  idempotencyKey: "sql-validate-1",
};

const validationReport = {
  contractVersion: "1.0",
  statementType: "SELECT",
  validationLevel: "VALIDATED",
  sqlHash: "sha256:query",
  referencedObjects: ["ORDERS.ORDERS"],
  risks: [],
  rejectionReasons: [],
  unverifiedItems: [],
};
