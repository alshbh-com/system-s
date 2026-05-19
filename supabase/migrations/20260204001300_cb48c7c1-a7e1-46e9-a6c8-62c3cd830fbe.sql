-- Drop existing foreign key constraints and recreate with ON DELETE SET NULL
ALTER TABLE public.cashbox 
DROP CONSTRAINT IF EXISTS cashbox_created_by_fkey;

ALTER TABLE public.cashbox
ADD CONSTRAINT cashbox_created_by_fkey 
FOREIGN KEY (created_by) 
REFERENCES public.admin_users(id) 
ON DELETE SET NULL;

-- Do the same for cashbox_transactions
ALTER TABLE public.cashbox_transactions 
DROP CONSTRAINT IF EXISTS cashbox_transactions_user_id_fkey;

ALTER TABLE public.cashbox_transactions
ADD CONSTRAINT cashbox_transactions_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES public.admin_users(id) 
ON DELETE SET NULL;

-- Do the same for treasury
ALTER TABLE public.treasury 
DROP CONSTRAINT IF EXISTS treasury_created_by_fkey;

ALTER TABLE public.treasury
ADD CONSTRAINT treasury_created_by_fkey 
FOREIGN KEY (created_by) 
REFERENCES public.admin_users(id) 
ON DELETE SET NULL;

-- Do the same for agent_daily_closings
ALTER TABLE public.agent_daily_closings 
DROP CONSTRAINT IF EXISTS agent_daily_closings_closed_by_fkey;

ALTER TABLE public.agent_daily_closings
ADD CONSTRAINT agent_daily_closings_closed_by_fkey 
FOREIGN KEY (closed_by) 
REFERENCES public.admin_users(id) 
ON DELETE SET NULL;

-- Do the same for activity_logs
ALTER TABLE public.activity_logs 
DROP CONSTRAINT IF EXISTS activity_logs_user_id_fkey;

ALTER TABLE public.activity_logs
ADD CONSTRAINT activity_logs_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES public.admin_users(id) 
ON DELETE SET NULL;