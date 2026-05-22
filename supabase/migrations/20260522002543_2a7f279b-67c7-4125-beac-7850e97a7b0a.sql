CREATE OR REPLACE FUNCTION public.normalize_external_order_totals()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  products_match text[];
  total_match text[];
  products_amount numeric;
  grand_total numeric;
  shipping_amount numeric;
BEGIN
  shipping_amount := COALESCE(NEW.shipping_cost, 0);

  IF NEW.order_details IS NULL OR shipping_amount <= 0 OR COALESCE(NEW.total_amount, 0) <= 0 THEN
    RETURN NEW;
  END IF;

  products_match := regexp_match(NEW.order_details, 'المنتجات\s*:\s*([0-9٠-٩]+(?:[\.,][0-9٠-٩]+)?)');
  total_match := regexp_match(NEW.order_details, 'الإجمالي\s*:\s*([0-9٠-٩]+(?:[\.,][0-9٠-٩]+)?)');

  IF products_match IS NOT NULL THEN
    products_amount := translate(products_match[1], '٠١٢٣٤٥٦٧٨٩,', '0123456789.')::numeric;

    IF products_amount >= 0
       AND abs(COALESCE(NEW.total_amount, 0) - (products_amount + shipping_amount)) < 0.01 THEN
      NEW.total_amount := products_amount;
      RETURN NEW;
    END IF;
  END IF;

  IF total_match IS NOT NULL THEN
    grand_total := translate(total_match[1], '٠١٢٣٤٥٦٧٨٩,', '0123456789.')::numeric;

    IF grand_total > shipping_amount
       AND abs(COALESCE(NEW.total_amount, 0) - grand_total) < 0.01 THEN
      NEW.total_amount := grand_total - shipping_amount;
      RETURN NEW;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_external_order_totals_before_write ON public.orders;

CREATE TRIGGER normalize_external_order_totals_before_write
BEFORE INSERT OR UPDATE OF total_amount, shipping_cost, order_details
ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.normalize_external_order_totals();

UPDATE public.orders
SET total_amount = total_amount
WHERE order_details LIKE '%المنتجات:%'
  AND COALESCE(shipping_cost, 0) > 0
  AND COALESCE(total_amount, 0) > COALESCE(shipping_cost, 0);