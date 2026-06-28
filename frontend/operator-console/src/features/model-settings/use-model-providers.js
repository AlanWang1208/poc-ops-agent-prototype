import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createModelProvider,
  disableModelProvider,
  listModelProviders,
  rotateModelProviderApiKey,
  setDefaultModelProvider,
  testModelProvider,
  updateModelProvider,
} from "../../api/model-provider-api.js";

const MODEL_PROVIDER_QUERY_KEY = ["model-providers"];

export function useModelProviders() {
  return useQuery({
    queryKey: MODEL_PROVIDER_QUERY_KEY,
    queryFn: listModelProviders,
    staleTime: 15_000,
    retry: false,
  });
}

export function useCreateModelProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createModelProvider,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MODEL_PROVIDER_QUERY_KEY }),
  });
}

export function useUpdateModelProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateModelProvider,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MODEL_PROVIDER_QUERY_KEY }),
  });
}

export function useRotateModelProviderApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: rotateModelProviderApiKey,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MODEL_PROVIDER_QUERY_KEY }),
  });
}

export function useTestModelProvider() {
  return useMutation({
    mutationFn: testModelProvider,
  });
}

export function useSetDefaultModelProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setDefaultModelProvider,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MODEL_PROVIDER_QUERY_KEY }),
  });
}

export function useDisableModelProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: disableModelProvider,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MODEL_PROVIDER_QUERY_KEY }),
  });
}
