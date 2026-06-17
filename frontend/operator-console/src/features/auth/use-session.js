import { useQuery } from "@tanstack/react-query";

import { getBrowserSession } from "../../api/auth-api.js";

export function useSession() {
  return useQuery({
    queryKey: ["browser-session"],
    queryFn: getBrowserSession,
    staleTime: 30_000,
    retry: false,
  });
}

