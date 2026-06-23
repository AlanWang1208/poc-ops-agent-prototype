import { z } from "zod";

/**
 * @typedef {z.infer<typeof quickLinkCatalogSchema>} QuickLinkCatalog
 * @typedef {z.infer<typeof quickLinkTemplateSchema>} QuickLinkTemplate
 * @typedef {z.infer<typeof quickLinkConfirmResponseSchema>} QuickLinkConfirmResponse
 * @typedef {z.infer<typeof quickLinkLaunchResponseSchema>} QuickLinkLaunchResponse
 * @typedef {z.infer<typeof claimSearchParametersSchema>} ClaimSearchParameters
 */

const nonBlankString = z.string().trim().min(1);

export const claimEnvironmentSchema = z.enum(["test", "production"]);

export const claimSearchFieldSchema = z.enum([
  "claimNo",
  "policyNo",
  "customerId",
  "requestId",
  "traceId",
  "serviceName",
  "claimEnvironment",
  "timeRange",
  "logLevel",
  "keyword",
]);

export const timeRangeSchema = z.enum([
  "last_15_minutes",
  "last_30_minutes",
  "last_2_hours",
  "last_24_hours",
]);

export const logLevelSchema = z.enum(["DEBUG", "INFO", "WARN", "ERROR"]);

export const claimSearchParametersSchema = z
  .object({
    claimNo: nonBlankString.optional(),
    policyNo: nonBlankString.optional(),
    customerId: nonBlankString.optional(),
    requestId: nonBlankString.optional(),
    traceId: nonBlankString.optional(),
    serviceName: nonBlankString.optional(),
    claimEnvironment: claimEnvironmentSchema,
    timeRange: timeRangeSchema.optional(),
    logLevel: logLevelSchema.optional(),
    keyword: nonBlankString.optional(),
  })
  .strict();

export const quickLinkTemplateSchema = z
  .object({
    templateId: nonBlankString,
    adapterId: nonBlankString,
    displayName: nonBlankString,
    description: nonBlankString,
    ownerTeam: nonBlankString,
    claimEnvironment: claimEnvironmentSchema,
    requiredFields: z.array(claimSearchFieldSchema).min(1),
    optionalFields: z.array(claimSearchFieldSchema),
    userEditableFields: z.array(claimSearchFieldSchema),
    defaultTimeRange: timeRangeSchema,
    defaultIndex: nonBlankString,
    defaultSourceType: nonBlankString,
    version: nonBlankString,
    status: z.enum(["ACTIVE", "DISABLED"]),
    favorite: z.boolean(),
  })
  .strict();

const personalPresetSchema = claimSearchParametersSchema
  .extend({
    presetId: nonBlankString,
    templateId: nonBlankString,
    displayName: nonBlankString,
  })
  .strict();

const recentLaunchSchema = z
  .object({
    launchId: nonBlankString,
    templateId: nonBlankString,
    templateName: nonBlankString,
    claimEnvironment: claimEnvironmentSchema,
    parameterSummary: nonBlankString,
    launchedAt: z.iso.datetime({ offset: true }),
    auditEventId: nonBlankString,
  })
  .strict();

export const quickLinkCatalogSchema = z
  .object({
    contractVersion: z.literal("1.0"),
    templates: z.array(quickLinkTemplateSchema),
    personalPresets: z.array(personalPresetSchema),
    recentLaunches: z.array(recentLaunchSchema),
  })
  .strict();

export const quickLinkConfirmRequestSchema = z
  .object({
    contractVersion: z.literal("1.0"),
    templateId: nonBlankString,
    search: claimSearchParametersSchema,
  })
  .strict();

const adapterSummarySchema = z
  .object({
    displayName: nonBlankString,
    targetType: z.literal("SPLUNK"),
    authMode: z.enum(["BROWSER_SESSION", "USERNAME_PASSWORD", "SSO"]),
  })
  .strict();

const templateSummarySchema = z
  .object({
    templateId: nonBlankString,
    displayName: nonBlankString,
    version: nonBlankString,
    claimEnvironment: claimEnvironmentSchema,
  })
  .strict();

const claimSearchSummarySchema = z
  .object({
    title: nonBlankString,
    lines: z.array(nonBlankString),
  })
  .strict();

const auditSummarySchema = z
  .object({
    policyDecision: nonBlankString,
    environment: claimEnvironmentSchema,
    message: nonBlankString,
  })
  .strict();

export const quickLinkConfirmResponseSchema = z
  .object({
    contractVersion: z.literal("1.0"),
    launchRequestId: nonBlankString,
    adapterSummary: adapterSummarySchema,
    templateSummary: templateSummarySchema,
    claimSearchSummary: claimSearchSummarySchema,
    resolvedParameters: claimSearchParametersSchema,
    editableFields: z.array(claimSearchFieldSchema),
    missingFields: z.array(claimSearchFieldSchema),
    warnings: z.array(nonBlankString),
    auditSummary: auditSummarySchema,
  })
  .strict();

export const quickLinkLaunchRequestSchema = z
  .object({
    contractVersion: z.literal("1.0"),
    launchRequestId: nonBlankString,
    resolvedParameters: claimSearchParametersSchema,
  })
  .strict();

export const quickLinkLaunchResponseSchema = z
  .object({
    contractVersion: z.literal("1.0"),
    launchId: nonBlankString,
    targetUrl: z.url(),
    targetUrlHash: nonBlankString,
    auditEventId: nonBlankString,
    expiresAt: z.iso.datetime({ offset: true }),
  })
  .strict();
