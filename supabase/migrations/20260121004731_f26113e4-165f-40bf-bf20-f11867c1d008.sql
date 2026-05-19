-- Add new order status for deleted agent
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'agent_deleted';