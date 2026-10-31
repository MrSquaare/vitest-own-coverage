import { readFile } from "node:fs/promises";

import type { TestRunner } from "./runner.ts";
import type {
  CheckOptions,
  CheckReport,
  CheckTarget,
  CoverageFailure,
  SourceUnit,
  TargetCheckResult,
  TestSuiteNode,
  TestTarget,
  UnitCheckResult,
} from "./types.ts";

import * as thisMod from "./checks.ts";
import { findFileCoverage, getFileUncoveredLines, getUnitUncoveredLines } from "./metrics.ts";
import { pairTestFiles } from "./targets.ts";
import { extractSourceUnits } from "./units.ts";

export const findSuites = (
  suites: readonly TestSuiteNode[],
  describePath: readonly string[],
): TestSuiteNode[] => {
  const [name, ...childPath] = describePath;
  const matches = suites.filter((suite) => suite.name === name);

  if (childPath.length === 0) {
    return matches;
  }

  return matches.flatMap((suite) => thisMod.findSuites(suite.suites, childPath));
};

export const toUncoveredFailure = (uncoveredLines: readonly number[]): CoverageFailure | null => {
  return uncoveredLines.length > 0 ? { kind: "uncovered", uncoveredLines } : null;
};

export const checkUnit = async (
  runner: TestRunner,
  target: TestTarget,
  suites: readonly TestSuiteNode[],
  unit: SourceUnit,
): Promise<UnitCheckResult> => {
  const describeSuites = thisMod.findSuites(suites, unit.describePath);

  if (describeSuites.length === 0) {
    return { unit, failure: { kind: "missing-describe" } };
  }

  const testIds = describeSuites.flatMap((suite) => suite.testIds);

  if (testIds.length === 0) {
    return { unit, failure: { kind: "no-tests" } };
  }

  const run = await runner.runTestFile(target.testFile, testIds);

  if (!run.ok) {
    return { unit, failure: { kind: "failed-tests", failures: run.failures } };
  }

  if (run.passedTestCount === 0) {
    return { unit, failure: { kind: "no-tests" } };
  }

  const coverage = findFileCoverage(run.coverage, target.sourceFile);

  return { unit, failure: thisMod.toUncoveredFailure(getUnitUncoveredLines(coverage, unit)) };
};

export const checkTarget = async (
  runner: TestRunner,
  { target, units }: CheckTarget,
): Promise<TargetCheckResult> => {
  const run = await runner.runTestFile(target.testFile);

  if (!run.ok) {
    return { target, failure: { kind: "failed-tests", failures: run.failures }, units: [] };
  }

  const unitResults: UnitCheckResult[] = [];

  for (const unit of units) {
    unitResults.push(await thisMod.checkUnit(runner, target, run.suites, unit));
  }

  const coverage = findFileCoverage(run.coverage, target.sourceFile);

  return {
    target,
    failure: thisMod.toUncoveredFailure(getFileUncoveredLines(coverage)),
    units: unitResults,
  };
};

export const readSourceUnits = async (
  sourceFile: string,
): Promise<readonly [string, SourceUnit[]]> => {
  return [sourceFile, extractSourceUnits(sourceFile, await readFile(sourceFile, "utf8"))];
};

export const checkProject = async (
  runner: TestRunner,
  options: CheckOptions,
): Promise<CheckReport> => {
  const coverage = await runner.runAllTestFiles();
  const sourceFiles = Object.values(coverage)
    .map((entry) => entry.path)
    .sort();
  const sourceUnits = new Map(
    await Promise.all(sourceFiles.map((sourceFile) => thisMod.readSourceUnits(sourceFile))),
  );
  const pairing = pairTestFiles(runner.testFiles, sourceUnits, options);
  const targets: TargetCheckResult[] = [];

  for (const checkTarget of pairing.targets) {
    targets.push(await thisMod.checkTarget(runner, checkTarget));
  }

  return {
    untestedSourceFiles: pairing.untestedSourceFiles,
    orphanTestFiles: pairing.orphanTestFiles,
    targets,
  };
};
