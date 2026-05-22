-- Add agent shipping cost per governorate (auto-applied to orders)
ALTER TABLE public.governorates 
ADD COLUMN IF NOT EXISTS agent_shipping_cost numeric NOT NULL DEFAULT 0;

-- Add separate shipping deduction field to returns
ALTER TABLE public.returns 
ADD COLUMN IF NOT EXISTS shipping_deduction numeric NOT NULL DEFAULT 0;