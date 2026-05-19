-- Drop old permissions table and recreate with view/edit options
DROP TABLE IF EXISTS admin_user_permissions CASCADE;

-- Create new permissions table with permission type (view/edit)
CREATE TABLE public.admin_user_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    permission TEXT NOT NULL,
    permission_type TEXT NOT NULL DEFAULT 'edit' CHECK (permission_type IN ('view', 'edit')),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, permission)
);

-- Enable RLS
ALTER TABLE admin_user_permissions ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "Allow all for admin_user_permissions" ON admin_user_permissions
FOR ALL USING (true) WITH CHECK (true);

-- Add unique constraint on password for admin_users (for password-only login)
CREATE UNIQUE INDEX IF NOT EXISTS admin_users_password_unique ON admin_users(password);