-- إضافة حالة جديدة "مرتجع دون شحن" إلى enum
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'return_no_shipping';

-- تحديث trigger لمعالجة حالة المرتجع الجزئي
CREATE OR REPLACE FUNCTION public.handle_partial_return()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- If return has a delivery agent and it's a partial return
  IF NEW.delivery_agent_id IS NOT NULL THEN
    -- Deduct the return amount from agent's total_owed
    UPDATE delivery_agents
    SET total_owed = total_owed - NEW.return_amount
    WHERE id = NEW.delivery_agent_id;
    
    -- Create a payment record for the return
    INSERT INTO agent_payments (
      delivery_agent_id,
      order_id,
      amount,
      payment_type,
      notes
    ) VALUES (
      NEW.delivery_agent_id,
      NEW.order_id,
      -NEW.return_amount,
      'return',
      'مرتجع - طلب رقم ' || NEW.order_id
    );
    
    -- Update the order's total_amount if it's a partial return
    UPDATE orders
    SET total_amount = total_amount - NEW.return_amount
    WHERE id = NEW.order_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- استبدال trigger القديم بالجديد
DROP TRIGGER IF EXISTS on_return_created ON returns;
CREATE TRIGGER on_return_created
  AFTER INSERT ON returns
  FOR EACH ROW
  EXECUTE FUNCTION handle_partial_return();