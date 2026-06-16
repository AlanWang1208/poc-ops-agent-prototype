import { useMutation, useQuery } from "@tanstack/react-query";

import { listSqlConnections, validateSqlQuery } from "../../api/sql-api.js";

export function useSqlConnections() {
  return useQuery({
    queryKey: ["sql-workbench", "connections"],
    queryFn: listSqlConnections,
  });
}

export function useValidateSqlQuery() {
  return useMutation({
    mutationFn: validateSqlQuery,
  });
}
