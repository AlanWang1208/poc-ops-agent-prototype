import { useMutation, useQuery } from "@tanstack/react-query";

import {
  createSqlConnection,
  listSqlConnections,
  probeSqlConnection,
  readSqlResultPage,
  runReadOnlySqlQuery,
  validateSqlQuery,
} from "../../api/sql-api.js";

export function useSqlConnections() {
  return useQuery({
    queryKey: ["sql-workbench", "connections"],
    queryFn: listSqlConnections,
  });
}

export function useCreateSqlConnection() {
  return useMutation({
    mutationFn: createSqlConnection,
  });
}

export function useProbeSqlConnection() {
  return useMutation({
    mutationFn: probeSqlConnection,
  });
}

export function useValidateSqlQuery() {
  return useMutation({
    mutationFn: validateSqlQuery,
  });
}

export function useRunReadOnlySqlQuery() {
  return useMutation({
    mutationFn: runReadOnlySqlQuery,
  });
}

/**
 * @param {string | null | undefined} resultId
 * @param {string | null | undefined} pageToken
 */
export function useSqlResultPage(resultId, pageToken = null) {
  return useQuery({
    enabled: Boolean(resultId),
    queryKey: ["sql-workbench", "results", resultId, pageToken ?? ""],
    queryFn: () => readSqlResultPage({ resultId: String(resultId), pageToken }),
  });
}
