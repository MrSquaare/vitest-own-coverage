import type { ViteUserConfig } from "vitest/config";
import type { CliOptions, VitestPluginContext } from "vitest/node";

import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { satisfies } from "semver";
import * as z from "zod";

import packageJson from "../package.json" with { type: "json" };
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
const PROJECT_PACKAGE_JSON_FILE = "package.json";
const VITEST_PACKAGE_JSON_SPECIFIER = "vitest/package.json";
const VITEST_NODE_SPECIFIER = "vitest/node";

const vitestPackageJsonSchema = z.object({
  version: z.string(),
});

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

export const resolveProjectModule = (root: string, specifier: string): string => {
  try {
    return createRequire(join(root, PROJECT_PACKAGE_JSON_FILE)).resolve(specifier);
  } catch (error) {
    throw new Error(
      `Failed to check ${root}: ${specifier} cannot be resolved from it. Install Vitest in the project.`,
      { cause: error },
    );
  }
};

export const readVitestVersion = async (root: string): Promise<string> => {
  const path = thisMod.resolveProjectModule(root, VITEST_PACKAGE_JSON_SPECIFIER);
  const content = await readFile(path, "utf8");

  return vitestPackageJsonSchema.parse(JSON.parse(content)).version;
};

export const assertSupportedVitestVersion = (root: string, version: string): void => {
  const supportedRange = packageJson.peerDependencies.vitest;

  if (!satisfies(version, supportedRange)) {
    throw new Error(
      `Failed to check ${root}: it uses Vitest ${version}, but vitest-own-coverage supports Vitest ${supportedRange}. Install a supported Vitest version in the project.`,
    );
  }
};

export const importModule = async (path: string): Promise<unknown> => {
  return import(pathToFileURL(path).href);
};

export const hasCreateVitest = (
  module: unknown,
): module is { readonly createVitest: CreateVitest } => {
  return (
    typeof module === "object" &&
    module !== null &&
    "createVitest" in module &&
    typeof module.createVitest === "function"
  );
};

export const loadCreateVitest = async (root: string): Promise<CreateVitest> => {
  thisMod.assertSupportedVitestVersion(root, await thisMod.readVitestVersion(root));

  const module = await thisMod.importModule(
    thisMod.resolveProjectModule(root, VITEST_NODE_SPECIFIER),
  );

  if (!thisMod.hasCreateVitest(module)) {
    throw new Error(
      `Failed to check ${root}: its ${VITEST_NODE_SPECIFIER} module exports no createVitest function.`,
    );
  }

  return module.createVitest;
};
