
-- Countries
CREATE TABLE public.countries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  dial_code TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.countries TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.countries TO authenticated;
GRANT ALL ON public.countries TO service_role;
ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view enabled countries" ON public.countries FOR SELECT USING (is_enabled = TRUE OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage countries" ON public.countries FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_countries_updated BEFORE UPDATE ON public.countries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Languages
CREATE TABLE public.languages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  native_name TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.languages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.languages TO authenticated;
GRANT ALL ON public.languages TO service_role;
ALTER TABLE public.languages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view enabled languages" ON public.languages FOR SELECT USING (is_enabled = TRUE OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage languages" ON public.languages FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_languages_updated BEFORE UPDATE ON public.languages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Fitness categories
CREATE TABLE public.fitness_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.fitness_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fitness_categories TO authenticated;
GRANT ALL ON public.fitness_categories TO service_role;
ALTER TABLE public.fitness_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view enabled categories" ON public.fitness_categories FOR SELECT USING (is_enabled = TRUE OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage categories" ON public.fitness_categories FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_categories_updated BEFORE UPDATE ON public.fitness_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Policies / agreements
CREATE TABLE public.policies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  body_markdown TEXT NOT NULL DEFAULT '',
  version TEXT NOT NULL DEFAULT '1.0',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.policies TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.policies TO authenticated;
GRANT ALL ON public.policies TO service_role;
ALTER TABLE public.policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view published policies" ON public.policies FOR SELECT USING (published_at IS NOT NULL OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage policies" ON public.policies FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_policies_updated BEFORE UPDATE ON public.policies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Audit logs
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id UUID,
  action TEXT NOT NULL,
  target_table TEXT,
  target_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view audit logs" ON public.audit_logs FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert audit logs" ON public.audit_logs FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed a few starter rows
INSERT INTO public.countries (code, name, dial_code) VALUES
  ('US','United States','+1'),
  ('GB','United Kingdom','+44'),
  ('IN','India','+91'),
  ('DE','Germany','+49'),
  ('BR','Brazil','+55')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.languages (code, name, native_name) VALUES
  ('en','English','English'),
  ('es','Spanish','Español'),
  ('pt','Portuguese','Português'),
  ('de','German','Deutsch'),
  ('hi','Hindi','हिन्दी')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.fitness_categories (slug, name, description, sort_order) VALUES
  ('strength','Strength','Weight training and powerlifting',1),
  ('cardio','Cardio','Running, cycling, endurance',2),
  ('yoga','Yoga','Flexibility and mindfulness',3),
  ('crossfit','CrossFit','High-intensity functional fitness',4),
  ('nutrition','Nutrition','Diet and meal planning',5)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.policies (slug, title, body_markdown, published_at) VALUES
  ('terms','Terms of Service','# Terms of Service\n\nWelcome to LEER Sports.', now()),
  ('privacy','Privacy Policy','# Privacy Policy\n\nWe respect your privacy.', now()),
  ('community-guidelines','Community Guidelines','# Community Guidelines\n\nBe respectful.', now())
ON CONFLICT (slug) DO NOTHING;
