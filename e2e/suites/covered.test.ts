import { existsSync } from "node:fs";
import { describe, expect } from "vitest";

import { test } from "../lib/test.ts";

describe("covered", () => {
  test.override({ fixture: "covered" });

  test("should pass every check", ({ workspace }) => {
    const result = workspace.run([]);

    expect(result.stdout).toMatchSnapshot();
  });

  test("should leave the coverage reports directory of the project untouched", ({ workspace }) => {
    workspace.run([]);

    expect(existsSync(workspace.resolve("coverage"))).toEqual(false);
  });
});
