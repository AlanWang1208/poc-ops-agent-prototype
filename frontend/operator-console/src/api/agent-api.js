import {
  skillRoutingRequestSchema,
  skillRoutingResponseSchema,
} from "../schemas/agent-schemas.js";
import { requestJson } from "./client.js";

/**
 * @param {unknown} criteria
 */
export function searchSkillCandidates(criteria) {
  const request = skillRoutingRequestSchema.parse(criteria);
  return requestJson("/internal/routing/skills/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    schema: skillRoutingResponseSchema,
  });
}
