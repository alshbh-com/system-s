-- Create storage bucket for product images
INSERT INTO storage.buckets (id, name, public)
VALUES ('products', 'products', true);

-- Allow public access to view product images
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'products');

-- Allow anyone to upload product images
CREATE POLICY "Allow product uploads"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'products');

-- Allow anyone to update product images
CREATE POLICY "Allow product updates"
ON storage.objects FOR UPDATE
USING (bucket_id = 'products');

-- Allow anyone to delete product images
CREATE POLICY "Allow product deletes"
ON storage.objects FOR DELETE
USING (bucket_id = 'products');