-- Update the trigger function to auto-set agent_shipping_cost from governorate if not provided
CREATE OR REPLACE FUNCTION public.handle_order_agent_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  gov_shipping_cost numeric;
  final_agent_shipping_cost numeric;
BEGIN
  -- Only proceed if delivery_agent_id is being set (from NULL to a value)
  -- and this is a new assignment (not an update to existing assignment)
  IF NEW.delivery_agent_id IS NOT NULL AND OLD.delivery_agent_id IS NULL THEN
    
    -- If agent_shipping_cost is 0 or NULL, try to get it from the governorate
    IF COALESCE(NEW.agent_shipping_cost, 0) = 0 AND NEW.governorate_id IS NOT NULL THEN
      SELECT shipping_cost INTO gov_shipping_cost
      FROM governorates
      WHERE id = NEW.governorate_id;
      
      IF gov_shipping_cost IS NOT NULL THEN
        NEW.agent_shipping_cost := gov_shipping_cost;
      END IF;
    END IF;
    
    final_agent_shipping_cost := COALESCE(NEW.agent_shipping_cost, 0);
    
    -- Calculate amount owed to agent: total + shipping - agent_shipping_cost
    INSERT INTO agent_payments (
      delivery_agent_id,
      order_id,
      amount,
      payment_type,
      notes
    ) VALUES (
      NEW.delivery_agent_id,
      NEW.id,
      NEW.total_amount + COALESCE(NEW.shipping_cost, 0) - final_agent_shipping_cost,
      'owed',
      'تعيين طلب رقم ' || COALESCE(NEW.order_number::text, NEW.id::text)
    );
    
    -- Update agent total_owed
    UPDATE delivery_agents
    SET total_owed = COALESCE(total_owed, 0) + NEW.total_amount + COALESCE(NEW.shipping_cost, 0) - final_agent_shipping_cost
    WHERE id = NEW.delivery_agent_id;
    
    -- Automatically change status to 'shipped'
    NEW.status = 'shipped';
  END IF;
  
  RETURN NEW;
END;
$function$;