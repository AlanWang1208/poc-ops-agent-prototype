import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";

import App from "./App.jsx";
import { AppProviders } from "./providers.jsx";
import { server } from "../test/server.js";

describe("App", () => {
  it("mounts with the application providers and an injected memory router", async () => {
    server.use(
      http.get("/auth/session", () =>
        HttpResponse.json(
          {
            authenticated: false,
            subject: null,
            username: null,
            roles: [],
            authenticationType: "anonymous",
          },
          { status: 401 },
        ),
      ),
    );

    render(
      <AppProviders
        Router={MemoryRouter}
        routerProps={{ initialEntries: ["/login"] }}
      >
        <App />
      </AppProviders>,
    );

    expect(
      await screen.findByRole("heading", { name: "操作员登录" }),
    ).toBeInTheDocument();
  });
});
