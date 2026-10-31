import { FACTOR } from "./constants.ts";

function clamp(value: number): number {
  return Math.max(value, 0);
}

export function double(value: number): number {
  return value * FACTOR;
}

export const half = (value: number): number => {
  if (value < 0) {
    return 0;
  }

  return clamp(value) / FACTOR;
};

export class Counter {
  count = 0;

  increment(): void {
    this.count += 1;
  }
}
