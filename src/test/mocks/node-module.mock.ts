import { createRequire } from "node:module";
import { vi } from "vitest";

vi.mock("node:module", async (importActual) => {
  const actual = await importActual<typeof import("node:module")>();

  return {
    ...actual,
    createRequire: vi.fn(),
  };
});

export const mockedCreateRequire = vi.mocked(createRequire);
