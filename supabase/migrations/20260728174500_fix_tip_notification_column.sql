-- The tips table uses trainer_id. The original notification trigger still
-- referenced the removed legacy column to_trainer_id, causing every paid tip
-- settlement to roll back.
CREATE OR REPLACE FUNCTION public.tr_notify_tip()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  aname TEXT;
BEGIN
  SELECT COALESCE(display_name, username, 'Someone')
  INTO aname
  FROM public.profiles
  WHERE user_id = NEW.from_user_id;

  PERFORM public.create_notification(
    NEW.trainer_id,
    'tip',
    aname || ' sent you a tip',
    NULL,
    NEW.from_user_id,
    'tip',
    NEW.id,
    NULL,
    jsonb_build_object('amount', NEW.amount)
  );
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.tr_notify_tip() FROM PUBLIC, anon, authenticated;
