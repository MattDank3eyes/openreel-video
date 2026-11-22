import { describe, expect, it } from "vitest";
import { PRODUCT_NAME } from "./brand";

describe("desktop branding", () => {
  it("names the app OBSTcut", () => {
    expect(PRODUCT_NAME).toBe("OBSTcut");
  });
});
