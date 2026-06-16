import { useQuery } from "@tanstack/react-query";

import { searchSkillCandidates } from "../../api/agent-api.js";

export const READ_ONLY_CANDIDATE_CRITERIA = {
  skillId: null,
  category: null,
  maxRiskLevel: "READ_ONLY",
  requiredParameters: [],
  requiredTags: [],
  requestContextTags: [],
  publicationStatusRequired: "VALIDATED",
};

export function useAgentCandidates() {
  return useQuery({
    queryKey: ["agent-workspace", "skill-candidates", READ_ONLY_CANDIDATE_CRITERIA],
    queryFn: () => searchSkillCandidates(READ_ONLY_CANDIDATE_CRITERIA),
  });
}
