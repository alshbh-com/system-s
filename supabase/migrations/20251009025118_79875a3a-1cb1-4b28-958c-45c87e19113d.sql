-- Add quantity pricing column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS quantity_pricing jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN products.quantity_pricing IS 'Array of pricing tiers: [{quantity: 1, price: 100}, {quantity: 2, price: 95}, ...]';