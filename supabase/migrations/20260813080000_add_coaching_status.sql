-- 8.3 Coaching Lifecycle
-- Add coaching_status to community_posts to track the 5-step coaching flow

ALTER TABLE community_posts
  ADD COLUMN IF NOT EXISTS coaching_status text
    CHECK (coaching_status IN ('pending', 'coached', 'coaching_completed'))
    DEFAULT NULL;

-- Set existing coaching posts (those with a target_trainer_id) to 'pending'
UPDATE community_posts
  SET coaching_status = 'pending'
  WHERE target_trainer_id IS NOT NULL
    AND coaching_status IS NULL;

-- Index for efficient coaching status queries
CREATE INDEX IF NOT EXISTS idx_community_posts_coaching_status
  ON community_posts(coaching_status)
  WHERE coaching_status IS NOT NULL;

COMMENT ON COLUMN community_posts.coaching_status IS
  'Tracks the coaching lifecycle: pending (awaiting trainer) → coached (trainer replied) → coaching_completed (thread locked after final exchange)';
