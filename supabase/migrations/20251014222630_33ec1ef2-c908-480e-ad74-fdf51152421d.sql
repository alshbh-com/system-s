-- Create governorates table
CREATE TABLE IF NOT EXISTS public.governorates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  shipping_cost numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.governorates ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow public read governorates" 
ON public.governorates 
FOR SELECT 
USING (true);

CREATE POLICY "Allow all on governorates" 
ON public.governorates 
FOR ALL 
USING (true);

-- Insert Egyptian governorates
INSERT INTO public.governorates (name, shipping_cost) VALUES
('القاهرة', 0),
('الجيزة', 0),
('الإسكندرية', 0),
('الدقهلية', 0),
('الشرقية', 0),
('القليوبية', 0),
('المنوفية', 0),
('الغربية', 0),
('البحيرة', 0),
('الإسماعيلية', 0),
('كفر الشيخ', 0),
('دمياط', 0),
('بورسعيد', 0),
('السويس', 0),
('الفيوم', 0),
('بني سويف', 0),
('المنيا', 0),
('أسيوط', 0),
('سوهاج', 0),
('قنا', 0),
('أسوان', 0),
('الأقصر', 0),
('البحر الأحمر', 0),
('الوادي الجديد', 0),
('مطروح', 0),
('شمال سيناء', 0),
('جنوب سيناء', 0)
ON CONFLICT (name) DO NOTHING;