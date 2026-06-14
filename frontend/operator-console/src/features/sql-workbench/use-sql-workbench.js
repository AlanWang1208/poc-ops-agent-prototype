import { useMutation, useQuery } from "@tanstack/react-query";

import { listSqlConnections, validateSqlQuery } from "../../api/sql-api.js";

export function useSqlConnections() {
  return useQuery({
    queryKey: ["sql-connections"],
    queryFn: listSqlConnections,
    staleTime: 30_000,
    retry: false,
  });
}

export function useValidateSqlQuery() {
  return useMutation({
    mutationFn: validateSqlQuery,
  });
}

