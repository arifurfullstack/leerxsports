
-- 1. Extend app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'trainee';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'trainer';

-- (New enum values must be committed before use in same tx? In PG14+ this works if not used in same statement.
-- Migrate legacy 'user' rows to 'trainee'
UPDATE public.user_roles SET role = 'trainee'::public.app_role WHERE role = 'user'::public.app_role;

-- 2. Extend profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS cover_url TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS native_language TEXT,
  ADD COLUMN IF NOT EXISTS additional_languages TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS gender TEXT,
  ADD COLUMN IF NOT EXISTS height_cm NUMERIC,
  ADD COLUMN IF NOT EXISTS weight_kg NUMERIC,
  ADD COLUMN IF NOT EXISTS body_fat_percent NUMERIC,
  ADD COLUMN IF NOT EXISTS skeletal_muscle_kg NUMERIC,
  ADD COLUMN IF NOT EXISTS goal TEXT,
  ADD COLUMN IF NOT EXISTS experience_level TEXT,
  ADD COLUMN IF NOT EXISTS injuries TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS agreement_accepted_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_key
  ON public.profiles (lower(username)) WHERE username IS NOT NULL;

-- 3. Trainer applications
CREATE TABLE IF NOT EXISTS public.trainer_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_legal_name TEXT NOT NULL,
  public_trainer_name TEXT NOT NULL,
  country TEXT NOT NULL,
  native_language TEXT NOT NULL,
  additional_languages TEXT[] NOT NULL DEFAULT '{}',
  specialties TEXT[] NOT NULL DEFAULT '{}',
  years_experience INTEGER NOT NULL DEFAULT 0,
  biography TEXT NOT NULL DEFAULT '',
  certification_details TEXT NOT NULL DEFAULT '',
  certificates TEXT[] NOT NULL DEFAULT '{}',
  id_doc_url TEXT,
  social_links TEXT[] NOT NULL DEFAULT '{}',
  requested_price NUMERIC NOT NULL DEFAULT 9.99,
  payout_info JSONB NOT NULL DEFAULT '{}'::jsonb,
  agreement_accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','resubmit')),
  admin_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS trainer_applications_one_active_per_user
  ON public.trainer_applications (user_id) WHERE status IN ('pending','resubmit');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trainer_applications TO authenticated;
GRANT ALL ON public.trainer_applications TO service_role;
ALTER TABLE public.trainer_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own applications"
  ON public.trainer_applications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own applications"
  ON public.trainer_applications FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pending applications"
  ON public.trainer_applications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND status IN ('pending','resubmit'))
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all applications"
  ON public.trainer_applications FOR SELECT
  TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update all applications"
  ON public.trainer_applications FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER trainer_applications_updated_at
  BEFORE UPDATE ON public.trainer_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Trainer profiles (created on approval)
CREATE TABLE IF NOT EXISTS public.trainer_profiles (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  value_proposition TEXT NOT NULL DEFAULT '',
  specialties TEXT[] NOT NULL DEFAULT '{}',
  subscription_price NUMERIC NOT NULL DEFAULT 9.99,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  monetization_enabled BOOLEAN NOT NULL DEFAULT false,
  strike_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.trainer_profiles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trainer_profiles TO authenticated;
GRANT ALL ON public.trainer_profiles TO service_role;
ALTER TABLE public.trainer_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view verified trainer profiles"
  ON public.trainer_profiles FOR SELECT
  TO anon, authenticated
  USING (is_verified = true AND monetization_enabled = true);

CREATE POLICY "Trainer can view own profile"
  ON public.trainer_profiles FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Trainer can update own profile"
  ON public.trainer_profiles FOR UPDATE
  TO authenticated USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage trainer profiles"
  ON public.trainer_profiles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER trainer_profiles_updated_at
  BEFORE UPDATE ON public.trainer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Update handle_new_user to insert 'trainee'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    INSERT INTO public.profiles (user_id, full_name, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email),
        NEW.raw_user_meta_data->>'avatar_url'
    );
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'trainee'::public.app_role);
    RETURN NEW;
END;
$function$;
