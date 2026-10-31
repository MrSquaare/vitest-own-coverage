import { describe, expect, it } from "vitest";

import { double } from "./math.ts";

describe("double", () => {
  it("should double the value", () => {
    expect(double(2)).toEqual(4);
  });
});
