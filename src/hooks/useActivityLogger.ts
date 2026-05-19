import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useCallback } from "react";

export const useActivityLogger = () => {
  const { logActivity, currentUser } = useAdminAuth();

  const logAction = useCallback(async (
    action: string,
    section: string,
    details?: any
  ) => {
    if (currentUser) {
      await logActivity(action, section, details);
    }
  }, [logActivity, currentUser]);

  return { logAction };
};
