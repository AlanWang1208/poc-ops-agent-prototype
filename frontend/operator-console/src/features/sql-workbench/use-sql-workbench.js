import { useMutation, useQuery } from "@tanstack/react-query";

import {
  createSqlConnection,
  askSqlAssistant,
  deleteSqlConnection,
  listSqlConnections,
  probeSqlConnection,
  readSqlResultPage,
  runReadOnlySqlQuery,
  updateSqlConnection,
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

export function useUpdateSqlConnection() {
  return useMutation({
    /**
     * @param {{
     *   connectionId: string,
     *   request: import("../../schemas/sql-schemas.js").SqlConnectionUpdateRequest,
     * }} input
     */
    mutationFn: (input) => updateSqlConnection(input.connectionId, input.request),
  });
}

export function useDeleteSqlConnection() {
  return useMutation({
    mutationFn: deleteSqlConnection,
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

export function useSqlAssistant() {
  return useMutation({
    mutationFn: askSqlAssistant,
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
