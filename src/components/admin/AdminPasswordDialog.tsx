import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ShieldAlert, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAdminAuth } from "@/contexts/AdminAuthContext";

interface AdminPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  itemType?: string;
}

const AdminPasswordDialog = ({
  open,
  onOpenChange,
  onConfirm,
  title = "تأكيد الحذف",
  description = "هذا الإجراء يتطلب كلمة المرور الإدارية",
  itemType = "العنصر"
}: AdminPasswordDialogProps) => {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { currentUser, logActivity } = useAdminAuth();

  const handleVerify = async () => {
    if (!password) {
      toast.error("يرجى إدخال كلمة المرور");
      return;
    }

    setLoading(true);
    try {
      // Verify admin password from system_passwords
      const { data, error } = await supabase
        .from("system_passwords")
        .select("password")
        .eq("id", "admin_delete")
        .single();

      if (error) {
        toast.error("حدث خطأ أثناء التحقق");
        return;
      }

      if (data?.password === password) {
        toast.success("تم التحقق بنجاح");
        setPassword("");
        onOpenChange(false);
        // Call onConfirm after dialog closes to ensure state is stable
        setTimeout(() => onConfirm(), 100);
      } else {
        // Log failed attempt
        await logActivity("محاولة حذف فاشلة - كلمة مرور خاطئة", itemType, {
          username: currentUser?.username,
          timestamp: new Date().toISOString()
        });
        toast.error("كلمة المرور غير صحيحة");
      }
    } catch (error) {
      toast.error("حدث خطأ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>
            {description}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
            <p className="text-sm text-amber-700 dark:text-amber-400">
              ⚠️ هذا الإجراء لا يمكن التراجع عنه. يتطلب كلمة المرور الإدارية.
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="admin-password" className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              كلمة المرور الإدارية
            </Label>
            <Input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="أدخل كلمة المرور الإدارية"
              onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => {
            onOpenChange(false);
            setPassword("");
          }}>
            إلغاء
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleVerify}
            disabled={loading || !password}
          >
            {loading ? "جاري التحقق..." : "تأكيد الحذف"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdminPasswordDialog;
