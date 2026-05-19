
-- Create storage bucket for product images
INSERT INTO storage.buckets (id, name, public) VALUES ('products', 'products', true);

-- Allow public read access
CREATE POLICY "Public read access products" ON storage.objects FOR SELECT USING (bucket_id = 'products');

-- Allow anyone to upload to products bucket
CREATE POLICY "Allow upload products" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'products');

-- Allow anyone to update products bucket
CREATE POLICY "Allow update products" ON storage.objects FOR UPDATE USING (bucket_id = 'products');

-- Allow anyone to delete from products bucket
CREATE POLICY "Allow delete products" ON storage.objects FOR DELETE USING (bucket_id = 'products');
