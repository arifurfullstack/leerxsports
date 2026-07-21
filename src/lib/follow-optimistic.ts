import type { QueryClient } from "@tanstack/react-query";
import type { SubscriptionInfo } from "@/lib/subscription-functions";

export type FollowCounts = { followers: number; following: number; subscribers: number };
export type FollowMutationContext = {
  prevInfo: SubscriptionInfo | undefined;
  prevCounts: FollowCounts | undefined;
  /** +1 when going from not-following → following, -1 otherwise. */
  delta: 1 | -1;
};

export const followInfoKey = (trainerId: string) =>
  ["subscription-info", trainerId] as const;
export const followCountsKey = (trainerId: string) =>
  ["follow-counts", trainerId] as const;

function bumpFollowersCache(
  qc: QueryClient,
  trainerId: string,
  delta: number,
) {
  const key = followCountsKey(trainerId);
  const current = qc.getQueryData<FollowCounts>(key);
  if (!current) return;
  qc.setQueryData<FollowCounts>(key, {
    ...current,
    followers: Math.max(0, current.followers + delta),
  });
}

/**
 * Pure optimistic update: flip isFollowing and adjust follower count.
 * Returns previous snapshots + the delta so the caller can roll back on
 * error even when counts arrived from the server mid-flight.
 */
export async function applyOptimisticFollow(
  qc: QueryClient,
  trainerId: string,
): Promise<FollowMutationContext> {
  const infoKey = followInfoKey(trainerId);
  const countsKey = followCountsKey(trainerId);
  await Promise.all([
    qc.cancelQueries({ queryKey: infoKey }),
    qc.cancelQueries({ queryKey: countsKey }),
  ]);
  const prevInfo = qc.getQueryData<SubscriptionInfo>(infoKey);
  const prevCounts = qc.getQueryData<FollowCounts>(countsKey);
  const wasFollowing = prevInfo?.isFollowing ?? false;
  const delta: 1 | -1 = wasFollowing ? -1 : 1;
  if (prevInfo) {
    qc.setQueryData<SubscriptionInfo>(infoKey, {
      ...prevInfo,
      isFollowing: !wasFollowing,
    });
  }
  bumpFollowersCache(qc, trainerId, delta);
  return { prevInfo, prevCounts, delta };
}

export function rollbackOptimisticFollow(
  qc: QueryClient,
  trainerId: string,
  ctx: FollowMutationContext | undefined,
) {
  if (!ctx) return;
  if (ctx.prevInfo) qc.setQueryData(followInfoKey(trainerId), ctx.prevInfo);
  // Reverse whatever we applied, even if counts landed from the server
  // between apply → rollback (prevCounts snapshot would be stale).
  bumpFollowersCache(qc, trainerId, -ctx.delta);
}

/**
 * Reconcile follow state from the server response — the source of truth.
 * Corrects the follower count if the optimistic guess and server disagree
 * (e.g. rapid double-toggle, out-of-band change).
 */
export function reconcileFollowFromServer(
  qc: QueryClient,
  trainerId: string,
  ctx: FollowMutationContext | undefined,
  serverFollowing: boolean,
) {
  const infoKey = followInfoKey(trainerId);
  const current = qc.getQueryData<SubscriptionInfo>(infoKey);
  if (current && current.isFollowing !== serverFollowing) {
    qc.setQueryData<SubscriptionInfo>(infoKey, {
      ...current,
      isFollowing: serverFollowing,
    });
  }
  const wasFollowing = ctx?.prevInfo?.isFollowing ?? !serverFollowing;
  const expectedDelta = serverFollowing === wasFollowing ? 0 : serverFollowing ? 1 : -1;
  const appliedDelta = ctx?.delta ?? 0;
  const diff = expectedDelta - appliedDelta;
  if (diff !== 0) bumpFollowersCache(qc, trainerId, diff);
}

export function invalidateFollow(qc: QueryClient, trainerId: string) {
  qc.invalidateQueries({ queryKey: followInfoKey(trainerId) });
  qc.invalidateQueries({ queryKey: followCountsKey(trainerId) });
}

// ————————————————————————————————————————————————————————————
// Subscription (isSubscribed) optimistic helpers
// ————————————————————————————————————————————————————————————

export type SubscribeMutationContext = {
  prevInfo: SubscriptionInfo | undefined;
};

export async function applyOptimisticSubscribe(
  qc: QueryClient,
  trainerId: string,
  next: boolean,
): Promise<SubscribeMutationContext> {
  const infoKey = followInfoKey(trainerId);
  await qc.cancelQueries({ queryKey: infoKey });
  const prevInfo = qc.getQueryData<SubscriptionInfo>(infoKey);
  if (prevInfo && prevInfo.isSubscribed !== next) {
    qc.setQueryData<SubscriptionInfo>(infoKey, {
      ...prevInfo,
      isSubscribed: next,
    });
    const countsKey = followCountsKey(trainerId);
    const counts = qc.getQueryData<FollowCounts>(countsKey);
    if (counts) {
      const delta = next ? 1 : -1;
      qc.setQueryData<FollowCounts>(countsKey, {
        ...counts,
        subscribers: Math.max(0, counts.subscribers + delta),
      });
    }
  }
  return { prevInfo };
}

export function rollbackOptimisticSubscribe(
  qc: QueryClient,
  trainerId: string,
  ctx: SubscribeMutationContext | undefined,
) {
  if (ctx?.prevInfo) {
    qc.setQueryData(followInfoKey(trainerId), ctx.prevInfo);
    qc.invalidateQueries({ queryKey: followCountsKey(trainerId) });
  }
}