import {
  skillCatalogSchema,
  skillLookupSchema,
} from "../schemas/skill-schemas.js";
import { requestJson } from "./client.js";

export function listSkills() {
  return requestJson("/internal/skills", { schema: skillCatalogSchema });
}

/**
 * @param {string} skillId
 * @param {string} [version]
 */
export function getSkill(skillId, version) {
  const params = version ? `?version=${encodeURIComponent(version)}` : "";
  return requestJson(`/internal/skills/${encodeURIComponent(skillId)}${params}`, {
    schema: skillLookupSchema,
  });
}
