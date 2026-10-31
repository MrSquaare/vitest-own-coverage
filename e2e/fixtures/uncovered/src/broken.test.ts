import { describe, expect, it } from "vitest";

import { noop } from "./broken.ts";

const setUp = (): void => {
  throw new Error("Failed to set up the broken test file");
};

setUp();

describe(noop, () => {
  it("should return nothing", () => {
    expect(noop()).toEqual(undefined);
  });
});
