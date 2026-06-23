import { z } from "zod";

import {
  registeredSkillSchema,
  skillCategorySchema,
  skillPublicationStatusSchema,
  skillRiskLevelSchema,
} from "./skill-schemas.js";

/**
 * @typedef {z.infer<typeof skillRouteCandidateSchema>} SkillRouteCandidate
 */

const nonBlankString = z.string().trim().min(1);

export const skillRoutingRequestSchema = z
  .object({
    skillId: nonBlankString.nullable(),
    category: skillCategorySchema.nullable(),
    maxRiskLevel: skillRiskLevelSchema.nullable(),
    requiredParameters: z.array(nonBlankString),
    requiredTags: z.array(nonBlankString),
    requestContextTags: z.array(nonBlankString),
    publicationStatusRequired: skillPublicationStatusSchema.nullable(),
  })
  .strict();

export const readOnlyDiagnosticRequestSchema = z
  .object({
    skillId: z.literal("node-health-read"),
    targetEnvironment: z.literal("development"),
    parameters: z
      .object({
        nodeName: z.literal("node-a"),
      })
      .strict(),
    idempotencyKey: nonBlankString,
  })
  .strict();

/**
 * @typedef {z.infer<typeof readOnlyDiagnosticRequestSchema>} ReadOnlyDiagnosticRequest
 */

export const agentDiagnosticRequestSchema = z
  .object({
    targetEnvironment: z.literal("development"),
    idempotencyKey: nonBlankString,
    userIntent: nonBlankString.max(2000),
    inputParameters: z.record(z.string(), z.string()),
  })
  .strict();

/**
 * @typedef {z.infer<typeof agentDiagnosticRequestSchema>} AgentDiagnosticRequest
 */

export const agentTaskResultSchema = z
  .object({
    schemaVersion: z.literal("1.0"),
    taskId: nonBlankString,
    workflowId: nonBlankString,
    status: z.enum(["SUCCEEDED", "FAILED_TERMINAL", "REJECTED", "AGENT_RUNTIME_DISABLED"]),
    summary: nonBlankString,
    toolCallCount: z.number().int().nonnegative(),
    completedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

/**
 * @typedef {z.infer<typeof agentTaskResultSchema>} AgentTaskResult
 */

export const nodeHealthOutputSchema = z
  .object({
    nodeName: nonBlankString,
    status: nonBlankString,
    cpuUsagePercent: z.number().int().min(0).max(100),
    memoryUsagePercent: z.number().int().min(0).max(100),
    diskUsagePercent: z.number().int().min(0).max(100),
    lastHeartbeatAt: z.iso.datetime({ offset: true }),
  })
  .strict();

/**
 * @typedef {z.infer<typeof nodeHealthOutputSchema>} NodeHealthOutput
 */

const skillReleaseSnapshotSchema = z
  .object({
    skillId: nonBlankString,
    version: nonBlankString,
    stage: z.enum(["GENERAL_AVAILABLE", "CANARY", "ROLLED_BACK"]),
    rolloutPercentage: z.number().int().min(0).max(100),
    targetContextTags: z.array(nonBlankString),
    reason: nonBlankString,
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

const skillRouteCandidateSchema = z
  .object({
    skill: registeredSkillSchema,
    releaseSnapshot: skillReleaseSnapshotSchema,
    score: z.number().int(),
    matchedRules: z.array(nonBlankString),
  })
  .strict();

export const skillRoutingResponseSchema = z
  .object({
    total: z.number().int().nonnegative(),
    candidates: z.array(skillRouteCandidateSchema),
  })
  .strict()
  .refine((response) => response.total === response.candidates.length, {
    message: "Skill routing total must match candidates length",
    path: ["total"],
  });

const semanticPayloadSchema = z.discriminatedUnion("payloadType", [
  z
    .object({
      payloadType: z.literal("WORKFLOW_STARTED"),
      commandId: nonBlankString,
      operatorId: nonBlankString,
    })
    .strict(),
  z
    .object({
      payloadType: z.literal("SKILL_ROUTED"),
      skillId: nonBlankString,
      skillVersion: nonBlankString,
    })
    .strict(),
  z
    .object({
      payloadType: z.literal("WORKER_ACCEPTED"),
      executionRequestId: nonBlankString,
    })
    .strict(),
  z
    .object({
      payloadType: z.literal("WORKFLOW_COMPLETED"),
      outputSchemaId: nonBlankString,
      output: z.record(z.string(), z.unknown()),
    })
    .strict(),
  z
    .object({
      payloadType: z.literal("WORKFLOW_FAILED"),
      errorCode: nonBlankString,
      message: nonBlankString,
    })
    .strict(),
]);

export const semanticEventSchema = z
  .object({
    contractVersion: z.literal("1.0"),
    eventId: z.uuid(),
    workflowId: z.uuid(),
    sequence: z.number().int().positive(),
    timestamp: z.iso.datetime({ offset: true }),
    type: z.enum([
      "WORKFLOW_STARTED",
      "SKILL_ROUTED",
      "WORKER_ACCEPTED",
      "WORKFLOW_COMPLETED",
      "WORKFLOW_FAILED",
    ]),
    payload: semanticPayloadSchema,
  })
  .strict()
  .refine((event) => event.type === event.payload.payloadType, {
    message: "Event type must match payload type",
    path: ["payload", "payloadType"],
  });

/**
 * @typedef {z.infer<typeof semanticEventSchema>} SemanticEvent
 */
