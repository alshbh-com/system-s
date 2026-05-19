-- Create treasury table for cash management
CREATE TABLE public.treasury (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('deposit', 'withdrawal')),
  amount numeric NOT NULL,
  description text,
  category text,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid REFERENCES public.admin_users(id)
);

-- Enable RLS
ALTER TABLE public.treasury ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow all on treasury" ON public.treasury FOR ALL USING (true) WITH CHECK (true);

-- Add permission for treasury
INSERT INTO public.admin_user_permissions (user_id, permission, permission_type)
SELECT id, 'treasury', 'edit' FROM public.admin_users WHERE username = 'المدير'
ON CONFLICT DO NOTHING;