INSERT INTO public.system_passwords (id, password, description) 
VALUES ('treasury_password', '01013701405', 'كلمة مرور الخزانة') 
ON CONFLICT (id) DO UPDATE SET password = '01013701405', updated_at = now();