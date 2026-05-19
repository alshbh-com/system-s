-- First, clean up duplicate agent_payments records
-- Keep only the first record for each order_id + delivery_agent_id combination
DELETE FROM agent_payments 
WHERE id NOT IN (
  SELECT DISTINCT ON (order_id, delivery_agent_id, payment_type) id
  FROM agent_payments
  ORDER BY order_id, delivery_agent_id, payment_type, created_at ASC
);

-- Drop ALL existing triggers that use this function
DROP TRIGGER IF EXISTS trigger_order_agent_assignment ON orders;
DROP TRIGGER IF EXISTS on_order_agent_assigned ON orders;

-- Now drop the function
DROP FUNCTION IF EXISTS handle_order_agent_assignment() CASCADE;

-- Create improved function to handle order agent assignment
CREATE OR REPLACE FUNCTION handle_order_agent_assignment()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if delivery_agent_id is being set (from NULL to a value)
  -- and this is a new assignment (not an update to existing assignment)
  IF NEW.delivery_agent_id IS NOT NULL AND OLD.delivery_agent_id IS NULL THEN
    
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
      NEW.total_amount + COALESCE(NEW.shipping_cost, 0) - COALESCE(NEW.agent_shipping_cost, 0),
      'owed',
      'تعيين طلب رقم ' || COALESCE(NEW.order_number::text, NEW.id::text)
    );
    
    -- Update agent total_owed
    UPDATE delivery_agents
    SET total_owed = COALESCE(total_owed, 0) + NEW.total_amount + COALESCE(NEW.shipping_cost, 0) - COALESCE(NEW.agent_shipping_cost, 0)
    WHERE id = NEW.delivery_agent_id;
    
    -- Automatically change status to 'shipped'
    NEW.status = 'shipped';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create the trigger
CREATE TRIGGER trigger_order_agent_assignment
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION handle_order_agent_assignment();