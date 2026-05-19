
ALTER TABLE public.app_settings
ADD COLUMN IF NOT EXISTS platform_name TEXT NOT NULL DEFAULT 'Family Fashion',
ADD COLUMN IF NOT EXISTS invoice_name TEXT NOT NULL DEFAULT 'Family Fashion';

-- Ensure main row exists with defaults
INSERT INTO public.app_settings (id, platform_name, invoice_name)
VALUES ('main', 'Family Fashion', 'Family Fashion')
ON CONFLICT (id) DO UPDATE SET
  platform_name = COALESCE(app_settings.platform_name, 'Family Fashion'),
  invoice_name = COALESCE(app_settings.invoice_name, 'Family Fashion');
