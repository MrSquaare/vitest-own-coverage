import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createVitest } from "vitest/node";

import type { CoverageReport, TestFailure, TestFileRun, TestSuiteNode } from "./types.ts";
import type {
  VitestCollection,
  VitestInstance,
  VitestModule,
  VitestSpecification,
} from "./vitest.ts";

import * as thisMod from "./runner.ts";
import { coverageReportSchema } from "./types.ts";
import { startVitest } from "./vitest.ts";

export interface CoverageCollector {
  collect(coverage: unknown): void;
  take(): CoverageReport;
}

export type SpecificationsRun = {
  readonly testModules: readonly VitestModule[];
  readonly coverage: CoverageReport;
};

export interface TestRunner extends AsyncDisposable {
  readonly testFiles: readonly string[];
  runAllTestFiles(): Promise<CoverageReport>;
  runTestFile(testFile: string, testIds?: readonly string[]): Promise<TestFileRun>;
}

const REPORTS_DIRECTORY_PREFIX = "vitest-own-coverage-";

export const parseCoverageReport = (coverage: unknown): CoverageReport => {
  return coverageReportSchema.parse(JSON.parse(JSON.stringify(coverage)));
};

export const createCoverageCollector = (): CoverageCollector => {
  const reports: CoverageReport[] = [];

  return {
    collect: (coverage) => {
      reports.push(thisMod.parseCoverageReport(coverage));
    },
    take: () => {
      const report = reports.shift();

      if (!report) {
        throw new Error(
          "Vitest reported no coverage for the test run. Check that its coverage provider is installed.",
        );
      }

      return report;
    },
  };
};

export const indexSpecifications = (
  specifications: readonly VitestSpecification[],
): Map<string, VitestSpecification> => {
  const index = new Map<string, VitestSpecification>();

  for (const specification of specifications) {
    if (index.has(specification.moduleId)) {
      throw new Error(
        `Test file ${specification.moduleId} runs in several Vitest projects. Check each project with its own root instead.`,
      );
    }

    index.set(specification.moduleId, specification);
  }

  return index;
};

export const getSpecification = (
  specifications: ReadonlyMap<string, VitestSpecification>,
  testFile: string,
  testIds?: readonly string[],
): VitestSpecification => {
  const specification = specifications.get(testFile);

  if (!specification) {
    throw new Error(`Test file ${testFile} is not part of the Vitest test files.`);
  }

  if (testIds === undefined) {
    return specification;
  }

  return specification.project.createSpecification(specification.moduleId, {
    testIds: [...testIds],
  });
};

export const isErrorWithMessage = (error: unknown): error is { readonly message: string } => {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  );
};

export const formatErrorMessage = (error: unknown): string => {
  return thisMod.isErrorWithMessage(error) ? error.message : JSON.stringify(error);
};

export const runSpecifications = async (
  vitest: VitestInstance,
  collector: CoverageCollector,
  specifications: VitestSpecification[],
  allTestsRun: boolean,
): Promise<SpecificationsRun> => {
  const result = await vitest.runTestSpecifications(specifications, allTestsRun);

  if (result.unhandledErrors.length > 0) {
    throw new Error(
      `Vitest reported unhandled errors: ${result.unhandledErrors.map((error) => thisMod.formatErrorMessage(error)).join("; ")}`,
    );
  }

  return { testModules: result.testModules, coverage: collector.take() };
};

export const toSuiteNodes = (collection: VitestCollection): TestSuiteNode[] => {
  return [...collection.suites()].map((suite) => ({
    name: suite.name,
    testIds: [...suite.children.allTests()].map((test) => test.id),
    suites: thisMod.toSuiteNodes(suite.children),
  }));
};

export const toTestFailures = (testModule: VitestModule): TestFailure[] => {
  return [
    ...testModule
      .errors()
      .map((error) => ({ name: null, message: thisMod.formatErrorMessage(error) })),
    ...[...testModule.children.allSuites()].flatMap((suite) =>
      suite
        .errors()
        .map((error) => ({ name: suite.fullName, message: thisMod.formatErrorMessage(error) })),
    ),
    ...[...testModule.children.allTests("failed")].flatMap((test) =>
      (test.result().errors ?? []).map((error) => ({
        name: test.fullName,
        message: error.message,
      })),
    ),
  ];
};

export const toTestFileRun = (run: SpecificationsRun, testFile: string): TestFileRun => {
  const testModule = run.testModules.find((module) => module.moduleId === testFile);

  if (!testModule) {
    throw new Error(`Vitest reported no result for test file ${testFile}.`);
  }

  return {
    ok: testModule.ok(),
    failures: thisMod.toTestFailures(testModule),
    passedTestCount: [...testModule.children.allTests("passed")].length,
    suites: thisMod.toSuiteNodes(testModule.children),
    coverage: run.coverage,
  };
};

export const createTestRunner = async (root: string): Promise<TestRunner> => {
  await using resources = new AsyncDisposableStack();
  const reportsDirectory = await mkdtemp(join(tmpdir(), REPORTS_DIRECTORY_PREFIX));

  resources.defer(() => rm(reportsDirectory, { recursive: true, force: true }));

  const collector = thisMod.createCoverageCollector();
  const vitest = await startVitest(createVitest, {
    root,
    reportsDirectory,
    onCoverage: collector.collect,
  });

  resources.defer(() => vitest.close());

  if (vitest.config.coverage.include === undefined) {
    throw new Error(
      `Failed to check ${root}: coverage.include is not set in its Vitest config. Set it to the source files that must be tested.`,
    );
  }

  await vitest.enableCoverage();

  const specifications = thisMod.indexSpecifications(await vitest.globTestSpecifications());
  const ownedResources = resources.move();

  return {
    testFiles: [...specifications.keys()].sort(),
    runAllTestFiles: async () => {
      const run = await thisMod.runSpecifications(
        vitest,
        collector,
        [...specifications.values()],
        true,
      );

      return run.coverage;
    },
    runTestFile: async (testFile, testIds) => {
      const specification = thisMod.getSpecification(specifications, testFile, testIds);
      const run = await thisMod.runSpecifications(vitest, collector, [specification], false);

      return thisMod.toTestFileRun(run, testFile);
    },
    [Symbol.asyncDispose]: () => ownedResources.disposeAsync(),
  };
};
