import { mockedMkdtemp, mockedRm } from "./test/mocks/node-fs-promises.mock.ts";
import { mockedStartVitest } from "./vitest.mock.ts";

import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createVitest } from "vitest/node";

import type { CoverageCollector, SpecificationsRun } from "./runner.ts";
import type {
  VitestCollection,
  VitestInstance,
  VitestModule,
  VitestSpecification,
} from "./vitest.ts";

import * as thisMod from "./runner.ts";
import {
  createCoverageCollector,
  createTestRunner,
  formatErrorMessage,
  getSpecification,
  indexSpecifications,
  isErrorWithMessage,
  parseCoverageReport,
  runSpecifications,
  toSuiteNodes,
  toTestFailures,
  toTestFileRun,
} from "./runner.ts";
import {
  createFileCoverage,
  createTestFailure,
  createTestFileRun,
  createTestSuiteNode,
  ROOT,
} from "./types.fixture.ts";

const REPORTS_DIRECTORY = "/tmp/vitest-own-coverage-abc";
const TEST_FILE = `${ROOT}/src/example.test.ts`;
const OTHER_TEST_FILE = `${ROOT}/src/other.test.ts`;

describe("parseCoverageReport", () => {
  it("should validate the JSON form of the coverage map", () => {
    const coverage = createFileCoverage();
    const coverageMap = {
      toJSON: () => ({
        [coverage.path]: {
          ...coverage,
          branchMap: {
            "0": {
              loc: coverage.branchMap["0"].loc,
              locations: [coverage.branchMap["0"].loc, { start: {}, end: {} }],
            },
          },
        },
      }),
    };

    expect(parseCoverageReport(coverageMap)).toEqual({ [coverage.path]: coverage });
  });
});

describe("createCoverageCollector", () => {
  const parseCoverageReportSpy = vi.spyOn(thisMod, "parseCoverageReport");

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should take collected reports in collection order", () => {
    const collector = createCoverageCollector();
    const firstCoverage = createFileCoverage({
      path: `${ROOT}/src/first.ts`,
      branchMap: {},
      b: {},
    });
    const secondCoverage = createFileCoverage({
      path: `${ROOT}/src/second.ts`,
      branchMap: {},
      b: {},
    });

    collector.collect({ [firstCoverage.path]: firstCoverage });
    collector.collect({ [secondCoverage.path]: secondCoverage });

    expect(collector.take()).toEqual({ [firstCoverage.path]: firstCoverage });
    expect(collector.take()).toEqual({ [secondCoverage.path]: secondCoverage });
    expect(parseCoverageReportSpy).toHaveBeenCalledTimes(2);
    expect(parseCoverageReportSpy).toHaveBeenNthCalledWith(1, {
      [firstCoverage.path]: firstCoverage,
    });
    expect(parseCoverageReportSpy).toHaveBeenNthCalledWith(2, {
      [secondCoverage.path]: secondCoverage,
    });
  });

  it("should throw when no report was collected", () => {
    expect(() => createCoverageCollector().take()).toThrow(
      new Error(
        "Vitest reported no coverage for the test run. Check that its coverage provider is installed.",
      ),
    );
  });
});

describe("indexSpecifications", () => {
  it("should index specifications by test file", () => {
    const project = { createSpecification: vi.fn() };
    const specification = { moduleId: TEST_FILE, project };
    const otherSpecification = { moduleId: OTHER_TEST_FILE, project };

    expect(indexSpecifications([specification, otherSpecification])).toEqual(
      new Map([
        [TEST_FILE, specification],
        [OTHER_TEST_FILE, otherSpecification],
      ]),
    );
  });

  it("should throw when a test file runs in several projects", () => {
    const specification = { moduleId: TEST_FILE, project: { createSpecification: vi.fn() } };

    expect(() => indexSpecifications([specification, specification])).toThrow(
      new Error(
        `Test file ${TEST_FILE} runs in several Vitest projects. Check each project with its own root instead.`,
      ),
    );
  });
});

describe("getSpecification", () => {
  it("should return specification of the whole test file", () => {
    const specification = { moduleId: TEST_FILE, project: { createSpecification: vi.fn() } };

    expect(getSpecification(new Map([[TEST_FILE, specification]]), TEST_FILE)).toEqual(
      specification,
    );
    expect(specification.project.createSpecification).not.toHaveBeenCalled();
  });

  it("should create specification restricted to the test ids", () => {
    const filteredSpecification = {
      moduleId: TEST_FILE,
      project: { createSpecification: vi.fn() },
    };
    const createSpecification = vi
      .fn<VitestSpecification["project"]["createSpecification"]>()
      .mockReturnValueOnce(filteredSpecification);
    const specification = { moduleId: TEST_FILE, project: { createSpecification } };

    expect(
      getSpecification(new Map([[TEST_FILE, specification]]), TEST_FILE, ["first", "second"]),
    ).toEqual(filteredSpecification);
    expect(createSpecification).toHaveBeenCalledTimes(1);
    expect(createSpecification).toHaveBeenNthCalledWith(1, TEST_FILE, {
      testIds: ["first", "second"],
    });
  });

  it("should throw when the test file is not a Vitest test file", () => {
    expect(() => getSpecification(new Map(), TEST_FILE)).toThrow(
      new Error(`Test file ${TEST_FILE} is not part of the Vitest test files.`),
    );
  });
});

describe("isErrorWithMessage", () => {
  it("should accept objects with a string message", () => {
    expect(isErrorWithMessage({ message: "Failed" })).toEqual(true);
  });

  it("should reject objects without a string message", () => {
    expect(isErrorWithMessage({ message: 1 })).toEqual(false);
  });

  it("should reject objects without message", () => {
    expect(isErrorWithMessage({})).toEqual(false);
  });

  it("should reject null", () => {
    expect(isErrorWithMessage(null)).toEqual(false);
  });

  it("should reject primitives", () => {
    expect(isErrorWithMessage("Failed")).toEqual(false);
  });
});

describe("formatErrorMessage", () => {
  const isErrorWithMessageSpy = vi.spyOn(thisMod, "isErrorWithMessage");

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should return message of errors", () => {
    expect(formatErrorMessage({ message: "Failed" })).toEqual("Failed");
    expect(isErrorWithMessageSpy).toHaveBeenCalledTimes(1);
    expect(isErrorWithMessageSpy).toHaveBeenNthCalledWith(1, { message: "Failed" });
  });

  it("should return JSON of values without message", () => {
    expect(formatErrorMessage({ code: 1 })).toEqual('{"code":1}');
  });
});

describe("runSpecifications", () => {
  const formatErrorMessageSpy = vi.spyOn(thisMod, "formatErrorMessage");

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should run specifications and take the coverage they reported", async () => {
    const testModules: VitestModule[] = [];
    const coverage = { [`${ROOT}/src/example.ts`]: createFileCoverage() };
    const specifications = [{ moduleId: TEST_FILE, project: { createSpecification: vi.fn() } }];
    const runTestSpecifications = vi
      .fn<VitestInstance["runTestSpecifications"]>()
      .mockResolvedValueOnce({ testModules, unhandledErrors: [] });
    const take = vi.fn<CoverageCollector["take"]>().mockReturnValueOnce(coverage);
    const vitest: VitestInstance = {
      config: { coverage: {} },
      enableCoverage: vi.fn(),
      globTestSpecifications: vi.fn(),
      runTestSpecifications,
      close: vi.fn(),
    };

    await expect(
      runSpecifications(vitest, { collect: vi.fn(), take }, specifications, true),
    ).resolves.toEqual({ testModules, coverage });
    expect(runTestSpecifications).toHaveBeenCalledTimes(1);
    expect(runTestSpecifications).toHaveBeenNthCalledWith(1, specifications, true);
    expect(take).toHaveBeenCalledTimes(1);
  });

  it("should throw when Vitest reports unhandled errors", async () => {
    const runTestSpecifications = vi
      .fn<VitestInstance["runTestSpecifications"]>()
      .mockResolvedValueOnce({
        testModules: [],
        unhandledErrors: [{ message: "First failure" }, { message: "Second failure" }],
      });
    const take = vi.fn<CoverageCollector["take"]>();
    const vitest: VitestInstance = {
      config: { coverage: {} },
      enableCoverage: vi.fn(),
      globTestSpecifications: vi.fn(),
      runTestSpecifications,
      close: vi.fn(),
    };

    await expect(runSpecifications(vitest, { collect: vi.fn(), take }, [], false)).rejects.toThrow(
      new Error("Vitest reported unhandled errors: First failure; Second failure"),
    );
    expect(formatErrorMessageSpy).toHaveBeenCalledTimes(2);
    expect(formatErrorMessageSpy).toHaveBeenNthCalledWith(1, { message: "First failure" });
    expect(formatErrorMessageSpy).toHaveBeenNthCalledWith(2, { message: "Second failure" });
    expect(take).not.toHaveBeenCalled();
  });
});

describe("toSuiteNodes", () => {
  const toSuiteNodesSpy = vi.spyOn(thisMod, "toSuiteNodes");

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should map nested suites with the ids of all their tests", () => {
    const nestedTest = { id: "nested-test", fullName: "Example > greet > nested", result: vi.fn() };
    const directTest = { id: "direct-test", fullName: "Example > direct", result: vi.fn() };
    const nestedChildren: VitestCollection = {
      suites: () => [],
      allSuites: () => [],
      allTests: () => [nestedTest],
    };
    const greet = {
      name: "greet",
      fullName: "Example > greet",
      children: nestedChildren,
      errors: vi.fn(),
    };
    const exampleChildren: VitestCollection = {
      suites: () => [greet],
      allSuites: () => [greet],
      allTests: () => [nestedTest, directTest],
    };
    const example = {
      name: "Example",
      fullName: "Example",
      children: exampleChildren,
      errors: vi.fn(),
    };
    const collection: VitestCollection = {
      suites: () => [example],
      allSuites: () => [example, greet],
      allTests: () => [nestedTest, directTest],
    };

    expect(toSuiteNodes(collection)).toEqual([
      {
        name: "Example",
        testIds: ["nested-test", "direct-test"],
        suites: [{ name: "greet", testIds: ["nested-test"], suites: [] }],
      },
    ]);
    expect(toSuiteNodesSpy).toHaveBeenCalledTimes(3);
    expect(toSuiteNodesSpy).toHaveBeenNthCalledWith(1, collection);
    expect(toSuiteNodesSpy).toHaveBeenNthCalledWith(2, exampleChildren);
    expect(toSuiteNodesSpy).toHaveBeenNthCalledWith(3, nestedChildren);
  });
});

describe("toTestFailures", () => {
  const formatErrorMessageSpy = vi.spyOn(thisMod, "formatErrorMessage");

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should collect errors of the test file, its suites, and its failed tests", () => {
    const suite = {
      name: "example",
      fullName: "Example > greet",
      children: { suites: () => [], allSuites: () => [], allTests: () => [] },
      errors: () => [{ message: "beforeAll failed" }],
    };
    const failedTest = {
      id: "failed-test",
      fullName: "Example > greet > should greet",
      result: () => ({
        state: "failed",
        errors: [{ message: "expected 1 to be 2" }, { message: "second assertion" }],
      }),
    };
    const allTests = vi.fn<VitestCollection["allTests"]>().mockReturnValueOnce([failedTest]);
    const testModule: VitestModule = {
      moduleId: TEST_FILE,
      children: { suites: () => [suite], allSuites: () => [suite], allTests },
      ok: () => false,
      errors: () => [{ message: "Failed to load" }],
    };

    expect(toTestFailures(testModule)).toEqual([
      { name: null, message: "Failed to load" },
      { name: "Example > greet", message: "beforeAll failed" },
      { name: "Example > greet > should greet", message: "expected 1 to be 2" },
      { name: "Example > greet > should greet", message: "second assertion" },
    ]);
    expect(allTests).toHaveBeenCalledTimes(1);
    expect(allTests).toHaveBeenNthCalledWith(1, "failed");
    expect(formatErrorMessageSpy).toHaveBeenCalledTimes(2);
    expect(formatErrorMessageSpy).toHaveBeenNthCalledWith(1, { message: "Failed to load" });
    expect(formatErrorMessageSpy).toHaveBeenNthCalledWith(2, { message: "beforeAll failed" });
  });

  it("should ignore failed tests without errors", () => {
    const testModule: VitestModule = {
      moduleId: TEST_FILE,
      children: {
        suites: () => [],
        allSuites: () => [],
        allTests: () => [{ id: "test", fullName: "test", result: () => ({ state: "failed" }) }],
      },
      ok: () => false,
      errors: () => [],
    };

    expect(toTestFailures(testModule)).toEqual([]);
  });
});

describe("toTestFileRun", () => {
  const toSuiteNodesSpy = vi.spyOn(thisMod, "toSuiteNodes");
  const toTestFailuresSpy = vi.spyOn(thisMod, "toTestFailures");

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should summarize the module of the test file", () => {
    const suites = [createTestSuiteNode()];
    const failures = [createTestFailure()];
    const allTests = vi.fn<VitestCollection["allTests"]>().mockReturnValueOnce([
      { id: "first", fullName: "first", result: vi.fn() },
      { id: "second", fullName: "second", result: vi.fn() },
    ]);
    const children: VitestCollection = { suites: () => [], allSuites: () => [], allTests };
    const testModule: VitestModule = {
      moduleId: TEST_FILE,
      children,
      ok: () => false,
      errors: () => [],
    };
    const otherModule: VitestModule = {
      moduleId: OTHER_TEST_FILE,
      children: { suites: () => [], allSuites: () => [], allTests: () => [] },
      ok: () => true,
      errors: () => [],
    };
    const run: SpecificationsRun = {
      testModules: [otherModule, testModule],
      coverage: { [`${ROOT}/src/example.ts`]: createFileCoverage() },
    };

    toTestFailuresSpy.mockReturnValueOnce(failures);
    toSuiteNodesSpy.mockReturnValueOnce(suites);

    expect(toTestFileRun(run, TEST_FILE)).toEqual({
      ok: false,
      failures,
      passedTestCount: 2,
      suites,
      coverage: run.coverage,
    });
    expect(toTestFailuresSpy).toHaveBeenCalledTimes(1);
    expect(toTestFailuresSpy).toHaveBeenNthCalledWith(1, testModule);
    expect(allTests).toHaveBeenCalledTimes(1);
    expect(allTests).toHaveBeenNthCalledWith(1, "passed");
    expect(toSuiteNodesSpy).toHaveBeenCalledTimes(1);
    expect(toSuiteNodesSpy).toHaveBeenNthCalledWith(1, children);
  });

  it("should throw when Vitest reported no module for the test file", () => {
    expect(() => toTestFileRun({ testModules: [], coverage: {} }, TEST_FILE)).toThrow(
      new Error(`Vitest reported no result for test file ${TEST_FILE}.`),
    );
  });
});

describe("createTestRunner", () => {
  const createCoverageCollectorSpy = vi.spyOn(thisMod, "createCoverageCollector");
  const indexSpecificationsSpy = vi.spyOn(thisMod, "indexSpecifications");
  const getSpecificationSpy = vi.spyOn(thisMod, "getSpecification");
  const runSpecificationsSpy = vi.spyOn(thisMod, "runSpecifications");
  const toTestFileRunSpy = vi.spyOn(thisMod, "toTestFileRun");

  const otherSpecification = {
    moduleId: OTHER_TEST_FILE,
    project: { createSpecification: vi.fn() },
  };
  const specification = { moduleId: TEST_FILE, project: { createSpecification: vi.fn() } };

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should start Vitest with coverage and expose sorted test files", async () => {
    const vitest: VitestInstance = {
      config: { coverage: { include: ["src/**/*.ts"] } },
      enableCoverage: vi.fn<VitestInstance["enableCoverage"]>().mockResolvedValueOnce(undefined),
      globTestSpecifications: vi
        .fn<VitestInstance["globTestSpecifications"]>()
        .mockResolvedValueOnce([otherSpecification, specification]),
      runTestSpecifications: vi.fn(),
      close: vi.fn<VitestInstance["close"]>().mockResolvedValueOnce(undefined),
    };

    mockedMkdtemp.mockResolvedValueOnce(REPORTS_DIRECTORY);
    mockedStartVitest.mockResolvedValueOnce(vitest);

    const runner = await createTestRunner(ROOT);
    const collector = createCoverageCollectorSpy.mock.results[0]?.value as CoverageCollector;

    expect(runner.testFiles).toEqual([TEST_FILE, OTHER_TEST_FILE]);
    expect(mockedMkdtemp).toHaveBeenCalledTimes(1);
    expect(mockedMkdtemp).toHaveBeenNthCalledWith(1, join(tmpdir(), "vitest-own-coverage-"));
    expect(mockedStartVitest).toHaveBeenCalledTimes(1);
    expect(mockedStartVitest).toHaveBeenNthCalledWith(1, createVitest, {
      root: ROOT,
      reportsDirectory: REPORTS_DIRECTORY,
      onCoverage: collector.collect,
    });
    expect(vitest.enableCoverage).toHaveBeenCalledTimes(1);
    expect(indexSpecificationsSpy).toHaveBeenCalledTimes(1);
    expect(indexSpecificationsSpy).toHaveBeenNthCalledWith(1, [otherSpecification, specification]);
    expect(vitest.close).not.toHaveBeenCalled();
    expect(mockedRm).not.toHaveBeenCalled();
  });

  it("should run every test file as a complete run", async () => {
    const vitest: VitestInstance = {
      config: { coverage: { include: ["src/**/*.ts"] } },
      enableCoverage: vi.fn<VitestInstance["enableCoverage"]>().mockResolvedValueOnce(undefined),
      globTestSpecifications: vi
        .fn<VitestInstance["globTestSpecifications"]>()
        .mockResolvedValueOnce([otherSpecification, specification]),
      runTestSpecifications: vi.fn(),
      close: vi.fn<VitestInstance["close"]>().mockResolvedValueOnce(undefined),
    };
    const coverage = { [`${ROOT}/src/example.ts`]: createFileCoverage() };

    mockedMkdtemp.mockResolvedValueOnce(REPORTS_DIRECTORY);
    mockedStartVitest.mockResolvedValueOnce(vitest);
    runSpecificationsSpy.mockResolvedValueOnce({ testModules: [], coverage });

    const runner = await createTestRunner(ROOT);
    const collector = createCoverageCollectorSpy.mock.results[0]?.value as CoverageCollector;

    await expect(runner.runAllTestFiles()).resolves.toEqual(coverage);
    expect(runSpecificationsSpy).toHaveBeenCalledTimes(1);
    expect(runSpecificationsSpy).toHaveBeenNthCalledWith(
      1,
      vitest,
      collector,
      [otherSpecification, specification],
      true,
    );
  });

  it("should run one test file restricted to the test ids", async () => {
    const vitest: VitestInstance = {
      config: { coverage: { include: ["src/**/*.ts"] } },
      enableCoverage: vi.fn<VitestInstance["enableCoverage"]>().mockResolvedValueOnce(undefined),
      globTestSpecifications: vi
        .fn<VitestInstance["globTestSpecifications"]>()
        .mockResolvedValueOnce([otherSpecification, specification]),
      runTestSpecifications: vi.fn(),
      close: vi.fn<VitestInstance["close"]>().mockResolvedValueOnce(undefined),
    };
    const filteredSpecification = {
      moduleId: TEST_FILE,
      project: { createSpecification: vi.fn() },
    };
    const run: SpecificationsRun = { testModules: [], coverage: {} };
    const testFileRun = createTestFileRun();

    mockedMkdtemp.mockResolvedValueOnce(REPORTS_DIRECTORY);
    mockedStartVitest.mockResolvedValueOnce(vitest);
    getSpecificationSpy.mockReturnValueOnce(filteredSpecification);
    runSpecificationsSpy.mockResolvedValueOnce(run);
    toTestFileRunSpy.mockReturnValueOnce(testFileRun);

    const runner = await createTestRunner(ROOT);
    const collector = createCoverageCollectorSpy.mock.results[0]?.value as CoverageCollector;

    await expect(runner.runTestFile(TEST_FILE, ["first"])).resolves.toEqual(testFileRun);
    expect(getSpecificationSpy).toHaveBeenCalledTimes(1);
    expect(getSpecificationSpy).toHaveBeenNthCalledWith(
      1,
      new Map([
        [OTHER_TEST_FILE, otherSpecification],
        [TEST_FILE, specification],
      ]),
      TEST_FILE,
      ["first"],
    );
    expect(runSpecificationsSpy).toHaveBeenCalledTimes(1);
    expect(runSpecificationsSpy).toHaveBeenNthCalledWith(
      1,
      vitest,
      collector,
      [filteredSpecification],
      false,
    );
    expect(toTestFileRunSpy).toHaveBeenCalledTimes(1);
    expect(toTestFileRunSpy).toHaveBeenNthCalledWith(1, run, TEST_FILE);
  });

  it("should close Vitest and then remove the reports directory when disposed", async () => {
    const vitest: VitestInstance = {
      config: { coverage: { include: ["src/**/*.ts"] } },
      enableCoverage: vi.fn<VitestInstance["enableCoverage"]>().mockResolvedValueOnce(undefined),
      globTestSpecifications: vi
        .fn<VitestInstance["globTestSpecifications"]>()
        .mockResolvedValueOnce([otherSpecification, specification]),
      runTestSpecifications: vi.fn(),
      close: vi.fn<VitestInstance["close"]>().mockResolvedValueOnce(undefined),
    };

    mockedMkdtemp.mockResolvedValueOnce(REPORTS_DIRECTORY);
    mockedStartVitest.mockResolvedValueOnce(vitest);
    mockedRm.mockResolvedValueOnce(undefined);

    const runner = await createTestRunner(ROOT);

    await runner[Symbol.asyncDispose]();

    expect(vitest.close).toHaveBeenCalledTimes(1);
    expect(mockedRm).toHaveBeenCalledTimes(1);
    expect(mockedRm).toHaveBeenNthCalledWith(1, REPORTS_DIRECTORY, {
      recursive: true,
      force: true,
    });
    expect(vi.mocked(vitest.close).mock.invocationCallOrder[0]).toBeLessThan(
      mockedRm.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("should release resources and throw when coverage.include is not set", async () => {
    const vitest: VitestInstance = {
      config: { coverage: { include: undefined } },
      enableCoverage: vi.fn<VitestInstance["enableCoverage"]>().mockResolvedValueOnce(undefined),
      globTestSpecifications: vi
        .fn<VitestInstance["globTestSpecifications"]>()
        .mockResolvedValueOnce([otherSpecification, specification]),
      runTestSpecifications: vi.fn(),
      close: vi.fn<VitestInstance["close"]>().mockResolvedValueOnce(undefined),
    };

    mockedMkdtemp.mockResolvedValueOnce(REPORTS_DIRECTORY);
    mockedStartVitest.mockResolvedValueOnce(vitest);
    mockedRm.mockResolvedValueOnce(undefined);

    await expect(createTestRunner(ROOT)).rejects.toThrow(
      new Error(
        `Failed to check ${ROOT}: coverage.include is not set in its Vitest config. Set it to the source files that must be tested.`,
      ),
    );
    expect(vitest.enableCoverage).not.toHaveBeenCalled();
    expect(vitest.close).toHaveBeenCalledTimes(1);
    expect(mockedRm).toHaveBeenCalledTimes(1);
  });
});
