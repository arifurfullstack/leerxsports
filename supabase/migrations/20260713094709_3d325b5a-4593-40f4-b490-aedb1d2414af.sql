
-- ============ Enums ============
DO $$ BEGIN
  CREATE TYPE public.report_target AS ENUM (
    'post','comment','community_post','community_comment',
    'profile','coaching_thread','transformation','short'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.report_reason AS ENUM (
    'nudity','abuse','spam','misinformation','ip_violation','self_harm','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.report_status AS ENUM ('open','reviewed','actioned','dismissed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.moderation_action AS ENUM ('hide','restore','remove','warn');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.strike_status AS ENUM ('active','expired','revoked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ posts / transformation_posts hidden flag ============
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS posts_hidden_idx ON public.posts(is_hidden) WHERE is_hidden;

ALTER TABLE public.transformation_posts
  ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT FALSE;

-- Add strike counter to trainer_profiles (hidden from trainers via app policy).
ALTER TABLE public.trainer_profiles
  ADD COLUMN IF NOT EXISTS strike_count INTEGER NOT NULL DEFAULT 0;

-- ============ reports ============
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type public.report_target NOT NULL,
  target_id UUID NOT NULL,
  reason public.report_reason NOT NULL,
  details TEXT,
  status public.report_status NOT NULL DEFAULT 'open',
  resolution_note TEXT,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (reporter_id, target_type, target_id, reason)
);

CREATE INDEX reports_target_idx ON public.reports(target_type, target_id);
CREATE INDEX reports_status_idx ON public.reports(status, created_at DESC);

GRANT SELECT, INSERT ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reporters and admins read reports"
  ON public.reports FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users file own reports"
  ON public.reports FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());

CREATE POLICY "Admins manage reports"
  ON public.reports FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_reports_updated_at
  BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ moderation_actions ============
CREATE TABLE public.moderation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  target_type public.report_target NOT NULL,
  target_id UUID NOT NULL,
  action public.moderation_action NOT NULL,
  reason TEXT,
  automated BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX moderation_target_idx ON public.moderation_actions(target_type, target_id, created_at DESC);

GRANT SELECT ON public.moderation_actions TO authenticated;
GRANT ALL ON public.moderation_actions TO service_role;
ALTER TABLE public.moderation_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read moderation actions"
  ON public.moderation_actions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage moderation actions"
  ON public.moderation_actions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ trainer_strikes ============
CREATE TABLE public.trainer_strikes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  dispute_id UUID REFERENCES public.coaching_disputes(id) ON DELETE SET NULL,
  moderation_action_id UUID REFERENCES public.moderation_actions(id) ON DELETE SET NULL,
  status public.strike_status NOT NULL DEFAULT 'active',
  issued_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX trainer_strikes_trainer_idx ON public.trainer_strikes(trainer_id, status);

GRANT SELECT ON public.trainer_strikes TO authenticated;
GRANT ALL ON public.trainer_strikes TO service_role;
ALTER TABLE public.trainer_strikes ENABLE ROW LEVEL SECURITY;

-- Strikes are hidden from trainers: only admins may read/write.
CREATE POLICY "Admins read strikes"
  ON public.trainer_strikes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage strikes"
  ON public.trainer_strikes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_trainer_strikes_updated_at
  BEFORE UPDATE ON public.trainer_strikes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Auto-hide trigger ============
CREATE OR REPLACE FUNCTION public.auto_hide_on_reports()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  serious_count INTEGER;
BEGIN
  IF NEW.reason NOT IN ('nudity','abuse','self_harm') THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO serious_count
  FROM public.reports
  WHERE target_type = NEW.target_type
    AND target_id = NEW.target_id
    AND reason IN ('nudity','abuse','self_harm')
    AND status IN ('open','reviewed');

  IF serious_count < 3 THEN
    RETURN NEW;
  END IF;

  IF NEW.target_type = 'post' THEN
    UPDATE public.posts SET is_hidden = TRUE WHERE id = NEW.target_id;
  ELSIF NEW.target_type = 'transformation' THEN
    UPDATE public.transformation_posts SET is_hidden = TRUE WHERE id = NEW.target_id;
  ELSIF NEW.target_type = 'community_post' THEN
    UPDATE public.community_posts SET status = 'hidden' WHERE id = NEW.target_id;
  ELSIF NEW.target_type = 'community_comment' THEN
    UPDATE public.community_comments SET status = 'hidden' WHERE id = NEW.target_id;
  ELSIF NEW.target_type = 'comment' THEN
    UPDATE public.comments SET status = 'hidden' WHERE id = NEW.target_id;
  END IF;

  INSERT INTO public.moderation_actions(target_type, target_id, action, reason, automated, metadata)
  VALUES (NEW.target_type, NEW.target_id, 'hide',
          'auto-hide: ' || serious_count || ' serious reports', TRUE,
          jsonb_build_object('trigger_report_id', NEW.id));

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.auto_hide_on_reports() FROM public, anon, authenticated;

CREATE TRIGGER reports_auto_hide
  AFTER INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.auto_hide_on_reports();
