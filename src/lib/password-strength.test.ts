import { describe, it, expect } from "vitest";
import { checkPassword, friendlyAuthError, PASSWORD_MIN_LENGTH } from "./password-strength";

describe("checkPassword", () => {
  it("flags short passwords", () => {
    const r = checkPassword("abc1");
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.includes(String(PASSWORD_MIN_LENGTH)))).toBe(true);
  });

  it("allows passwords without numbers", () => {
    const r = checkPassword("abcdefghij");
    expect(r.ok).toBe(true);
    expect(r.issues).toEqual([]);
  });

  it("allows common passwords while scoring them low", () => {
    const r = checkPassword("password1");
    expect(r.ok).toBe(true);
    expect(r.score).toBeLessThan(3);
  });

  it("passes for a reasonably strong password", () => {
    const r = checkPassword("Sunset-Bicycle-42");
    expect(r.ok).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(3);
  });
});

describe("friendlyAuthError", () => {
  it("maps HIBP messages", () => {
    expect(friendlyAuthError("Password has been pwned")).toMatch(/data breach/i);
  });
  it("maps invalid credentials", () => {
    expect(friendlyAuthError("Invalid login credentials")).toMatch(/incorrect/i);
  });
  it("maps email not confirmed", () => {
    expect(friendlyAuthError("Email not confirmed")).toMatch(/confirm your email/i);
  });
  it("passes through unknown errors", () => {
    expect(friendlyAuthError("Something unusual")).toBe("Something unusual");
  });
});