
ALTER TABLE public.profiles              ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.trainer_profiles      ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.posts                 ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.community_posts       ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.transformation_posts  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.sports_classes        ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_profiles_is_demo             ON public.profiles(is_demo)             WHERE is_demo;
CREATE INDEX IF NOT EXISTS idx_posts_is_demo                ON public.posts(is_demo)                WHERE is_demo;
CREATE INDEX IF NOT EXISTS idx_community_posts_is_demo      ON public.community_posts(is_demo)      WHERE is_demo;
CREATE INDEX IF NOT EXISTS idx_transformation_posts_is_demo ON public.transformation_posts(is_demo) WHERE is_demo;
CREATE INDEX IF NOT EXISTS idx_sports_classes_is_demo       ON public.sports_classes(is_demo)       WHERE is_demo;
