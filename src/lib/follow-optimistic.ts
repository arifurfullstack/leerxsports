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

/** Per-trainer in-flight tracking so rapid clicks reconcile to a stable
 * baseline instead of drifting on partial server responses. */
type BurstState = {
  inflight: number;
  baselineFollowers: number | null;
  baselineFollowing: boolean | null;
  baselineViewerFollowing: number | null;
};
const burst = new Map<string, BurstState>();
/** Scope id for TanStack Query mutation serialization. Same trainer +
 * viewer pair is serialized so DB toggles land in click order. */
export const followMutationScopeId = (trainerId: string, viewerId?: string | null) =>
  `follow:${trainerId}:${viewerId ?? "anon"}`;

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
 * Bump the "following" count on the viewer's own follow-counts cache so
 * their profile reflects a follow/unfollow immediately without waiting
 * for a refetch.
 */
export function bumpViewerFollowingCache(
  qc: QueryClient,
  viewerId: string,
  delta: number,
) {
  const key = followCountsKey(viewerId);
  const current = qc.getQueryData<FollowCounts>(key);
  if (!current) return;
  qc.setQueryData<FollowCounts>(key, {
    ...current,
    following: Math.max(0, current.following + delta),
  });
}

/**
 * Optimistically flip isFollowing and adjust follower count.
 *
 * Rapid-click safety: on the first click of a burst we snapshot the
 * follower count (and optionally the viewer's own following count) as a
 * baseline; each subsequent click while the burst is in flight adds to
 * the same baseline. When the burst settles, reconcile snaps counts to
 * `baseline ± {0,1}` derived from the server's final isFollowing state.
 */
export async function applyOptimisticFollow(
  qc: QueryClient,
  trainerId: string,
  viewerId?: string | null,
): Promise<FollowMutationContext> {
  const infoKey = followInfoKey(trainerId);
  const countsKey = followCountsKey(trainerId);
  await Promise.all([
    qc.cancelQueries({ queryKey: infoKey }),
    qc.cancelQueries({ queryKey: countsKey }),
  ]);
  const prevInfo = qc.getQueryData<SubscriptionInfo>(infoKey);
  const prevCounts = qc.getQueryData<FollowCounts>(countsKey);

  const state = burst.get(trainerId) ?? {
    inflight: 0,
    baselineFollowers: null,
    baselineFollowing: null,
    baselineViewerFollowing: null,
  };
  if (state.inflight === 0) {
    state.baselineFollowers = prevCounts?.followers ?? null;
    state.baselineFollowing = prevInfo?.isFollowing ?? false;
    if (viewerId && viewerId !== trainerId) {
      const viewerCounts = qc.getQueryData<FollowCounts>(followCountsKey(viewerId));
      state.baselineViewerFollowing = viewerCounts?.following ?? null;
    } else {
      state.baselineViewerFollowing = null;
    }
  }
  state.inflight += 1;
  burst.set(trainerId, state);

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

function endBurst(trainerId: string): BurstState | null {
  const s = burst.get(trainerId);
  if (!s) return null;
  s.inflight = Math.max(0, s.inflight - 1);
  if (s.inflight === 0) {
    const snapshot = { ...s };
    burst.delete(trainerId);
    return snapshot;
  }
  burst.set(trainerId, s);
  return null;
}

export function rollbackOptimisticFollow(
  qc: QueryClient,
  trainerId: string,
  ctx: FollowMutationContext | undefined,
) {
  if (!ctx) return;
  endBurst(trainerId);
  if (ctx.prevInfo) qc.setQueryData(followInfoKey(trainerId), ctx.prevInfo);
  // Reverse whatever we applied, even if counts landed from the server
  // between apply → rollback (prevCounts snapshot would be stale).
  bumpFollowersCache(qc, trainerId, -ctx.delta);
}

/**
 * Reconcile follow state from the server response — the source of truth.
 *
 * Only the LAST in-flight click of a burst reconciles counts; intermediate
 * responses just decrement the in-flight counter. This prevents thrashing
 * when the server hasn't yet processed later toggles, and guarantees the
 * final count = baseline + trueDelta where trueDelta ∈ {-1, 0, +1}.
 */
export function reconcileFollowFromServer(
  qc: QueryClient,
  trainerId: string,
  _ctx: FollowMutationContext | undefined,
  serverFollowing: boolean,
  viewerId?: string | null,
) {
  const infoKey = followInfoKey(trainerId);
  const current = qc.getQueryData<SubscriptionInfo>(infoKey);
  // Boolean is authoritative — always reflect the latest server state.
  if (current && current.isFollowing !== serverFollowing) {
    qc.setQueryData<SubscriptionInfo>(infoKey, {
      ...current,
      isFollowing: serverFollowing,
    });
  }
  const finished = endBurst(trainerId);
  if (!finished) return; // more clicks still in flight; wait for the last one

  const {
    baselineFollowers,
    baselineFollowing,
    baselineViewerFollowing,
  } = finished;
  if (baselineFollowers != null && baselineFollowing != null) {
    const trueDelta = serverFollowing === baselineFollowing ? 0 : serverFollowing ? 1 : -1;
    const target = Math.max(0, baselineFollowers + trueDelta);
    const counts = qc.getQueryData<FollowCounts>(followCountsKey(trainerId));
    if (counts && counts.followers !== target) {
      qc.setQueryData<FollowCounts>(followCountsKey(trainerId), {
        ...counts,
        followers: target,
      });
    }
    if (
      viewerId &&
      viewerId !== trainerId &&
      baselineViewerFollowing != null
    ) {
      const viewerKey = followCountsKey(viewerId);
      const viewerCounts = qc.getQueryData<FollowCounts>(viewerKey);
      const viewerTarget = Math.max(0, baselineViewerFollowing + trueDelta);
      if (viewerCounts && viewerCounts.following !== viewerTarget) {
        qc.setQueryData<FollowCounts>(viewerKey, {
          ...viewerCounts,
          following: viewerTarget,
        });
      }
    }
  }
}

export function invalidateFollow(
  qc: QueryClient,
  trainerId: string,
  viewerId?: string,
) {
  qc.invalidateQueries({ queryKey: followInfoKey(trainerId) });
  qc.invalidateQueries({ queryKey: followCountsKey(trainerId) });
  if (viewerId && viewerId !== trainerId) {
    qc.invalidateQueries({ queryKey: followCountsKey(viewerId) });
  }
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