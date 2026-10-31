import * as z from "zod";

export const coverageLocationSchema = z.object({
  line: z.number(),
});

export const coverageRangeSchema = z.object({
  start: coverageLocationSchema,
  end: coverageLocationSchema,
});

export type CoverageRange = z.infer<typeof coverageRangeSchema>;

export const fileCoverageSchema = z.object({
  path: z.string(),
  statementMap: z.record(z.string(), coverageRangeSchema),
  fnMap: z.record(z.string(), z.object({ name: z.string(), loc: coverageRangeSchema })),
  branchMap: z.record(
    z.string(),
    z.object({
      loc: coverageRangeSchema,
      locations: z.array(
        z.union([
          coverageRangeSchema,
          z.object({ start: z.object({}), end: z.object({}) }).transform(() => null),
        ]),
      ),
    }),
  ),
  s: z.record(z.string(), z.number()),
  f: z.record(z.string(), z.number()),
  b: z.record(z.string(), z.array(z.number())),
});

export type FileCoverage = z.infer<typeof fileCoverageSchema>;

export const coverageReportSchema = z.record(z.string(), fileCoverageSchema);

export type CoverageReport = z.infer<typeof coverageReportSchema>;

export type CheckOptions = {
  readonly testInfixes: readonly string[];
};

export type TestSuiteNode = {
  readonly name: string;
  readonly testIds: readonly string[];
  readonly suites: readonly TestSuiteNode[];
};

export type TestFailure = {
  readonly name: string | null;
  readonly message: string;
};

export type TestFileRun = {
  readonly ok: boolean;
  readonly failures: readonly TestFailure[];
  readonly passedTestCount: number;
  readonly suites: readonly TestSuiteNode[];
  readonly coverage: CoverageReport;
};

export type TestTarget = {
  readonly testFile: string;
  readonly sourceFile: string;
};

export type SourceUnit = {
  readonly describePath: readonly string[];
  readonly startLine: number;
  readonly endLine: number;
};

export type CheckTarget = {
  readonly target: TestTarget;
  readonly units: readonly SourceUnit[];
};

export type CoverageFailure =
  | { readonly kind: "failed-tests"; readonly failures: readonly TestFailure[] }
  | { readonly kind: "uncovered"; readonly uncoveredLines: readonly number[] };

export type UnitCoverageFailure =
  | CoverageFailure
  | { readonly kind: "missing-describe" }
  | { readonly kind: "no-tests" };

export type UnitCheckResult = {
  readonly unit: SourceUnit;
  readonly failure: UnitCoverageFailure | null;
};

export type TargetCheckResult = {
  readonly target: TestTarget;
  readonly failure: CoverageFailure | null;
  readonly units: readonly UnitCheckResult[];
};

export type CheckReport = {
  readonly untestedSourceFiles: readonly string[];
  readonly orphanTestFiles: readonly string[];
  readonly targets: readonly TargetCheckResult[];
};
