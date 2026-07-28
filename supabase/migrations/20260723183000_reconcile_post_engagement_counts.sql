-- Reconcile legacy/stale counters once. Ongoing writes remain maintained by
-- the existing respects, saves, and comments triggers.
UPDATE public.posts AS p
SET
  respect_count = (
    SELECT count(*)::integer
    FROM public.respects AS r
    WHERE r.post_id = p.id
  ),
  save_count = (
    SELECT count(*)::integer
    FROM public.saves AS s
    WHERE s.post_id = p.id
  ),
  comment_count = (
    SELECT count(*)::integer
    FROM public.comments AS c
    WHERE c.post_id = p.id
      AND c.status = 'visible'
  );
