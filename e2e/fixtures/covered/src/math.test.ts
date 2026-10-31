import { describe, expect, it } from "vitest";

import { Counter, double, half } from "./math.ts";

describe(double, () => {
  it("should double the value", () => {
    expect(double(2)).toEqual(4);
  });
});

describe.each([
  [4, 2],
  [-4, 0],
])("half", (value, expected) => {
  it("should halve the value", () => {
    expect(half(value)).toEqual(expected);
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
});
