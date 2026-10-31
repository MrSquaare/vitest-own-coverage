import { afterEach, describe, expect, it, vi } from "vitest";

import * as thisMod from "./metrics.ts";
import {
  collectHits,
  findFileCoverage,
  getFileUncoveredLines,
  getLocation,
  getRangeLines,
  getUncoveredLines,
  getUnitUncoveredLines,
  toLineRanges,
  toSortedLines,
} from "./metrics.ts";
import {
  createCoverageRange,
  createFileCoverage,
  createSourceUnit,
  ROOT,
} from "./types.fixture.ts";

describe("getRangeLines", () => {
  it("should return every line of the range", () => {
    expect(getRangeLines(createCoverageRange(3, 5))).toEqual([3, 4, 5]);
  });

  it("should return a single line when range starts and ends on the same line", () => {
    expect(getRangeLines(createCoverageRange(3, 3))).toEqual([3]);
  });
});

describe("toSortedLines", () => {
  it("should sort lines and remove duplicates", () => {
    expect(toSortedLines([5, 3, 5, 1])).toEqual([1, 3, 5]);
  });
});

describe("toLineRanges", () => {
  it("should group consecutive lines into ranges", () => {
    expect(toLineRanges([1, 2, 3, 5, 7, 8])).toEqual("1-3, 5, 7-8");
  });

  it("should return empty string when there are no lines", () => {
    expect(toLineRanges([])).toEqual("");
  });
});

describe("findFileCoverage", () => {
  it("should return coverage entry of the source file", () => {
    const coverage = createFileCoverage({ path: `${ROOT}/src/example.ts` });

    expect(findFileCoverage({ [coverage.path]: coverage }, `${ROOT}/src/example.ts`)).toEqual(
      coverage,
    );
  });

  it("should throw when no coverage was collected for the source file", () => {
    expect(() => findFileCoverage({}, `${ROOT}/src/missing.ts`)).toThrow(
      new Error(
        `No coverage was collected for ${ROOT}/src/missing.ts. Check that its test file imports it.`,
      ),
    );
  });
});

describe("getLocation", () => {
  it("should return location of key", () => {
    const coverage = createFileCoverage();

    expect(getLocation(coverage, coverage.statementMap, "statement", "1")).toEqual(
      createCoverageRange(3, 7),
    );
  });

  it("should throw when key has no location", () => {
    const coverage = createFileCoverage();

    expect(() => getLocation(coverage, coverage.statementMap, "statement", "9")).toThrow(
      new Error(`Invalid coverage report for ${coverage.path}: statement 9 has no location.`),
    );
  });
});

describe("collectHits", () => {
  const getLocationSpy = vi.spyOn(thisMod, "getLocation");

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should collect statement, branch, and function hits with their ranges in this order", () => {
    const coverage = createFileCoverage();

    expect(collectHits(coverage)).toEqual([
      [1, createCoverageRange(1, 1)],
      [1, createCoverageRange(3, 7)],
      [0, createCoverageRange(5, 5)],
      [0, createCoverageRange(4, 6)],
      [1, createCoverageRange(4, 6)],
      [1, createCoverageRange(3, 7)],
    ]);
    expect(getLocationSpy).toHaveBeenCalledTimes(5);
    expect(getLocationSpy).toHaveBeenNthCalledWith(
      1,
      coverage,
      coverage.statementMap,
      "statement",
      "0",
    );
    expect(getLocationSpy).toHaveBeenNthCalledWith(
      2,
      coverage,
      coverage.statementMap,
      "statement",
      "1",
    );
    expect(getLocationSpy).toHaveBeenNthCalledWith(
      3,
      coverage,
      coverage.statementMap,
      "statement",
      "2",
    );
    expect(getLocationSpy).toHaveBeenNthCalledWith(4, coverage, coverage.branchMap, "branch", "0");
    expect(getLocationSpy).toHaveBeenNthCalledWith(5, coverage, coverage.fnMap, "function", "0");
  });
});

describe("getUncoveredLines", () => {
  const getRangeLinesSpy = vi.spyOn(thisMod, "getRangeLines");
  const toSortedLinesSpy = vi.spyOn(thisMod, "toSortedLines");

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should return sorted lines of hits that were never executed", () => {
    expect(
      getUncoveredLines([
        [0, createCoverageRange(5, 6)],
        [3, createCoverageRange(1, 2)],
        [0, createCoverageRange(2, 2)],
      ]),
    ).toEqual([2, 5, 6]);
    expect(getRangeLinesSpy).toHaveBeenCalledTimes(2);
    expect(getRangeLinesSpy).toHaveBeenNthCalledWith(1, createCoverageRange(5, 6));
    expect(getRangeLinesSpy).toHaveBeenNthCalledWith(2, createCoverageRange(2, 2));
    expect(toSortedLinesSpy).toHaveBeenCalledTimes(1);
    expect(toSortedLinesSpy).toHaveBeenNthCalledWith(1, [5, 6, 2]);
  });

  it("should return no lines when every hit was executed", () => {
    expect(getUncoveredLines([[1, createCoverageRange(1, 2)]])).toEqual([]);
    expect(getRangeLinesSpy).not.toHaveBeenCalled();
  });
});

describe("getFileUncoveredLines", () => {
  const collectHitsSpy = vi.spyOn(thisMod, "collectHits");
  const getUncoveredLinesSpy = vi.spyOn(thisMod, "getUncoveredLines");

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should return uncovered lines of every hit of the file", () => {
    const coverage = createFileCoverage({
      statementMap: { "0": createCoverageRange(1, 1), "1": createCoverageRange(5, 5) },
      fnMap: {},
      branchMap: {},
      s: { "0": 1, "1": 0 },
      f: {},
      b: {},
    });

    expect(getFileUncoveredLines(coverage)).toEqual([5]);
    expect(collectHitsSpy).toHaveBeenCalledTimes(1);
    expect(collectHitsSpy).toHaveBeenNthCalledWith(1, coverage);
    expect(getUncoveredLinesSpy).toHaveBeenCalledTimes(1);
    expect(getUncoveredLinesSpy).toHaveBeenNthCalledWith(1, [
      [1, createCoverageRange(1, 1)],
      [0, createCoverageRange(5, 5)],
    ]);
  });
});

describe("getUnitUncoveredLines", () => {
  const collectHitsSpy = vi.spyOn(thisMod, "collectHits");
  const getUncoveredLinesSpy = vi.spyOn(thisMod, "getUncoveredLines");

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should return uncovered lines of hits inside the unit only", () => {
    const coverage = createFileCoverage({
      statementMap: {
        "0": createCoverageRange(1, 1),
        "1": createCoverageRange(3, 7),
        "2": createCoverageRange(5, 5),
        "3": createCoverageRange(6, 9),
      },
      fnMap: {},
      branchMap: {},
      s: { "0": 0, "1": 1, "2": 0, "3": 0 },
      f: {},
      b: {},
    });
    const unit = createSourceUnit({ startLine: 3, endLine: 7 });

    expect(getUnitUncoveredLines(coverage, unit)).toEqual([5]);
    expect(collectHitsSpy).toHaveBeenCalledTimes(1);
    expect(collectHitsSpy).toHaveBeenNthCalledWith(1, coverage);
    expect(getUncoveredLinesSpy).toHaveBeenCalledTimes(1);
    expect(getUncoveredLinesSpy).toHaveBeenNthCalledWith(1, [
      [1, createCoverageRange(3, 7)],
      [0, createCoverageRange(5, 5)],
    ]);
  });
});
