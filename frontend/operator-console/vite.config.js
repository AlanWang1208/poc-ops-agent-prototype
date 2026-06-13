import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const backendProxy = {
  target: "http://127.0.0.1:8080",
  changeOrigin: false,
};

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.js",
  },
  server: {
    proxy: {
      "/internal": backendProxy,
      "/auth": backendProxy,
      "/oauth2": backendProxy,
      "/login": backendProxy,
      "/logout": backendProxy,
      "/mock-oidc": backendProxy,
      "/.well-known": backendProxy,
    },
  },
});
