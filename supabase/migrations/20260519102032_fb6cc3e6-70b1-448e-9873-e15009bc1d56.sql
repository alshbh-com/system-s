ALTER TABLE products ALTER COLUMN size_options SET DEFAULT '{}';
ALTER TABLE products ALTER COLUMN color_options SET DEFAULT '{}';
UPDATE products SET size_options = '{}' WHERE size_options IS NULL;
UPDATE products SET color_options = '{}' WHERE color_options IS NULL;
ALTER TABLE products ALTER COLUMN size_pricing SET DEFAULT '[]'::jsonb;
ALTER TABLE products ALTER COLUMN quantity_pricing SET DEFAULT '[]'::jsonb;