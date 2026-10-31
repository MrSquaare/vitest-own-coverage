import { afterEach, describe, expect, it, vi } from "vitest";

import * as thisMod from "./targets.ts";
import { pairTestFiles, toSourceFile } from "./targets.ts";
import { createCheckOptions, createSourceUnit, ROOT } from "./types.fixture.ts";

describe("toSourceFile", () => {
  it("should remove the test infix before the extension", () => {
    expect(toSourceFile(`${ROOT}/src/example.test.ts`, ["test", "spec"])).toEqual(
      `${ROOT}/src/example.ts`,
    );
  });

  it("should keep the extension of the test file", () => {
    expect(toSourceFile(`${ROOT}/src/view.spec.tsx`, ["test", "spec"])).toEqual(
      `${ROOT}/src/view.tsx`,
    );
  });

  it("should keep dots of the source name", () => {
    expect(toSourceFile(`${ROOT}/src/example.utils.test.ts`, ["test"])).toEqual(
      `${ROOT}/src/example.utils.ts`,
    );
  });

  it("should return null when the infix is not a test infix", () => {
    expect(toSourceFile(`${ROOT}/src/example.e2e.ts`, ["test", "spec"])).toEqual(null);
  });

  it("should return null when the test file has no infix", () => {
    expect(toSourceFile(`${ROOT}/src/example.ts`, ["test", "spec"])).toEqual(null);
  });
});

describe("pairTestFiles", () => {
  const toSourceFileSpy = vi.spyOn(thisMod, "toSourceFile");

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should pair test files with their source units", () => {
    const options = createCheckOptions({ testInfixes: ["test"] });
    const units = [createSourceUnit()];

    expect(
      pairTestFiles(
        [`${ROOT}/src/example.test.ts`],
        new Map([[`${ROOT}/src/example.ts`, units]]),
        options,
      ),
    ).toEqual({
      targets: [
        {
          target: { testFile: `${ROOT}/src/example.test.ts`, sourceFile: `${ROOT}/src/example.ts` },
          units,
        },
      ],
      untestedSourceFiles: [],
      orphanTestFiles: [],
    });
    expect(toSourceFileSpy).toHaveBeenCalledTimes(1);
    expect(toSourceFileSpy).toHaveBeenNthCalledWith(1, `${ROOT}/src/example.test.ts`, ["test"]);
  });

  it("should report source files with units and without test file", () => {
    const options = createCheckOptions({ testInfixes: ["test"] });

    expect(
      pairTestFiles(
        [],
        new Map([
          [`${ROOT}/src/untested.ts`, [createSourceUnit()]],
          [`${ROOT}/src/constants.ts`, []],
        ]),
        options,
      ),
    ).toEqual({
      targets: [],
      untestedSourceFiles: [`${ROOT}/src/untested.ts`],
      orphanTestFiles: [],
    });
  });

  it("should report test files without test infix", () => {
    const options = createCheckOptions({ testInfixes: ["test"] });

    expect(pairTestFiles([`${ROOT}/src/example.e2e.ts`], new Map(), options)).toEqual({
      targets: [],
      untestedSourceFiles: [],
      orphanTestFiles: [`${ROOT}/src/example.e2e.ts`],
    });
  });

  it("should report test files whose source file is not covered", () => {
    const options = createCheckOptions({ testInfixes: ["test"] });

    expect(pairTestFiles([`${ROOT}/src/missing.test.ts`], new Map(), options)).toEqual({
      targets: [],
      untestedSourceFiles: [],
      orphanTestFiles: [`${ROOT}/src/missing.test.ts`],
    });
  });
});
