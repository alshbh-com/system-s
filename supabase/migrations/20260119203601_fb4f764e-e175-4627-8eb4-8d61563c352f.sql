-- Ensure agent_payments.payment_date is used consistently for daily accounting
-- and default customer shipping_cost is auto-filled for all orders (including store-imported).

-- 1) Auto-fill shipping_cost (and optionally governorate_id via customer governorate) on all orders
CREATE OR REPLACE FUNCTION public.set_order_shipping_cost_from_governorate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  gov_shipping_cost numeric;
BEGIN
  -- Try to infer governorate_id from the linked customer (if missing)
  IF NEW.governorate_id IS NULL AND NEW.customer_id IS NOT NULL THEN
    SELECT g.id
      INTO NEW.governorate_id
    FROM public.customers c
    JOIN public.governorates g
      ON g.name = c.governorate
    WHERE c.id = NEW.customer_id
    LIMIT 1;
  END IF;

  -- If shipping_cost is not set, fill it from governorates
  IF (NEW.shipping_cost IS NULL OR NEW.shipping_cost = 0)
     AND NEW.governorate_id IS NOT NULL THEN
    SELECT shipping_cost
      INTO gov_shipping_cost
    FROM public.governorates
    WHERE id = NEW.governorate_id;

    IF gov_shipping_cost IS NOT NULL THEN
      NEW.shipping_cost := gov_shipping_cost;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_orders_set_shipping_cost ON public.orders;
CREATE TRIGGER trg_orders_set_shipping_cost
BEFORE INSERT OR UPDATE OF governorate_id, customer_id, shipping_cost
ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.set_order_shipping_cost_from_governorate();


-- 2) Make DB-created agent_payments rows carry payment_date = order.assigned_at day (Cairo)
-- This keeps daily summaries stable even when the order is edited days later.

-- Update assignment function: include payment_date
CREATE OR REPLACE FUNCTION public.handle_order_agent_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  gov_shipping_cost numeric;
  final_agent_shipping_cost numeric;
  accounting_date date;
BEGIN
  IF NEW.delivery_agent_id IS NOT NULL AND OLD.delivery_agent_id IS NULL THEN

    -- Set assigned_at once (do not change it later)
    IF NEW.assigned_at IS NULL THEN
      NEW.assigned_at := now();
    END IF;

    -- If agent_shipping_cost is 0 or NULL, try to get it from the governorate
    IF COALESCE(NEW.agent_shipping_cost, 0) = 0 AND NEW.governorate_id IS NOT NULL THEN
      SELECT shipping_cost INTO gov_shipping_cost
      FROM public.governorates
      WHERE id = NEW.governorate_id;

      IF gov_shipping_cost IS NOT NULL THEN
        NEW.agent_shipping_cost := gov_shipping_cost;
      END IF;
    END IF;

    final_agent_shipping_cost := COALESCE(NEW.agent_shipping_cost, 0);

    accounting_date := DATE(COALESCE(NEW.assigned_at, now()) AT TIME ZONE 'Africa/Cairo');

    INSERT INTO public.agent_payments (
      delivery_agent_id,
      order_id,
      amount,
      payment_type,
      payment_date,
      notes
    ) VALUES (
      NEW.delivery_agent_id,
      NEW.id,
      NEW.total_amount + COALESCE(NEW.shipping_cost, 0) - final_agent_shipping_cost,
      'owed',
      accounting_date,
      'تعيين طلب رقم ' || COALESCE(NEW.order_number::text, NEW.id::text)
    );

    UPDATE public.delivery_agents
    SET total_owed = COALESCE(total_owed, 0) + NEW.total_amount + COALESCE(NEW.shipping_cost, 0) - final_agent_shipping_cost
    WHERE id = NEW.delivery_agent_id;

    NEW.status = 'shipped';
  END IF;

  RETURN NEW;
END;
$function$;


-- Update order status change function: include payment_date for delivered records
CREATE OR REPLACE FUNCTION public.handle_order_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  order_amount numeric;
  accounting_date date;
BEGIN
  order_amount := NEW.total_amount + COALESCE(NEW.shipping_cost, 0) - COALESCE(NEW.agent_shipping_cost, 0);
  accounting_date := DATE(COALESCE(NEW.assigned_at, OLD.assigned_at, NEW.created_at, now()) AT TIME ZONE 'Africa/Cairo');

  IF NEW.status = 'delivered' AND OLD.status != 'delivered' AND NEW.delivery_agent_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.agent_payments
      WHERE order_id = NEW.id
        AND delivery_agent_id = NEW.delivery_agent_id
        AND payment_type = 'delivered'
    ) THEN
      INSERT INTO public.agent_payments (
        delivery_agent_id,
        order_id,
        amount,
        payment_type,
        payment_date,
        notes
      ) VALUES (
        NEW.delivery_agent_id,
        NEW.id,
        order_amount,
        'delivered',
        accounting_date,
        'طلب مسلم رقم ' || COALESCE(NEW.order_number::text, NEW.id::text)
      );
    END IF;
  END IF;

  IF OLD.status = 'delivered' AND NEW.status = 'shipped' AND NEW.delivery_agent_id IS NOT NULL THEN
    DELETE FROM public.agent_payments
    WHERE order_id = NEW.id
      AND delivery_agent_id = NEW.delivery_agent_id
      AND payment_type = 'delivered';
  END IF;

  IF OLD.status = 'delivered' AND NEW.status NOT IN ('delivered', 'shipped') AND OLD.delivery_agent_id IS NOT NULL THEN
    DELETE FROM public.agent_payments
    WHERE order_id = NEW.id
      AND delivery_agent_id = OLD.delivery_agent_id
      AND payment_type IN ('delivered', 'owed');

    UPDATE public.delivery_agents
    SET total_owed = total_owed - order_amount
    WHERE id = OLD.delivery_agent_id;

    NEW.delivery_agent_id := NULL;
  END IF;

  IF OLD.status = 'shipped' AND NEW.status NOT IN ('shipped', 'delivered') AND OLD.delivery_agent_id IS NOT NULL THEN
    DELETE FROM public.agent_payments
    WHERE order_id = NEW.id
      AND delivery_agent_id = OLD.delivery_agent_id
      AND payment_type = 'owed';

    UPDATE public.delivery_agents
    SET total_owed = total_owed - order_amount
    WHERE id = OLD.delivery_agent_id;

    NEW.delivery_agent_id := NULL;
  END IF;

  RETURN NEW;
END;
$function$;


-- Update order amount modification function: include payment_date for modification records
CREATE OR REPLACE FUNCTION public.handle_order_amount_modification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  old_order_amount numeric;
  new_order_amount numeric;
  amount_difference numeric;
  accounting_date date;
BEGIN
  IF NEW.delivery_agent_id IS NOT NULL AND OLD.delivery_agent_id IS NOT NULL
     AND OLD.status IN ('shipped', 'delivered') THEN

    old_order_amount := OLD.total_amount + COALESCE(OLD.shipping_cost, 0) - COALESCE(OLD.agent_shipping_cost, 0);
    new_order_amount := NEW.total_amount + COALESCE(NEW.shipping_cost, 0) - COALESCE(NEW.agent_shipping_cost, 0);

    IF old_order_amount != new_order_amount THEN
      accounting_date := DATE(COALESCE(OLD.assigned_at, NEW.assigned_at, OLD.created_at, NEW.created_at, now()) AT TIME ZONE 'Africa/Cairo');
      amount_difference := old_order_amount - new_order_amount;

      UPDATE public.delivery_agents
      SET total_owed = total_owed - amount_difference
      WHERE id = NEW.delivery_agent_id;

      IF amount_difference > 0 THEN
        INSERT INTO public.agent_payments (
          delivery_agent_id,
          order_id,
          amount,
          payment_type,
          payment_date,
          notes
        ) VALUES (
          NEW.delivery_agent_id,
          NEW.id,
          -amount_difference,
          'modification',
          accounting_date,
          'تعديل طلب رقم ' || COALESCE(NEW.order_number::text, NEW.id::text) || ' - خصم ' || amount_difference::text || ' ج.م'
        );
      ELSIF amount_difference < 0 THEN
        INSERT INTO public.agent_payments (
          delivery_agent_id,
          order_id,
          amount,
          payment_type,
          payment_date,
          notes
        ) VALUES (
          NEW.delivery_agent_id,
          NEW.id,
          ABS(amount_difference),
          'modification',
          accounting_date,
          'تعديل طلب رقم ' || COALESCE(NEW.order_number::text, NEW.id::text) || ' - إضافة ' || ABS(amount_difference)::text || ' ج.م'
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;


-- Update return creation functions: include payment_date = order.assigned_at
CREATE OR REPLACE FUNCTION public.handle_return_creation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  order_assigned_at timestamptz;
  accounting_date date;
BEGIN
  IF NEW.delivery_agent_id IS NOT NULL THEN
    UPDATE public.delivery_agents
    SET total_owed = total_owed - NEW.return_amount
    WHERE id = NEW.delivery_agent_id;

    SELECT o.assigned_at INTO order_assigned_at
    FROM public.orders o
    WHERE o.id = NEW.order_id;

    accounting_date := DATE(COALESCE(order_assigned_at, now()) AT TIME ZONE 'Africa/Cairo');

    INSERT INTO public.agent_payments (
      delivery_agent_id,
      order_id,
      amount,
      payment_type,
      payment_date,
      notes
    ) VALUES (
      NEW.delivery_agent_id,
      NEW.order_id,
      -NEW.return_amount,
      'return',
      accounting_date,
      'مرتجع - طلب رقم ' || NEW.order_id
    );
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_partial_return()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  order_assigned_at timestamptz;
  accounting_date date;
BEGIN
  IF NEW.delivery_agent_id IS NOT NULL THEN
    UPDATE public.delivery_agents
    SET total_owed = total_owed - NEW.return_amount
    WHERE id = NEW.delivery_agent_id;

    SELECT o.assigned_at INTO order_assigned_at
    FROM public.orders o
    WHERE o.id = NEW.order_id;

    accounting_date := DATE(COALESCE(order_assigned_at, now()) AT TIME ZONE 'Africa/Cairo');

    INSERT INTO public.agent_payments (
      delivery_agent_id,
      order_id,
      amount,
      payment_type,
      payment_date,
      notes
    ) VALUES (
      NEW.delivery_agent_id,
      NEW.order_id,
      -NEW.return_amount,
      'return',
      accounting_date,
      'مرتجع - طلب رقم ' || NEW.order_id
    );

    UPDATE public.orders
    SET total_amount = total_amount - NEW.return_amount
    WHERE id = NEW.order_id;
  END IF;

  RETURN NEW;
END;
$function$;