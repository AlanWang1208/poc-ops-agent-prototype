import {
  quickLinkCatalogSchema,
  quickLinkConfirmRequestSchema,
  quickLinkConfirmResponseSchema,
  quickLinkLaunchRequestSchema,
  quickLinkLaunchResponseSchema,
} from "../schemas/quick-link-schemas.js";
import { requestJson } from "./client.js";

export function listSplunkQuickLinkTemplates() {
  return requestJson("/internal/quick-links/splunk/templates", {
    schema: quickLinkCatalogSchema,
  });
}

/**
 * @param {unknown} input
 */
export function confirmSplunkQuickLinkLaunch(input) {
  const request = quickLinkConfirmRequestSchema.parse(input);
  return requestJson("/internal/quick-links/splunk/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    schema: quickLinkConfirmResponseSchema,
  });
}

/**
 * @param {unknown} input
 */
export function launchSplunkQuickLink(input) {
  const request = quickLinkLaunchRequestSchema.parse(input);
  return requestJson("/internal/quick-links/splunk/launch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    schema: quickLinkLaunchResponseSchema,
  });
}
