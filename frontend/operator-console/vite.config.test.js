import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

describe("vite development proxy", () => {
  test("forwards the public Agent API to the control plane", () => {
    const source = readFileSync("vite.config.js", "utf8");

    expect(source).toContain('"/api": backendProxy');
    expect(source).toContain("process.env.VITE_BACKEND_TARGET");
  });
});
