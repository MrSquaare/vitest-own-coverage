import { afterEach, describe, expect, it, vi } from "vitest";

import * as thisMod from "./report.ts";
import {
  countChecks,
  formatCheckLines,
  formatFailure,
  formatJsonReport,
  formatSummary,
  formatTargetResult,
  formatTestFailure,
  formatTextReport,
} from "./report.ts";
import {
  createCheckReport,
  createSourceUnit,
  createTargetCheckResult,
  createTestFailure,
  createTestTarget,
  createUnitCheckResult,
  ROOT,
} from "./types.fixture.ts";

const TARGET = createTestTarget({
  testFile: `${ROOT}/src/example.test.ts`,
  sourceFile: `${ROOT}/src/example.ts`,
});

describe("countChecks", () => {
  it("should count discovery problems, file checks, and unit checks", () => {
    const report = createCheckReport({
      untestedSourceFiles: [`${ROOT}/src/untested.ts`],
      orphanTestFiles: [`${ROOT}/src/orphan.test.ts`],
      targets: [
        createTargetCheckResult({
          failure: { kind: "failed-tests", failures: [] },
          units: [
            createUnitCheckResult({ failure: null }),
            createUnitCheckResult({ failure: { kind: "no-tests" } }),
          ],
        }),
        createTargetCheckResult({ failure: null, units: [] }),
      ],
    });

    expect(countChecks(report)).toEqual({ failureCount: 4, totalCount: 6 });
  });

  it("should count no checks for an empty report", () => {
    expect(
      countChecks(createCheckReport({ untestedSourceFiles: [], orphanTestFiles: [], targets: [] })),
    ).toEqual({ failureCount: 0, totalCount: 0 });
  });
});

describe("formatFailure", () => {
  it("should describe missing describe blocks", () => {
    expect(formatFailure({ kind: "missing-describe" })).toEqual("missing describe block");
  });

  it("should describe describe blocks without passing tests", () => {
    expect(formatFailure({ kind: "no-tests" })).toEqual("describe block runs no passing test");
  });

  it("should describe failed tests", () => {
    expect(formatFailure({ kind: "failed-tests", failures: [createTestFailure()] })).toEqual(
      "tests failed",
    );
  });

  it("should describe uncovered lines as ranges", () => {
    expect(formatFailure({ kind: "uncovered", uncoveredLines: [3, 4, 5, 9] })).toEqual(
      "uncovered lines: 3-5, 9",
    );
  });
});

describe("formatTestFailure", () => {
  it("should prefix the message with the name of the failing test", () => {
    expect(
      formatTestFailure(
        createTestFailure({ name: "example > should work", message: "expected 1 to be 2" }),
      ),
    ).toEqual(["• example > should work: expected 1 to be 2"]);
  });

  it("should indent the following lines of multi-line messages", () => {
    expect(
      formatTestFailure(createTestFailure({ name: "example", message: "first\nsecond" })),
    ).toEqual(["• example: first", "  second"]);
  });

  it("should keep the message alone for errors of the test file", () => {
    expect(formatTestFailure(createTestFailure({ name: null, message: "Failed to load" }))).toEqual(
      ["• Failed to load"],
    );
  });
});

describe("formatCheckLines", () => {
  const formatFailureSpy = vi.spyOn(thisMod, "formatFailure");
  const formatTestFailureSpy = vi.spyOn(thisMod, "formatTestFailure");

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should mark passing checks", () => {
    expect(formatCheckLines("src/example.ts", null)).toEqual(["✅ src/example.ts"]);
    expect(formatFailureSpy).not.toHaveBeenCalled();
  });

  it("should mark failing checks with their failure", () => {
    expect(formatCheckLines("src/example.ts", { kind: "no-tests" })).toEqual([
      "❌ src/example.ts: describe block runs no passing test",
    ]);
    expect(formatFailureSpy).toHaveBeenCalledTimes(1);
    expect(formatFailureSpy).toHaveBeenNthCalledWith(1, { kind: "no-tests" });
    expect(formatTestFailureSpy).not.toHaveBeenCalled();
  });

  it("should list the indented test failures of failed tests", () => {
    const firstFailure = createTestFailure({ name: "example > first", message: "first error" });
    const secondFailure = createTestFailure({ name: "example > second", message: "second error" });

    expect(
      formatCheckLines("src/example.ts", {
        kind: "failed-tests",
        failures: [firstFailure, secondFailure],
      }),
    ).toEqual([
      "❌ src/example.ts: tests failed",
      "   • example > first: first error",
      "   • example > second: second error",
    ]);
    expect(formatTestFailureSpy).toHaveBeenCalledTimes(2);
    expect(formatTestFailureSpy).toHaveBeenNthCalledWith(1, firstFailure);
    expect(formatTestFailureSpy).toHaveBeenNthCalledWith(2, secondFailure);
  });
});

describe("formatTargetResult", () => {
  const formatCheckLinesSpy = vi.spyOn(thisMod, "formatCheckLines");

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should format the file check followed by indented unit checks", () => {
    const failure = createTestFailure({ name: "Example > greet > should greet", message: "boom" });
    const result = createTargetCheckResult({
      target: TARGET,
      failure: null,
      units: [
        createUnitCheckResult({
          unit: createSourceUnit({ describePath: ["Example", "greet"], startLine: 3, endLine: 7 }),
          failure: { kind: "failed-tests", failures: [failure] },
        }),
      ],
    });

    expect(formatTargetResult(ROOT, result)).toEqual([
      "✅ src/example.test.ts → src/example.ts",
      '   ❌ describe("Example") > describe("greet") (lines 3-7): tests failed',
      "      • Example > greet > should greet: boom",
    ]);
    expect(formatCheckLinesSpy).toHaveBeenCalledTimes(2);
    expect(formatCheckLinesSpy).toHaveBeenNthCalledWith(
      1,
      "src/example.test.ts → src/example.ts",
      null,
    );
    expect(formatCheckLinesSpy).toHaveBeenNthCalledWith(
      2,
      'describe("Example") > describe("greet") (lines 3-7)',
      { kind: "failed-tests", failures: [failure] },
    );
  });
});

describe("formatSummary", () => {
  it("should report that every check passes", () => {
    expect(formatSummary({ failureCount: 0, totalCount: 3 })).toEqual("\nAll 3 checks pass.");
  });

  it("should report failing checks", () => {
    expect(formatSummary({ failureCount: 1, totalCount: 3 })).toEqual("\n1 of 3 checks fail.");
  });
});

describe("formatTextReport", () => {
  const formatTargetResultSpy = vi.spyOn(thisMod, "formatTargetResult");
  const countChecksSpy = vi.spyOn(thisMod, "countChecks");
  const formatSummarySpy = vi.spyOn(thisMod, "formatSummary");

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should list discovery problems, target results, and the summary", () => {
    const result = createTargetCheckResult({ target: TARGET, failure: null, units: [] });
    const report = createCheckReport({
      untestedSourceFiles: [`${ROOT}/src/untested.ts`],
      orphanTestFiles: [`${ROOT}/src/orphan.test.ts`],
      targets: [result],
    });

    expect(formatTextReport(ROOT, report)).toEqual(
      [
        "❌ src/untested.ts: missing test file",
        "❌ src/orphan.test.ts: missing source file",
        "✅ src/example.test.ts → src/example.ts",
        "",
        "2 of 3 checks fail.",
      ].join("\n"),
    );
    expect(formatTargetResultSpy).toHaveBeenCalledTimes(1);
    expect(formatTargetResultSpy).toHaveBeenNthCalledWith(1, ROOT, result);
    expect(countChecksSpy).toHaveBeenCalledTimes(1);
    expect(countChecksSpy).toHaveBeenNthCalledWith(1, report);
    expect(formatSummarySpy).toHaveBeenCalledTimes(1);
    expect(formatSummarySpy).toHaveBeenNthCalledWith(1, { failureCount: 2, totalCount: 3 });
  });
});

describe("formatJsonReport", () => {
  const countChecksSpy = vi.spyOn(thisMod, "countChecks");

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should serialize the report with paths relative to the root and the counts", () => {
    const unitResult = createUnitCheckResult({
      unit: createSourceUnit({ describePath: ["example"], startLine: 3, endLine: 7 }),
      failure: { kind: "uncovered", uncoveredLines: [5] },
    });
    const report = createCheckReport({
      untestedSourceFiles: [`${ROOT}/src/untested.ts`],
      orphanTestFiles: [`${ROOT}/src/orphan.test.ts`],
      targets: [createTargetCheckResult({ target: TARGET, failure: null, units: [unitResult] })],
    });

    expect(JSON.parse(formatJsonReport(ROOT, report))).toEqual({
      untestedSourceFiles: ["src/untested.ts"],
      orphanTestFiles: ["src/orphan.test.ts"],
      targets: [
        {
          testFile: "src/example.test.ts",
          sourceFile: "src/example.ts",
          failure: null,
          units: [
            {
              unit: { describePath: ["example"], startLine: 3, endLine: 7 },
              failure: { kind: "uncovered", uncoveredLines: [5] },
            },
          ],
        },
      ],
      failureCount: 3,
      totalCount: 4,
    });
    expect(countChecksSpy).toHaveBeenCalledTimes(1);
    expect(countChecksSpy).toHaveBeenNthCalledWith(1, report);
  });

  it("should indent the JSON with two spaces", () => {
    const report = createCheckReport({ untestedSourceFiles: [], orphanTestFiles: [], targets: [] });

    expect(formatJsonReport(ROOT, report)).toEqual(
      [
        "{",
        '  "untestedSourceFiles": [],',
        '  "orphanTestFiles": [],',
        '  "targets": [],',
        '  "failureCount": 0,',
        '  "totalCount": 0',
        "}",
      ].join("\n"),
    );
  });
});
