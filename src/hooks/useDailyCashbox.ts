import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Get today's date in Cairo timezone as YYYY-MM-DD
 */
export const getTodayDateCairo = () => {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
};

/**
 * Generate the daily cashbox name from a date string
 */
export const getDailyCashboxName = (date: string) => `خزنة ${date}`;

/**
 * Hook that ensures a daily cashbox exists for today.
 * Auto-creates one with 0 opening balance if missing.
 * Returns today's cashbox and all active cashboxes.
 */
export const useDailyCashbox = () => {
  const queryClient = useQueryClient();
  const today = getTodayDateCairo();
  const todayCashboxName = getDailyCashboxName(today);

  // Fetch all active cashboxes
  const { data: cashboxes, isLoading } = useQuery({
    queryKey: ["cashboxes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cashbox")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Find today's cashbox
  const todayCashbox = cashboxes?.find((c: any) => c.name === todayCashboxName) || null;

  // Auto-create today's cashbox if it doesn't exist
  const createMutation = useMutation({
    mutationFn: async () => {
      // Double-check it doesn't already exist
      const { data: existing } = await supabase
        .from("cashbox")
        .select("id")
        .eq("name", todayCashboxName)
        .eq("is_active", true)
        .maybeSingle();

      if (existing) return existing;

      const { data, error } = await supabase
        .from("cashbox")
        .insert({
          name: todayCashboxName,
          opening_balance: 0,
        })
        .select("id")
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cashboxes"] });
      queryClient.invalidateQueries({ queryKey: ["cashboxes-active"] });
    },
  });

  useEffect(() => {
    if (!isLoading && cashboxes && !todayCashbox && !createMutation.isPending) {
      createMutation.mutate();
    }
  }, [isLoading, cashboxes, todayCashbox]);

  return {
    todayCashbox,
    todayCashboxName,
    today,
    cashboxes,
    isLoading,
  };
};
