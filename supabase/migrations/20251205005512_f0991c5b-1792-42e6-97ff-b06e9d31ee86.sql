-- Create trigger to handle agent assignment for orders (this will handle payments automatically)
CREATE OR REPLACE TRIGGER trigger_order_agent_assignment
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_order_agent_assignment();