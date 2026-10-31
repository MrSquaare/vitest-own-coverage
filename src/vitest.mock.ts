import { vi } from "vitest";

import { startVitest } from "./vitest.ts";

vi.mock("./vitest.ts", async (importActual) => {
  const actual = await importActual<typeof import("./vitest.ts")>();

  return {
    ...actual,
    startVitest: vi.fn(),
  };
});

export const mockedStartVitest = vi.mocked(startVitest);
