import { describe, expect, it } from "vitest";

import { negate } from "./failing.ts";

describe(negate, () => {
  it("should negate the value", () => {
    expect(negate(1)).toEqual(1);
  });
});
