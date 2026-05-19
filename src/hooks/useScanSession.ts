import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/contexts/AdminAuthContext";

export const useScanSession = () => {
  const { currentUser } = useAdminAuth();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const startSession = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("scan_sessions")
      .insert({
        user_id: currentUser?.id || null,
        username: currentUser?.username || "نظام",
        status: "active",
      })
      .select()
      .single();
    setLoading(false);
    if (error) throw error;
    setSessionId(data.id);
    return data.id as string;
  }, [currentUser]);

  const addOrderToSession = useCallback(async (orderId: string, sid?: string) => {
    const id = sid || sessionId;
    if (!id) return;
    await supabase.from("scan_session_items").insert({ session_id: id, order_id: orderId });
    await supabase.from("scan_logs").insert({
      user_id: currentUser?.id || null,
      username: currentUser?.username || "نظام",
      session_id: id,
      order_id: orderId,
      action: "scan",
    });
  }, [sessionId, currentUser]);

  const endSession = useCallback(async (totalScanned: number) => {
    if (!sessionId) return;
    await supabase
      .from("scan_sessions")
      .update({ status: "completed", ended_at: new Date().toISOString(), total_scanned: totalScanned })
      .eq("id", sessionId);
    setSessionId(null);
  }, [sessionId]);

  return { sessionId, loading, startSession, addOrderToSession, endSession };
};
