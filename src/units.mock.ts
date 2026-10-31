import { vi } from "vitest";

import { extractSourceUnits } from "./units.ts";

vi.mock("./units.ts", async (importActual) => {
  const actual = await importActual<typeof import("./units.ts")>();

  return {
    ...actual,
    extractSourceUnits: vi.fn(),
  };
});

export const mockedExtractSourceUnits = vi.mocked(extractSourceUnits);
