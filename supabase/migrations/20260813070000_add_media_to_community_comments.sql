-- 8.2 Rich Media Trainer Response
-- Add media_urls and is_private to community_comments

ALTER TABLE community_comments
  ADD COLUMN IF NOT EXISTS media_urls text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_community_comments_is_private
  ON community_comments(is_private);

COMMENT ON COLUMN community_comments.media_urls IS 'Signed storage URLs for video/image attachments on this comment (max 3).';
COMMENT ON COLUMN community_comments.is_private IS 'When true, this comment is only visible to the post author and the target trainer. Used for coaching thread responses.';
