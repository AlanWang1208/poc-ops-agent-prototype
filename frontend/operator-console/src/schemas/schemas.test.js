import { describe, expect, test } from "vitest";

import { browserSessionSchema } from "./auth-schemas.js";
import {
  agentDiagnosticRequestSchema,
  agentTaskResultSchema,
  nodeHealthOutputSchema,
  readOnlyDiagnosticRequestSchema,
  semanticEventSchema,
  skillRoutingResponseSchema,
} from "./agent-schemas.js";
import { skillCatalogSchema, skillLookupSchema } from "./skill-schemas.js";
import {
  sqlConnectionListSchema,
  sqlQueryRequestSchema,
  sqlValidationReportSchema,
} from "./sql-schemas.js";

describe("browserSessionSchema", () => {
  test("accepts the current BrowserSessionResponse", () => {
    expect(
      browserSessionSchema.parse({
        authenticated: true,
        subject: "alice-id",
        username: "alice",
        roles: ["ROLE_ops-reader"],
        authenticationType: "built-in",
      }),
    ).toMatchObject({ authenticated: true, username: "alice" });
  });

  test("accepts only explicit known identity-session extensions", () => {
    expect(
      browserSessionSchema.parse({
        authenticated: true,
        subject: "alice-id",
        username: "alice",
        roles: ["ROLE_ops-reader"],
        authenticationType: "built-in",
        sessionExpiresAt: "2026-06-14T08:00:00Z",
        passwordChangeRequired: false,
        workspaces: [{ workspaceId: "operations", displayName: "Operations" }],
        currentWorkspaceId: "operations",
      }),
    ).toMatchObject({ currentWorkspaceId: "operations" });
  });

  test("rejects invalid or internally inconsistent sessions", () => {
    expect(() => browserSessionSchema.parse({ authenticated: "yes" })).toThrow();
    expect(() =>
      browserSessionSchema.parse({
        authenticated: false,
        subject: "alice-id",
        username: null,
        roles: [],
        authenticationType: "anonymous",
      }),
    ).toThrow();
  });
});

describe("skill schemas", () => {
  test("accepts registered skill descriptor and publication data", () => {
    expect(skillCatalogSchema.parse({ total: 1, skills: [registeredSkill] }).total).toBe(1);
    expect(skillLookupSchema.parse({ skill: registeredSkill }).skill.descriptor.readOnly).toBe(true);
  });

  test("strictly rejects a catalog total that disagrees with its skills", () => {
    expect(() => skillCatalogSchema.parse({ total: 1, skills: [] })).toThrow();
  });

  test("strictly rejects a routing total that disagrees with its candidates", () => {
    expect(() => skillRoutingResponseSchema.parse({ total: 1, candidates: [] })).toThrow();
  });
});

describe("SQL schemas", () => {
  test("accepts development and test DB2 for i connections", () => {
    expect(
      sqlConnectionListSchema.parse([
        {
          contractVersion: "1.0",
          connectionId: "as400-development",
          displayName: "AS/400 Development",
          targetEnvironment: "development",
          platformType: "DB2_FOR_I",
          allowedSchemas: ["ORDERS"],
          capabilities: ["VALIDATE", "RUN_READ_ONLY", "PREFLIGHT_DML"],
        },
      ]),
    ).toHaveLength(1);
  });

  test("rejects any production connection instead of silently filtering it", () => {
    expect(() =>
      sqlConnectionListSchema.parse([
        {
          contractVersion: "1.0",
          connectionId: "as400-production",
          displayName: "AS/400 Production",
          targetEnvironment: "production",
          platformType: "DB2_FOR_I",
          allowedSchemas: ["ORDERS"],
          capabilities: ["VALIDATE"],
        },
      ]),
    ).toThrow();
  });

  test("accepts the real validation report fields", () => {
    expect(sqlValidationReportSchema.parse(validationReport)).toEqual(validationReport);
  });

  test("rejects production SQL requests", () => {
    expect(() =>
      sqlQueryRequestSchema.parse({
        ...sqlRequest,
        targetEnvironment: "production",
      }),
    ).toThrow();
  });
});

describe("semanticEventSchema", () => {
  test("requires the event type to match its strongly typed payload", () => {
    expect(() =>
      semanticEventSchema.parse({
        contractVersion: "1.0",
        eventId: "9cf516e0-561e-4cbf-8f18-c0b36a54b4da",
        workflowId: "193b2852-cd76-46a2-a589-dd350d830e6a",
        sequence: 1,
        timestamp: "2026-06-14T00:00:00Z",
        type: "WORKFLOW_STARTED",
        payload: {
          payloadType: "SKILL_ROUTED",
          skillId: "node-health-read",
          skillVersion: "1.1.0",
        },
      }),
    ).toThrow();
  });
});

describe("readOnlyDiagnosticRequestSchema", () => {
  test("accepts the fixed P1 node health request", () => {
    expect(readOnlyDiagnosticRequestSchema.parse(nodeHealthRequest)).toEqual(nodeHealthRequest);
  });

  test("rejects production diagnostic requests", () => {
    expect(() =>
      readOnlyDiagnosticRequestSchema.parse({
        ...nodeHealthRequest,
        targetEnvironment: "production",
      }),
    ).toThrow();
  });
});

describe("agent diagnostic schemas", () => {
  test("accepts a main AgentScope diagnostic task request", () => {
    expect(agentDiagnosticRequestSchema.parse(agentDiagnosticRequest)).toEqual(agentDiagnosticRequest);
  });

  test("rejects production or blank main Agent task requests", () => {
    expect(() =>
      agentDiagnosticRequestSchema.parse({
        ...agentDiagnosticRequest,
        targetEnvironment: "production",
      }),
    ).toThrow();
    expect(() =>
      agentDiagnosticRequestSchema.parse({
        ...agentDiagnosticRequest,
        userIntent: "   ",
      }),
    ).toThrow();
  });

  test("accepts the main Agent task result contract", () => {
    expect(agentTaskResultSchema.parse(agentTaskResult)).toEqual(agentTaskResult);
  });

  test("rejects unsupported main Agent task result statuses", () => {
    expect(() =>
      agentTaskResultSchema.parse({
        ...agentTaskResult,
        status: "NEEDS_APPROVAL",
      }),
    ).toThrow();
  });
});

describe("nodeHealthOutputSchema", () => {
  test("accepts complete node health output", () => {
    expect(nodeHealthOutputSchema.parse(nodeHealthOutput)).toEqual(nodeHealthOutput);
  });

  test("rejects incomplete node health output", () => {
    const incompleteOutput = Object.fromEntries(
      Object.entries(nodeHealthOutput).filter(([key]) => key !== "diskUsagePercent"),
    );

    expect(() => nodeHealthOutputSchema.parse(incompleteOutput)).toThrow();
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
    parameters: [
      {
        name: "nodeName",
        displayName: "Node",
        description: "Node identifier",
        type: "STRING",
        required: true,
        allowedValues: [],
        defaultValue: null,
      },
    ],
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

const nodeHealthRequest = {
  skillId: "node-health-read",
  targetEnvironment: "development",
  parameters: {
    nodeName: "node-a",
  },
  idempotencyKey: "node-health-request-1",
};

const agentDiagnosticRequest = {
  targetEnvironment: "development",
  idempotencyKey: "agent-workspace-task-00000000-0000-4000-8000-000000000001",
  userIntent: "检查 node-a 健康状态并总结风险",
  inputParameters: {},
};

const agentTaskResult = {
  schemaVersion: "1.0",
  taskId: "task-0001",
  workflowId: "00000000-0000-4000-8000-000000000301",
  status: "SUCCEEDED",
  summary: "已完成只读诊断，未发现阻塞风险。",
  toolCallCount: 1,
  completedAt: "2026-06-23T08:00:00Z",
};

const nodeHealthOutput = {
  nodeName: "node-a",
  status: "HEALTHY",
  cpuUsagePercent: 17,
  memoryUsagePercent: 43,
  diskUsagePercent: 68,
  lastHeartbeatAt: "2026-06-14T08:00:00+08:00",
};
