
-- Create system password for admin operations if not exists
INSERT INTO public.system_passwords (id, password, description)
VALUES ('admin_delete', 'Magdi17121997', 'كلمة المرور الإدارية للحذف')
ON CONFLICT (id) DO NOTHING;

-- Drop old treasury table if exists (we're replacing it with the new cashbox system)
-- Note: We'll keep the cashbox tables that already exist

-- Update RLS policies for cashbox_transactions to prevent DELETE and UPDATE
DROP POLICY IF EXISTS "Allow update cashbox_transactions" ON public.cashbox_transactions;
DROP POLICY IF EXISTS "Allow delete cashbox_transactions" ON public.cashbox_transactions;

-- Create a function to check admin password
CREATE OR REPLACE FUNCTION public.verify_admin_password(input_password text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.system_passwords
    WHERE id = 'admin_delete'
    AND password = input_password
  )
$$;

-- Create a function to log failed delete attempts
CREATE OR REPLACE FUNCTION public.log_failed_delete_attempt(
  section_name text,
  item_id text,
  username_input text DEFAULT NULL,
  user_id_input uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.activity_logs (
    user_id,
    username,
    action,
    section,
    details
  ) VALUES (
    user_id_input,
    COALESCE(username_input, 'غير معروف'),
    'محاولة حذف فاشلة',
    section_name,
    jsonb_build_object('item_id', item_id, 'timestamp', now())
  );
END;
$$;

-- Add index for better performance on cashbox transactions
CREATE INDEX IF NOT EXISTS idx_cashbox_transactions_cashbox_id ON public.cashbox_transactions(cashbox_id);
CREATE INDEX IF NOT EXISTS idx_cashbox_transactions_created_at ON public.cashbox_transactions(created_at DESC);

-- Add permission for cashbox if not exists
DO $$
BEGIN
  -- Check if the permission already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'cashbox' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'admin_permission')
  ) THEN
    -- Add new permission value
    ALTER TYPE public.admin_permission ADD VALUE IF NOT EXISTS 'cashbox';
  END IF;
EXCEPTION
  WHEN others THEN
    -- Handle case where enum value already exists
    NULL;
END
$$;
