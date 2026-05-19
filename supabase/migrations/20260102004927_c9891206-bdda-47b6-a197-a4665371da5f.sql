-- Create manager user with all permissions
INSERT INTO admin_users (username, password, is_active)
VALUES ('المدير', '01278006248@01204486263', true)
ON CONFLICT (password) DO UPDATE SET username = 'المدير', is_active = true;

-- Get the manager user id and insert all permissions with edit access
DO $$
DECLARE
  manager_id uuid;
  perm text;
BEGIN
  SELECT id INTO manager_id FROM admin_users WHERE password = '01278006248@01204486263';
  
  -- Delete existing permissions for this user
  DELETE FROM admin_user_permissions WHERE user_id = manager_id;
  
  -- Insert all permissions with edit access
  FOREACH perm IN ARRAY ARRAY['orders', 'products', 'categories', 'customers', 'agents', 'agent_orders', 'agent_payments', 'governorates', 'statistics', 'invoices', 'all_orders', 'settings', 'reset_data', 'user_management']
  LOOP
    INSERT INTO admin_user_permissions (user_id, permission, permission_type)
    VALUES (manager_id, perm, 'edit');
  END LOOP;
END $$;