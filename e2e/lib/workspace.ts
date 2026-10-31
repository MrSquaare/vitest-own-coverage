import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import { join, resolve } from "node:path";

import type { CommandResult, FixtureName } from "./types.ts";

export type RunOptions = {
  readonly exitCode?: number;
};

const E2E_DIR = resolve(import.meta.dirname, "..");
const FIXTURES_DIR = join(E2E_DIR, "fixtures");
const WORKSPACES_DIR = join(E2E_DIR, ".workspaces");
const CLI_BIN_PATH = resolve(E2E_DIR, "../dist/bin.mjs");
const WORKSPACE_PLACEHOLDER = "<workspace>";
const SUCCESS_EXIT_CODE = 0;

export class Workspace {
  readonly directory: string;

  constructor(directory: string) {
    this.directory = directory;
  }

  static async create(fixture: FixtureName): Promise<Workspace> {
    await mkdir(WORKSPACES_DIR, { recursive: true });

    const directory = await mkdtemp(join(WORKSPACES_DIR, `${fixture}-`));

    await cp(join(FIXTURES_DIR, fixture), directory, { recursive: true });

    return new Workspace(directory);
  }

  run(args: readonly string[], options: RunOptions = {}): CommandResult {
    const expectedExitCode = options.exitCode ?? SUCCESS_EXIT_CODE;
    const result = spawnSync("node", [CLI_BIN_PATH, this.directory, ...args], {
      cwd: this.directory,
      encoding: "utf8",
    });

    if (result.error) {
      throw result.error;
    }

    if (result.status !== expectedExitCode) {
      throw new Error(
        `Expected exit code ${expectedExitCode} but got ${result.status}.\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
      );
    }

    return {
      stdout: result.stdout.replaceAll(this.directory, WORKSPACE_PLACEHOLDER),
      stderr: result.stderr.replaceAll(this.directory, WORKSPACE_PLACEHOLDER),
    };
  }

  resolve(path: string): string {
    return join(this.directory, path);
  }

  async remove(): Promise<void> {
    await rm(this.directory, { recursive: true, force: true });
  }
}
