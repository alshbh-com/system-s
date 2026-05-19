-- Create function to reset order number sequence
CREATE OR REPLACE FUNCTION reset_order_sequence()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Reset the sequence to 0
  PERFORM setval('order_number_seq', 0, false);
END;
$$;