import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { BrowserRouter, useLocation, useNavigate } from "react-router-dom";

import { SESSION_EXPIRED_EVENT } from "../api/client.js";

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
      <Router {...routerProps}>
        <SessionExpiredRedirector>{children}</SessionExpiredRedirector>
      </Router>
    </QueryClientProvider>
  );
}

/**
 * @param {{children: import("react").ReactNode}} props
 */
function SessionExpiredRedirector({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    /**
     * @param {Event} event
     */
    function handleSessionExpired(event) {
      queryClient.removeQueries({ queryKey: ["browser-session"] });
      if (location.pathname === "/login") {
        return;
      }
      navigate("/login", {
        replace: true,
        state: { from: location.pathname },
      });
      event.stopPropagation();
    }

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    };
  }, [location.pathname, navigate, queryClient]);

  return children;
}
