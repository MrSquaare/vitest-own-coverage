import type { ESTree } from "vite";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createClassElement, createStatement, SOURCE_PATH } from "./test/fixtures/vite.fixture.ts";
import * as thisMod from "./units.ts";
import {
  createSourceUnit,
  extractSourceUnits,
  getClassMemberName,
  getDeclarations,
  getDeclarationUnits,
  getExportedNames,
  getLineNumber,
  getPropertyName,
  isFunctionNode,
} from "./units.ts";

const SOURCE_CODE = `import { value } from "./value";

export function declared(): number {
  return value;
}

export const arrow = (): number => 1;

export const expression = function (): number {
  return 2;
};

export const constant = 3;

function local(): number {
  return 4;
}

function exportedLater(): number {
  return 5;
}

export { exportedLater };

export function overloaded(input: string): string;
export function overloaded(input: number): number;
export function overloaded(input: string | number): string | number {
  return input;
}

export class Example {
  private count = 0;

  constructor(private readonly name: string) {}

  greet(): string {
    return this.name;
  }

  readonly reset = (): void => {
    this.count = 0;
  };

  #secret(): number {
    return this.count;
  }
}

export default function main(): number {
  return local();
}
`;

describe("getLineNumber", () => {
  it("should return one-based line of the offset", () => {
    expect(getLineNumber("first\nsecond\nthird", 8)).toEqual(2);
  });

  it("should return first line for offset zero", () => {
    expect(getLineNumber("first\nsecond", 0)).toEqual(1);
  });
});

describe("createSourceUnit", () => {
  const getLineNumberSpy = vi.spyOn(thisMod, "getLineNumber");

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should create unit spanning start and end lines of the node", () => {
    const code = "first\nsecond\nthird";

    expect(createSourceUnit(code, { start: 6, end: 18 }, ["Example", "greet"])).toEqual({
      describePath: ["Example", "greet"],
      startLine: 2,
      endLine: 3,
    });
    expect(getLineNumberSpy).toHaveBeenCalledTimes(2);
    expect(getLineNumberSpy).toHaveBeenNthCalledWith(1, code, 6);
    expect(getLineNumberSpy).toHaveBeenNthCalledWith(2, code, 18);
  });
});

describe("isFunctionNode", () => {
  it("should accept arrow functions", () => {
    const statement = createStatement("const value = () => 1;") as ESTree.VariableDeclaration;

    expect(isFunctionNode(statement.declarations[0].init)).toEqual(true);
  });

  it("should accept function expressions", () => {
    const statement = createStatement(
      "const value = function () { return 1; };",
    ) as ESTree.VariableDeclaration;

    expect(isFunctionNode(statement.declarations[0].init)).toEqual(true);
  });

  it("should reject other expressions", () => {
    const statement = createStatement("const value = compute();") as ESTree.VariableDeclaration;

    expect(isFunctionNode(statement.declarations[0].init)).toEqual(false);
  });

  it("should reject missing initializers", () => {
    expect(isFunctionNode(null)).toEqual(false);
  });
});

describe("getDeclarations", () => {
  const getDeclarationsSpy = vi.spyOn(thisMod, "getDeclarations");
  const isFunctionNodeSpy = vi.spyOn(thisMod, "isFunctionNode");

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should return declaration of named exports", () => {
    const statement = createStatement(
      "export function declared() { return 1; }",
    ) as ESTree.ExportNamedDeclaration;

    expect(getDeclarations(statement)).toEqual([["declared", statement.declaration]]);
    expect(getDeclarationsSpy).toHaveBeenCalledTimes(2);
    expect(getDeclarationsSpy).toHaveBeenNthCalledWith(1, statement);
    expect(getDeclarationsSpy).toHaveBeenNthCalledWith(2, statement.declaration);
  });

  it("should return declaration of default exports", () => {
    const statement = createStatement(
      "export default function main() { return 1; }",
    ) as ESTree.ExportDefaultDeclaration;

    expect(getDeclarations(statement)).toEqual([["main", statement.declaration]]);
    expect(getDeclarationsSpy).toHaveBeenCalledTimes(2);
    expect(getDeclarationsSpy).toHaveBeenNthCalledWith(1, statement);
    expect(getDeclarationsSpy).toHaveBeenNthCalledWith(2, statement.declaration);
  });

  it("should return class declarations", () => {
    const statement = createStatement("class Example {}");

    expect(getDeclarations(statement)).toEqual([["Example", statement]]);
  });

  it("should return function initializers of variable declarations", () => {
    const statement = createStatement(
      "const arrow = () => 1, constant = 2, { picked } = source;",
    ) as ESTree.VariableDeclaration;

    expect(getDeclarations(statement)).toEqual([["arrow", statement.declarations[0].init]]);
    expect(isFunctionNodeSpy).toHaveBeenCalledTimes(2);
    expect(isFunctionNodeSpy).toHaveBeenNthCalledWith(1, statement.declarations[0].init);
    expect(isFunctionNodeSpy).toHaveBeenNthCalledWith(2, statement.declarations[1].init);
  });

  it("should ignore named exports without declaration", () => {
    expect(getDeclarations(createStatement("export { value };"))).toEqual([]);
    expect(getDeclarationsSpy).toHaveBeenCalledTimes(1);
  });

  it("should ignore function overload signatures", () => {
    expect(getDeclarations(createStatement("declare function overloaded(): void;"))).toEqual([]);
  });

  it("should ignore anonymous functions", () => {
    const statement = createStatement(
      "export default function () { return 1; }",
    ) as ESTree.ExportDefaultDeclaration;

    expect(getDeclarations(statement.declaration)).toEqual([]);
  });

  it("should ignore anonymous classes", () => {
    const statement = createStatement("export default class {}") as ESTree.ExportDefaultDeclaration;

    expect(getDeclarations(statement.declaration)).toEqual([]);
  });

  it("should ignore other statements", () => {
    expect(getDeclarations(createStatement("run();"))).toEqual([]);
  });
});

describe("getExportedNames", () => {
  const getDeclarationsSpy = vi.spyOn(thisMod, "getDeclarations");

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should return names of exported declarations", () => {
    const statement = createStatement("export const arrow = () => 1;");

    expect(getExportedNames(statement)).toEqual(["arrow"]);
    expect(getDeclarationsSpy).toHaveBeenCalledTimes(2);
    expect(getDeclarationsSpy).toHaveBeenNthCalledWith(1, statement);
    expect(getDeclarationsSpy).toHaveBeenNthCalledWith(
      2,
      (statement as ESTree.ExportNamedDeclaration).declaration,
    );
  });

  it("should return local names of export specifiers", () => {
    expect(getExportedNames(createStatement('export { local as exported, "quoted" };'))).toEqual([
      "local",
    ]);
  });

  it("should return local name of default exported identifiers", () => {
    expect(getExportedNames(createStatement("export default main;"))).toEqual(["main"]);
    expect(getDeclarationsSpy).not.toHaveBeenCalled();
  });

  it("should return name of default exported declarations", () => {
    const statement = createStatement("export default function main() { return 1; }");

    expect(getExportedNames(statement)).toEqual(["main"]);
    expect(getDeclarationsSpy).toHaveBeenCalledTimes(2);
    expect(getDeclarationsSpy).toHaveBeenNthCalledWith(1, statement);
    expect(getDeclarationsSpy).toHaveBeenNthCalledWith(
      2,
      (statement as ESTree.ExportDefaultDeclaration).declaration,
    );
  });

  it("should ignore re-exports from other modules", () => {
    expect(getExportedNames(createStatement('export { value } from "./value";'))).toEqual([]);
  });

  it("should ignore statements that are not exports", () => {
    expect(getExportedNames(createStatement("function local() { return 1; }"))).toEqual([]);
    expect(getDeclarationsSpy).not.toHaveBeenCalled();
  });
});

describe("getPropertyName", () => {
  it("should return identifier name of the member key", () => {
    const member = createClassElement("class Example { greet() {} }") as ESTree.MethodDefinition;

    expect(getPropertyName(member)).toEqual("greet");
  });

  it("should ignore computed keys", () => {
    const member = createClassElement(
      "class Example { [Symbol.iterator]() {} }",
    ) as ESTree.MethodDefinition;

    expect(getPropertyName(member)).toEqual(null);
  });

  it("should ignore private keys", () => {
    const member = createClassElement("class Example { #secret() {} }") as ESTree.MethodDefinition;

    expect(getPropertyName(member)).toEqual(null);
  });
});

describe("getClassMemberName", () => {
  const getPropertyNameSpy = vi.spyOn(thisMod, "getPropertyName");
  const isFunctionNodeSpy = vi.spyOn(thisMod, "isFunctionNode");

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should return name of methods", () => {
    const member = createClassElement("class Example { greet() { return 1; } }");

    expect(getClassMemberName(member)).toEqual("greet");
    expect(getPropertyNameSpy).toHaveBeenCalledTimes(1);
    expect(getPropertyNameSpy).toHaveBeenNthCalledWith(1, member);
  });

  it("should return name of function properties", () => {
    const member = createClassElement(
      "class Example { reset = () => 0; }",
    ) as ESTree.PropertyDefinition;

    expect(getClassMemberName(member)).toEqual("reset");
    expect(isFunctionNodeSpy).toHaveBeenCalledTimes(1);
    expect(isFunctionNodeSpy).toHaveBeenNthCalledWith(1, member.value);
    expect(getPropertyNameSpy).toHaveBeenNthCalledWith(1, member);
  });

  it("should return constructor when its body has statements", () => {
    const member = createClassElement("class Example { constructor() { run(); } }");

    expect(getClassMemberName(member)).toEqual("constructor");
    expect(getPropertyNameSpy).not.toHaveBeenCalled();
  });

  it("should ignore constructors with an empty body", () => {
    expect(
      getClassMemberName(
        createClassElement("class Example { constructor(private name: string) {} }"),
      ),
    ).toEqual(null);
  });

  it("should ignore method overload signatures", () => {
    expect(getClassMemberName(createClassElement("class Example { greet(): void; }"))).toEqual(
      null,
    );
    expect(getPropertyNameSpy).not.toHaveBeenCalled();
  });

  it("should ignore value properties", () => {
    expect(getClassMemberName(createClassElement("class Example { count = 0; }"))).toEqual(null);
    expect(getPropertyNameSpy).not.toHaveBeenCalled();
  });

  it("should ignore other class elements", () => {
    expect(getClassMemberName(createClassElement("class Example { static { run(); } }"))).toEqual(
      null,
    );
  });
});

describe("getDeclarationUnits", () => {
  const createSourceUnitSpy = vi.spyOn(thisMod, "createSourceUnit");
  const getClassMemberNameSpy = vi.spyOn(thisMod, "getClassMemberName");

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should return one unit for functions", () => {
    const code = "function declared() {\n  return 1;\n}";
    const statement = createStatement(code) as ESTree.Function;

    expect(getDeclarationUnits(code, ["declared", statement])).toEqual([
      { describePath: ["declared"], startLine: 1, endLine: 3 },
    ]);
    expect(createSourceUnitSpy).toHaveBeenCalledTimes(1);
    expect(createSourceUnitSpy).toHaveBeenNthCalledWith(1, code, statement, ["declared"]);
  });

  it("should return one unit per named member of classes", () => {
    const code = "class Example {\n  count = 0;\n  greet() {\n    return 1;\n  }\n}";
    const statement = createStatement(code) as ESTree.Class;

    expect(getDeclarationUnits(code, ["Example", statement])).toEqual([
      { describePath: ["Example", "greet"], startLine: 3, endLine: 5 },
    ]);
    expect(getClassMemberNameSpy).toHaveBeenCalledTimes(2);
    expect(getClassMemberNameSpy).toHaveBeenNthCalledWith(1, statement.body.body[0]);
    expect(getClassMemberNameSpy).toHaveBeenNthCalledWith(2, statement.body.body[1]);
    expect(createSourceUnitSpy).toHaveBeenCalledTimes(1);
    expect(createSourceUnitSpy).toHaveBeenNthCalledWith(1, code, statement.body.body[1], [
      "Example",
      "greet",
    ]);
  });
});

describe("extractSourceUnits", () => {
  const getExportedNamesSpy = vi.spyOn(thisMod, "getExportedNames");
  const getDeclarationUnitsSpy = vi.spyOn(thisMod, "getDeclarationUnits");

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should return units of exported functions and exported class members", () => {
    expect(extractSourceUnits(SOURCE_PATH, SOURCE_CODE)).toEqual([
      { describePath: ["declared"], startLine: 3, endLine: 5 },
      { describePath: ["arrow"], startLine: 7, endLine: 7 },
      { describePath: ["expression"], startLine: 9, endLine: 11 },
      { describePath: ["exportedLater"], startLine: 19, endLine: 21 },
      { describePath: ["overloaded"], startLine: 27, endLine: 29 },
      { describePath: ["Example", "greet"], startLine: 36, endLine: 38 },
      { describePath: ["Example", "reset"], startLine: 40, endLine: 42 },
      { describePath: ["main"], startLine: 49, endLine: 51 },
    ]);
    expect(getExportedNamesSpy).toHaveBeenCalledTimes(13);
    expect(getDeclarationUnitsSpy).toHaveBeenCalledTimes(7);
  });

  it("should return no units for modules without exported functions", () => {
    expect(extractSourceUnits(SOURCE_PATH, "export const constant = 1;")).toEqual([]);
    expect(getDeclarationUnitsSpy).not.toHaveBeenCalled();
  });

  it("should throw when the source cannot be parsed", () => {
    expect(() => extractSourceUnits(SOURCE_PATH, "export const = ;")).toThrow(
      new Error(`Failed to parse ${SOURCE_PATH}: Unexpected token`),
    );
  });
});
