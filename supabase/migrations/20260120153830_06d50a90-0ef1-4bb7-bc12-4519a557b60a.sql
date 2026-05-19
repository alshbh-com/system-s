-- Create table to track daily closings for agent accounting
CREATE TABLE IF NOT EXISTS public.agent_daily_closings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  delivery_agent_id uuid NOT NULL REFERENCES public.delivery_agents(id) ON DELETE CASCADE,
  closing_date date NOT NULL,
  net_amount numeric NOT NULL DEFAULT 0,
  closed_by uuid REFERENCES public.admin_users(id),
  closed_by_username text,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(delivery_agent_id, closing_date)
);

-- Enable RLS
ALTER TABLE public.agent_daily_closings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow all on agent_daily_closings" 
ON public.agent_daily_closings 
FOR ALL 
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow public read agent_daily_closings" 
ON public.agent_daily_closings 
FOR SELECT 
USING (true);