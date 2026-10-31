import { describe, expect } from "vitest";

import { test } from "../lib/test.ts";

describe("invalid-vitest", () => {
  test.override({ fixture: "invalid-vitest" });

  test("should fail when the Vitest of the project exports no createVitest", ({ workspace }) => {
    const result = workspace.run([], { exitCode: 1 });
    const [message] = result.stderr.split("\n");

    expect({ stdout: result.stdout, message }).toMatchSnapshot();
  });
});
