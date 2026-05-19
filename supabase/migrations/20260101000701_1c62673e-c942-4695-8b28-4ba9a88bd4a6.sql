-- Create enum for user roles/permissions
CREATE TYPE public.admin_permission AS ENUM (
  'orders',
  'products', 
  'categories',
  'customers',
  'agents',
  'agent_orders',
  'agent_payments',
  'governorates',
  'statistics',
  'invoices',
  'all_orders',
  'settings',
  'reset_data',
  'user_management'
);

-- Create admin users table
CREATE TABLE public.admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  is_active BOOLEAN DEFAULT true
);

-- Create admin user permissions table
CREATE TABLE public.admin_user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.admin_users(id) ON DELETE CASCADE NOT NULL,
  permission admin_permission NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id, permission)
);

-- Create system passwords table (master password, payment password)
CREATE TABLE public.system_passwords (
  id TEXT PRIMARY KEY,
  password TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create activity logs table
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  username TEXT,
  action TEXT NOT NULL,
  section TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insert default master password
INSERT INTO public.system_passwords (id, password, description)
VALUES 
  ('master', '01278006248@01204486263', 'كلمة مرور الدخول الرئيسية'),
  ('payment', '01278006248@01204486263', 'كلمة مرور تأكيد الدفعات');

-- Enable RLS
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_passwords ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Allow all operations (admin-only system)
CREATE POLICY "Allow all for admin_users" ON public.admin_users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for admin_user_permissions" ON public.admin_user_permissions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for system_passwords" ON public.system_passwords FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for activity_logs" ON public.activity_logs FOR ALL USING (true) WITH CHECK (true);

-- Create indexes
CREATE INDEX idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX idx_admin_user_permissions_user_id ON public.admin_user_permissions(user_id);