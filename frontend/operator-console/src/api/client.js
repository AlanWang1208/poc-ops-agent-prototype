import { ZodError } from "zod";

/**
 * @typedef {"unauthorized" | "forbidden" | "request" | "contract" | "network"} ApiErrorKind
 */

export class ApiError extends Error {
  /**
   * @param {{
   *   status: number,
   *   kind: ApiErrorKind,
   *   message: string,
   *   code?: string,
   *   cause?: unknown
   * }} input
   */
  constructor({ status, kind, message, code, cause }) {
    super(message, { cause });
    this.name = "ApiError";
    this.status = status;
    this.kind = kind;
    this.code = code;
  }
}

/**
 * @template Output
 * @param {string} url
 * @param {{
 *   schema: import("zod").ZodType<Output>,
 *   method?: string,
 *   headers?: HeadersInit,
 *   body?: BodyInit | null,
 *   signal?: AbortSignal
 * }} options
 * @returns {Promise<Output>}
 */
export async function requestJson(url, options) {
  let response;
  try {
    response = await fetch(url, {
      credentials: "include",
      ...options,
      headers: {
        Accept: "application/json",
        ...options.headers,
      },
    });
  } catch (cause) {
    throw new ApiError({
      status: 0,
      kind: "network",
      message: "Network request failed",
      cause,
    });
  }

  if (!response.ok) {
    const errorBody = await readOptionalJson(response).catch(() => undefined);
    const structuredError = readStructuredError(errorBody);
    throw new ApiError({
      status: response.status,
      kind:
        response.status === 401
          ? "unauthorized"
          : response.status === 403
            ? "forbidden"
            : "request",
      code: structuredError.code,
      message: structuredError.message ?? `Request failed with HTTP ${response.status}`,
    });
  }

  try {
    const payload = await readOptionalJson(response);
    return options.schema.parse(payload);
  } catch (cause) {
    throw new ApiError({
      status: response.status,
      kind: "contract",
      message:
        cause instanceof ZodError
          ? "Response did not match the expected contract"
          : "Response body was not valid JSON",
      cause,
    });
  }
}

/**
 * @param {Response} response
 * @returns {Promise<unknown>}
 */
async function readOptionalJson(response) {
  const text = await response.text();
  if (!text) {
    return undefined;
  }
  return JSON.parse(text);
}

/**
 * @param {unknown} value
 * @returns {{code?: string, message?: string}}
 */
function readStructuredError(value) {
  if (typeof value !== "object" || value === null) {
    return {};
  }
  const error = /** @type {Record<string, unknown>} */ (value);
  return {
    code: readNonBlankString(error.code) ?? readNonBlankString(error.errorCode),
    message: readNonBlankString(error.message),
  };
}

/**
 * @param {unknown} value
 * @returns {string | undefined}
 */
function readNonBlankString(value) {
  return typeof value === "string" && value.trim() ? value : undefined;
}
