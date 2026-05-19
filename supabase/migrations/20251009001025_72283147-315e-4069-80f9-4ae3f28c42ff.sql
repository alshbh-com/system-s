-- Create function to handle return creation and update agent balances
CREATE OR REPLACE FUNCTION public.handle_return_creation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If return has a delivery agent, deduct the return amount from their total_owed
  IF NEW.delivery_agent_id IS NOT NULL THEN
    UPDATE delivery_agents
    SET total_owed = total_owed - NEW.return_amount
    WHERE id = NEW.delivery_agent_id;
    
    -- Also create a payment record for the return
    INSERT INTO agent_payments (
      delivery_agent_id,
      order_id,
      amount,
      payment_type,
      notes
    ) VALUES (
      NEW.delivery_agent_id,
      NEW.order_id,
      -NEW.return_amount,
      'return',
      'مرتجع - طلب رقم ' || NEW.order_id
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for returns
CREATE TRIGGER on_return_created
  AFTER INSERT ON returns
  FOR EACH ROW
  EXECUTE FUNCTION handle_return_creation();