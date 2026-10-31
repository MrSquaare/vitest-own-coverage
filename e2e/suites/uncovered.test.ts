import { describe, expect } from "vitest";

import { test } from "../lib/test.ts";

describe("uncovered", () => {
  test.override({ fixture: "uncovered" });

  test("should report every failing check", ({ workspace }) => {
    const result = workspace.run([], { exitCode: 1 });

    expect(result.stdout).toMatchSnapshot();
  });

  test("should report every failing check as JSON", ({ workspace }) => {
    const result = workspace.run(["--format", "json"], { exitCode: 1 });

    expect(JSON.parse(result.stdout)).toMatchSnapshot();
  });
});
