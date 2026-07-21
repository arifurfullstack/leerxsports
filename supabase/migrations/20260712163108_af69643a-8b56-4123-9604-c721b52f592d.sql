
CREATE TYPE public.community_kind AS ENUM ('question','flex');
CREATE TYPE public.community_status AS ENUM ('visible','hidden','removed');

-- Posts
CREATE TABLE public.community_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind public.community_kind NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  media TEXT[] NOT NULL DEFAULT '{}',
  hashtags TEXT[] NOT NULL DEFAULT '{}',
  respect_count INT NOT NULL DEFAULT 0,
  comment_count INT NOT NULL DEFAULT 0,
  trainer_answered BOOLEAN NOT NULL DEFAULT false,
  status public.community_status NOT NULL DEFAULT 'visible',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX community_posts_kind_status_created_idx
  ON public.community_posts(kind, status, created_at DESC);
CREATE INDEX community_posts_author_idx ON public.community_posts(author_id);

GRANT SELECT ON public.community_posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_posts TO authenticated;
GRANT ALL ON public.community_posts TO service_role;
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read visible community posts" ON public.community_posts
  FOR SELECT TO anon, authenticated
  USING (status = 'visible' OR auth.uid() = author_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can create their own community posts" ON public.community_posts
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors and admins can update community posts" ON public.community_posts
  FOR UPDATE TO authenticated
  USING (auth.uid() = author_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authors and admins can delete community posts" ON public.community_posts
  FOR DELETE TO authenticated
  USING (auth.uid() = author_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_community_posts_updated_at
  BEFORE UPDATE ON public.community_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Respects
CREATE TABLE public.community_respects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);
GRANT SELECT ON public.community_respects TO anon;
GRANT SELECT, INSERT, DELETE ON public.community_respects TO authenticated;
GRANT ALL ON public.community_respects TO service_role;
ALTER TABLE public.community_respects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read community respects" ON public.community_respects
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Users can respect posts" ON public.community_respects
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove their own respect" ON public.community_respects
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.bump_community_respect()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.community_posts SET respect_count = respect_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.community_posts SET respect_count = GREATEST(0, respect_count - 1) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER bump_community_respect_trg
  AFTER INSERT OR DELETE ON public.community_respects
  FOR EACH ROW EXECUTE FUNCTION public.bump_community_respect();

-- Comments
CREATE TABLE public.community_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.community_comments(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  status public.comment_status NOT NULL DEFAULT 'visible',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX community_comments_post_idx
  ON public.community_comments(post_id, created_at ASC);

GRANT SELECT ON public.community_comments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_comments TO authenticated;
GRANT ALL ON public.community_comments TO service_role;
ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read visible community comments" ON public.community_comments
  FOR SELECT TO anon, authenticated
  USING (status = 'visible' OR auth.uid() = author_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can post community comments" ON public.community_comments
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors and admins can update community comments" ON public.community_comments
  FOR UPDATE TO authenticated
  USING (auth.uid() = author_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authors and admins can delete community comments" ON public.community_comments
  FOR DELETE TO authenticated
  USING (auth.uid() = author_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_community_comments_updated_at
  BEFORE UPDATE ON public.community_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Counter + trainer_answered maintenance
CREATE OR REPLACE FUNCTION public.bump_community_comment()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  is_trainer BOOLEAN;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'visible' THEN
    UPDATE public.community_posts
       SET comment_count = comment_count + 1
     WHERE id = NEW.post_id;
    -- trainer answered flag
    SELECT public.has_role(NEW.author_id, 'trainer') INTO is_trainer;
    IF is_trainer THEN
      UPDATE public.community_posts SET trainer_answered = true WHERE id = NEW.post_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' AND OLD.status = 'visible' THEN
    UPDATE public.community_posts
       SET comment_count = GREATEST(0, comment_count - 1)
     WHERE id = OLD.post_id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'visible' AND NEW.status <> 'visible' THEN
      UPDATE public.community_posts
         SET comment_count = GREATEST(0, comment_count - 1)
       WHERE id = NEW.post_id;
    ELSIF OLD.status <> 'visible' AND NEW.status = 'visible' THEN
      UPDATE public.community_posts
         SET comment_count = comment_count + 1
       WHERE id = NEW.post_id;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER bump_community_comment_trg
  AFTER INSERT OR DELETE OR UPDATE ON public.community_comments
  FOR EACH ROW EXECUTE FUNCTION public.bump_community_comment();
