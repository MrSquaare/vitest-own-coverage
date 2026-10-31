import { describe, expect } from "vitest";

import { test } from "../lib/test.ts";

describe("custom-infix", () => {
  test.override({ fixture: "custom-infix" });

  test("should pair test files using the custom test infixes", ({ workspace }) => {
    const result = workspace.run(["--test-infixes", "unit"]);

    expect(result.stdout).toMatchSnapshot();
  });

  test("should report test files whose infix is not a test infix", ({ workspace }) => {
    const result = workspace.run([], { exitCode: 1 });

    expect(result.stdout).toMatchSnapshot();
  });
});
