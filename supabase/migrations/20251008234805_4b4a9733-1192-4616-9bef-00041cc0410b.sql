-- Add new order statuses for returns
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'returned';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'partially_returned';

-- Add product variant fields
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS size_options text[],
ADD COLUMN IF NOT EXISTS color_options text[],
ADD COLUMN IF NOT EXISTS details text;

-- Add variant fields to order_items
ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS size text,
ADD COLUMN IF NOT EXISTS color text,
ADD COLUMN IF NOT EXISTS product_details text;

-- Create returns table
CREATE TABLE IF NOT EXISTS returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id),
  delivery_agent_id uuid REFERENCES delivery_agents(id),
  return_amount numeric NOT NULL DEFAULT 0,
  returned_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on returns
ALTER TABLE returns ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for returns
CREATE POLICY "Allow all on returns" ON returns FOR ALL USING (true);
CREATE POLICY "Allow public read returns" ON returns FOR SELECT USING (true);

-- Add order_id reference to agent_payments
ALTER TABLE agent_payments
ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES orders(id);

-- Create function to auto-add agent payment when order is assigned
CREATE OR REPLACE FUNCTION handle_order_agent_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only proceed if delivery_agent_id changed and is not null
  IF NEW.delivery_agent_id IS NOT NULL AND 
     (OLD.delivery_agent_id IS NULL OR OLD.delivery_agent_id != NEW.delivery_agent_id) THEN
    
    -- Insert payment record for agent
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
      'تعيين طلب رقم ' || NEW.id
    );
    
    -- Update agent total_owed
    UPDATE delivery_agents
    SET total_owed = total_owed + NEW.total_amount + COALESCE(NEW.shipping_cost, 0)
    WHERE id = NEW.delivery_agent_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for auto agent payment
DROP TRIGGER IF EXISTS on_order_agent_assigned ON orders;
CREATE TRIGGER on_order_agent_assigned
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION handle_order_agent_assignment();