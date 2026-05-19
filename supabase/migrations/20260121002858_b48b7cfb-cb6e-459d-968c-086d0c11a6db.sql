-- Update the handle_order_agent_assignment function to reset assigned_at on every new assignment
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

    -- Always set assigned_at to current time on new assignment
    NEW.assigned_at := now();

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