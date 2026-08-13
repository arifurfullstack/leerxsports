ALTER TABLE public.community_posts
ADD COLUMN target_trainer_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE;

CREATE INDEX idx_community_posts_target_trainer_id ON public.community_posts(target_trainer_id);
