import { describe, it, expect } from "vitest";
import {
  resolveAuthIntent,
  resolvePostAuthTarget,
  sanitizeRedirect,
} from "./auth-intent";

describe("resolveAuthIntent — /admin bounce stamps ?intent=admin", () => {
  it("returns 'admin' for /admin", () => {
    expect(resolveAuthIntent("/admin")).toBe("admin");
  });

  it("returns 'admin' for admin sub-routes", () => {
    expect(resolveAuthIntent("/admin/roles")).toBe("admin");
    expect(resolveAuthIntent("/admin/classes")).toBe("admin");
    expect(resolveAuthIntent("/admin/bookings")).toBe("admin");
  });

  it("returns '' for non-admin routes", () => {
    expect(resolveAuthIntent("/dashboard")).toBe("");
    expect(resolveAuthIntent("/settings")).toBe("");
    expect(resolveAuthIntent("/")).toBe("");
  });

  it("does not confuse look-alike paths", () => {
    expect(resolveAuthIntent("/administrator")).toBe("admin"); // startsWith
    expect(resolveAuthIntent("/not-admin")).toBe("");
  });
});

describe("resolvePostAuthTarget — successful login returns to /admin", () => {
  it("routes to /admin when intent is 'admin'", () => {
    expect(resolvePostAuthTarget({ intent: "admin" })).toBe("/admin");
    // Back-compat: string arg
    expect(resolvePostAuthTarget("admin")).toBe("/admin");
  });

  it("falls back to /onboarding for empty/unknown intent", () => {
    expect(resolvePostAuthTarget({ intent: "" })).toBe("/onboarding");
    expect(resolvePostAuthTarget({ intent: "something-else" })).toBe("/onboarding");
  });

  it("prefers a sanitized redirect over intent", () => {
    expect(resolvePostAuthTarget({ intent: "admin", redirect: "/dashboard" })).toBe(
      "/dashboard",
    );
  });

  it("drops unsafe redirects and falls back to intent/default", () => {
    expect(resolvePostAuthTarget({ redirect: "//evil.example/x" })).toBe("/onboarding");
    expect(resolvePostAuthTarget({ redirect: "https://evil.example" })).toBe(
      "/onboarding",
    );
    expect(resolvePostAuthTarget({ redirect: "javascript:alert(1)" })).toBe(
      "/onboarding",
    );
  });
});

describe("sanitizeRedirect — only same-origin app paths", () => {
  it("accepts absolute app paths", () => {
    expect(sanitizeRedirect("/dashboard")).toBe("/dashboard");
    expect(sanitizeRedirect("/classes/123")).toBe("/classes/123");
  });

  it("rejects external / protocol-relative / weird input", () => {
    expect(sanitizeRedirect("//evil.example")).toBe("");
    expect(sanitizeRedirect("https://evil.example")).toBe("");
    expect(sanitizeRedirect("dashboard")).toBe("");
    expect(sanitizeRedirect("")).toBe("");
    expect(sanitizeRedirect(undefined)).toBe("");
    expect(sanitizeRedirect(null)).toBe("");
    expect(sanitizeRedirect("/ok path")).toBe("");
  });
});