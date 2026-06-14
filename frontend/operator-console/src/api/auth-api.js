import { z } from "zod";

import { browserSessionSchema } from "../schemas/auth-schemas.js";
import { requestJson } from "./client.js";

export function getBrowserSession() {
  return requestJson("/auth/session", { schema: browserSessionSchema });
}

export function getLoginUrl() {
  return "/auth/login";
}

export function redirectToLogin() {
  window.location.assign(getLoginUrl());
}

export function logout() {
  return requestJson("/logout", {
    method: "POST",
    schema: z.unknown(),
  });
}
