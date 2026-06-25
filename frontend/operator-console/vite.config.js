import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const backendTarget = process.env.VITE_BACKEND_TARGET ?? "http://127.0.0.1:8080";
const backendProxy = {
  target: backendTarget,
  changeOrigin: false,
};

export default defineConfig({
  plugins: [authProxyPlugin(), react()],
  test: {
    environment: "jsdom",
    exclude: [...configDefaults.exclude, "tests/e2e/**"],
    setupFiles: "./src/test/setup.js",
  },
  server: {
    proxy: {
      "/api": backendProxy,
      "/internal": backendProxy,
      "/oauth2": backendProxy,
      "/logout": backendProxy,
      "/mock-oidc": backendProxy,
      "/.well-known": backendProxy,
    },
  },
});

/**
 * @returns {import("vite").Plugin}
 */
function authProxyPlugin() {
  return {
    name: "ops-agent-auth-proxy",
    /**
     * @param {import("vite").ViteDevServer} server
     */
    configureServer(server) {
      server.middlewares.use(
        /**
         * @param {import("node:http").IncomingMessage} request
         * @param {import("node:http").ServerResponse} response
         * @param {() => void} next
         */
        async (request, response, next) => {
          if (!request.url?.startsWith("/auth")) {
            next();
            return;
          }

          try {
            const backendResponse = await fetch(new URL(request.url, backendTarget), {
              body: hasBody(request.method) ? await readRequestBody(request) : undefined,
              headers: readForwardHeaders(request.headers),
              method: request.method,
              redirect: "manual",
            });
            response.statusCode = backendResponse.status;
            forwardResponseHeaders(backendResponse, response);
            response.end(Buffer.from(await backendResponse.arrayBuffer()));
          } catch (error) {
            console.error("[ops-agent-auth-proxy] failed to proxy auth request", error);
            response.statusCode = 502;
            response.setHeader("Content-Type", "application/json");
            response.end(JSON.stringify({
              errorCode: "CONTROL_PLANE_UNAVAILABLE",
              message: "Control plane is unavailable",
            }));
          }
        },
      );
    },
  };
}

/**
 * @param {string | undefined} method
 */
function hasBody(method) {
  return !["GET", "HEAD"].includes(method ?? "GET");
}

/**
 * @param {import("node:http").IncomingHttpHeaders} source
 */
function readForwardHeaders(source) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(source)) {
    if (
      !value ||
      [
        "connection",
        "content-length",
        "expect",
        "host",
        "keep-alive",
        "proxy-authenticate",
        "proxy-authorization",
        "te",
        "trailer",
        "transfer-encoding",
        "upgrade",
      ].includes(name.toLowerCase())
    ) {
      continue;
    }
    if (Array.isArray(value)) {
      value.forEach((item) => headers.append(name, item));
    } else {
      headers.set(name, value);
    }
  }
  return headers;
}

/**
 * @param {import("node:http").IncomingMessage} request
 */
function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    /** @type {Buffer[]} */
    const chunks = [];
    request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

/**
 * @param {Response} backendResponse
 * @param {import("node:http").ServerResponse} response
 */
function forwardResponseHeaders(backendResponse, response) {
  backendResponse.headers.forEach((value, name) => {
    if (name.toLowerCase() !== "set-cookie") {
      response.setHeader(name, value);
    }
  });
  const cookies = backendResponse.headers.getSetCookie?.() ?? [];
  if (cookies.length > 0) {
    response.setHeader("Set-Cookie", cookies);
  }
}
