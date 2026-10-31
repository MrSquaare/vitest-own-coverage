import { describe, expect } from "vitest";

import { test } from "../lib/test.ts";

describe("missing-coverage-include", () => {
  test.override({ fixture: "missing-coverage-include" });

  test("should fail when coverage.include is not set", ({ workspace }) => {
    const result = workspace.run([], { exitCode: 1 });
    const [message] = result.stderr.split("\n");

    expect({ stdout: result.stdout, message }).toMatchSnapshot();
  });
});
