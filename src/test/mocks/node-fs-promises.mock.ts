import { mkdtemp, readFile, rm } from "node:fs/promises";
import { vi } from "vitest";

vi.mock("node:fs/promises", async (importActual) => {
  const actual = await importActual<typeof import("node:fs/promises")>();

  return {
    ...actual,
    mkdtemp: vi.fn(),
    readFile: vi.fn(),
    rm: vi.fn(),
  };
});

export const mockedMkdtemp = vi.mocked(mkdtemp);
export const mockedReadFile = vi.mocked(readFile);
export const mockedRm = vi.mocked(rm);
