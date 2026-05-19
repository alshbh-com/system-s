-- Drop existing trigger
DROP TRIGGER IF EXISTS trigger_order_status_change ON orders;
DROP FUNCTION IF EXISTS handle_order_status_change();

-- Create corrected trigger function
-- When order is delivered: it should NOT affect total_owed (already added when assigned)
-- We just need to track it for display purposes in delivered orders
-- The receivables calculation should be: total assigned orders (not delivered) - payments

CREATE OR REPLACE FUNCTION public.handle_order_status_change()
RETURNS TRIGGER AS $$
DECLARE
  order_amount numeric;
BEGIN
  -- Calculate the order amount
  order_amount := NEW.total_amount + COALESCE(NEW.shipping_cost, 0) - COALESCE(NEW.agent_shipping_cost, 0);
  
  -- When order changes TO delivered status
  IF NEW.status = 'delivered' AND OLD.status != 'delivered' AND NEW.delivery_agent_id IS NOT NULL THEN
    -- Record as delivered (for tracking)
    INSERT INTO agent_payments (
      delivery_agent_id,
      order_id,
      amount,
      payment_type,
      notes
    ) VALUES (
      NEW.delivery_agent_id,
      NEW.id,
      order_amount,
      'delivered',
      'طلب مسلم رقم ' || COALESCE(NEW.order_number::text, NEW.id::text)
    );
  END IF;
  
  -- When order changes FROM delivered to another status (restore)
  IF OLD.status = 'delivered' AND NEW.status != 'delivered' AND NEW.delivery_agent_id IS NOT NULL THEN
    -- Delete the delivered record
    DELETE FROM agent_payments 
    WHERE order_id = NEW.id 
    AND delivery_agent_id = NEW.delivery_agent_id 
    AND payment_type = 'delivered';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger
CREATE TRIGGER trigger_order_status_change
BEFORE UPDATE ON orders
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION handle_order_status_change();