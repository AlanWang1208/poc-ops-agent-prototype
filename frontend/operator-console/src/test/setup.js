import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";

import { server } from "./server.js";

function createEmptyDomRect() {
  return {
    bottom: 0,
    height: 0,
    left: 0,
    right: 0,
    toJSON: () => ({}),
    top: 0,
    width: 0,
    x: 0,
    y: 0,
  };
}

function createEmptyDomRectList() {
  return /** @type {DOMRectList} */ ({
    item: () => null,
    length: 0,
    [Symbol.iterator]: function* iterateDomRects() {},
  });
}

if (globalThis.Range && !globalThis.Range.prototype.getClientRects) {
  globalThis.Range.prototype.getClientRects = createEmptyDomRectList;
}

if (globalThis.Range && !globalThis.Range.prototype.getBoundingClientRect) {
  globalThis.Range.prototype.getBoundingClientRect = createEmptyDomRect;
}

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());
