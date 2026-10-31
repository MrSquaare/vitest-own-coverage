export type ObjectGeneratorOptions<T, TAdditionalOptions extends object = object> = (
  | Partial<T>
  | {
      override?: T;
      extends?: Partial<T>;
    }
) &
  TAdditionalOptions;

export function defineObjectGenerator<T extends object, TOptions extends object = object>(
  defaultBuilder: (options?: ObjectGeneratorOptions<T, TOptions>) => T,
) {
  return (options?: ObjectGeneratorOptions<T, TOptions>): T => {
    if (!options) return defaultBuilder();
    if ("override" in options && options.override !== undefined) return options.override;

    const defaults = defaultBuilder(options);

    if ("extends" in options && options.extends) {
      return { ...defaults, ...options.extends } as T;
    }

    return { ...defaults, ...options } as T;
  };
}
