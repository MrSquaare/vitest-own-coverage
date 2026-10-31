import type { ViteUserConfig } from "vitest/config";
import type { CliOptions, VitestPluginContext } from "vitest/node";

import * as thisMod from "./vitest.ts";

export type VitestTestResult = {
  readonly state: string;
  readonly errors?: readonly { readonly message: string }[];
};

export interface VitestTestCase {
  readonly id: string;
  readonly fullName: string;
  result(): VitestTestResult;
}

export interface VitestCollection {
  suites(): Iterable<VitestSuite>;
  allSuites(): Iterable<VitestSuite>;
  allTests(state?: "passed" | "failed"): Iterable<VitestTestCase>;
}

export interface VitestSuite {
  readonly name: string;
  readonly fullName: string;
  readonly children: VitestCollection;
  errors(): readonly unknown[];
}

export interface VitestModule {
  readonly moduleId: string;
  readonly children: VitestCollection;
  ok(): boolean;
  errors(): readonly unknown[];
}

export interface VitestProject {
  createSpecification(moduleId: string, options: { testIds: string[] }): VitestSpecification;
}

export interface VitestSpecification {
  readonly moduleId: string;
  readonly project: VitestProject;
}

export type VitestRunResult = {
  readonly testModules: readonly VitestModule[];
  readonly unhandledErrors: readonly unknown[];
};

export interface VitestInstance {
  readonly config: { readonly coverage: { readonly include?: readonly string[] } };
  enableCoverage(): Promise<void>;
  globTestSpecifications(): Promise<VitestSpecification[]>;
  runTestSpecifications(
    specifications: VitestSpecification[],
    allTestsRun: boolean,
  ): Promise<VitestRunResult>;
  close(): Promise<void>;
}

export type CreateVitest = (
  options: CliOptions,
  viteOverrides: ViteUserConfig,
) => Promise<VitestInstance>;

export type StartVitestParams = {
  readonly root: string;
  readonly reportsDirectory: string;
  readonly onCoverage: (coverage: unknown) => void;
};

export type CoverageConfig = VitestPluginContext["vitest"]["config"]["coverage"];

const PLUGIN_NAME = "vitest-own-coverage";

export const overrideCoverageConfig = (
  coverage: CoverageConfig,
  reportsDirectory: string,
): void => {
  coverage.reportsDirectory = reportsDirectory;
  coverage.reporter = [];
  coverage.thresholds = undefined;
};

export const createViteOverrides = (reportsDirectory: string): ViteUserConfig => {
  return {
    plugins: [
      {
        name: PLUGIN_NAME,
        configureVitest: ({ vitest }) => {
          thisMod.overrideCoverageConfig(vitest.config.coverage, reportsDirectory);
        },
      },
    ],
  };
};

export const startVitest = async (
  create: CreateVitest,
  params: StartVitestParams,
): Promise<VitestInstance> => {
  return create(
    { root: params.root, watch: false, reporters: [{ onCoverage: params.onCoverage }] },
    thisMod.createViteOverrides(params.reportsDirectory),
  );
};
