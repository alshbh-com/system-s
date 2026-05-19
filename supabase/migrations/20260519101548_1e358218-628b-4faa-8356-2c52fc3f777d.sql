INSERT INTO app_settings (id, platform_name, invoice_name)
VALUES ('main', 'الصقر اكسبريس', 'الصقر اكسبريس')
ON CONFLICT (id) DO UPDATE SET platform_name = EXCLUDED.platform_name, invoice_name = EXCLUDED.invoice_name, updated_at = now();

ALTER TABLE app_settings ALTER COLUMN platform_name SET DEFAULT 'الصقر اكسبريس';
ALTER TABLE app_settings ALTER COLUMN invoice_name SET DEFAULT 'الصقر اكسبريس';