ALTER TABLE public.testimonials ADD COLUMN IF NOT EXISTS avatar_url text;

UPDATE public.testimonials SET avatar_url = 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=256&h=256&fit=crop&crop=faces&auto=format&q=75' WHERE name = 'Leo M.' AND avatar_url IS NULL;
UPDATE public.testimonials SET avatar_url = 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=256&h=256&fit=crop&crop=faces&auto=format&q=75' WHERE name = 'Priya S.' AND avatar_url IS NULL;
UPDATE public.testimonials SET avatar_url = 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=256&h=256&fit=crop&crop=faces&auto=format&q=75' WHERE name = 'Diego R.' AND avatar_url IS NULL;
UPDATE public.testimonials SET avatar_url = 'https://images.unsplash.com/photo-1541823709867-1b206113eafd?w=256&h=256&fit=crop&crop=faces&auto=format&q=75' WHERE name = 'Amelia K.' AND avatar_url IS NULL;
UPDATE public.testimonials SET avatar_url = 'https://images.unsplash.com/photo-1552058544-f2b08422138a?w=256&h=256&fit=crop&crop=faces&auto=format&q=75' WHERE name = 'Tomás E.' AND avatar_url IS NULL;
UPDATE public.testimonials SET avatar_url = 'https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=256&h=256&fit=crop&crop=faces&auto=format&q=75' WHERE name = 'Yuki N.' AND avatar_url IS NULL;