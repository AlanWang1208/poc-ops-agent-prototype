import {
  browserSessionSchema,
  passwordLoginResponseSchema,
} from "../schemas/auth-schemas.js";
import { ApiError } from "./client.js";
import { requestJson } from "./client.js";

const anonymousSession = {
  authenticated: false,
  subject: null,
  username: null,
  roles: [],
  authenticationType: "anonymous",
};

export async function getBrowserSession() {
  try {
    return await requestJson("/auth/session", { schema: browserSessionSchema });
  } catch (error) {
    if (error instanceof ApiError && error.kind === "unauthorized") {
      return anonymousSession;
    }
    throw error;
  }
}

export function getLoginUrl() {
  return "/auth/login";
}

export function getLogoutUrl() {
  return "/auth/logout";
}

export function redirectToLogin() {
  window.location.assign(getLoginUrl());
}

export function redirectToLogout() {
  window.location.assign(getLogoutUrl());
}

export async function logout() {
  let response;
  try {
    response = await fetch(getLogoutUrl(), {
      credentials: "include",
      headers: {
        Accept: "application/json, text/html;q=0.9, */*;q=0.8",
      },
      method: "GET",
    });
  } catch (cause) {
    throw new ApiError({
      status: 0,
      kind: "network",
      message: "Network request failed",
      cause,
    });
  }

  if (response.ok || response.status === 401 || isRedirectStatus(response.status)) {
    return;
  }

  throw new ApiError({
    status: response.status,
    kind: response.status === 403 ? "forbidden" : "request",
    message: `Logout failed with HTTP ${response.status}`,
  });
}

/**
 * @param {number} status
 */
function isRedirectStatus(status) {
  return status >= 300 && status < 400;
}

/**
 * @param {{username: string, password: string}} credentials
 */
export function loginWithPassword(credentials) {
  return requestJson(getLoginUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: credentials.username,
      password: credentials.password,
    }),
    schema: passwordLoginResponseSchema,
  });
}
