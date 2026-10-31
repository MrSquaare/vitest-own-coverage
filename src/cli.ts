import { defineCommand, type ArgsDef, type ParsedArgs } from "citty";
import { resolve } from "node:path";

import type { CheckOptions } from "./types.ts";

import { checkProject } from "./checks.ts";
import * as thisMod from "./cli.ts";
import { DEFAULT_REPORT_FORMAT, DEFAULT_TEST_INFIXES, REPORT_FORMATS } from "./constants.ts";
import { countChecks, formatJsonReport, formatTextReport } from "./report.ts";
import { createTestRunner } from "./runner.ts";

export type CheckCommandArgs = ParsedArgs<typeof argsDef>;

const TEST_INFIX_SEPARATOR = ",";
const SUCCESS_EXIT_CODE = 0;
const FAILURE_EXIT_CODE = 1;

const argsDef = {
  root: {
    type: "positional",
    description: "Root directory of the Vitest project to check",
    required: true,
  },
  "test-infixes": {
    type: "string",
    description:
      "Comma-separated infixes between the source name and the extension of test files, such as test in example.test.ts",
    default: DEFAULT_TEST_INFIXES,
  },
  format: {
    type: "enum",
    description: "Output format",
    options: [...REPORT_FORMATS],
    default: DEFAULT_REPORT_FORMAT,
  },
} satisfies ArgsDef;

export const toCheckOptions = (args: CheckCommandArgs): CheckOptions => {
  const testInfixes = args["test-infixes"].split(TEST_INFIX_SEPARATOR);

  if (testInfixes.some((infix) => infix === "")) {
    throw new Error(
      `Invalid --test-infixes value "${args["test-infixes"]}": every comma-separated infix must be non-empty.`,
    );
  }

  return { testInfixes };
};

export const runCheck = async (args: CheckCommandArgs): Promise<void> => {
  const root = resolve(args.root);
  const options = thisMod.toCheckOptions(args);
  await using runner = await createTestRunner(root);
  const report = await checkProject(runner, options);

  console.log(
    args.format === "json" ? formatJsonReport(root, report) : formatTextReport(root, report),
  );

  process.exitCode = countChecks(report).failureCount > 0 ? FAILURE_EXIT_CODE : SUCCESS_EXIT_CODE;
};

export const mainCommand = defineCommand({
  meta: {
    name: "vitest-own-coverage",
    description:
      "Check that each exported function and class method is fully covered by its own describe block",
  },
  args: argsDef,
  run: async ({ args }) => {
    await thisMod.runCheck(args);
  },
});
