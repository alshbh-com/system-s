import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

const ResetData = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [password, setPassword] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const resetAllDataMutation = useMutation({
    mutationFn: async (password: string) => {
      // التحقق من كلمة السر
      if (password !== "01278006248m") {
        throw new Error("كلمة السر غير صحيحة");
      }

      // Delete in correct order to respect foreign keys
      await supabase.from("order_items").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("agent_payments").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("returns").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("orders").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("customers").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("delivery_agents").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      
      // Reset statistics
      await supabase.from("statistics").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("statistics").insert({
        total_sales: 0,
        total_orders: 0
      });
      
      // Reset order number sequence
      await supabase.rpc('reset_order_sequence');
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      setPassword("");
      setDialogOpen(false);
      toast.success("تم مسح جميع البيانات بنجاح - يمكنك البدء من جديد");
      navigate("/admin/dashboard");
    },
    onError: (error: any) => {
      console.error("Reset error:", error);
      if (error.message === "كلمة السر غير صحيحة") {
        toast.error("كلمة السر غير صحيحة");
      } else {
        toast.error("حدث خطأ أثناء مسح البيانات");
      }
    }
  });

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-4">
        <Button 
          variant="ghost" 
          onClick={() => navigate("/admin/dashboard")}
          className="mb-4"
        >
          <ArrowLeft className="ml-2 h-4 w-4" />
          العودة
        </Button>

        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">إعادة تعيين جميع البيانات</CardTitle>
            <CardDescription>
              تحذير: هذه العملية ستحذف جميع البيانات بشكل دائم ولا يمكن التراجع عنها
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-destructive/10 rounded-lg">
              <h3 className="font-semibold mb-2">سيتم حذف:</h3>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>جميع الطلبات وعناصرها</li>
                <li>جميع العملاء</li>
                <li>جميع المندوبين ومدفوعاتهم</li>
                <li>جميع المرتجعات</li>
                <li>إحصائيات المبيعات</li>
              </ul>
              <p className="mt-3 text-sm font-semibold">
                ترقيم الطلبات سيبدأ من رقم 1 مرة أخرى
              </p>
            </div>

            <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full">
                  <Trash2 className="ml-2 h-4 w-4" />
                  حذف جميع البيانات
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>إدخال كلمة السر</AlertDialogTitle>
                  <AlertDialogDescription>
                    هذه العملية لا يمكن التراجع عنها. سيتم حذف جميع البيانات بشكل دائم. يرجى إدخال كلمة السر للتأكيد.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="py-4">
                  <Label htmlFor="password">كلمة السر</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="أدخل كلمة السر"
                    className="mt-2"
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setPassword("")}>إلغاء</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => resetAllDataMutation.mutate(password)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    نعم، احذف كل شيء
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ResetData;
