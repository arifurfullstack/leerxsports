-- Clean up duplicate default 'trainee' role for users who have a higher-priority role
DELETE FROM public.user_roles ur
WHERE ur.role = 'trainee'
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur2
    WHERE ur2.user_id = ur.user_id
      AND ur2.role IN ('admin','moderator','trainer','user')
  );