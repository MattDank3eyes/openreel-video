import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("clean tree", () => {
  it("does not promote the token, PostHog, or a product credit in the README", () => {
    const readme = read("README.md");
    const editorPkg = read("apps/obstcut/package.json");
    expect(readme).not.toContain("$OPENREEL");
    expect(readme).not.toContain("B7wDnfrdtvdG7SCkRjSMJ6LkVwGWvdWrQ75iV8G9pump");
    expect(readme.toLowerCase()).not.toContain("posthog");
    expect(readme).not.toContain("OpenReel");
    expect(editorPkg).not.toContain("posthog");
  });

  it("keeps the MIT copyright and permission notice for reused code", () => {
    for (const path of ["LICENSE", "THIRD_PARTY_NOTICES", "apps/obstcut/public/LICENSE", "apps/obstcut/public/THIRD_PARTY_NOTICES"]) {
      const text = read(path);
      expect(text).toContain("Copyright (c) 2024-2026 Augustus Otu and Contributors");
      expect(text).toContain("Permission is hereby granted, free of charge");
      expect(text).toContain("THE SOFTWARE IS PROVIDED \"AS IS\"");
    }
  });
});