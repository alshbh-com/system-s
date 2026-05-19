
-- Fix: Don't unassign agent on return statuses (keep for historical records)
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

  -- Delivered: create 'delivered' payment
  IF NEW.status = 'delivered' AND OLD.status != 'delivered' AND NEW.delivery_agent_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.agent_payments
      WHERE order_id = NEW.id AND delivery_agent_id = NEW.delivery_agent_id AND payment_type = 'delivered'
    ) THEN
      INSERT INTO public.agent_payments (delivery_agent_id, order_id, amount, payment_type, payment_date, notes)
      VALUES (NEW.delivery_agent_id, NEW.id, order_amount, 'delivered', accounting_date,
              'طلب مسلم رقم ' || COALESCE(NEW.order_number::text, NEW.id::text));
    END IF;
  END IF;

  -- Reversal: delivered -> shipped (delete delivered payment only)
  IF OLD.status = 'delivered' AND NEW.status = 'shipped' AND NEW.delivery_agent_id IS NOT NULL THEN
    DELETE FROM public.agent_payments
    WHERE order_id = NEW.id AND delivery_agent_id = NEW.delivery_agent_id AND payment_type = 'delivered';
  END IF;

  -- Reversal: delivered -> pending/processing/cancelled (delete all payments, unassign agent)
  -- But NOT for return statuses - keep agent assigned for historical records
  IF OLD.status = 'delivered' AND NEW.status NOT IN ('delivered', 'shipped', 'returned', 'return_no_shipping') AND OLD.delivery_agent_id IS NOT NULL THEN
    DELETE FROM public.agent_payments
    WHERE order_id = NEW.id AND delivery_agent_id = OLD.delivery_agent_id AND payment_type IN ('delivered', 'owed');

    UPDATE public.delivery_agents
    SET total_owed = total_owed - order_amount
    WHERE id = OLD.delivery_agent_id;

    NEW.delivery_agent_id := NULL;
  END IF;

  -- Reversal: delivered -> return (delete delivered payment but keep agent and owed)
  IF OLD.status = 'delivered' AND NEW.status IN ('returned', 'return_no_shipping') AND OLD.delivery_agent_id IS NOT NULL THEN
    DELETE FROM public.agent_payments
    WHERE order_id = NEW.id AND delivery_agent_id = OLD.delivery_agent_id AND payment_type = 'delivered';
  END IF;

  -- Reversal: shipped -> pending/processing/cancelled (delete owed, unassign)
  -- But NOT for return statuses
  IF OLD.status = 'shipped' AND NEW.status NOT IN ('shipped', 'delivered', 'returned', 'return_no_shipping') AND OLD.delivery_agent_id IS NOT NULL THEN
    DELETE FROM public.agent_payments
    WHERE order_id = NEW.id AND delivery_agent_id = OLD.delivery_agent_id AND payment_type = 'owed';

    UPDATE public.delivery_agents
    SET total_owed = total_owed - order_amount
    WHERE id = OLD.delivery_agent_id;

    NEW.delivery_agent_id := NULL;
  END IF;

  RETURN NEW;
END;
$function$;
