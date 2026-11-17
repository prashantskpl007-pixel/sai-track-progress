import { describe, expect, it } from "vitest";
import { isPasswordLongEnough } from "./password-policy";

describe("password policy", () => {
  it("accepts four-character passwords without complexity requirements", () => {
    expect(isPasswordLongEnough("1234")).toBe(true);
    expect(isPasswordLongEnough("admin123")).toBe(true);
    expect(isPasswordLongEnough("staff01")).toBe(true);
    expect(isPasswordLongEnough("test123")).toBe(true);
  });

  it("rejects passwords shorter than four characters", () => {
    expect(isPasswordLongEnough("123")).toBe(false);
  });
});