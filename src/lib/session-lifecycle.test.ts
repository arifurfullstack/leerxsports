import { afterEach, describe, expect, it } from "vitest";
import {
  buildExpiryRedirect,
  clearManualSignOut,
  isProtectedPath,
  markManualSignOut,
  shouldRefreshBeforeUse,
  wasManualSignOut,
} from "./session-lifecycle";

afterEach(() => clearManualSignOut());

describe("isProtectedPath", () => {
  it("matches known protected roots and their children", () => {
    expect(isProtectedPath("/admin")).toBe(true);
    expect(isProtectedPath("/admin/roles")).toBe(true);
    expect(isProtectedPath("/settings")).toBe(true);
    expect(isProtectedPath("/messages/123")).toBe(true);
    expect(isProtectedPath("/creator.dashboard")).toBe(true);
  });

  it("does not match public routes or look-alikes", () => {
    expect(isProtectedPath("/")).toBe(false);
    expect(isProtectedPath("/browse")).toBe(false);
    expect(isProtectedPath("/auth")).toBe(false);
    expect(isProtectedPath("/administrator")).toBe(false); // no trailing slash
    expect(isProtectedPath("/settingsx")).toBe(false);
    expect(isProtectedPath("")).toBe(false);
    expect(isProtectedPath("javascript:alert(1)")).toBe(false);
  });
});

describe("markManualSignOut / wasManualSignOut", () => {
  it("returns true within the 5s window and false afterwards", () => {
    const t0 = 1_000_000;
    markManualSignOut(t0);
    expect(wasManualSignOut(t0)).toBe(true);
    expect(wasManualSignOut(t0 + 4_999)).toBe(true);
    expect(wasManualSignOut(t0 + 5_001)).toBe(false);
  });

  it("defaults to false when the flag was never set", () => {
    expect(wasManualSignOut()).toBe(false);
  });
});

describe("buildExpiryRedirect", () => {
  it("returns a replace-navigation payload targeting landing page /", () => {
    expect(buildExpiryRedirect("/admin/roles")).toEqual({
      to: "/",
      replace: true,
    });
  });
});

describe("shouldRefreshBeforeUse", () => {
  const now = 1_700_000_000_000; // fixed ms
  it("refreshes when the token expires within the skew window", () => {
    const expiresAt = Math.floor(now / 1000) + 30; // 30s from now
    expect(shouldRefreshBeforeUse(expiresAt, now, 60)).toBe(true);
  });
  it("leaves the token alone when it is comfortably in the future", () => {
    const expiresAt = Math.floor(now / 1000) + 3_600; // 1h
    expect(shouldRefreshBeforeUse(expiresAt, now, 60)).toBe(false);
  });
  it("returns false when expires_at is missing", () => {
    expect(shouldRefreshBeforeUse(null, now)).toBe(false);
    expect(shouldRefreshBeforeUse(undefined, now)).toBe(false);
  });
});