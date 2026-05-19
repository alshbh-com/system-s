-- Create a trigger to handle order amount modification when agent is assigned
-- This will deduct the difference from agent's total_owed when order amount is reduced

CREATE OR REPLACE FUNCTION public.handle_order_amount_modification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  old_order_amount numeric;
  new_order_amount numeric;
  amount_difference numeric;
BEGIN
  -- Only proceed if there's an assigned agent and the order was already shipped/delivered
  IF NEW.delivery_agent_id IS NOT NULL AND OLD.delivery_agent_id IS NOT NULL 
     AND OLD.status IN ('shipped', 'delivered') THEN
    
    -- Calculate the old and new total amounts (including shipping)
    old_order_amount := OLD.total_amount + COALESCE(OLD.shipping_cost, 0) - COALESCE(OLD.agent_shipping_cost, 0);
    new_order_amount := NEW.total_amount + COALESCE(NEW.shipping_cost, 0) - COALESCE(NEW.agent_shipping_cost, 0);
    
    -- If the amount changed
    IF old_order_amount != new_order_amount THEN
      amount_difference := old_order_amount - new_order_amount;
      
      -- Update agent's total_owed by the difference
      UPDATE delivery_agents
      SET total_owed = total_owed - amount_difference
      WHERE id = NEW.delivery_agent_id;
      
      -- Create a payment record for the modification
      IF amount_difference > 0 THEN
        INSERT INTO agent_payments (
          delivery_agent_id,
          order_id,
          amount,
          payment_type,
          notes
        ) VALUES (
          NEW.delivery_agent_id,
          NEW.id,
          -amount_difference,
          'modification',
          'تعديل طلب رقم ' || COALESCE(NEW.order_number::text, NEW.id::text) || ' - خصم ' || amount_difference::text || ' ج.م'
        );
      ELSIF amount_difference < 0 THEN
        INSERT INTO agent_payments (
          delivery_agent_id,
          order_id,
          amount,
          payment_type,
          notes
        ) VALUES (
          NEW.delivery_agent_id,
          NEW.id,
          ABS(amount_difference),
          'modification',
          'تعديل طلب رقم ' || COALESCE(NEW.order_number::text, NEW.id::text) || ' - إضافة ' || ABS(amount_difference)::text || ' ج.م'
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Drop the trigger if exists and recreate it
DROP TRIGGER IF EXISTS on_order_amount_modification ON orders;

CREATE TRIGGER on_order_amount_modification
  BEFORE UPDATE ON orders
  FOR EACH ROW
  WHEN (OLD.total_amount IS DISTINCT FROM NEW.total_amount OR OLD.shipping_cost IS DISTINCT FROM NEW.shipping_cost)
  EXECUTE FUNCTION handle_order_amount_modification();