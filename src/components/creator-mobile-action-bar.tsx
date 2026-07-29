import { Button } from "@/components/ui/button";
import { UnlockCheckoutDialog } from "@/components/unlock-checkout-dialog";
import { MessageSquare, Heart, UserPlus, UserCheck, UserX, Loader2 } from "lucide-react";

interface CreatorMobileActionBarProps {
  trainerId: string;
  creatorName: string;
  creatorUsername?: string;
  avatarUrl?: string;
  isVerified?: boolean;
  subscriptionPrice: number;
  monetizationEnabled: boolean;
  hasEnoughPublicPosts: boolean;
  publicFeedCount: number;
  minPublicPostsRequired: number;
  isSubscribed?: boolean;
  isFollowing?: boolean;
  dmsEnabled: boolean;
  isPendingFollow: boolean;
  onFollowClick: () => void;
  onMessageClick: () => void;
  onTipClick: () => void;
  isSelfProfile?: boolean;
}

export function CreatorMobileActionBar({
  trainerId,
  creatorName,
  creatorUsername,
  avatarUrl,
  isVerified,
  subscriptionPrice,
  monetizationEnabled,
  hasEnoughPublicPosts,
  publicFeedCount,
  minPublicPostsRequired,
  isSubscribed,
  isFollowing,
  dmsEnabled,
  isPendingFollow,
  onFollowClick,
  onMessageClick,
  onTipClick,
  isSelfProfile,
}: CreatorMobileActionBarProps) {
  if (isSelfProfile) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 sm:hidden border-t border-border/80 bg-background/90 p-3 backdrop-blur-xl shadow-[0_-8px_30px_rgba(0,0,0,0.5)]">
      <div className="mx-auto flex max-w-md items-center justify-between gap-2">
        {/* Follow Button */}
        <Button
          size="sm"
          disabled={isPendingFollow}
          onClick={onFollowClick}
          className={`flex-1 rounded-xl font-bold uppercase tracking-wider text-xs transition-all ${
            isFollowing
              ? "border border-neutral-700 bg-neutral-900 text-neutral-200"
              : "bg-white text-black hover:bg-neutral-200"
          }`}
        >
          {isPendingFollow ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isFollowing ? (
            <>
              <UserCheck className="mr-1 h-3.5 w-3.5 text-emerald-400" />
              Following
            </>
          ) : (
            <>
              <UserPlus className="mr-1 h-3.5 w-3.5 text-black" />
              Follow
            </>
          )}
        </Button>

        {/* Subscribe Button */}
        <UnlockCheckoutDialog
          trainerId={trainerId}
          creatorName={creatorName}
          creatorUsername={creatorUsername}
          avatarUrl={avatarUrl}
          isVerified={isVerified}
          subscriptionPrice={subscriptionPrice}
          monetizationEnabled={monetizationEnabled}
          hasEnoughPublicPosts={hasEnoughPublicPosts}
          publicFeedCount={publicFeedCount}
          minPublicPostsRequired={minPublicPostsRequired}
          isSubscribed={isSubscribed}
          dmsEnabled={dmsEnabled}
          triggerSize="sm"
          triggerClassName="flex-1 rounded-xl text-xs"
        />

        {/* Quick Message */}
        <Button
          size="icon"
          variant="outline"
          disabled={!dmsEnabled}
          onClick={onMessageClick}
          title={!dmsEnabled ? "DMs Off" : "Message"}
          className="h-9 w-9 shrink-0 rounded-xl border border-neutral-800 bg-neutral-900/90 text-white"
        >
          <MessageSquare className="h-4 w-4 text-neutral-300" />
        </Button>

        {/* Quick Tip */}
        <Button
          size="icon"
          variant="outline"
          disabled={!monetizationEnabled}
          onClick={onTipClick}
          title="Send Tip"
          className="h-9 w-9 shrink-0 rounded-xl border border-neutral-800 bg-neutral-900/90 text-primary hover:border-primary/60 hover:bg-primary/20"
        >
          <Heart className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
