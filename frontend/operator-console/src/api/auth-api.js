import { z } from "zod";

import { browserSessionSchema } from "../schemas/auth-schemas.js";
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

export function logout() {
  return requestJson(getLogoutUrl(), {
    method: "GET",
    schema: z.unknown(),
  });
}
