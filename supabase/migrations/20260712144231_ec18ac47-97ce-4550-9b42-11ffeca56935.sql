-- Remove the broad read policy that exposed all profiles to any logged-in user
DROP POLICY IF EXISTS "Users can read all profiles" ON public.profiles;

-- Add a self-read policy
CREATE POLICY "Users can read their own profile"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);
