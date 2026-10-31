import type { ESTree } from "vite";

import { parseSync } from "vite";

export const SOURCE_PATH = "/repo/src/example.ts";

export const createProgram = (code: string): ESTree.Program => {
  return parseSync(SOURCE_PATH, code).program;
};

export const createStatement = (code: string): ESTree.Node => {
  const [statement] = createProgram(code).body;

  if (statement === undefined) {
    throw new Error("Failed to create statement: code must contain at least one statement.");
  }

  return statement;
};

export const createClassElement = (code: string): ESTree.ClassElement => {
  const statement = createStatement(code);
  const [member] = statement.type === "ClassDeclaration" ? statement.body.body : [];

  if (member === undefined) {
    throw new Error("Failed to create class element: code must declare a class with a member.");
  }

  return member;
};
