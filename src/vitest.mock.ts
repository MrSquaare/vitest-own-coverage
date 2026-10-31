import { vi } from "vitest";

import { loadCreateVitest, startVitest } from "./vitest.ts";

vi.mock("./vitest.ts", async (importActual) => {
  const actual = await importActual<typeof import("./vitest.ts")>();

  return {
    ...actual,
    startVitest: vi.fn(),
    loadCreateVitest: vi.fn(),
  };
});

export const mockedStartVitest = vi.mocked(startVitest);
export const mockedLoadCreateVitest = vi.mocked(loadCreateVitest);
