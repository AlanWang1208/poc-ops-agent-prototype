import { z } from "zod";

const nonBlankString = z.string().trim().min(1);
const targetEnvironmentSchema = z.enum(["development", "test"]);
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
    platformType: z.literal("DB2_FOR_I"),
    allowedSchemas: z.array(nonBlankString).min(1),
    capabilities: z.array(sqlQueryActionSchema).min(1),
  })
  .strict();

export const sqlConnectionListSchema = z.array(sqlConnectionSchema);

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

export const sqlValidationReportSchema = z
  .object({
    contractVersion: z.literal("1.0"),
    statementType: z.enum(["SELECT", "INSERT", "UPDATE", "DELETE", "UNSUPPORTED"]),
    validationLevel: z.enum(["VALIDATED", "PARTIAL", "REJECTED"]),
    sqlHash: nonBlankString,
    referencedObjects: z.array(nonBlankString),
    risks: z.array(nonBlankString),
    rejectionReasons: z.array(nonBlankString),
    unverifiedItems: z.array(nonBlankString),
  })
  .strict();
