import { useMutation, useQuery } from "@tanstack/react-query";

import {
  confirmSplunkQuickLinkLaunch,
  launchSplunkQuickLink,
  listSplunkQuickLinkTemplates,
} from "../../api/quick-link-api.js";

export function useSplunkQuickLinkCatalog() {
  return useQuery({
    queryKey: ["quick-links", "splunk", "templates"],
    queryFn: listSplunkQuickLinkTemplates,
    retry: false,
    staleTime: 30_000,
  });
}

export function useConfirmSplunkQuickLinkLaunch() {
  return useMutation({
    mutationFn: confirmSplunkQuickLinkLaunch,
  });
}

export function useLaunchSplunkQuickLink() {
  return useMutation({
    mutationFn: launchSplunkQuickLink,
  });
}
