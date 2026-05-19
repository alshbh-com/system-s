
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'delivered_with_modification';

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS modified_amount numeric NOT NULL DEFAULT 0;

ALTER TABLE public.statistics
  ADD COLUMN IF NOT EXISTS total_sales numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_orders integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reset timestamptz;

CREATE OR REPLACE FUNCTION public.delete_old_activity_logs()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.activity_logs WHERE created_at < now() - interval '3 days';
$$;

CREATE OR REPLACE FUNCTION public.reset_order_sequence()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM setval('public.order_number_seq', 1000, false);
END;
$$;
