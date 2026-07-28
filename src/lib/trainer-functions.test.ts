import { describe, expect, it } from "vitest";
import { resolveDiscoveryCount } from "./trainer-functions";

describe("resolveDiscoveryCount", () => {
  it("preserves the post counter when an anonymous recount is rejected", () => {
    expect(
      resolveDiscoveryCount(new Map(), "post-1", 7, new Error("permission denied")),
    ).toBe(7);
  });

  it("uses a successful recount, including a legitimate zero", () => {
    expect(resolveDiscoveryCount(new Map([["post-1", 0]]), "post-1", 7, null)).toBe(0);
    expect(resolveDiscoveryCount(new Map([["post-1", 3]]), "post-1", 7, null)).toBe(3);
  });

  it("preserves the post counter when RLS silently returns an empty result", () => {
    expect(resolveDiscoveryCount(new Map(), "post-1", 7, null)).toBe(7);
  });
});
