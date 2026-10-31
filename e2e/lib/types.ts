export type FixtureName = "covered" | "uncovered" | "custom-infix" | "missing-coverage-include";

export type CommandResult = {
  readonly stdout: string;
  readonly stderr: string;
};
