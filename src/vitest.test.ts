import type { ViteUserConfig } from "vitest/config";
import type { Vite, VitestPluginContext } from "vitest/node";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { CoverageConfig, CreateVitest, VitestInstance } from "./vitest.ts";

import { ROOT } from "./types.fixture.ts";
import * as thisMod from "./vitest.ts";
import { createViteOverrides, overrideCoverageConfig, startVitest } from "./vitest.ts";

const REPORTS_DIRECTORY = "/tmp/vitest-own-coverage-abc";

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
