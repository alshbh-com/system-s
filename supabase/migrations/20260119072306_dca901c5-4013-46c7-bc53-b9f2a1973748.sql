-- Add payment_date column to agent_payments for selecting which day the payment belongs to
ALTER TABLE public.agent_payments 
ADD COLUMN IF NOT EXISTS payment_date DATE DEFAULT CURRENT_DATE;

-- Backfill existing records with the date from created_at
UPDATE public.agent_payments 
SET payment_date = DATE(created_at AT TIME ZONE 'Africa/Cairo')
WHERE payment_date IS NULL OR payment_date = CURRENT_DATE;

-- Create index for better filtering
CREATE INDEX IF NOT EXISTS idx_agent_payments_payment_date 
ON public.agent_payments(payment_date);