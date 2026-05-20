
UPDATE public.admin_users SET is_active = true WHERE password = '01278006248';

DO $$
DECLARE
  uid uuid := 'ff4808ca-b2ab-4bff-bcd9-092c17915c24';
  perm text;
  perms text[] := ARRAY['customers','agents','orders','agent_orders','cashbox','products','categories','statistics','invoices','governorates','all_orders','reset_data','user_management','barcode_scanner','treasury','settings','agent_payments'];
BEGIN
  DELETE FROM public.admin_user_permissions WHERE user_id = uid;
  FOREACH perm IN ARRAY perms LOOP
    INSERT INTO public.admin_user_permissions (user_id, permission, permission_type)
    VALUES (uid, perm, 'edit');
  END LOOP;
END $$;
