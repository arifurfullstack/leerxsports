
-- Syllabus / materials / resource links per class
CREATE TABLE public.class_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.sports_classes(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('syllabus','resource','video','reading','link')),
  title TEXT NOT NULL,
  description TEXT,
  url TEXT,
  content TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_materials TO authenticated;
GRANT ALL ON public.class_materials TO service_role;
ALTER TABLE public.class_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enrolled trainees or admins can view class materials"
  ON public.class_materials FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.class_id = class_materials.class_id
        AND b.user_id = auth.uid()
        AND b.status IN ('confirmed','attended')
    )
  );
CREATE POLICY "Admins manage class materials"
  ON public.class_materials FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_class_materials_updated
  BEFORE UPDATE ON public.class_materials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_class_materials_class ON public.class_materials(class_id, sort_order);

-- Assignments
CREATE TABLE public.class_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.sports_classes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  instructions TEXT,
  due_at TIMESTAMPTZ,
  points INTEGER NOT NULL DEFAULT 10,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_assignments TO authenticated;
GRANT ALL ON public.class_assignments TO service_role;
ALTER TABLE public.class_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enrolled trainees or admins can view assignments"
  ON public.class_assignments FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.class_id = class_assignments.class_id
        AND b.user_id = auth.uid()
        AND b.status IN ('confirmed','attended')
    )
  );
CREATE POLICY "Admins manage assignments"
  ON public.class_assignments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_class_assignments_updated
  BEFORE UPDATE ON public.class_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_class_assignments_class ON public.class_assignments(class_id, sort_order);

-- Trainee submissions
CREATE TABLE public.assignment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.class_assignments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','completed','graded')),
  note TEXT,
  score INTEGER,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignment_submissions TO authenticated;
GRANT ALL ON public.assignment_submissions TO service_role;
ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trainees manage their own submissions"
  ON public.assignment_submissions FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_assignment_submissions_updated
  BEFORE UPDATE ON public.assignment_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed syllabus, resources, and assignments for every existing demo class
WITH c AS (SELECT id, title, category, instructor FROM public.sports_classes WHERE is_demo = true)
INSERT INTO public.class_materials (class_id, kind, title, description, url, content, sort_order, is_demo)
SELECT c.id, m.kind, m.title, m.description, m.url, m.content, m.sort_order, true
FROM c
CROSS JOIN LATERAL (VALUES
  ('syllabus', c.title || ' — Syllabus',
   'Week-by-week outline covering warm-up, technical drills, main set, and cooldown.',
   NULL,
   E'Week 1 — Foundations & assessment\nWeek 2 — Technique focus\nWeek 3 — Volume progression\nWeek 4 — Peak & test\nEach session: 10 min warm-up · 35 min main work · 10 min cooldown',
   0),
  ('reading', 'Pre-class primer',
   'Read before your first session to get the most out of it.',
   'https://www.acefitness.org/resources/pros/expert-articles/',
   NULL,
   1),
  ('video', 'Warm-up demo',
   'Follow along with the standard warm-up ' || c.instructor || ' uses.',
   'https://www.youtube.com/watch?v=ml6cT4AZdqI',
   NULL,
   2),
  ('resource', 'Gear checklist',
   'What to bring to every ' || lower(c.category) || ' session.',
   NULL,
   E'• Water bottle\n• Towel\n• Appropriate footwear\n• Notebook for cues\n• Positive attitude',
   3),
  ('link', 'Community thread',
   'Ask questions and share progress with classmates.',
   '/community',
   NULL,
   4)
) AS m(kind, title, description, url, content, sort_order);

WITH c AS (SELECT id, title FROM public.sports_classes WHERE is_demo = true)
INSERT INTO public.class_assignments (class_id, title, instructions, due_at, points, sort_order, is_demo)
SELECT c.id, a.title, a.instructions, a.due_at, a.points, a.sort_order, true
FROM c
CROSS JOIN LATERAL (VALUES
  ('Baseline check-in',
   'Record a short video or notes on where you are today: mobility, effort, and one goal for the block.',
   now() + interval '3 days', 10, 0),
  ('Technique drill',
   'Complete 3 rounds of the drill covered in class and log RPE for each round.',
   now() + interval '7 days', 15, 1),
  ('Progress review',
   'Compare week 1 numbers to week 4 and share one win + one thing to improve.',
   now() + interval '21 days', 25, 2)
) AS a(title, instructions, due_at, points, sort_order);
