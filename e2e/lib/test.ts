import { test as baseTest } from "vitest";

import type { FixtureName } from "./types.ts";

import { Workspace } from "./workspace.ts";

export const test = baseTest.extend<{ fixture: FixtureName; workspace: Workspace }>({
  fixture: "covered",
  workspace: async ({ fixture }, use) => {
    const workspace = await Workspace.create(fixture);

    await use(workspace);
    await workspace.remove();
  },
});
