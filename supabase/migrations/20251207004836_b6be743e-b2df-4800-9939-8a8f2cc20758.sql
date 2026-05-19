-- Drop existing trigger and function
DROP TRIGGER IF EXISTS trigger_order_status_change ON orders;
DROP FUNCTION IF EXISTS handle_order_status_change();

-- Create updated function to handle status changes
CREATE OR REPLACE FUNCTION public.handle_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  order_amount numeric;
BEGIN
  -- Calculate the order amount
  order_amount := NEW.total_amount + COALESCE(NEW.shipping_cost, 0) - COALESCE(NEW.agent_shipping_cost, 0);
  
  -- When order changes TO delivered status
  IF NEW.status = 'delivered' AND OLD.status != 'delivered' AND NEW.delivery_agent_id IS NOT NULL THEN
    -- Record as delivered
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
  
  -- When order changes FROM shipped to status OTHER than delivered (unassign from agent)
  IF OLD.status = 'shipped' AND NEW.status NOT IN ('shipped', 'delivered') AND OLD.delivery_agent_id IS NOT NULL THEN
    -- Delete the owed record for this order
    DELETE FROM agent_payments 
    WHERE order_id = NEW.id 
    AND delivery_agent_id = OLD.delivery_agent_id 
    AND payment_type = 'owed';
    
    -- Update agent's total_owed
    UPDATE delivery_agents
    SET total_owed = total_owed - order_amount
    WHERE id = OLD.delivery_agent_id;
    
    -- Remove agent from order
    NEW.delivery_agent_id := NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER trigger_order_status_change
BEFORE UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION handle_order_status_change();