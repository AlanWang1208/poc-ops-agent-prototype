import { useQuery } from "@tanstack/react-query";

import { listSkills } from "../../api/skill-api.js";

export function useSkills() {
  return useQuery({
    queryKey: ["skill-catalog"],
    queryFn: listSkills,
    staleTime: 30_000,
    retry: false,
  });
}

