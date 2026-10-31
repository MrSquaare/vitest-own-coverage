import {
  mockedFindFileCoverage,
  mockedGetFileUncoveredLines,
  mockedGetUnitUncoveredLines,
} from "./metrics.mock.ts";
import { mockedPairTestFiles } from "./targets.mock.ts";
import { mockedReadFile } from "./test/mocks/node-fs-promises.mock.ts";
import { mockedExtractSourceUnits } from "./units.mock.ts";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { TestRunner } from "./runner.ts";

import * as thisMod from "./checks.ts";
import {
  checkProject,
  checkTarget,
  checkUnit,
  findSuites,
  readSourceUnits,
  toUncoveredFailure,
} from "./checks.ts";
import {
  createCheckOptions,
  createCheckTarget,
  createFileCoverage,
  createSourceUnit,
  createTargetCheckResult,
  createTestFailure,
  createTestFileRun,
  createTestSuiteNode,
  createTestTarget,
  createUnitCheckResult,
  ROOT,
} from "./types.fixture.ts";

const SOURCE_FILE = `${ROOT}/src/example.ts`;
const TEST_FILE = `${ROOT}/src/example.test.ts`;

describe("findSuites", () => {
  const findSuitesSpy = vi.spyOn(thisMod, "findSuites");

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should return every top-level suite of the name", () => {
    const first = createTestSuiteNode({ name: "example", testIds: ["first"] });
    const second = createTestSuiteNode({ name: "example", testIds: ["second"] });

    expect(
      findSuites([first, createTestSuiteNode({ name: "other" }), second], ["example"]),
    ).toEqual([first, second]);
    expect(findSuitesSpy).toHaveBeenCalledTimes(1);
  });

  it("should descend into suites along the describe path", () => {
    const greet = createTestSuiteNode({ name: "greet" });
    const example = createTestSuiteNode({ name: "Example", suites: [greet] });

    expect(findSuites([example], ["Example", "greet"])).toEqual([greet]);
    expect(findSuitesSpy).toHaveBeenCalledTimes(2);
    expect(findSuitesSpy).toHaveBeenNthCalledWith(2, [greet], ["greet"]);
  });

  it("should return no suite when the describe path is missing", () => {
    expect(findSuites([createTestSuiteNode({ name: "other" })], ["Example", "greet"])).toEqual([]);
  });
});

describe("toUncoveredFailure", () => {
  it("should report uncovered lines", () => {
    expect(toUncoveredFailure([3, 4])).toEqual({ kind: "uncovered", uncoveredLines: [3, 4] });
  });

  it("should return null when every line is covered", () => {
    expect(toUncoveredFailure([])).toEqual(null);
  });
});

describe("checkUnit", () => {
  const findSuitesSpy = vi.spyOn(thisMod, "findSuites");
  const toUncoveredFailureSpy = vi.spyOn(thisMod, "toUncoveredFailure");

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should run the tests of the describe block and check coverage of the unit", async () => {
    const target = createTestTarget({ testFile: TEST_FILE, sourceFile: SOURCE_FILE });
    const unit = createSourceUnit({ describePath: ["example"] });
    const suites = [createTestSuiteNode({ name: "example", testIds: ["first", "second"] })];
    const coverage = createFileCoverage({ path: SOURCE_FILE });
    const run = createTestFileRun({
      ok: true,
      passedTestCount: 2,
      coverage: { [SOURCE_FILE]: coverage },
    });
    const runTestFile = vi.fn<TestRunner["runTestFile"]>().mockResolvedValueOnce(run);
    const runner: TestRunner = {
      testFiles: [TEST_FILE],
      runAllTestFiles: vi.fn(),
      runTestFile,
      [Symbol.asyncDispose]: vi.fn(),
    };

    mockedGetUnitUncoveredLines.mockReturnValueOnce([]);

    await expect(checkUnit(runner, target, suites, unit)).resolves.toEqual({ unit, failure: null });
    expect(findSuitesSpy).toHaveBeenCalledTimes(1);
    expect(findSuitesSpy).toHaveBeenNthCalledWith(1, suites, ["example"]);
    expect(runTestFile).toHaveBeenCalledTimes(1);
    expect(runTestFile).toHaveBeenNthCalledWith(1, TEST_FILE, ["first", "second"]);
    expect(mockedFindFileCoverage).toHaveBeenCalledTimes(1);
    expect(mockedFindFileCoverage).toHaveBeenNthCalledWith(1, run.coverage, SOURCE_FILE);
    expect(mockedGetUnitUncoveredLines).toHaveBeenCalledTimes(1);
    expect(mockedGetUnitUncoveredLines).toHaveBeenNthCalledWith(1, coverage, unit);
    expect(toUncoveredFailureSpy).toHaveBeenCalledTimes(1);
    expect(toUncoveredFailureSpy).toHaveBeenNthCalledWith(1, []);
  });

  it("should report uncovered lines of the unit", async () => {
    const target = createTestTarget({ testFile: TEST_FILE, sourceFile: SOURCE_FILE });
    const unit = createSourceUnit({ describePath: ["example"] });
    const run = createTestFileRun({
      ok: true,
      passedTestCount: 1,
      coverage: { [SOURCE_FILE]: createFileCoverage({ path: SOURCE_FILE }) },
    });
    const runner: TestRunner = {
      testFiles: [TEST_FILE],
      runAllTestFiles: vi.fn(),
      runTestFile: vi.fn<TestRunner["runTestFile"]>().mockResolvedValueOnce(run),
      [Symbol.asyncDispose]: vi.fn(),
    };

    mockedGetUnitUncoveredLines.mockReturnValueOnce([5]);

    await expect(
      checkUnit(runner, target, [createTestSuiteNode({ name: "example" })], unit),
    ).resolves.toEqual({ unit, failure: { kind: "uncovered", uncoveredLines: [5] } });
  });

  it("should report missing describe block without running tests", async () => {
    const runTestFile = vi.fn<TestRunner["runTestFile"]>();
    const runner: TestRunner = {
      testFiles: [TEST_FILE],
      runAllTestFiles: vi.fn(),
      runTestFile,
      [Symbol.asyncDispose]: vi.fn(),
    };
    const unit = createSourceUnit({ describePath: ["Example", "greet"] });

    await expect(
      checkUnit(runner, createTestTarget(), [createTestSuiteNode({ name: "example" })], unit),
    ).resolves.toEqual({ unit, failure: { kind: "missing-describe" } });
    expect(runTestFile).not.toHaveBeenCalled();
  });

  it("should report describe block without tests without running tests", async () => {
    const runTestFile = vi.fn<TestRunner["runTestFile"]>();
    const runner: TestRunner = {
      testFiles: [TEST_FILE],
      runAllTestFiles: vi.fn(),
      runTestFile,
      [Symbol.asyncDispose]: vi.fn(),
    };
    const unit = createSourceUnit({ describePath: ["example"] });

    await expect(
      checkUnit(
        runner,
        createTestTarget(),
        [createTestSuiteNode({ name: "example", testIds: [] })],
        unit,
      ),
    ).resolves.toEqual({ unit, failure: { kind: "no-tests" } });
    expect(runTestFile).not.toHaveBeenCalled();
  });

  it("should report failed tests of the describe block with their failures", async () => {
    const failure = createTestFailure();
    const runner: TestRunner = {
      testFiles: [TEST_FILE],
      runAllTestFiles: vi.fn(),
      runTestFile: vi
        .fn<TestRunner["runTestFile"]>()
        .mockResolvedValueOnce(
          createTestFileRun({ ok: false, failures: [failure], passedTestCount: 1 }),
        ),
      [Symbol.asyncDispose]: vi.fn(),
    };
    const unit = createSourceUnit({ describePath: ["example"] });

    await expect(
      checkUnit(runner, createTestTarget(), [createTestSuiteNode({ name: "example" })], unit),
    ).resolves.toEqual({ unit, failure: { kind: "failed-tests", failures: [failure] } });
    expect(mockedGetUnitUncoveredLines).not.toHaveBeenCalled();
  });

  it("should report describe block that runs no passing test", async () => {
    const runner: TestRunner = {
      testFiles: [TEST_FILE],
      runAllTestFiles: vi.fn(),
      runTestFile: vi
        .fn<TestRunner["runTestFile"]>()
        .mockResolvedValueOnce(createTestFileRun({ ok: true, passedTestCount: 0 })),
      [Symbol.asyncDispose]: vi.fn(),
    };
    const unit = createSourceUnit({ describePath: ["example"] });

    await expect(
      checkUnit(runner, createTestTarget(), [createTestSuiteNode({ name: "example" })], unit),
    ).resolves.toEqual({ unit, failure: { kind: "no-tests" } });
    expect(mockedGetUnitUncoveredLines).not.toHaveBeenCalled();
  });
});

describe("checkTarget", () => {
  const checkUnitSpy = vi.spyOn(thisMod, "checkUnit");
  const toUncoveredFailureSpy = vi.spyOn(thisMod, "toUncoveredFailure");

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should check each unit in order and then the coverage of the whole test file", async () => {
    const target = createTestTarget({ testFile: TEST_FILE, sourceFile: SOURCE_FILE });
    const units = [
      createSourceUnit({ describePath: ["first"] }),
      createSourceUnit({ describePath: ["second"] }),
    ];
    const coverage = createFileCoverage({ path: SOURCE_FILE });
    const run = createTestFileRun({ ok: true, coverage: { [SOURCE_FILE]: coverage } });
    const runTestFile = vi.fn<TestRunner["runTestFile"]>().mockResolvedValueOnce(run);
    const runner: TestRunner = {
      testFiles: [TEST_FILE],
      runAllTestFiles: vi.fn(),
      runTestFile,
      [Symbol.asyncDispose]: vi.fn(),
    };
    const unitResults = units.map((unit) => createUnitCheckResult({ unit, failure: null }));

    checkUnitSpy.mockResolvedValueOnce(unitResults[0]).mockResolvedValueOnce(unitResults[1]);
    mockedGetFileUncoveredLines.mockReturnValueOnce([]);

    await expect(checkTarget(runner, createCheckTarget({ target, units }))).resolves.toEqual({
      target,
      failure: null,
      units: unitResults,
    });
    expect(runTestFile).toHaveBeenCalledTimes(1);
    expect(runTestFile).toHaveBeenNthCalledWith(1, TEST_FILE);
    expect(checkUnitSpy).toHaveBeenCalledTimes(2);
    expect(checkUnitSpy).toHaveBeenNthCalledWith(1, runner, target, run.suites, units[0]);
    expect(checkUnitSpy).toHaveBeenNthCalledWith(2, runner, target, run.suites, units[1]);
    expect(mockedFindFileCoverage).toHaveBeenCalledTimes(1);
    expect(mockedFindFileCoverage).toHaveBeenNthCalledWith(1, run.coverage, SOURCE_FILE);
    expect(mockedGetFileUncoveredLines).toHaveBeenCalledTimes(1);
    expect(mockedGetFileUncoveredLines).toHaveBeenNthCalledWith(1, coverage);
    expect(toUncoveredFailureSpy).toHaveBeenCalledTimes(1);
    expect(toUncoveredFailureSpy).toHaveBeenNthCalledWith(1, []);
  });

  it("should report uncovered lines of the whole test file", async () => {
    const target = createTestTarget({ testFile: TEST_FILE, sourceFile: SOURCE_FILE });
    const run = createTestFileRun({
      ok: true,
      coverage: { [SOURCE_FILE]: createFileCoverage({ path: SOURCE_FILE }) },
    });
    const runner: TestRunner = {
      testFiles: [TEST_FILE],
      runAllTestFiles: vi.fn(),
      runTestFile: vi.fn<TestRunner["runTestFile"]>().mockResolvedValueOnce(run),
      [Symbol.asyncDispose]: vi.fn(),
    };

    mockedGetFileUncoveredLines.mockReturnValueOnce([1, 2]);

    await expect(checkTarget(runner, createCheckTarget({ target, units: [] }))).resolves.toEqual({
      target,
      failure: { kind: "uncovered", uncoveredLines: [1, 2] },
      units: [],
    });
  });

  it("should report failed tests without checking units or coverage", async () => {
    const target = createTestTarget({ testFile: TEST_FILE, sourceFile: SOURCE_FILE });
    const failure = createTestFailure();
    const runner: TestRunner = {
      testFiles: [TEST_FILE],
      runAllTestFiles: vi.fn(),
      runTestFile: vi
        .fn<TestRunner["runTestFile"]>()
        .mockResolvedValueOnce(createTestFileRun({ ok: false, failures: [failure] })),
      [Symbol.asyncDispose]: vi.fn(),
    };

    await expect(
      checkTarget(runner, createCheckTarget({ target, units: [createSourceUnit()] })),
    ).resolves.toEqual({
      target,
      failure: { kind: "failed-tests", failures: [failure] },
      units: [],
    });
    expect(checkUnitSpy).not.toHaveBeenCalled();
    expect(mockedFindFileCoverage).not.toHaveBeenCalled();
  });
});

describe("readSourceUnits", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should read the source file and extract its units", async () => {
    const units = [createSourceUnit()];

    mockedReadFile.mockResolvedValueOnce("source code");
    mockedExtractSourceUnits.mockReturnValueOnce(units);

    await expect(readSourceUnits(SOURCE_FILE)).resolves.toEqual([SOURCE_FILE, units]);
    expect(mockedReadFile).toHaveBeenCalledTimes(1);
    expect(mockedReadFile).toHaveBeenNthCalledWith(1, SOURCE_FILE, "utf8");
    expect(mockedExtractSourceUnits).toHaveBeenCalledTimes(1);
    expect(mockedExtractSourceUnits).toHaveBeenNthCalledWith(1, SOURCE_FILE, "source code");
  });
});

describe("checkProject", () => {
  const readSourceUnitsSpy = vi.spyOn(thisMod, "readSourceUnits");
  const checkTargetSpy = vi.spyOn(thisMod, "checkTarget");

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should check every paired target of the source files covered by the test run", async () => {
    const otherSourceFile = `${ROOT}/src/other.ts`;
    const units = [createSourceUnit()];
    const runAllTestFiles = vi.fn<TestRunner["runAllTestFiles"]>().mockResolvedValueOnce({
      [otherSourceFile]: createFileCoverage({ path: otherSourceFile }),
      [SOURCE_FILE]: createFileCoverage({ path: SOURCE_FILE }),
    });
    const runner: TestRunner = {
      testFiles: [TEST_FILE],
      runAllTestFiles,
      runTestFile: vi.fn(),
      [Symbol.asyncDispose]: vi.fn(),
    };
    const options = createCheckOptions();
    const checkTargets = [createCheckTarget(), createCheckTarget()];
    const targetResults = [createTargetCheckResult(), createTargetCheckResult()];

    readSourceUnitsSpy
      .mockResolvedValueOnce([SOURCE_FILE, units])
      .mockResolvedValueOnce([otherSourceFile, []]);
    mockedPairTestFiles.mockReturnValueOnce({
      targets: checkTargets,
      untestedSourceFiles: [`${ROOT}/src/untested.ts`],
      orphanTestFiles: [`${ROOT}/src/orphan.test.ts`],
    });
    checkTargetSpy.mockResolvedValueOnce(targetResults[0]).mockResolvedValueOnce(targetResults[1]);

    await expect(checkProject(runner, options)).resolves.toEqual({
      untestedSourceFiles: [`${ROOT}/src/untested.ts`],
      orphanTestFiles: [`${ROOT}/src/orphan.test.ts`],
      targets: targetResults,
    });
    expect(runAllTestFiles).toHaveBeenCalledTimes(1);
    expect(readSourceUnitsSpy).toHaveBeenCalledTimes(2);
    expect(readSourceUnitsSpy).toHaveBeenNthCalledWith(1, SOURCE_FILE);
    expect(readSourceUnitsSpy).toHaveBeenNthCalledWith(2, otherSourceFile);
    expect(mockedPairTestFiles).toHaveBeenCalledTimes(1);
    expect(mockedPairTestFiles).toHaveBeenNthCalledWith(
      1,
      [TEST_FILE],
      new Map([
        [SOURCE_FILE, units],
        [otherSourceFile, []],
      ]),
      options,
    );
    expect(checkTargetSpy).toHaveBeenCalledTimes(2);
    expect(checkTargetSpy).toHaveBeenNthCalledWith(1, runner, checkTargets[0]);
    expect(checkTargetSpy).toHaveBeenNthCalledWith(2, runner, checkTargets[1]);
  });
});
