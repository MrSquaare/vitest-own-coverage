import { relative } from "node:path";

import type { CheckReport, TargetCheckResult, TestFailure, UnitCoverageFailure } from "./types.ts";

import { toLineRanges } from "./metrics.ts";
import * as thisMod from "./report.ts";

export type CheckCount = {
  readonly failureCount: number;
  readonly totalCount: number;
};

const JSON_INDENTATION = 2;
const DETAIL_INDENTATION = "   ";

export const countChecks = (report: CheckReport): CheckCount => {
  const failures = report.targets.flatMap((result) => [
    result.failure,
    ...result.units.map((unitResult) => unitResult.failure),
  ]);
  const problemCount = report.untestedSourceFiles.length + report.orphanTestFiles.length;

  return {
    failureCount: problemCount + failures.filter((failure) => failure !== null).length,
    totalCount: problemCount + failures.length,
  };
};

export const formatFailure = (failure: UnitCoverageFailure): string => {
  switch (failure.kind) {
    case "missing-describe":
      return "missing describe block";
    case "no-tests":
      return "describe block runs no passing test";
    case "failed-tests":
      return "tests failed";
    case "uncovered":
      return `uncovered lines: ${toLineRanges(failure.uncoveredLines)}`;
  }
};

export const formatTestFailure = (failure: TestFailure): string[] => {
  const [firstLine, ...otherLines] = failure.message.split("\n");
  const label = failure.name === null ? firstLine : `${failure.name}: ${firstLine}`;

  return [`• ${label}`, ...otherLines.map((line) => `  ${line}`)];
};

export const formatCheckLines = (label: string, failure: UnitCoverageFailure | null): string[] => {
  if (failure === null) {
    return [`✅ ${label}`];
  }

  const details =
    failure.kind === "failed-tests"
      ? failure.failures.flatMap((testFailure) => thisMod.formatTestFailure(testFailure))
      : [];

  return [
    `❌ ${label}: ${thisMod.formatFailure(failure)}`,
    ...details.map((line) => `${DETAIL_INDENTATION}${line}`),
  ];
};

export const formatTargetResult = (root: string, result: TargetCheckResult): string[] => {
  const testFile = relative(root, result.target.testFile);
  const sourceFile = relative(root, result.target.sourceFile);

  return [
    ...thisMod.formatCheckLines(`${testFile} → ${sourceFile}`, result.failure),
    ...result.units.flatMap(({ unit, failure }) => {
      const describePath = unit.describePath.map((name) => `describe("${name}")`).join(" > ");
      const label = `${describePath} (lines ${unit.startLine}-${unit.endLine})`;

      return thisMod.formatCheckLines(label, failure).map((line) => `${DETAIL_INDENTATION}${line}`);
    }),
  ];
};

export const formatSummary = (count: CheckCount): string => {
  if (count.failureCount === 0) {
    return `\nAll ${count.totalCount} checks pass.`;
  }

  return `\n${count.failureCount} of ${count.totalCount} checks fail.`;
};

export const formatTextReport = (root: string, report: CheckReport): string => {
  return [
    ...report.untestedSourceFiles.map((file) => `❌ ${relative(root, file)}: missing test file`),
    ...report.orphanTestFiles.map((file) => `❌ ${relative(root, file)}: missing source file`),
    ...report.targets.flatMap((result) => thisMod.formatTargetResult(root, result)),
    thisMod.formatSummary(thisMod.countChecks(report)),
  ].join("\n");
};

export const formatJsonReport = (root: string, report: CheckReport): string => {
  return JSON.stringify(
    {
      untestedSourceFiles: report.untestedSourceFiles.map((file) => relative(root, file)),
      orphanTestFiles: report.orphanTestFiles.map((file) => relative(root, file)),
      targets: report.targets.map((result) => ({
        testFile: relative(root, result.target.testFile),
        sourceFile: relative(root, result.target.sourceFile),
        failure: result.failure,
        units: result.units,
      })),
      ...thisMod.countChecks(report),
    },
    null,
    JSON_INDENTATION,
  );
};
