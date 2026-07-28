import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { syncGlobalPostCounts } from "./engagement-functions";

describe("syncGlobalPostCounts", () => {
  it("updates a comment count once across cached post lists", () => {
    const qc = new QueryClient();
    qc.setQueryData(["shorts-feed"], [
      { id: "post-1", comment_count: 0, respect_count: 0, save_count: 0 },
    ]);

    syncGlobalPostCounts(qc, "post-1", { commentDelta: 1 });

    expect(
      qc.getQueryData<Array<{ comment_count: number }>>(["shorts-feed"])?.[0]
        .comment_count,
    ).toBe(1);
  });

  it("never rolls a cached count below zero", () => {
    const qc = new QueryClient();
    qc.setQueryData(["home", "shorts-feed"], [
      { id: "post-1", comment_count: 0, respect_count: 0, save_count: 0 },
    ]);

    syncGlobalPostCounts(qc, "post-1", { commentDelta: -1 });

    expect(
      qc.getQueryData<Array<{ comment_count: number }>>([
        "home",
        "shorts-feed",
      ])?.[0].comment_count,
    ).toBe(0);
  });
});
