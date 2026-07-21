CREATE TABLE IF NOT EXISTS public.testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text NOT NULL,
  body text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.testimonials TO anon, authenticated;
GRANT ALL ON public.testimonials TO service_role;

ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read published testimonials"
  ON public.testimonials
  FOR SELECT
  TO anon, authenticated
  USING (published = true);

CREATE POLICY "Admins can manage testimonials"
  ON public.testimonials
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_testimonials_updated_at
  BEFORE UPDATE ON public.testimonials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.testimonials (name, role, body, sort_order) VALUES
  ('Leo M.',   'Member · 8 months',  'First platform where my coach actually watches my lifts. Video feedback beats any group chat.', 10),
  ('Priya S.', 'Member · 1 year',    'I stopped bouncing between apps. Programs, community, and a real pro in one place.',           20),
  ('Diego R.', 'Member · 6 months',  'The verification is real. My coach is an ex-national athlete — not a random influencer.',     30),
  ('Amelia K.','Member · 4 months',  'Weekly form reviews reshaped my squat in two months. Nothing else has moved the needle like this.', 40),
  ('Tomás E.', 'Member · 10 months', 'The community layer is quiet in a good way — actual athletes talking programming, not hype.', 50),
  ('Yuki N.',  'Member · 5 months',  'Multilingual captions on every drill mean my mum can follow the program too. Huge unlock.',  60)
ON CONFLICT DO NOTHING;