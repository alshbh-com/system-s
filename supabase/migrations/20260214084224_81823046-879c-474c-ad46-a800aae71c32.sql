
-- Add missing enum values
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'delivered_with_modification';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'return_no_shipping';

-- Create delete_old_activity_logs function
CREATE OR REPLACE FUNCTION public.delete_old_activity_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.activity_logs WHERE created_at < now() - interval '3 days';
END;
$$;

-- Create reset_order_sequence function
CREATE OR REPLACE FUNCTION public.reset_order_sequence()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  ALTER SEQUENCE order_number_seq RESTART WITH 1;
END;
$$;
