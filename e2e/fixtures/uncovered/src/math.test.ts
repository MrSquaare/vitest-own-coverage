import { describe, expect, it } from "vitest";

import { Counter, half, quadruple } from "./math.ts";

describe(quadruple, () => {
  it("should quadruple the value", () => {
    expect(quadruple(1)).toEqual(4);
  });
});

describe("half", () => {
  it("should halve the value", () => {
    expect(half(4)).toEqual(2);
  });
});

describe("Counter", () => {
  describe("increment", () => {
    it("should increment the count", () => {
      const counter = new Counter();

      counter.increment();

      expect(counter.count).toEqual(1);
    });
  });

  describe("reset", () => {
    it.skip("should reset the count", () => {
      const counter = new Counter();

      counter.reset();

      expect(counter.count).toEqual(0);
    });
  });
});
