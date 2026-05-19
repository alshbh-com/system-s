-- Create trigger for agent assignment on orders
CREATE OR REPLACE FUNCTION public.handle_order_agent_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only proceed if delivery_agent_id changed and is not null
  IF NEW.delivery_agent_id IS NOT NULL AND 
     (OLD.delivery_agent_id IS NULL OR OLD.delivery_agent_id != NEW.delivery_agent_id) THEN
    
    -- Calculate amount owed to agent
    INSERT INTO agent_payments (
      delivery_agent_id,
      order_id,
      amount,
      payment_type,
      notes
    ) VALUES (
      NEW.delivery_agent_id,
      NEW.id,
      NEW.total_amount + COALESCE(NEW.shipping_cost, 0) - COALESCE(NEW.agent_shipping_cost, 0),
      'owed',
      'تعيين طلب رقم ' || COALESCE(NEW.order_number::text, NEW.id::text)
    );
    
    -- Update agent total_owed
    UPDATE delivery_agents
    SET total_owed = total_owed + NEW.total_amount + COALESCE(NEW.shipping_cost, 0) - COALESCE(NEW.agent_shipping_cost, 0)
    WHERE id = NEW.delivery_agent_id;
    
    -- Automatically change status to 'shipped'
    NEW.status = 'shipped';
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Drop existing trigger if exists and recreate
DROP TRIGGER IF EXISTS trigger_order_agent_assignment ON orders;

CREATE TRIGGER trigger_order_agent_assignment
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION handle_order_agent_assignment();