export function double(value: number): number {
  return value * 2;
}

export function quadruple(value: number): number {
  return double(double(value));
}

export const half = (value: number): number => {
  if (value < 0) {
    return 0;
  }

  return value / 2;
};

export class Counter {
  count = 0;

  increment(): void {
    this.count += 1;
  }

  reset(): void {
    this.count = 0;
  }
}
