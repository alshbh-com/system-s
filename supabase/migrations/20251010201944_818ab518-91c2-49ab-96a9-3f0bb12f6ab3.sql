-- Add phone2 to customers table
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS phone2 TEXT;

-- Add discount and order_details to orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount NUMERIC DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_details TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS modified_amount NUMERIC;

-- Add new order status for delivered with modification
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
    CREATE TYPE order_status AS ENUM ('pending', 'processing', 'shipped', 'delivered', 'cancelled', 'returned', 'partially_returned', 'delivered_with_modification');
  ELSE
    ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'delivered_with_modification';
  END IF;
END$$;

-- Update the trigger to only deduct agent shipping (not customer shipping)
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
    
    -- Calculate amount owed to agent (total + agent shipping only, not customer shipping)
    -- The shipping_cost in orders table is the agent's shipping cost
    INSERT INTO agent_payments (
      delivery_agent_id,
      order_id,
      amount,
      payment_type,
      notes
    ) VALUES (
      NEW.delivery_agent_id,
      NEW.id,
      NEW.total_amount + COALESCE(NEW.shipping_cost, 0),
      'owed',
      'تعيين طلب رقم ' || NEW.order_number
    );
    
    -- Update agent total_owed with correct amount
    UPDATE delivery_agents
    SET total_owed = total_owed + NEW.total_amount + COALESCE(NEW.shipping_cost, 0)
    WHERE id = NEW.delivery_agent_id;
    
    -- Automatically change status to 'shipped' when agent is assigned
    NEW.status = 'shipped';
  END IF;
  
  RETURN NEW;
END;
$function$;