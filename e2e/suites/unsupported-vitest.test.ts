import { describe, expect } from "vitest";

import { test } from "../lib/test.ts";

describe("unsupported-vitest", () => {
  test.override({ fixture: "unsupported-vitest" });

  test("should fail when the Vitest of the project is not supported", ({ workspace }) => {
    const result = workspace.run([], { exitCode: 1 });
    const [message] = result.stderr.split("\n");

    expect({ stdout: result.stdout, message }).toMatchSnapshot();
  });
});
