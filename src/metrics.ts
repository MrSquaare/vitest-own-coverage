import type { CoverageRange, CoverageReport, FileCoverage, SourceUnit } from "./types.ts";

import * as thisMod from "./metrics.ts";

export type CoverageHit = readonly [count: number, range: CoverageRange];

export const getRangeLines = (range: CoverageRange): number[] => {
  return Array.from(
    { length: range.end.line - range.start.line + 1 },
    (_, index) => range.start.line + index,
  );
};

export const toSortedLines = (lines: Iterable<number>): number[] => {
  return [...new Set(lines)].sort((left, right) => left - right);
};

export const toLineRanges = (lines: readonly number[]): string => {
  const groups: number[][] = [];

  for (const line of lines) {
    const group = groups.at(-1);

    if (group && group.at(-1) === line - 1) {
      group.push(line);

      continue;
    }

    groups.push([line]);
  }

  return groups
    .map((group) => (group.length === 1 ? `${group[0]}` : `${group[0]}-${group.at(-1)}`))
    .join(", ");
};

export const findFileCoverage = (report: CoverageReport, sourceFile: string): FileCoverage => {
  const coverage = Object.values(report).find((entry) => entry.path === sourceFile);

  if (!coverage) {
    throw new Error(
      `No coverage was collected for ${sourceFile}. Check that its test file imports it.`,
    );
  }

  return coverage;
};

export const getLocation = <TLocation>(
  coverage: FileCoverage,
  locations: Readonly<Record<string, TLocation>>,
  kind: string,
  key: string,
): TLocation => {
  if (!Object.hasOwn(locations, key)) {
    throw new Error(
      `Invalid coverage report for ${coverage.path}: ${kind} ${key} has no location.`,
    );
  }

  return locations[key];
};

export const collectHits = (coverage: FileCoverage): CoverageHit[] => {
  return [
    ...Object.entries(coverage.s).map(([key, count]): CoverageHit => [
      count,
      thisMod.getLocation(coverage, coverage.statementMap, "statement", key),
    ]),
    ...Object.entries(coverage.b).flatMap(([key, counts]) => {
      const branch = thisMod.getLocation(coverage, coverage.branchMap, "branch", key);

      return counts.map((count, index): CoverageHit => [
        count,
        branch.locations[index] ?? branch.loc,
      ]);
    }),
    ...Object.entries(coverage.f).map(([key, count]): CoverageHit => [
      count,
      thisMod.getLocation(coverage, coverage.fnMap, "function", key).loc,
    ]),
  ];
};

export const getUncoveredLines = (hits: readonly CoverageHit[]): number[] => {
  return thisMod.toSortedLines(
    hits.filter(([count]) => count === 0).flatMap(([, range]) => thisMod.getRangeLines(range)),
  );
};

export const getFileUncoveredLines = (coverage: FileCoverage): number[] => {
  return thisMod.getUncoveredLines(thisMod.collectHits(coverage));
};

export const getUnitUncoveredLines = (coverage: FileCoverage, unit: SourceUnit): number[] => {
  return thisMod.getUncoveredLines(
    thisMod
      .collectHits(coverage)
      .filter(([, range]) => range.start.line >= unit.startLine && range.end.line <= unit.endLine),
  );
};
