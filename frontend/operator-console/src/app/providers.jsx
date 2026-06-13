import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { BrowserRouter } from "react-router-dom";

/**
 * @typedef {object} AppProvidersProps
 * @property {import("react").ReactNode} children
 * @property {import("react").ElementType} [Router]
 * @property {Record<string, unknown>} [routerProps]
 */

/**
 * @param {AppProvidersProps} props
 */
export function AppProviders({
  children,
  Router = BrowserRouter,
  routerProps = {},
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <Router {...routerProps}>{children}</Router>
    </QueryClientProvider>
  );
}
