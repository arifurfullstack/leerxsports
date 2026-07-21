import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import {
  applyOptimisticFollow,
  rollbackOptimisticFollow,
  invalidateFollow,
  followInfoKey,
  followCountsKey,
  type FollowCounts,
} from "./follow-optimistic";
import type { SubscriptionInfo } from "@/lib/subscription-functions";

const TRAINER = "trainer-1";

function makeInfo(over: Partial<SubscriptionInfo> = {}): SubscriptionInfo {
  return {
    isFollowing: false,
    isSubscribed: false,
    subscription: null,
    credit: null,
    ...over,
  };
}

function seed(qc: QueryClient, info: SubscriptionInfo, counts: FollowCounts) {
  qc.setQueryData(followInfoKey(TRAINER), info);
  qc.setQueryData(followCountsKey(TRAINER), counts);
}

let qc: QueryClient;
beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

describe("applyOptimisticFollow", () => {
  it("flips isFollowing false→true and increments follower count", async () => {
    seed(qc, makeInfo({ isFollowing: false }), { followers: 10, following: 3, subscribers: 0 });
    const ctx = await applyOptimisticFollow(qc, TRAINER);

    expect(qc.getQueryData<SubscriptionInfo>(followInfoKey(TRAINER))?.isFollowing).toBe(true);
    expect(qc.getQueryData<FollowCounts>(followCountsKey(TRAINER))).toEqual({
      followers: 11,
      following: 3,
    });
    expect(ctx.prevInfo?.isFollowing).toBe(false);
    expect(ctx.prevCounts).toEqual({ followers: 10, following: 3, subscribers: 0 });
  });

  it("flips isFollowing true→false and decrements follower count", async () => {
    seed(qc, makeInfo({ isFollowing: true }), { followers: 5, following: 2, subscribers: 0 });
    await applyOptimisticFollow(qc, TRAINER);

    expect(qc.getQueryData<SubscriptionInfo>(followInfoKey(TRAINER))?.isFollowing).toBe(false);
    expect(qc.getQueryData<FollowCounts>(followCountsKey(TRAINER))?.followers).toBe(4);
  });

  it("clamps follower count at zero when unfollowing from 0", async () => {
    seed(qc, makeInfo({ isFollowing: true }), { followers: 0, following: 0, subscribers: 0 });
    await applyOptimisticFollow(qc, TRAINER);
    expect(qc.getQueryData<FollowCounts>(followCountsKey(TRAINER))?.followers).toBe(0);
  });

  it("returns undefined snapshots when no cache is present and does not populate cache", async () => {
    const ctx = await applyOptimisticFollow(qc, TRAINER);
    expect(ctx.prevInfo).toBeUndefined();
    expect(ctx.prevCounts).toBeUndefined();
    expect(qc.getQueryData(followInfoKey(TRAINER))).toBeUndefined();
    expect(qc.getQueryData(followCountsKey(TRAINER))).toBeUndefined();
  });

  it("cancels in-flight queries for both keys before mutating", async () => {
    seed(qc, makeInfo(), { followers: 1, following: 0, subscribers: 0 });
    const cancelSpy = vi.spyOn(qc, "cancelQueries");
    await applyOptimisticFollow(qc, TRAINER);
    const keys = cancelSpy.mock.calls.map((c) => c[0]?.queryKey);
    expect(keys).toContainEqual(followInfoKey(TRAINER));
    expect(keys).toContainEqual(followCountsKey(TRAINER));
  });
});

describe("rollbackOptimisticFollow", () => {
  it("restores prior info and counts on error", async () => {
    const initialInfo = makeInfo({ isFollowing: false });
    const initialCounts: FollowCounts = { followers: 7, following: 1, subscribers: 0 };
    seed(qc, initialInfo, initialCounts);

    const ctx = await applyOptimisticFollow(qc, TRAINER);
    // sanity: optimistic changes are visible
    expect(qc.getQueryData<SubscriptionInfo>(followInfoKey(TRAINER))?.isFollowing).toBe(true);
    expect(qc.getQueryData<FollowCounts>(followCountsKey(TRAINER))?.followers).toBe(8);

    rollbackOptimisticFollow(qc, TRAINER, ctx);

    expect(qc.getQueryData<SubscriptionInfo>(followInfoKey(TRAINER))).toEqual(initialInfo);
    expect(qc.getQueryData<FollowCounts>(followCountsKey(TRAINER))).toEqual(initialCounts);
  });

  it("is a no-op when context is undefined", () => {
    seed(qc, makeInfo({ isFollowing: true }), { followers: 2, following: 0, subscribers: 0 });
    rollbackOptimisticFollow(qc, TRAINER, undefined);
    expect(qc.getQueryData<SubscriptionInfo>(followInfoKey(TRAINER))?.isFollowing).toBe(true);
    expect(qc.getQueryData<FollowCounts>(followCountsKey(TRAINER))?.followers).toBe(2);
  });

  it("only restores the snapshots that were present at mutate time", async () => {
    // Only counts cached, info missing
    qc.setQueryData(followCountsKey(TRAINER), { followers: 3, following: 0, subscribers: 0 });
    const ctx = await applyOptimisticFollow(qc, TRAINER);
    // simulate a background write to info during flight — rollback must not clobber it
    qc.setQueryData(followInfoKey(TRAINER), makeInfo({ isFollowing: true }));
    rollbackOptimisticFollow(qc, TRAINER, ctx);
    expect(qc.getQueryData<SubscriptionInfo>(followInfoKey(TRAINER))?.isFollowing).toBe(true);
    expect(qc.getQueryData<FollowCounts>(followCountsKey(TRAINER))).toEqual({
      followers: 3,
      following: 0,
    });
  });
});

describe("invalidateFollow — final reconciliation", () => {
  it("invalidates both subscription-info and follow-counts queries", () => {
    seed(qc, makeInfo(), { followers: 1, following: 0, subscribers: 0 });
    const spy = vi.spyOn(qc, "invalidateQueries");
    invalidateFollow(qc, TRAINER);
    const keys = spy.mock.calls.map((c) => c[0]?.queryKey);
    expect(keys).toContainEqual(followInfoKey(TRAINER));
    expect(keys).toContainEqual(followCountsKey(TRAINER));
  });

  it("marks cached queries as stale so next observer refetches from server", async () => {
    // Register queries with observers so state.isInvalidated flips visibly.
    await qc.fetchQuery({
      queryKey: followInfoKey(TRAINER),
      queryFn: async () => makeInfo({ isFollowing: true }),
    });
    await qc.fetchQuery({
      queryKey: followCountsKey(TRAINER),
      queryFn: async () => ({ followers: 9, following: 4, subscribers: 0 }) as FollowCounts,
    });

    invalidateFollow(qc, TRAINER);

    expect(qc.getQueryState(followInfoKey(TRAINER))?.isInvalidated).toBe(true);
    expect(qc.getQueryState(followCountsKey(TRAINER))?.isInvalidated).toBe(true);
  });
});

describe("full mutation lifecycle", () => {
  it("optimistic → error → rollback → invalidate leaves cache at server truth", async () => {
    const initialInfo = makeInfo({ isFollowing: false });
    const initialCounts: FollowCounts = { followers: 4, following: 1, subscribers: 0 };
    seed(qc, initialInfo, initialCounts);

    // 1. onMutate
    const ctx = await applyOptimisticFollow(qc, TRAINER);
    expect(qc.getQueryData<FollowCounts>(followCountsKey(TRAINER))?.followers).toBe(5);

    // 2. onError
    rollbackOptimisticFollow(qc, TRAINER, ctx);
    expect(qc.getQueryData<SubscriptionInfo>(followInfoKey(TRAINER))).toEqual(initialInfo);
    expect(qc.getQueryData<FollowCounts>(followCountsKey(TRAINER))).toEqual(initialCounts);

    // 3. onSettled
    const spy = vi.spyOn(qc, "invalidateQueries");
    invalidateFollow(qc, TRAINER);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("optimistic → success → invalidate keeps optimistic value until refetch", async () => {
    seed(qc, makeInfo({ isFollowing: false }), { followers: 4, following: 1, subscribers: 0 });
    await applyOptimisticFollow(qc, TRAINER);
    // no rollback on success
    invalidateFollow(qc, TRAINER);
    expect(qc.getQueryData<SubscriptionInfo>(followInfoKey(TRAINER))?.isFollowing).toBe(true);
    expect(qc.getQueryData<FollowCounts>(followCountsKey(TRAINER))?.followers).toBe(5);
  });
});