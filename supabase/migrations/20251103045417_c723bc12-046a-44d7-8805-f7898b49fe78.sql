-- Create categories table for product organization
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add category_id to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;

-- Enable RLS on categories
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Create policies for categories
CREATE POLICY "Allow all on categories" ON public.categories FOR ALL USING (true);
CREATE POLICY "Allow public read categories" ON public.categories FOR SELECT USING (true);

-- Add trigger for updated_at on categories
CREATE TRIGGER update_categories_updated_at
BEFORE UPDATE ON public.categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Simplify agent_payments by removing complex payment_type logic
-- Now it will only store actual payments made (money given to agent)
-- Remove the old payment_type constraint and add a simpler one
ALTER TABLE public.agent_payments 
DROP CONSTRAINT IF EXISTS agent_payments_payment_type_check;

ALTER TABLE public.agent_payments 
ALTER COLUMN payment_type SET DEFAULT 'payment';

-- The total_owed will be calculated dynamically from orders
-- Keep total_paid in delivery_agents for quick reference
-- Add a comment to clarify this
COMMENT ON COLUMN public.delivery_agents.total_owed IS 'Calculated dynamically from orders - not updated by triggers';
COMMENT ON COLUMN public.delivery_agents.total_paid IS 'Sum of all payments in agent_payments table';