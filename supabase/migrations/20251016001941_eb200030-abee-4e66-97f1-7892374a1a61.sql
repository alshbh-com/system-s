-- Add agent_shipping_cost column to orders table
ALTER TABLE orders ADD COLUMN agent_shipping_cost NUMERIC DEFAULT 0;

-- Update the trigger to handle agent shipping cost correctly
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
    -- Formula: total_amount + customer_shipping - agent_shipping
    -- Customer pays: total_amount + customer_shipping (shipping_cost)
    -- Agent owes: total_amount + customer_shipping - agent_shipping
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
      'تعيين طلب رقم ' || NEW.order_number
    );
    
    -- Update agent total_owed with correct amount
    UPDATE delivery_agents
    SET total_owed = total_owed + NEW.total_amount + COALESCE(NEW.shipping_cost, 0) - COALESCE(NEW.agent_shipping_cost, 0)
    WHERE id = NEW.delivery_agent_id;
    
    -- Automatically change status to 'shipped' when agent is assigned
    NEW.status = 'shipped';
  END IF;
  
  RETURN NEW;
END;
$function$;