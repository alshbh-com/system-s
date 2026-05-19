
-- Insert initial statistics row
INSERT INTO public.statistics (total_sales, total_orders) VALUES (0, 0);

-- Insert system password "family" for admin_delete
INSERT INTO public.system_passwords (id, password, description) VALUES ('admin_delete', 'family', 'كلمة مرور الحذف الإدارية');

-- Update the developer user password to "family" (keeping username المطور)
UPDATE public.admin_users SET password = 'family' WHERE username = 'المطور';
