
-- App settings for themes and templates
CREATE TABLE public.app_settings (
  id text PRIMARY KEY DEFAULT 'main',
  active_theme text NOT NULL DEFAULT 'blue-default',
  active_template text NOT NULL DEFAULT 'classic',
  custom_settings jsonb DEFAULT '{}',
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES public.admin_users(id)
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read app_settings" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Allow public update app_settings" ON public.app_settings FOR UPDATE USING (true);
CREATE POLICY "Allow public insert app_settings" ON public.app_settings FOR INSERT WITH CHECK (true);

-- Insert default settings
INSERT INTO public.app_settings (id, active_theme, active_template) VALUES ('main', 'blue-default', 'classic');
