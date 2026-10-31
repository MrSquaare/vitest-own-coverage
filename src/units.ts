import type { ESTree } from "vite";

import { parseSync } from "vite";

import type { SourceUnit } from "./types.ts";

import * as thisMod from "./units.ts";

export type FunctionNode = ESTree.Function | ESTree.ArrowFunctionExpression;

export type UnitDeclaration = FunctionNode | ESTree.Class;

export type NamedDeclaration = readonly [name: string, declaration: UnitDeclaration];

export const getLineNumber = (code: string, offset: number): number => {
  return code.slice(0, offset).split("\n").length;
};

export const createSourceUnit = (
  code: string,
  node: ESTree.Span,
  describePath: readonly string[],
): SourceUnit => {
  return {
    describePath,
    startLine: thisMod.getLineNumber(code, node.start),
    endLine: thisMod.getLineNumber(code, node.end),
  };
};

export const isFunctionNode = (node: ESTree.Expression | null): node is FunctionNode => {
  return (
    node !== null && (node.type === "ArrowFunctionExpression" || node.type === "FunctionExpression")
  );
};

export const getDeclarations = (node: ESTree.Node): NamedDeclaration[] => {
  switch (node.type) {
    case "ExportNamedDeclaration":
      return node.declaration === null ? [] : thisMod.getDeclarations(node.declaration);
    case "ExportDefaultDeclaration":
      return thisMod.getDeclarations(node.declaration);
    case "FunctionDeclaration":
      return node.id !== null && node.body !== null ? [[node.id.name, node]] : [];
    case "ClassDeclaration":
      return node.id !== null ? [[node.id.name, node]] : [];
    case "VariableDeclaration":
      return node.declarations.flatMap((declarator): NamedDeclaration[] =>
        declarator.id.type === "Identifier" && thisMod.isFunctionNode(declarator.init)
          ? [[declarator.id.name, declarator.init]]
          : [],
      );
    default:
      return [];
  }
};

export const getExportedNames = (node: ESTree.Node): string[] => {
  if (node.type === "ExportDefaultDeclaration") {
    return node.declaration.type === "Identifier"
      ? [node.declaration.name]
      : thisMod.getDeclarations(node).map(([name]) => name);
  }

  if (node.type !== "ExportNamedDeclaration" || node.source !== null) {
    return [];
  }

  return [
    ...thisMod.getDeclarations(node).map(([name]) => name),
    ...node.specifiers.flatMap((specifier) =>
      specifier.local.type === "Identifier" ? [specifier.local.name] : [],
    ),
  ];
};

export const getPropertyName = (
  member: ESTree.MethodDefinition | ESTree.PropertyDefinition,
): string | null => {
  return !member.computed && member.key.type === "Identifier" ? member.key.name : null;
};

export const getClassMemberName = (member: ESTree.ClassElement): string | null => {
  if (member.type === "MethodDefinition") {
    if (member.value.body === null) {
      return null;
    }

    if (member.kind === "constructor") {
      return member.value.body.body.length > 0 ? "constructor" : null;
    }

    return thisMod.getPropertyName(member);
  }

  if (member.type === "PropertyDefinition" && thisMod.isFunctionNode(member.value)) {
    return thisMod.getPropertyName(member);
  }

  return null;
};

export const getDeclarationUnits = (
  code: string,
  [name, declaration]: NamedDeclaration,
): SourceUnit[] => {
  if (declaration.type !== "ClassDeclaration") {
    return [thisMod.createSourceUnit(code, declaration, [name])];
  }

  return declaration.body.body.flatMap((member) => {
    const memberName = thisMod.getClassMemberName(member);

    return memberName === null ? [] : [thisMod.createSourceUnit(code, member, [name, memberName])];
  });
};

export const extractSourceUnits = (filePath: string, code: string): SourceUnit[] => {
  const { program, errors } = parseSync(filePath, code);

  if (errors.length > 0) {
    throw new Error(
      `Failed to parse ${filePath}: ${errors.map((error) => error.message).join("; ")}`,
    );
  }

  const exportedNames = new Set(program.body.flatMap((node) => thisMod.getExportedNames(node)));

  return program.body
    .flatMap((node) => thisMod.getDeclarations(node))
    .filter(([name]) => exportedNames.has(name))
    .flatMap((declaration) => thisMod.getDeclarationUnits(code, declaration));
};
