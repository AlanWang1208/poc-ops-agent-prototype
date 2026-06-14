import { useQuery } from "@tanstack/react-query";

import { searchSkillCandidates } from "../../api/agent-api.js";

const readOnlyCandidateCriteria = {
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
    queryKey: ["agent-candidates", readOnlyCandidateCriteria],
    queryFn: () => searchSkillCandidates(readOnlyCandidateCriteria),
    staleTime: 30_000,
    retry: false,
  });
}

