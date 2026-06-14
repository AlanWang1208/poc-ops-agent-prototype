import {
  sqlConnectionListSchema,
  sqlQueryRequestSchema,
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
export function validateSqlQuery(input) {
  const request = sqlQueryRequestSchema.parse(input);
  return requestJson("/internal/sql-workbench/queries/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    schema: sqlValidationReportSchema,
  });
}
