-- PRD: Change QA dispatch default expiry from 7 days to 48 hours
-- Only affects NEW dispatches; existing pending ones retain their original expires_at
ALTER TABLE qa_dispatches
  ALTER COLUMN expires_at SET DEFAULT (now() + INTERVAL '48 hours');
