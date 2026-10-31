import { vi } from "vitest";

import { createTestRunner } from "./runner.ts";

vi.mock("./runner.ts", async (importActual) => {
  const actual = await importActual<typeof import("./runner.ts")>();

  return {
    ...actual,
    createTestRunner: vi.fn(),
  };
});

export const mockedCreateTestRunner = vi.mocked(createTestRunner);
