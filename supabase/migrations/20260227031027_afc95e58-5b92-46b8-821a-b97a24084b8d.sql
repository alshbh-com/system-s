
CREATE TABLE public.offices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  logo_url text,
  watermark_name text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.offices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public access offices" ON public.offices FOR ALL USING (true) WITH CHECK (true);
