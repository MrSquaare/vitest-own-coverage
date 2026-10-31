import { vi } from "vitest";

import { countChecks, formatJsonReport, formatTextReport } from "./report.ts";

vi.mock("./report.ts", async (importActual) => {
  const actual = await importActual<typeof import("./report.ts")>();

  return {
    ...actual,
    countChecks: vi.fn(actual.countChecks),
    formatJsonReport: vi.fn(actual.formatJsonReport),
    formatTextReport: vi.fn(actual.formatTextReport),
  };
});

export const mockedCountChecks = vi.mocked(countChecks);
export const mockedFormatJsonReport = vi.mocked(formatJsonReport);
export const mockedFormatTextReport = vi.mocked(formatTextReport);
