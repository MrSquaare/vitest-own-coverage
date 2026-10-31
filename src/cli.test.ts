import { mockedCheckProject } from "./checks.mock.ts";
import {
  mockedCountChecks,
  mockedFormatJsonReport,
  mockedFormatTextReport,
} from "./report.mock.ts";
import { mockedCreateTestRunner } from "./runner.mock.ts";

import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CheckCommandArgs } from "./cli.ts";
import type { TestRunner } from "./runner.ts";

import * as thisMod from "./cli.ts";
import { mainCommand, runCheck, toCheckOptions } from "./cli.ts";
import { createCheckReport, createTargetCheckResult } from "./types.fixture.ts";

const ROOT_ARG = "packages/example";

const ARGS = {
  _: [ROOT_ARG],
  root: ROOT_ARG,
  "test-infixes": "test,spec",
  format: "text",
} satisfies CheckCommandArgs;

type MainCommandContext = Parameters<NonNullable<typeof mainCommand.run>>[0];

describe("toCheckOptions", () => {
  it("should split test infixes on commas", () => {
    expect(toCheckOptions({ ...ARGS, "test-infixes": "test,spec,unit" })).toEqual({
      testInfixes: ["test", "spec", "unit"],
    });
  });

  it("should accept a single test infix", () => {
    expect(toCheckOptions({ ...ARGS, "test-infixes": "test" })).toEqual({
      testInfixes: ["test"],
    });
  });

  it("should throw when a test infix is empty", () => {
    expect(() => toCheckOptions({ ...ARGS, "test-infixes": "test,,spec" })).toThrow(
      new Error(
        'Invalid --test-infixes value "test,,spec": every comma-separated infix must be non-empty.',
      ),
    );
  });
});

describe("runCheck", () => {
  const toCheckOptionsSpy = vi.spyOn(thisMod, "toCheckOptions");
  const logSpy = vi.spyOn(console, "log");

  afterEach(() => {
    process.exitCode = undefined;

    vi.clearAllMocks();
  });

  it("should check the resolved root, print a text report, and set a success exit code", async () => {
    const dispose = vi
      .fn<TestRunner[typeof Symbol.asyncDispose]>()
      .mockResolvedValueOnce(undefined);
    const runner: TestRunner = {
      testFiles: [],
      runAllTestFiles: vi.fn(),
      runTestFile: vi.fn(),
      [Symbol.asyncDispose]: dispose,
    };
    const report = createCheckReport({
      untestedSourceFiles: [],
      orphanTestFiles: [],
      targets: [createTargetCheckResult({ failure: null, units: [] })],
    });

    mockedCreateTestRunner.mockResolvedValueOnce(runner);
    mockedCheckProject.mockResolvedValueOnce(report);
    logSpy.mockImplementationOnce(() => undefined);

    await runCheck(ARGS);

    expect(toCheckOptionsSpy).toHaveBeenCalledTimes(1);
    expect(toCheckOptionsSpy).toHaveBeenNthCalledWith(1, ARGS);
    expect(mockedCreateTestRunner).toHaveBeenCalledTimes(1);
    expect(mockedCreateTestRunner).toHaveBeenNthCalledWith(1, resolve(ROOT_ARG));
    expect(mockedCheckProject).toHaveBeenCalledTimes(1);
    expect(mockedCheckProject).toHaveBeenNthCalledWith(1, runner, {
      testInfixes: ["test", "spec"],
    });
    expect(mockedFormatTextReport).toHaveBeenCalledTimes(1);
    expect(mockedFormatTextReport).toHaveBeenNthCalledWith(1, resolve(ROOT_ARG), report);
    expect(mockedFormatJsonReport).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenNthCalledWith(1, mockedFormatTextReport.mock.results[0]?.value);
    expect(mockedCountChecks).toHaveBeenCalledTimes(1);
    expect(mockedCountChecks).toHaveBeenNthCalledWith(1, report);
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(process.exitCode).toEqual(0);
  });

  it("should print a JSON report and set a failure exit code when a check fails", async () => {
    const runner: TestRunner = {
      testFiles: [],
      runAllTestFiles: vi.fn(),
      runTestFile: vi.fn(),
      [Symbol.asyncDispose]: vi
        .fn<TestRunner[typeof Symbol.asyncDispose]>()
        .mockResolvedValueOnce(undefined),
    };
    const report = createCheckReport({
      untestedSourceFiles: [],
      orphanTestFiles: [],
      targets: [
        createTargetCheckResult({ failure: { kind: "failed-tests", failures: [] }, units: [] }),
      ],
    });

    mockedCreateTestRunner.mockResolvedValueOnce(runner);
    mockedCheckProject.mockResolvedValueOnce(report);
    logSpy.mockImplementationOnce(() => undefined);

    await runCheck({ ...ARGS, format: "json" });

    expect(mockedFormatJsonReport).toHaveBeenCalledTimes(1);
    expect(mockedFormatJsonReport).toHaveBeenNthCalledWith(1, resolve(ROOT_ARG), report);
    expect(mockedFormatTextReport).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenNthCalledWith(1, mockedFormatJsonReport.mock.results[0]?.value);
    expect(process.exitCode).toEqual(1);
  });

  it("should dispose the runner when the check throws", async () => {
    const error = new Error("Check failed");
    const dispose = vi
      .fn<TestRunner[typeof Symbol.asyncDispose]>()
      .mockResolvedValueOnce(undefined);
    const runner: TestRunner = {
      testFiles: [],
      runAllTestFiles: vi.fn(),
      runTestFile: vi.fn(),
      [Symbol.asyncDispose]: dispose,
    };

    mockedCreateTestRunner.mockResolvedValueOnce(runner);
    mockedCheckProject.mockRejectedValueOnce(error);

    await expect(runCheck(ARGS)).rejects.toThrow(error);
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(logSpy).not.toHaveBeenCalled();
  });

  it("should throw before starting Vitest when options are invalid", async () => {
    await expect(runCheck({ ...ARGS, "test-infixes": "," })).rejects.toThrow(
      new Error('Invalid --test-infixes value ",": every comma-separated infix must be non-empty.'),
    );
    expect(mockedCreateTestRunner).not.toHaveBeenCalled();
  });
});

describe("mainCommand", () => {
  const runCheckSpy = vi.spyOn(thisMod, "runCheck");

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should run the check with the parsed arguments", async () => {
    runCheckSpy.mockResolvedValueOnce(undefined);

    await mainCommand.run?.({
      rawArgs: [ROOT_ARG],
      args: ARGS,
      cmd: mainCommand,
    } as MainCommandContext);

    expect(runCheckSpy).toHaveBeenCalledTimes(1);
    expect(runCheckSpy).toHaveBeenNthCalledWith(1, ARGS);
  });
});
