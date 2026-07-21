
-- Notifications, preferences, translations cache

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  target_type TEXT,
  target_id UUID,
  link TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user_created ON public.notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id) WHERE is_read = FALSE;

GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own notifications" ON public.notifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Preferences: one row per user; per-type toggles stored in JSONB
CREATE TABLE public.notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  in_app JSONB NOT NULL DEFAULT '{}'::jsonb,
  email JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own prefs" ON public.notification_preferences
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Translations cache: keyed by (source_hash, target_lang)
CREATE TABLE public.translations_cache (
  source_hash TEXT NOT NULL,
  target_lang TEXT NOT NULL,
  source_lang TEXT,
  translated_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (source_hash, target_lang)
);
GRANT SELECT ON public.translations_cache TO authenticated, anon;
GRANT ALL ON public.translations_cache TO service_role;
ALTER TABLE public.translations_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read translations" ON public.translations_cache
  FOR SELECT TO authenticated, anon USING (true);

-- Helper to insert a notification safely (SECURITY DEFINER for triggers)
CREATE OR REPLACE FUNCTION public.create_notification(
  _user_id UUID,
  _type TEXT,
  _title TEXT,
  _body TEXT DEFAULT NULL,
  _actor_id UUID DEFAULT NULL,
  _target_type TEXT DEFAULT NULL,
  _target_id UUID DEFAULT NULL,
  _link TEXT DEFAULT NULL,
  _metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  prefs JSONB;
  allowed BOOLEAN;
  nid UUID;
BEGIN
  IF _user_id IS NULL OR _user_id = _actor_id THEN RETURN NULL; END IF;

  SELECT in_app INTO prefs FROM public.notification_preferences WHERE user_id = _user_id;
  IF prefs IS NOT NULL AND prefs ? _type THEN
    allowed := COALESCE((prefs ->> _type)::boolean, TRUE);
    IF NOT allowed THEN RETURN NULL; END IF;
  END IF;

  INSERT INTO public.notifications(user_id, type, title, body, actor_id, target_type, target_id, link, metadata)
  VALUES (_user_id, _type, _title, _body, _actor_id, _target_type, _target_id, _link, COALESCE(_metadata, '{}'::jsonb))
  RETURNING id INTO nid;
  RETURN nid;
END; $$;

REVOKE EXECUTE ON FUNCTION public.create_notification(UUID,TEXT,TEXT,TEXT,UUID,TEXT,UUID,TEXT,JSONB) FROM PUBLIC, anon, authenticated;

-- Trigger: new follower
CREATE OR REPLACE FUNCTION public.tr_notify_follow() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE aname TEXT;
BEGIN
  SELECT COALESCE(display_name, username, 'Someone') INTO aname FROM public.profiles WHERE user_id = NEW.follower_id;
  PERFORM public.create_notification(NEW.following_id, 'follow', aname || ' followed you', NULL, NEW.follower_id, 'profile', NEW.follower_id, '/u/' || COALESCE((SELECT username FROM public.profiles WHERE user_id = NEW.follower_id), ''), '{}'::jsonb);
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_notify_follow AFTER INSERT ON public.follows
FOR EACH ROW EXECUTE FUNCTION public.tr_notify_follow();

-- Trigger: respect on post
CREATE OR REPLACE FUNCTION public.tr_notify_post_respect() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE aname TEXT; owner UUID;
BEGIN
  SELECT author_id INTO owner FROM public.posts WHERE id = NEW.post_id;
  IF owner IS NULL THEN RETURN NEW; END IF;
  SELECT COALESCE(display_name, username, 'Someone') INTO aname FROM public.profiles WHERE user_id = NEW.user_id;
  PERFORM public.create_notification(owner, 'respect', aname || ' respected your post', NULL, NEW.user_id, 'post', NEW.post_id, NULL, '{}'::jsonb);
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_notify_post_respect AFTER INSERT ON public.respects
FOR EACH ROW EXECUTE FUNCTION public.tr_notify_post_respect();

-- Trigger: comment on post
CREATE OR REPLACE FUNCTION public.tr_notify_post_comment() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE aname TEXT; owner UUID;
BEGIN
  IF NEW.status <> 'visible' THEN RETURN NEW; END IF;
  SELECT author_id INTO owner FROM public.posts WHERE id = NEW.post_id;
  IF owner IS NULL THEN RETURN NEW; END IF;
  SELECT COALESCE(display_name, username, 'Someone') INTO aname FROM public.profiles WHERE user_id = NEW.author_id;
  PERFORM public.create_notification(owner, 'comment', aname || ' commented on your post', LEFT(COALESCE(NEW.text,''),160), NEW.author_id, 'post', NEW.post_id, NULL, '{}'::jsonb);
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_notify_post_comment AFTER INSERT ON public.comments
FOR EACH ROW EXECUTE FUNCTION public.tr_notify_post_comment();

-- Trigger: coaching message -> notify the other party
CREATE OR REPLACE FUNCTION public.tr_notify_coaching_message() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE recip UUID; aname TEXT;
BEGIN
  SELECT CASE WHEN NEW.sender_id = subscriber_id THEN trainer_id ELSE subscriber_id END
    INTO recip FROM public.coaching_requests WHERE id = NEW.thread_id;
  IF recip IS NULL THEN RETURN NEW; END IF;
  SELECT COALESCE(display_name, username, 'Someone') INTO aname FROM public.profiles WHERE user_id = NEW.sender_id;
  PERFORM public.create_notification(recip, 'coaching_message', aname || ' sent a coaching message', LEFT(COALESCE(NEW.text,''),160), NEW.sender_id, 'coaching', NEW.thread_id, '/coaching/' || NEW.thread_id::text, jsonb_build_object('kind', NEW.kind));
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_notify_coaching_message AFTER INSERT ON public.coaching_messages
FOR EACH ROW EXECUTE FUNCTION public.tr_notify_coaching_message();

-- Trigger: new subscription -> notify trainer
CREATE OR REPLACE FUNCTION public.tr_notify_subscription() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE aname TEXT;
BEGIN
  SELECT COALESCE(display_name, username, 'Someone') INTO aname FROM public.profiles WHERE user_id = NEW.subscriber_id;
  PERFORM public.create_notification(NEW.trainer_id, 'subscription', aname || ' subscribed to you', NULL, NEW.subscriber_id, 'subscription', NEW.id, NULL, '{}'::jsonb);
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_notify_subscription AFTER INSERT ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.tr_notify_subscription();

-- Trigger: tip received -> notify trainer
CREATE OR REPLACE FUNCTION public.tr_notify_tip() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE aname TEXT;
BEGIN
  SELECT COALESCE(display_name, username, 'Someone') INTO aname FROM public.profiles WHERE user_id = NEW.from_user_id;
  PERFORM public.create_notification(NEW.to_trainer_id, 'tip', aname || ' sent you a tip', NULL, NEW.from_user_id, 'tip', NEW.id, NULL, jsonb_build_object('amount', NEW.amount));
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_notify_tip AFTER INSERT ON public.tips
FOR EACH ROW EXECUTE FUNCTION public.tr_notify_tip();
