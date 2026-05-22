-- Trigger: auto-apply agent shipping cost from governorate
CREATE OR REPLACE FUNCTION public.apply_governorate_agent_shipping()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  gov_cost numeric;
BEGIN
  IF NEW.governorate_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only auto-fill when agent shipping is zero/unset
  IF COALESCE(NEW.agent_shipping_cost, 0) = 0 THEN
    SELECT COALESCE(agent_shipping_cost, 0)
      INTO gov_cost
      FROM public.governorates
     WHERE id = NEW.governorate_id;

    IF gov_cost IS NOT NULL AND gov_cost > 0 THEN
      NEW.agent_shipping_cost := gov_cost;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS apply_governorate_agent_shipping_trg ON public.orders;

CREATE TRIGGER apply_governorate_agent_shipping_trg
BEFORE INSERT OR UPDATE OF governorate_id, agent_shipping_cost
ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.apply_governorate_agent_shipping();

-- Backfill existing orders (only those with 0 agent_shipping_cost and a governorate)
UPDATE public.orders o
   SET agent_shipping_cost = g.agent_shipping_cost
  FROM public.governorates g
 WHERE o.governorate_id = g.id
   AND COALESCE(o.agent_shipping_cost, 0) = 0
   AND COALESCE(g.agent_shipping_cost, 0) > 0;