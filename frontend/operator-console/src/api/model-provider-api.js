import {
  modelProviderApiKeyRequestSchema,
  modelProviderCreateRequestSchema,
  modelProviderListSchema,
  modelProviderProbeResultSchema,
  modelProviderSummarySchema,
  modelProviderUpdateRequestSchema,
} from "../schemas/model-provider-schemas.js";
import { requestJson } from "./client.js";

export function listModelProviders() {
  return requestJson("/internal/model-providers", {
    schema: modelProviderListSchema,
  });
}

/**
 * @param {unknown} input
 */
export function createModelProvider(input) {
  const request = modelProviderCreateRequestSchema.parse(input);
  return requestJson("/internal/model-providers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    schema: modelProviderSummarySchema,
  });
}

/**
 * @param {{providerId: string, input: unknown}} params
 */
export function updateModelProvider(params) {
  const request = modelProviderUpdateRequestSchema.parse(params.input);
  return requestJson(`/internal/model-providers/${encodeURIComponent(params.providerId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    schema: modelProviderSummarySchema,
  });
}

/**
 * @param {{providerId: string, input: unknown}} params
 */
export function rotateModelProviderApiKey(params) {
  const request = modelProviderApiKeyRequestSchema.parse(params.input);
  return requestJson(
    `/internal/model-providers/${encodeURIComponent(params.providerId)}/api-key`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      schema: modelProviderSummarySchema,
    },
  );
}

/**
 * @param {string} providerId
 */
export function testModelProvider(providerId) {
  return requestJson(`/internal/model-providers/${encodeURIComponent(providerId)}/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    schema: modelProviderProbeResultSchema,
  });
}

/**
 * @param {string} providerId
 */
export function setDefaultModelProvider(providerId) {
  return requestJson(`/internal/model-providers/${encodeURIComponent(providerId)}/default`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    schema: modelProviderSummarySchema,
  });
}

/**
 * @param {string} providerId
 */
export function disableModelProvider(providerId) {
  return requestJson(`/internal/model-providers/${encodeURIComponent(providerId)}/disable`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    schema: modelProviderSummarySchema,
  });
}
