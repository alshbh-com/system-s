
-- =========================================================
-- COMPLETE SCHEMA REBUILD FOR FAMILY FASHION STORE
-- =========================================================

-- ---- Drop old conflicting tables ----
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.orders CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.categories CASCADE;
DROP TABLE IF EXISTS public.governorates CASCADE;
DROP TYPE  IF EXISTS public.order_status CASCADE;
DROP TYPE  IF EXISTS public.app_role CASCADE;

-- ---- ENUMs ----
CREATE TYPE public.order_status AS ENUM (
  'new','pending','processing','ready','picked_up','out_for_delivery',
  'shipped','delivered','returned','return_no_shipping','failed',
  'postponed','cancelled','agent_deleted'
);

-- ---- updated_at helper (already exists, recreate to be safe) ----
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- =========================================================
-- AUTH / ADMIN
-- =========================================================
CREATE TABLE public.admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE,
  password text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_admin_users_updated BEFORE UPDATE ON public.admin_users
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.admin_user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
  permission text NOT NULL,
  permission_type text NOT NULL DEFAULT 'view',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, permission)
);

CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  username text,
  action text NOT NULL,
  section text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.system_passwords (
  id text PRIMARY KEY,
  password text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- SETTINGS / OFFICES / GOVERNORATES / CATEGORIES
-- =========================================================
CREATE TABLE public.app_settings (
  id text PRIMARY KEY DEFAULT 'main',
  active_theme text NOT NULL DEFAULT 'blue-default',
  active_template text NOT NULL DEFAULT 'classic',
  platform_name text NOT NULL DEFAULT 'Family Fashion',
  invoice_name text NOT NULL DEFAULT 'Family Fashion',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.offices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo_url text,
  watermark_name text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.governorates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  shipping_cost numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  image_url text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- PRODUCTS
-- =========================================================
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  details text,
  price numeric NOT NULL DEFAULT 0,
  offer_price numeric,
  discount_price numeric,
  is_offer boolean NOT NULL DEFAULT false,
  is_featured boolean NOT NULL DEFAULT false,
  image_url text,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  stock integer NOT NULL DEFAULT 0,
  stock_quantity integer NOT NULL DEFAULT 0,
  low_stock_threshold integer NOT NULL DEFAULT 5,
  rating numeric NOT NULL DEFAULT 0,
  reviews_count integer NOT NULL DEFAULT 0,
  size_options text[] NOT NULL DEFAULT '{}',
  color_options text[] NOT NULL DEFAULT '{}',
  quantity_pricing jsonb NOT NULL DEFAULT '[]'::jsonb,
  size_pricing jsonb NOT NULL DEFAULT '[]'::jsonb,
  name_ar text,
  name_en text,
  description_ar text,
  description_en text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.product_color_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  color text,
  image_url text,
  stock integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  product_id uuid,
  user_id uuid,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- CUSTOMERS / DELIVERY AGENTS
-- =========================================================
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  phone2 text,
  address text,
  governorate text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_customers_phone ON public.customers(phone);

CREATE TABLE public.delivery_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  serial_number text,
  total_owed numeric NOT NULL DEFAULT 0,
  total_paid numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- ORDERS / ORDER ITEMS / RETURNS
-- =========================================================
CREATE SEQUENCE IF NOT EXISTS public.order_number_seq START 1000;

CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number bigint NOT NULL DEFAULT nextval('public.order_number_seq') UNIQUE,
  tracking_code text UNIQUE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  delivery_agent_id uuid REFERENCES public.delivery_agents(id) ON DELETE SET NULL,
  governorate_id uuid REFERENCES public.governorates(id) ON DELETE SET NULL,
  status public.order_status NOT NULL DEFAULT 'pending',
  total_amount numeric NOT NULL DEFAULT 0,
  shipping_cost numeric NOT NULL DEFAULT 0,
  agent_shipping_cost numeric NOT NULL DEFAULT 0,
  discount numeric NOT NULL DEFAULT 0,
  order_details text,
  notes text,
  assigned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_agent ON public.orders(delivery_agent_id);
CREATE INDEX idx_orders_customer ON public.orders(customer_id);

CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- auto-generate tracking_code
CREATE OR REPLACE FUNCTION public.set_order_tracking_code()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.tracking_code IS NULL OR NEW.tracking_code = '' THEN
    NEW.tracking_code := 'TRK-' || lpad(NEW.order_number::text, 6, '0');
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_orders_tracking BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.set_order_tracking_code();

CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  quantity integer NOT NULL DEFAULT 1,
  price numeric NOT NULL DEFAULT 0,
  size text,
  color text,
  product_details text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_order_items_order ON public.order_items(order_id);

CREATE TABLE public.returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  delivery_agent_id uuid REFERENCES public.delivery_agents(id) ON DELETE SET NULL,
  return_amount numeric NOT NULL DEFAULT 0,
  returned_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_returns_order ON public.returns(order_id);

-- =========================================================
-- AGENT PAYMENTS / DAILY CLOSINGS
-- =========================================================
CREATE TABLE public.agent_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_agent_id uuid REFERENCES public.delivery_agents(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  amount numeric NOT NULL DEFAULT 0,
  payment_type text NOT NULL DEFAULT 'payment', -- payment | delivered | returned | adjustment
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_payments_agent ON public.agent_payments(delivery_agent_id);
CREATE INDEX idx_agent_payments_order ON public.agent_payments(order_id);

CREATE TABLE public.agent_daily_closings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_agent_id uuid REFERENCES public.delivery_agents(id) ON DELETE CASCADE,
  closing_date date NOT NULL,
  net_amount numeric NOT NULL DEFAULT 0,
  closed_by uuid,
  closed_by_username text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(delivery_agent_id, closing_date)
);

-- =========================================================
-- CASHBOX / TREASURY
-- =========================================================
CREATE TABLE public.cashbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  opening_balance numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.cashbox_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cashbox_id uuid REFERENCES public.cashbox(id) ON DELETE CASCADE,
  type text NOT NULL, -- income | expense
  amount numeric NOT NULL DEFAULT 0,
  reason text,
  description text,
  payment_method text DEFAULT 'cash', -- cash | transfer
  user_id uuid,
  username text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cashbox_tx_cashbox ON public.cashbox_transactions(cashbox_id);

CREATE TABLE public.treasury (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL, -- deposit | withdrawal
  amount numeric NOT NULL DEFAULT 0,
  description text,
  category text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.statistics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric text NOT NULL,
  value numeric NOT NULL DEFAULT 0,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- SCAN / BARCODE
-- =========================================================
CREATE TABLE public.scan_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  username text,
  status text NOT NULL DEFAULT 'active', -- active | completed
  total_scanned integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);

CREATE TABLE public.scan_session_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.scan_sessions(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  scanned_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.scan_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  username text,
  session_id uuid REFERENCES public.scan_sessions(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  action text NOT NULL,
  old_value text,
  new_value text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- RLS (public access — admin auth handled in app layer)
-- =========================================================
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'admin_users','admin_user_permissions','activity_logs','system_passwords',
    'app_settings','offices','governorates','categories',
    'products','product_images','product_color_variants','analytics_events',
    'customers','delivery_agents',
    'orders','order_items','returns',
    'agent_payments','agent_daily_closings',
    'cashbox','cashbox_transactions','treasury','statistics',
    'scan_sessions','scan_session_items','scan_logs'
  ])
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "public_all" ON public.%I FOR ALL USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;

-- =========================================================
-- STORAGE BUCKET (products is already public)
-- =========================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('products', 'products', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "products_public_read"   ON storage.objects;
DROP POLICY IF EXISTS "products_public_insert" ON storage.objects;
DROP POLICY IF EXISTS "products_public_update" ON storage.objects;
DROP POLICY IF EXISTS "products_public_delete" ON storage.objects;
CREATE POLICY "products_public_read"   ON storage.objects FOR SELECT USING  (bucket_id='products');
CREATE POLICY "products_public_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id='products');
CREATE POLICY "products_public_update" ON storage.objects FOR UPDATE USING  (bucket_id='products') WITH CHECK (bucket_id='products');
CREATE POLICY "products_public_delete" ON storage.objects FOR DELETE USING  (bucket_id='products');

-- =========================================================
-- SEED DATA: owner user, master passwords, app settings
-- =========================================================
INSERT INTO public.app_settings (id) VALUES ('main')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.system_passwords (id, password) VALUES
  ('admin_delete',      '01278006248'),
  ('treasury_password', '01278006248'),
  ('vault_password',    '01278006248'),
  ('master_password',   '01278006248')
ON CONFLICT (id) DO UPDATE SET password = EXCLUDED.password;

-- Owner user with full permissions
WITH owner AS (
  INSERT INTO public.admin_users (username, password, is_active)
  VALUES ('المالك', '01278006248', true)
  RETURNING id
)
INSERT INTO public.admin_user_permissions (user_id, permission, permission_type)
SELECT owner.id, p, 'edit'
FROM owner,
     unnest(ARRAY[
       'orders','products','categories','customers','agents','agent_orders',
       'agent_payments','governorates','statistics','invoices','all_orders',
       'settings','reset_data','user_management','cashbox','treasury',
       'barcode_scanner'
     ]) AS p;
