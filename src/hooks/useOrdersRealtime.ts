import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribe to orders table updates and call onUpdate(updatedOrderRow).
 */
export const useOrdersRealtime = (
  enabled: boolean,
  onUpdate: (newRow: any, oldRow: any) => void
) => {
  useEffect(() => {
    if (!enabled) return;
    const channel = supabase
      .channel("orders-realtime-scanner")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        (payload) => onUpdate(payload.new, payload.old)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, onUpdate]);
};
