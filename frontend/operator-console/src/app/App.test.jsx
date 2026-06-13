import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";

import App from "./App.jsx";
import { AppProviders } from "./providers.jsx";

function LocationProbe() {
  const location = useLocation();

  return <span>{location.pathname}</span>;
}

describe("App", () => {
  it("mounts with the application providers and an injected memory router", () => {
    render(
      <AppProviders
        Router={MemoryRouter}
        routerProps={{ initialEntries: ["/provider-test"] }}
      >
        <App />
        <LocationProbe />
      </AppProviders>,
    );

    expect(screen.getByText("智能运维 Agent")).toBeInTheDocument();
    expect(screen.getByText("/provider-test")).toBeInTheDocument();
  });
});
