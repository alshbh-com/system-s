-- Create a function to automatically delete old activity logs
CREATE OR REPLACE FUNCTION public.delete_old_activity_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM activity_logs WHERE created_at < NOW() - INTERVAL '3 days';
END;
$$;

-- Create an index for better performance on date queries
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);