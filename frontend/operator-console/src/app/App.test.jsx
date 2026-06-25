import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";

import { SESSION_EXPIRED_EVENT } from "../api/client.js";
import App from "./App.jsx";
import { AppProviders } from "./providers.jsx";

describe("App", () => {
  it("mounts with the application providers and an injected memory router", () => {
    render(
      <AppProviders
        Router={MemoryRouter}
        routerProps={{ initialEntries: ["/login"] }}
      >
        <App />
      </AppProviders>,
    );

    expect(
      screen.getByRole("heading", { name: "企业智能运维工作台" }),
    ).toBeInTheDocument();
    expect(screen.getByText("SECURE OPERATOR ENTRY")).toBeInTheDocument();
  });

  it("routes the active workspace back to login when the browser session expires", async () => {
    render(
      <AppProviders
        Router={MemoryRouter}
        routerProps={{ initialEntries: ["/agent"] }}
      >
        <LocationProbe />
      </AppProviders>,
    );

    expect(screen.getByTestId("current-path")).toHaveTextContent("/agent");

    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));

    await waitFor(() => {
      expect(screen.getByTestId("current-path")).toHaveTextContent("/login");
    });
  });
});

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="current-path">{location.pathname}</span>;
}
