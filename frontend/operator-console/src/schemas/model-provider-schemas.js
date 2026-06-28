import { z } from "zod";

/**
 * @typedef {z.infer<typeof modelProviderSummarySchema>} ModelProviderSummary
 * @typedef {z.infer<typeof modelProviderCreateRequestSchema>} ModelProviderCreateRequest
 * @typedef {z.infer<typeof modelProviderUpdateRequestSchema>} ModelProviderUpdateRequest
 * @typedef {z.infer<typeof modelProviderApiKeyRequestSchema>} ModelProviderApiKeyRequest
 * @typedef {z.infer<typeof modelProviderProbeResultSchema>} ModelProviderProbeResult
 */

const nonBlankString = z.string().trim().min(1);
const durationValue = z.union([nonBlankString, z.number().positive()]);

export const modelProviderSummarySchema = z
  .object({
    providerId: nonBlankString,
    displayName: nonBlankString,
    providerType: z.enum(["OPENAI_COMPATIBLE"]),
    baseUrl: nonBlankString,
    modelName: nonBlankString,
    enabled: z.boolean(),
    defaultProvider: z.boolean(),
    timeout: durationValue,
    maxIterations: z.number().int().positive(),
    maxToolCalls: z.number().int().positive(),
    maxToolCallDuration: durationValue,
    apiKeyConfigured: z.boolean(),
    apiKeyFingerprint: nonBlankString,
    apiKeyLastRotatedAt: z.iso.datetime({ offset: true }),
    configVersion: z.number().int().positive(),
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const modelProviderListSchema = z.array(modelProviderSummarySchema);

export const modelProviderCreateRequestSchema = z
  .object({
    displayName: nonBlankString,
    baseUrl: nonBlankString,
    modelName: nonBlankString,
    apiKey: nonBlankString,
    timeoutSeconds: z.number().int().positive(),
    maxIterations: z.number().int().positive(),
    maxToolCalls: z.number().int().positive(),
    maxToolCallDurationSeconds: z.number().int().positive(),
  })
  .strict();

export const modelProviderUpdateRequestSchema = z
  .object({
    displayName: nonBlankString,
    baseUrl: nonBlankString,
    modelName: nonBlankString,
    enabled: z.boolean(),
    timeoutSeconds: z.number().int().positive(),
    maxIterations: z.number().int().positive(),
    maxToolCalls: z.number().int().positive(),
    maxToolCallDurationSeconds: z.number().int().positive(),
  })
  .strict();

export const modelProviderApiKeyRequestSchema = z
  .object({
    apiKey: nonBlankString,
  })
  .strict();

export const modelProviderProbeResultSchema = z
  .object({
    status: nonBlankString,
    message: nonBlankString,
  })
  .strict();
