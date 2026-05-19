
-- Create order_status enum
CREATE TYPE public.order_status AS ENUM ('pending', 'processing', 'shipped', 'delivered', 'cancelled', 'returned');

-- Admin users
CREATE TABLE public.admin_users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE,
  password text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  is_active boolean DEFAULT true,
  CONSTRAINT admin_users_pkey PRIMARY KEY (id)
);
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read admin_users" ON public.admin_users FOR SELECT USING (true);
CREATE POLICY "Allow public insert admin_users" ON public.admin_users FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update admin_users" ON public.admin_users FOR UPDATE USING (true);
CREATE POLICY "Allow public delete admin_users" ON public.admin_users FOR DELETE USING (true);

-- Admin user permissions
CREATE TABLE public.admin_user_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  permission text NOT NULL,
  permission_type text NOT NULL DEFAULT 'edit' CHECK (permission_type IN ('view', 'edit')),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT admin_user_permissions_pkey PRIMARY KEY (id),
  CONSTRAINT admin_user_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.admin_users(id) ON DELETE CASCADE
);
ALTER TABLE public.admin_user_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access admin_user_permissions" ON public.admin_user_permissions FOR ALL USING (true) WITH CHECK (true);

-- Activity logs
CREATE TABLE public.activity_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  username text,
  action text NOT NULL,
  section text NOT NULL,
  details jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT activity_logs_pkey PRIMARY KEY (id),
  CONSTRAINT activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.admin_users(id)
);
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access activity_logs" ON public.activity_logs FOR ALL USING (true) WITH CHECK (true);

-- Categories
CREATE TABLE public.categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  image_url text,
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT categories_pkey PRIMARY KEY (id)
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access categories" ON public.categories FOR ALL USING (true) WITH CHECK (true);

-- Products
CREATE TABLE public.products (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price numeric NOT NULL,
  image_url text,
  is_offer boolean DEFAULT false,
  offer_price numeric,
  stock integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  size_options text[],
  color_options text[],
  details text,
  quantity_pricing jsonb DEFAULT '[]'::jsonb,
  category_id uuid,
  size_pricing jsonb DEFAULT '[]'::jsonb,
  name_ar text,
  name_en text,
  description_ar text,
  description_en text,
  discount_price numeric,
  stock_quantity integer DEFAULT 0,
  low_stock_threshold integer DEFAULT 5,
  rating numeric DEFAULT 0,
  reviews_count integer DEFAULT 0,
  is_featured boolean DEFAULT false,
  CONSTRAINT products_pkey PRIMARY KEY (id),
  CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id)
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access products" ON public.products FOR ALL USING (true) WITH CHECK (true);

-- Product images
CREATE TABLE public.product_images (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id uuid,
  image_url text NOT NULL,
  display_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT product_images_pkey PRIMARY KEY (id),
  CONSTRAINT product_images_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE
);
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access product_images" ON public.product_images FOR ALL USING (true) WITH CHECK (true);

-- Product color variants
CREATE TABLE public.product_color_variants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  color text NOT NULL,
  sizes text[] DEFAULT '{}',
  stock integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  size_prices jsonb DEFAULT '[]'::jsonb,
  CONSTRAINT product_color_variants_pkey PRIMARY KEY (id),
  CONSTRAINT product_color_variants_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE
);
ALTER TABLE public.product_color_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access product_color_variants" ON public.product_color_variants FOR ALL USING (true) WITH CHECK (true);

-- Customers
CREATE TABLE public.customers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  address text NOT NULL,
  governorate text,
  created_at timestamp with time zone DEFAULT now(),
  phone2 text,
  CONSTRAINT customers_pkey PRIMARY KEY (id)
);
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access customers" ON public.customers FOR ALL USING (true) WITH CHECK (true);

-- Delivery agents
CREATE TABLE public.delivery_agents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  serial_number text NOT NULL UNIQUE,
  total_owed numeric DEFAULT 0,
  total_paid numeric DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT delivery_agents_pkey PRIMARY KEY (id)
);
ALTER TABLE public.delivery_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access delivery_agents" ON public.delivery_agents FOR ALL USING (true) WITH CHECK (true);

-- Governorates
CREATE TABLE public.governorates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  shipping_cost numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT governorates_pkey PRIMARY KEY (id)
);
ALTER TABLE public.governorates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access governorates" ON public.governorates FOR ALL USING (true) WITH CHECK (true);

-- Orders
CREATE TABLE public.orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  customer_id uuid,
  delivery_agent_id uuid,
  status order_status DEFAULT 'pending',
  total_amount numeric NOT NULL,
  shipping_cost numeric DEFAULT 0,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  order_number integer UNIQUE,
  discount numeric DEFAULT 0,
  order_details text,
  modified_amount numeric,
  agent_shipping_cost numeric DEFAULT 0,
  governorate_id uuid,
  assigned_at timestamp with time zone,
  CONSTRAINT orders_pkey PRIMARY KEY (id),
  CONSTRAINT orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id),
  CONSTRAINT orders_delivery_agent_id_fkey FOREIGN KEY (delivery_agent_id) REFERENCES public.delivery_agents(id),
  CONSTRAINT orders_governorate_id_fkey FOREIGN KEY (governorate_id) REFERENCES public.governorates(id)
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access orders" ON public.orders FOR ALL USING (true) WITH CHECK (true);

-- Order items
CREATE TABLE public.order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid,
  product_id uuid,
  quantity integer NOT NULL,
  price numeric NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  size text,
  color text,
  product_details text,
  CONSTRAINT order_items_pkey PRIMARY KEY (id),
  CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE,
  CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access order_items" ON public.order_items FOR ALL USING (true) WITH CHECK (true);

-- Agent payments
CREATE TABLE public.agent_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  delivery_agent_id uuid,
  amount numeric NOT NULL,
  payment_type text NOT NULL DEFAULT 'payment',
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  order_id uuid,
  payment_date date DEFAULT CURRENT_DATE,
  CONSTRAINT agent_payments_pkey PRIMARY KEY (id),
  CONSTRAINT agent_payments_delivery_agent_id_fkey FOREIGN KEY (delivery_agent_id) REFERENCES public.delivery_agents(id),
  CONSTRAINT agent_payments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id)
);
ALTER TABLE public.agent_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access agent_payments" ON public.agent_payments FOR ALL USING (true) WITH CHECK (true);

-- Agent daily closings
CREATE TABLE public.agent_daily_closings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  delivery_agent_id uuid NOT NULL,
  closing_date date NOT NULL,
  net_amount numeric NOT NULL DEFAULT 0,
  closed_by uuid,
  closed_by_username text,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT agent_daily_closings_pkey PRIMARY KEY (id),
  CONSTRAINT agent_daily_closings_delivery_agent_id_fkey FOREIGN KEY (delivery_agent_id) REFERENCES public.delivery_agents(id),
  CONSTRAINT agent_daily_closings_closed_by_fkey FOREIGN KEY (closed_by) REFERENCES public.admin_users(id)
);
ALTER TABLE public.agent_daily_closings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access agent_daily_closings" ON public.agent_daily_closings FOR ALL USING (true) WITH CHECK (true);

-- Returns
CREATE TABLE public.returns (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid,
  customer_id uuid,
  delivery_agent_id uuid,
  return_amount numeric NOT NULL DEFAULT 0,
  returned_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT returns_pkey PRIMARY KEY (id),
  CONSTRAINT returns_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id),
  CONSTRAINT returns_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id),
  CONSTRAINT returns_delivery_agent_id_fkey FOREIGN KEY (delivery_agent_id) REFERENCES public.delivery_agents(id)
);
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access returns" ON public.returns FOR ALL USING (true) WITH CHECK (true);

-- Banners
CREATE TABLE public.banners (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  image_url text NOT NULL,
  title text NOT NULL,
  description text,
  link_url text,
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT banners_pkey PRIMARY KEY (id)
);
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access banners" ON public.banners FOR ALL USING (true) WITH CHECK (true);

-- Offers
CREATE TABLE public.offers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title_ar text NOT NULL,
  title_en text,
  description_ar text,
  description_en text,
  discount_percentage integer,
  start_date timestamp with time zone,
  end_date timestamp with time zone,
  is_active boolean DEFAULT true,
  image_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT offers_pkey PRIMARY KEY (id)
);
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access offers" ON public.offers FOR ALL USING (true) WITH CHECK (true);

-- Cashbox
CREATE TABLE public.cashbox (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  opening_balance numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  is_active boolean DEFAULT true,
  CONSTRAINT cashbox_pkey PRIMARY KEY (id),
  CONSTRAINT cashbox_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.admin_users(id)
);
ALTER TABLE public.cashbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access cashbox" ON public.cashbox FOR ALL USING (true) WITH CHECK (true);

-- Cashbox transactions
CREATE TABLE public.cashbox_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cashbox_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  amount numeric NOT NULL CHECK (amount > 0),
  reason text NOT NULL CHECK (reason IN ('order', 'expense', 'salary', 'refund', 'manual')),
  description text,
  user_id uuid,
  username text,
  created_at timestamp with time zone DEFAULT now(),
  order_id uuid,
  payment_method text DEFAULT 'cash',
  CONSTRAINT cashbox_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT cashbox_transactions_cashbox_id_fkey FOREIGN KEY (cashbox_id) REFERENCES public.cashbox(id),
  CONSTRAINT cashbox_transactions_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id),
  CONSTRAINT cashbox_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.admin_users(id)
);
ALTER TABLE public.cashbox_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access cashbox_transactions" ON public.cashbox_transactions FOR ALL USING (true) WITH CHECK (true);

-- Settings
CREATE TABLE public.settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  password text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT settings_pkey PRIMARY KEY (id)
);
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access settings" ON public.settings FOR ALL USING (true) WITH CHECK (true);

-- Statistics
CREATE TABLE public.statistics (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  total_sales numeric DEFAULT 0,
  total_orders integer DEFAULT 0,
  last_reset timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT statistics_pkey PRIMARY KEY (id)
);
ALTER TABLE public.statistics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access statistics" ON public.statistics FOR ALL USING (true) WITH CHECK (true);

-- System passwords
CREATE TABLE public.system_passwords (
  id text NOT NULL,
  password text NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT system_passwords_pkey PRIMARY KEY (id)
);
ALTER TABLE public.system_passwords ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access system_passwords" ON public.system_passwords FOR ALL USING (true) WITH CHECK (true);

-- Treasury
CREATE TABLE public.treasury (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('deposit', 'withdrawal')),
  amount numeric NOT NULL,
  description text,
  category text,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  CONSTRAINT treasury_pkey PRIMARY KEY (id),
  CONSTRAINT treasury_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.admin_users(id)
);
ALTER TABLE public.treasury ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access treasury" ON public.treasury FOR ALL USING (true) WITH CHECK (true);

-- Create order number sequence
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1;

-- Auto-generate order number trigger
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number := nextval('order_number_seq');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_order_number
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.generate_order_number();

-- Insert default admin user "المطور"
INSERT INTO public.admin_users (username, password, is_active) 
VALUES ('المطور', '01278006248', true);

-- Give full permissions to المطور
INSERT INTO public.admin_user_permissions (user_id, permission, permission_type)
SELECT id, permission, 'edit'
FROM public.admin_users, 
unnest(ARRAY['dashboard', 'customers', 'agents', 'orders', 'products', 'categories', 'agent_orders', 'statistics', 'invoices', 'governorates', 'all_orders', 'reset_data', 'users', 'activity', 'treasury', 'cashbox']) AS permission
WHERE username = 'المطور';
