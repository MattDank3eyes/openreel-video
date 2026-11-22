import { describe, expect, it } from "vitest";
import { resolveViteBase } from "./base-path";

describe("resolveViteBase", () => {
  it("defaults to the site root", () => {
    expect(resolveViteBase({})).toBe("/");
  });

  it("accepts the /editor/ subpath from either env name", () => {
    expect(resolveViteBase({ OPENREEL_BASE_PATH: "/editor/" })).toBe("/editor/");
    expect(resolveViteBase({ VITE_BASE_PATH: "editor" })).toBe("/editor/");
  });

  it("uses a relative base for the desktop shell", () => {
    expect(resolveViteBase({ OPENREEL_DESKTOP: "1", OPENREEL_BASE_PATH: "/editor/" })).toBe("./");
  });
});
