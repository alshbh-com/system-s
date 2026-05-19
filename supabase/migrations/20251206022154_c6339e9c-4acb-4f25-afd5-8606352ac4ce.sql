-- Create trigger function to handle order status changes (delivered = settle, returned = restore)
CREATE OR REPLACE FUNCTION public.handle_order_status_change()
RETURNS TRIGGER AS $$
DECLARE
  order_amount numeric;
BEGIN
  -- Calculate the amount: total + shipping - agent_shipping_cost
  order_amount := NEW.total_amount + COALESCE(NEW.shipping_cost, 0) - COALESCE(NEW.agent_shipping_cost, 0);
  
  -- If order is marked as delivered and was not delivered before
  IF NEW.status = 'delivered' AND OLD.status != 'delivered' AND NEW.delivery_agent_id IS NOT NULL THEN
    -- Subtract from agent's total_owed (settled)
    UPDATE delivery_agents
    SET total_owed = COALESCE(total_owed, 0) - order_amount
    WHERE id = NEW.delivery_agent_id;
    
    -- Record the settlement
    INSERT INTO agent_payments (
      delivery_agent_id,
      order_id,
      amount,
      payment_type,
      notes
    ) VALUES (
      NEW.delivery_agent_id,
      NEW.id,
      -order_amount,
      'settlement',
      'تسوية طلب مسلم رقم ' || COALESCE(NEW.order_number::text, NEW.id::text)
    );
  END IF;
  
  -- If order was delivered and now changed to another status (restore the amount)
  IF OLD.status = 'delivered' AND NEW.status != 'delivered' AND NEW.delivery_agent_id IS NOT NULL THEN
    -- Add back to agent's total_owed
    UPDATE delivery_agents
    SET total_owed = COALESCE(total_owed, 0) + order_amount
    WHERE id = NEW.delivery_agent_id;
    
    -- Record the restoration
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
      'restore',
      'إرجاع طلب رقم ' || COALESCE(NEW.order_number::text, NEW.id::text) || ' للمستحقات'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_order_status_change ON orders;

-- Create trigger for order status changes
CREATE TRIGGER trigger_order_status_change
BEFORE UPDATE ON orders
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION handle_order_status_change();