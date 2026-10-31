import { extname } from "node:path";

import type { CheckOptions, CheckTarget, SourceUnit } from "./types.ts";

import * as thisMod from "./targets.ts";

export type TargetPairing = {
  readonly targets: readonly CheckTarget[];
  readonly untestedSourceFiles: readonly string[];
  readonly orphanTestFiles: readonly string[];
};

export const toSourceFile = (testFile: string, testInfixes: readonly string[]): string | null => {
  const extension = extname(testFile);
  const stem = testFile.slice(0, testFile.length - extension.length);
  const infix = extname(stem);

  if (!testInfixes.includes(infix.slice(1))) {
    return null;
  }

  return `${stem.slice(0, stem.length - infix.length)}${extension}`;
};

export const pairTestFiles = (
  testFiles: readonly string[],
  sourceUnits: ReadonlyMap<string, readonly SourceUnit[]>,
  options: CheckOptions,
): TargetPairing => {
  const targets: CheckTarget[] = [];
  const orphanTestFiles: string[] = [];

  for (const testFile of testFiles) {
    const sourceFile = thisMod.toSourceFile(testFile, options.testInfixes);
    const units = sourceFile === null ? undefined : sourceUnits.get(sourceFile);

    if (sourceFile === null || units === undefined) {
      orphanTestFiles.push(testFile);

      continue;
    }

    targets.push({ target: { testFile, sourceFile }, units });
  }

  const testedSourceFiles = new Set(targets.map(({ target }) => target.sourceFile));
  const untestedSourceFiles = [...sourceUnits]
    .filter(([sourceFile, units]) => units.length > 0 && !testedSourceFiles.has(sourceFile))
    .map(([sourceFile]) => sourceFile);

  return { targets, untestedSourceFiles, orphanTestFiles };
};
