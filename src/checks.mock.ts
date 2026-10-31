import { vi } from "vitest";

import { checkProject } from "./checks.ts";

vi.mock("./checks.ts", async (importActual) => {
  const actual = await importActual<typeof import("./checks.ts")>();

  return {
    ...actual,
    checkProject: vi.fn(),
  };
});

export const mockedCheckProject = vi.mocked(checkProject);
