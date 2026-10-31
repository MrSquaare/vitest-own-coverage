import type {
  CheckOptions,
  CheckReport,
  CheckTarget,
  CoverageRange,
  FileCoverage,
  SourceUnit,
  TargetCheckResult,
  TestFailure,
  TestFileRun,
  TestSuiteNode,
  TestTarget,
  UnitCheckResult,
} from "./types.ts";

import { defineObjectGenerator } from "./test/utils/factory.ts";

export const ROOT = "/repo/packages/example";

export const createCoverageRange = (startLine: number, endLine: number): CoverageRange => ({
  start: { line: startLine },
  end: { line: endLine },
});

export const createFileCoverage = defineObjectGenerator<FileCoverage>(() => ({
  path: `${ROOT}/src/example.ts`,
  statementMap: {
    "0": createCoverageRange(1, 1),
    "1": createCoverageRange(3, 7),
    "2": createCoverageRange(5, 5),
  },
  fnMap: {
    "0": { name: "example", loc: createCoverageRange(3, 7) },
  },
  branchMap: {
    "0": { loc: createCoverageRange(4, 6), locations: [createCoverageRange(4, 6), null] },
  },
  s: { "0": 1, "1": 1, "2": 0 },
  f: { "0": 1 },
  b: { "0": [0, 1] },
}));

export const createCheckOptions = defineObjectGenerator<CheckOptions>(() => ({
  testInfixes: ["test", "spec"],
}));

export const createTestSuiteNode = defineObjectGenerator<TestSuiteNode>(() => ({
  name: "example",
  testIds: ["example-test-id"],
  suites: [],
}));

export const createTestFailure = defineObjectGenerator<TestFailure>(() => ({
  name: "example > should work",
  message: "expected 1 to be 2",
}));

export const createTestFileRun = defineObjectGenerator<TestFileRun>(() => ({
  ok: true,
  failures: [],
  passedTestCount: 1,
  suites: [createTestSuiteNode()],
  coverage: { [`${ROOT}/src/example.ts`]: createFileCoverage() },
}));

export const createTestTarget = defineObjectGenerator<TestTarget>(() => ({
  testFile: `${ROOT}/src/example.test.ts`,
  sourceFile: `${ROOT}/src/example.ts`,
}));

export const createSourceUnit = defineObjectGenerator<SourceUnit>(() => ({
  describePath: ["example"],
  startLine: 3,
  endLine: 7,
}));

export const createCheckTarget = defineObjectGenerator<CheckTarget>(() => ({
  target: createTestTarget(),
  units: [createSourceUnit()],
}));

export const createUnitCheckResult = defineObjectGenerator<UnitCheckResult>(() => ({
  unit: createSourceUnit(),
  failure: null,
}));

export const createTargetCheckResult = defineObjectGenerator<TargetCheckResult>(() => ({
  target: createTestTarget(),
  failure: null,
  units: [createUnitCheckResult()],
}));

export const createCheckReport = defineObjectGenerator<CheckReport>(() => ({
  untestedSourceFiles: [],
  orphanTestFiles: [],
  targets: [createTargetCheckResult()],
}));
