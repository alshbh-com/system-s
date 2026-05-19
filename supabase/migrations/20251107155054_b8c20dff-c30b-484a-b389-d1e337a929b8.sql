-- Fix search path for reset_order_sequence function
DROP FUNCTION IF EXISTS reset_order_sequence();

CREATE OR REPLACE FUNCTION reset_order_sequence()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Reset the sequence to 0
  PERFORM setval('order_number_seq', 0, false);
END;
$$;