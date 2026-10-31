import { mockedReadFile } from "./test/mocks/node-fs-promises.mock.ts";
import { mockedCreateRequire } from "./test/mocks/node-module.mock.ts";

import type { ViteUserConfig } from "vitest/config";
import type { Vite, VitestPluginContext } from "vitest/node";

import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CoverageConfig, CreateVitest, VitestInstance } from "./vitest.ts";

import { ROOT } from "./types.fixture.ts";
import * as thisMod from "./vitest.ts";
import {
  assertSupportedVitestVersion,
  createViteOverrides,
  hasCreateVitest,
  importModule,
  loadCreateVitest,
  overrideCoverageConfig,
  readVitestVersion,
  resolveProjectModule,
  startVitest,
} from "./vitest.ts";

const REPORTS_DIRECTORY = "/tmp/vitest-own-coverage-abc";
const VITEST_PACKAGE_JSON_PATH = `${ROOT}/node_modules/vitest/package.json`;
const VITEST_NODE_PATH = `${ROOT}/node_modules/vitest/dist/node.js`;

describe("overrideCoverageConfig", () => {
  it("should redirect reports, disable reporters, and drop thresholds", () => {
    const coverage = {
      include: ["src/**/*.ts"],
      reportsDirectory: `${ROOT}/coverage`,
      reporter: [["html", {}]],
      thresholds: { lines: 80 },
    } as CoverageConfig;

    overrideCoverageConfig(coverage, REPORTS_DIRECTORY);

    expect(coverage).toEqual({
      include: ["src/**/*.ts"],
      reportsDirectory: REPORTS_DIRECTORY,
      reporter: [],
      thresholds: undefined,
    });
  });
});

describe("createViteOverrides", () => {
  const overrideCoverageConfigSpy = vi.spyOn(thisMod, "overrideCoverageConfig");

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should register a plugin named after the tool", () => {
    const overrides = createViteOverrides(REPORTS_DIRECTORY);
    const [plugin] = overrides.plugins as Vite.Plugin[];

    expect(overrides).toEqual({
      plugins: [{ name: "vitest-own-coverage", configureVitest: plugin.configureVitest }],
    });
  });

  it("should override coverage config of the Vitest instance when the plugin configures it", () => {
    const [plugin] = createViteOverrides(REPORTS_DIRECTORY).plugins as Vite.Plugin[];
    const coverage = { reportsDirectory: `${ROOT}/coverage` } as CoverageConfig;
    const configureVitest = plugin.configureVitest as (context: VitestPluginContext) => void;

    configureVitest({ vitest: { config: { coverage } } } as VitestPluginContext);

    expect(overrideCoverageConfigSpy).toHaveBeenCalledTimes(1);
    expect(overrideCoverageConfigSpy).toHaveBeenNthCalledWith(1, coverage, REPORTS_DIRECTORY);
  });
});

describe("startVitest", () => {
  const createViteOverridesSpy = vi.spyOn(thisMod, "createViteOverrides");

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should create a non-watching Vitest instance reporting coverage to the callback", async () => {
    const vitest = {} as VitestInstance;
    const overrides: ViteUserConfig = { plugins: [] };
    const onCoverage = vi.fn();
    const create = vi.fn<CreateVitest>();

    createViteOverridesSpy.mockReturnValueOnce(overrides);
    create.mockResolvedValueOnce(vitest);

    await expect(
      startVitest(create, { root: ROOT, reportsDirectory: REPORTS_DIRECTORY, onCoverage }),
    ).resolves.toEqual(vitest);
    expect(createViteOverridesSpy).toHaveBeenCalledTimes(1);
    expect(createViteOverridesSpy).toHaveBeenNthCalledWith(1, REPORTS_DIRECTORY);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenNthCalledWith(
      1,
      { root: ROOT, watch: false, reporters: [{ onCoverage }] },
      overrides,
    );
  });
});

describe("resolveProjectModule", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should resolve the specifier from the project root", async () => {
    const { createRequire } = await vi.importActual<typeof import("node:module")>("node:module");
    const projectRequire = createRequire(import.meta.url);
    const resolve = vi.spyOn(projectRequire, "resolve").mockReturnValueOnce(VITEST_NODE_PATH);

    mockedCreateRequire.mockReturnValueOnce(projectRequire);

    expect(resolveProjectModule(ROOT, "vitest/node")).toEqual(VITEST_NODE_PATH);
    expect(mockedCreateRequire).toHaveBeenCalledTimes(1);
    expect(mockedCreateRequire).toHaveBeenNthCalledWith(1, `${ROOT}/package.json`);
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(resolve).toHaveBeenNthCalledWith(1, "vitest/node");
  });

  it("should throw when the specifier cannot be resolved from the project root", async () => {
    const { createRequire } = await vi.importActual<typeof import("node:module")>("node:module");
    const projectRequire = createRequire(import.meta.url);
    const cause = new Error("Cannot find module 'vitest/node'");

    vi.spyOn(projectRequire, "resolve").mockImplementationOnce(() => {
      throw cause;
    });
    mockedCreateRequire.mockReturnValueOnce(projectRequire);

    expect(() => resolveProjectModule(ROOT, "vitest/node")).toThrow(
      new Error(
        `Failed to check ${ROOT}: vitest/node cannot be resolved from it. Install Vitest in the project.`,
        { cause },
      ),
    );
  });
});

describe("readVitestVersion", () => {
  const resolveProjectModuleSpy = vi.spyOn(thisMod, "resolveProjectModule");

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should read the version of the Vitest package of the project", async () => {
    resolveProjectModuleSpy.mockReturnValueOnce(VITEST_PACKAGE_JSON_PATH);
    mockedReadFile.mockResolvedValueOnce('{"name":"vitest","version":"5.0.5"}');

    await expect(readVitestVersion(ROOT)).resolves.toEqual("5.0.5");
    expect(resolveProjectModuleSpy).toHaveBeenCalledTimes(1);
    expect(resolveProjectModuleSpy).toHaveBeenNthCalledWith(1, ROOT, "vitest/package.json");
    expect(mockedReadFile).toHaveBeenCalledTimes(1);
    expect(mockedReadFile).toHaveBeenNthCalledWith(1, VITEST_PACKAGE_JSON_PATH, "utf8");
  });
});

describe("assertSupportedVitestVersion", () => {
  it("should accept versions inside the supported range", () => {
    expect(assertSupportedVitestVersion(ROOT, "5.1.0")).toEqual(undefined);
  });

  it("should accept the lowest version of the supported range", () => {
    expect(assertSupportedVitestVersion(ROOT, "5.0.0")).toEqual(undefined);
  });

  it("should throw for versions outside the supported range", () => {
    expect(() => assertSupportedVitestVersion(ROOT, "4.2.0")).toThrow(
      new Error(
        `Failed to check ${ROOT}: it uses Vitest 4.2.0, but vitest-own-coverage supports Vitest ^5.0. Install a supported Vitest version in the project.`,
      ),
    );
  });
});

describe("importModule", () => {
  it("should import the module at the path", async () => {
    await expect(importModule(join(import.meta.dirname, "types.ts"))).resolves.toEqual(
      await import("./types.ts"),
    );
  });
});

describe("hasCreateVitest", () => {
  it("should accept modules exporting a createVitest function", () => {
    expect(hasCreateVitest({ createVitest: vi.fn() })).toEqual(true);
  });

  it("should reject modules whose createVitest is not a function", () => {
    expect(hasCreateVitest({ createVitest: "createVitest" })).toEqual(false);
  });

  it("should reject modules without createVitest", () => {
    expect(hasCreateVitest({})).toEqual(false);
  });

  it("should reject null", () => {
    expect(hasCreateVitest(null)).toEqual(false);
  });

  it("should reject primitives", () => {
    expect(hasCreateVitest("vitest")).toEqual(false);
  });
});

describe("loadCreateVitest", () => {
  const readVitestVersionSpy = vi.spyOn(thisMod, "readVitestVersion");
  const assertSupportedVitestVersionSpy = vi.spyOn(thisMod, "assertSupportedVitestVersion");
  const resolveProjectModuleSpy = vi.spyOn(thisMod, "resolveProjectModule");
  const importModuleSpy = vi.spyOn(thisMod, "importModule");
  const hasCreateVitestSpy = vi.spyOn(thisMod, "hasCreateVitest");

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should load createVitest from the supported Vitest of the project", async () => {
    const createVitest = vi.fn<CreateVitest>();
    const module = { createVitest };

    readVitestVersionSpy.mockResolvedValueOnce("5.0.5");
    resolveProjectModuleSpy.mockReturnValueOnce(VITEST_NODE_PATH);
    importModuleSpy.mockResolvedValueOnce(module);

    await expect(loadCreateVitest(ROOT)).resolves.toEqual(createVitest);
    expect(readVitestVersionSpy).toHaveBeenCalledTimes(1);
    expect(readVitestVersionSpy).toHaveBeenNthCalledWith(1, ROOT);
    expect(assertSupportedVitestVersionSpy).toHaveBeenCalledTimes(1);
    expect(assertSupportedVitestVersionSpy).toHaveBeenNthCalledWith(1, ROOT, "5.0.5");
    expect(resolveProjectModuleSpy).toHaveBeenCalledTimes(1);
    expect(resolveProjectModuleSpy).toHaveBeenNthCalledWith(1, ROOT, "vitest/node");
    expect(importModuleSpy).toHaveBeenCalledTimes(1);
    expect(importModuleSpy).toHaveBeenNthCalledWith(1, VITEST_NODE_PATH);
    expect(hasCreateVitestSpy).toHaveBeenCalledTimes(1);
    expect(hasCreateVitestSpy).toHaveBeenNthCalledWith(1, module);
  });

  it("should throw when the Vitest module of the project exports no createVitest", async () => {
    readVitestVersionSpy.mockResolvedValueOnce("5.0.5");
    resolveProjectModuleSpy.mockReturnValueOnce(VITEST_NODE_PATH);
    importModuleSpy.mockResolvedValueOnce({});

    await expect(loadCreateVitest(ROOT)).rejects.toThrow(
      new Error(
        `Failed to check ${ROOT}: its vitest/node module exports no createVitest function.`,
      ),
    );
  });
});
