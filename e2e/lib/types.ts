export type FixtureName =
  | "covered"
  | "uncovered"
  | "custom-infix"
  | "missing-coverage-include"
  | "unsupported-vitest"
  | "invalid-vitest";

export type CommandResult = {
  readonly stdout: string;
  readonly stderr: string;
};
