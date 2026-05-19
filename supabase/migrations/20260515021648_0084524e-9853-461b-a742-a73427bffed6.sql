
-- 1. Add tracking columns to orders
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS tracking_code text,
  ADD COLUMN IF NOT EXISTS barcode_value text,
  ADD COLUMN IF NOT EXISTS qr_value text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_tracking_code ON public.orders(tracking_code) WHERE tracking_code IS NOT NULL;

-- 2. Trigger to auto-generate tracking code
CREATE OR REPLACE FUNCTION public.generate_tracking_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tracking_code IS NULL THEN
    NEW.tracking_code := 'TRK-' || LPAD(COALESCE(NEW.order_number, 0)::text, 6, '0');
  END IF;
  IF NEW.barcode_value IS NULL THEN
    NEW.barcode_value := NEW.tracking_code;
  END IF;
  IF NEW.qr_value IS NULL THEN
    NEW.qr_value := NEW.tracking_code;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_tracking_code ON public.orders;
CREATE TRIGGER trg_generate_tracking_code
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_tracking_code();

-- Backfill existing orders
UPDATE public.orders 
SET tracking_code = 'TRK-' || LPAD(COALESCE(order_number, 0)::text, 6, '0'),
    barcode_value = 'TRK-' || LPAD(COALESCE(order_number, 0)::text, 6, '0'),
    qr_value = 'TRK-' || LPAD(COALESCE(order_number, 0)::text, 6, '0')
WHERE tracking_code IS NULL;

-- 3. Scan sessions
CREATE TABLE IF NOT EXISTS public.scan_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  username text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  total_scanned integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.scan_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access scan_sessions" ON public.scan_sessions FOR ALL USING (true) WITH CHECK (true);

-- 4. Scan session items
CREATE TABLE IF NOT EXISTS public.scan_session_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  order_id uuid NOT NULL,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id, order_id)
);
ALTER TABLE public.scan_session_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access scan_session_items" ON public.scan_session_items FOR ALL USING (true) WITH CHECK (true);

-- 5. Scan logs
CREATE TABLE IF NOT EXISTS public.scan_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  username text,
  order_id uuid,
  session_id uuid,
  action text NOT NULL,
  old_value text,
  new_value text,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.scan_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access scan_logs" ON public.scan_logs FOR ALL USING (true) WITH CHECK (true);

-- 6. Order status history
CREATE TABLE IF NOT EXISTS public.order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  old_status text,
  new_status text NOT NULL,
  changed_by uuid,
  changed_by_username text,
  source text,
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access order_status_history" ON public.order_status_history FOR ALL USING (true) WITH CHECK (true);

-- 7. Trigger to log status changes
CREATE OR REPLACE FUNCTION public.log_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.order_status_history (order_id, old_status, new_status)
    VALUES (NEW.id, OLD.status::text, NEW.status::text);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_order_status_change ON public.orders;
CREATE TRIGGER trg_log_order_status_change
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.log_order_status_change();

-- 8. Enable realtime
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.scan_session_items REPLICA IDENTITY FULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.scan_session_items;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
