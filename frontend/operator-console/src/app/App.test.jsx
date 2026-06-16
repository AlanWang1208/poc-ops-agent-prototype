import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";

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
});
