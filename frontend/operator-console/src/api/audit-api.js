import { auditEventsResponseSchema } from "../schemas/audit-schemas.js";
import { requestJson } from "./client.js";

/**
 * @param {{limit?: number}} [options]
 * @returns {Promise<import("../schemas/audit-schemas.js").AuditEventsResponse>}
 */
export function loadRecentAuditEvents(options = {}) {
  const requestedLimit = options.limit;
  const limit = typeof requestedLimit === "number" &&
    Number.isInteger(requestedLimit) &&
    requestedLimit > 0
    ? Math.min(requestedLimit, 200)
    : 50;
  return requestJson(`/internal/audit/events?limit=${limit}`, {
    method: "GET",
    schema: auditEventsResponseSchema,
  });
}
