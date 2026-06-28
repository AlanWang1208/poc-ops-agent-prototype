import { z } from "zod";

/**
 * @typedef {z.infer<typeof sqlConnectionSchema>} SqlConnectionSummary
 * @typedef {z.infer<typeof sqlValidationReportSchema>} SqlValidationReport
 * @typedef {z.infer<typeof sqlConnectionCreateRequestSchema>} SqlConnectionCreateRequest
 * @typedef {z.infer<typeof sqlConnectionProbeResultSchema>} SqlConnectionProbeResult
 * @typedef {z.infer<typeof sqlQueryRunRequestSchema>} SqlQueryRunRequest
 * @typedef {z.infer<typeof sqlQueryRunResultSchema>} SqlQueryRunResult
 * @typedef {z.infer<typeof sqlResultPageSchema>} SqlResultPage
 */

const nonBlankString = z.string().trim().min(1);
const targetEnvironmentSchema = z.enum(["development", "test"]);
const sqlPlatformTypeSchema = z.enum(["DB2_FOR_I", "H2", "MYSQL"]);
const sqlConnectionStatusSchema = z.enum([
  "READY",
  "PENDING_WORKER_BINDING",
  "DISABLED",
  "PROBE_FAILED",
]);
const sqlProbeStatusSchema = z.enum([
  "READY",
  "CREDENTIAL_ALIAS_NOT_FOUND",
  "CREDENTIAL_LOCKED",
  "EGRESS_NOT_ALLOWED",
  "READ_ONLY_ACCOUNT_CHECK_FAILED",
  "PROBE_FAILED",
]);
const sqlQueryActionSchema = z.enum([
  "VALIDATE",
  "EXPLAIN",
  "RUN_READ_ONLY",
  "PREFLIGHT_DML",
]);

const sqlConnectionSchema = z
  .object({
    contractVersion: z.literal("1.0"),
    connectionId: nonBlankString,
    displayName: nonBlankString,
    targetEnvironment: targetEnvironmentSchema,
    platformType: sqlPlatformTypeSchema,
    host: nonBlankString.optional(),
    port: z.number().int().min(1).max(65_535).optional(),
    status: sqlConnectionStatusSchema.default("READY"),
    defaultSchema: nonBlankString.optional(),
    allowedSchemas: z.array(nonBlankString).min(1),
    capabilities: z.array(sqlQueryActionSchema).min(1),
    credentialAlias: nonBlankString.optional(),
    maxRowsDefault: z.number().int().min(1).max(10_000).default(500),
    timeoutSecondsDefault: z.number().int().min(1).max(300).default(30),
  })
  .strict();

export const sqlConnectionListSchema = z.array(sqlConnectionSchema);

export const sqlConnectionCreateRequestSchema = z
  .object({
    contractVersion: z.literal("1.0"),
    displayName: nonBlankString,
    targetEnvironment: targetEnvironmentSchema,
    platformType: sqlPlatformTypeSchema,
    host: nonBlankString,
    port: z.number().int().min(1).max(65_535),
    defaultSchema: nonBlankString,
    allowedSchemas: z.array(nonBlankString).min(1),
    capabilities: z.array(sqlQueryActionSchema).min(1),
    credentialAlias: nonBlankString,
    maxRowsDefault: z.number().int().min(1).max(10_000),
    timeoutSecondsDefault: z.number().int().min(1).max(300),
  })
  .strict();

export const sqlConnectionProbeResultSchema = z
  .object({
    contractVersion: z.literal("1.0"),
    connectionId: nonBlankString,
    status: sqlProbeStatusSchema,
    message: z.string().nullable().optional(),
    probedAt: nonBlankString,
    workerId: nonBlankString.optional(),
  })
  .strict();

const sqlTypedParameterSchema = z
  .object({
    name: nonBlankString,
    type: nonBlankString,
    value: z.json(),
  })
  .strict();

const sqlQueryLimitsSchema = z
  .object({
    maxRows: z.number().int().min(1).max(10_000),
    maxBytes: z.number().int().min(1).max(100_000_000),
    timeoutSeconds: z.number().int().min(1).max(300),
  })
  .strict();

export const sqlQueryRequestSchema = z
  .object({
    contractVersion: z.literal("1.0"),
    connectionId: nonBlankString,
    targetEnvironment: targetEnvironmentSchema,
    schema: nonBlankString,
    action: sqlQueryActionSchema,
    sql: nonBlankString,
    parameters: z.array(sqlTypedParameterSchema),
    limits: sqlQueryLimitsSchema,
    idempotencyKey: nonBlankString,
  })
  .strict();

export const sqlQueryRunRequestSchema = sqlQueryRequestSchema
  .extend({
    action: z.literal("RUN_READ_ONLY"),
    validationHash: nonBlankString,
  })
  .strict();

export const sqlValidationReportSchema = z
  .object({
    contractVersion: z.literal("1.0"),
    statementType: z.enum(["SELECT", "INSERT", "UPDATE", "DELETE", "UNSUPPORTED"]),
    validationLevel: z.enum(["VALIDATED", "PARTIAL", "REJECTED"]),
    sqlHash: nonBlankString,
    validationHash: nonBlankString.optional(),
    referencedObjects: z.array(nonBlankString),
    risks: z.array(nonBlankString),
    rejectionReasons: z.array(nonBlankString),
    unverifiedItems: z.array(nonBlankString),
  })
  .strict();

export const sqlQueryRunResultSchema = z
  .object({
    contractVersion: z.literal("1.0"),
    executionRequestId: nonBlankString,
    workflowId: nonBlankString,
    status: z.enum(["QUEUED", "RUNNING", "SUCCEEDED", "FAILED", "REJECTED", "EXPIRED"]),
    resultId: nonBlankString.nullable().optional(),
    errorCode: z.string().nullable().optional(),
    errorMessage: z.string().nullable().optional(),
  })
  .strict();

const sqlResultColumnSchema = z
  .object({
    name: nonBlankString,
    type: nonBlankString,
    masked: z.boolean().default(false),
  })
  .strict();

export const sqlResultPageSchema = z
  .object({
    contractVersion: z.literal("1.0"),
    resultId: nonBlankString,
    columns: z.array(sqlResultColumnSchema),
    rows: z.array(z.array(z.json())),
    nextCursor: z.string().nullable(),
    truncated: z.boolean(),
    expiresAt: nonBlankString,
  })
  .strict();
