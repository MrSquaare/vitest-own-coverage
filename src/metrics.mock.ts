import { vi } from "vitest";

import { findFileCoverage, getFileUncoveredLines, getUnitUncoveredLines } from "./metrics.ts";

vi.mock("./metrics.ts", async (importActual) => {
  const actual = await importActual<typeof import("./metrics.ts")>();

  return {
    ...actual,
    findFileCoverage: vi.fn(actual.findFileCoverage),
    getFileUncoveredLines: vi.fn(),
    getUnitUncoveredLines: vi.fn(),
  };
});

export const mockedFindFileCoverage = vi.mocked(findFileCoverage);
export const mockedGetFileUncoveredLines = vi.mocked(getFileUncoveredLines);
export const mockedGetUnitUncoveredLines = vi.mocked(getUnitUncoveredLines);
