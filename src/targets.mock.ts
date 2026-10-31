import { vi } from "vitest";

import { pairTestFiles } from "./targets.ts";

vi.mock("./targets.ts", async (importActual) => {
  const actual = await importActual<typeof import("./targets.ts")>();

  return {
    ...actual,
    pairTestFiles: vi.fn(),
  };
});

export const mockedPairTestFiles = vi.mocked(pairTestFiles);
