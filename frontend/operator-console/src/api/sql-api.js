import {
  sqlConnectionCreateRequestSchema,
  sqlConnectionListSchema,
  sqlConnectionProbeResultSchema,
  sqlQueryRunRequestSchema,
  sqlQueryRunResultSchema,
  sqlQueryRequestSchema,
  sqlResultPageSchema,
  sqlValidationReportSchema,
} from "../schemas/sql-schemas.js";
import { requestJson } from "./client.js";

export function listSqlConnections() {
  return requestJson("/internal/sql-workbench/connections", {
    schema: sqlConnectionListSchema,
  });
}

/**
 * @param {unknown} input
 */
export function createSqlConnection(input) {
  const request = sqlConnectionCreateRequestSchema.parse(input);
  return requestJson("/internal/sql-workbench/connections", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    schema: sqlConnectionListSchema.element,
  });
}

/**
 * @param {string} connectionId
 */
export function probeSqlConnection(connectionId) {
  return requestJson(
    `/internal/sql-workbench/connections/${encodeURIComponent(connectionId)}/probe`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      schema: sqlConnectionProbeResultSchema,
    },
  );
}

/**
 * @param {unknown} input
 */
export function validateSqlQuery(input) {
  const request = sqlQueryRequestSchema.parse(input);
  return requestJson("/internal/sql-workbench/queries/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    schema: sqlValidationReportSchema,
  });
}

/**
 * @param {unknown} input
 */
export function runReadOnlySqlQuery(input) {
  const request = sqlQueryRunRequestSchema.parse(input);
  return requestJson("/internal/sql-workbench/queries/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    schema: sqlQueryRunResultSchema,
  });
}

/**
 * @param {{resultId: string, pageToken?: string | null}} input
 */
export function readSqlResultPage(input) {
  const query = input.pageToken
    ? `?pageToken=${encodeURIComponent(input.pageToken)}`
    : "";
  return requestJson(
    `/internal/sql-workbench/results/${encodeURIComponent(input.resultId)}${query}`,
    {
      schema: sqlResultPageSchema,
    },
  );
}
