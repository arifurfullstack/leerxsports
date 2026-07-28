CREATE TABLE IF NOT EXISTS public.site_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  site_name text NOT NULL DEFAULT 'LEER Sports',
  tagline text NOT NULL DEFAULT 'Elite Fitness Creators & Private Coaching',
  meta_title text NOT NULL DEFAULT 'LEER Sports — Elite Fitness Creators & Private Coaching',
  meta_description text NOT NULL DEFAULT 'LEER Sports is the premium global platform for verified fitness creators.',
  meta_keywords text,
  favicon_url text,
  logo_url text,
  logo_dark_url text,
  og_title text,
  og_description text,
  og_image_url text,
  twitter_handle text DEFAULT '@leersports',
  theme_color text NOT NULL DEFAULT '#0a0a0a',
  support_email text,
  footer_text text,
  social_twitter text,
  social_instagram text,
  social_youtube text,
  social_tiktok text,
  social_facebook text,
  social_linkedin text,
  custom_head_html text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT ON public.site_settings TO anon;
GRANT SELECT, INSERT, UPDATE ON public.site_settings TO authenticated;
GRANT ALL ON public.site_settings TO service_role;

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site_settings readable by all"
  ON public.site_settings FOR SELECT
  USING (true);

CREATE POLICY "site_settings insertable by admins"
  ON public.site_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "site_settings updatable by admins"
  ON public.site_settings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER update_site_settings_updated_at
  BEFORE UPDATE ON public.site_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.site_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
