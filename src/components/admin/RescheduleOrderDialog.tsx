import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ArrowDown } from "lucide-react";
import { toast } from "sonner";

interface RescheduleOrderDialogProps {
  order: any;
  onSuccess?: () => void;
}

const RescheduleOrderDialog = ({ order, onSuccess }: RescheduleOrderDialogProps) => {
  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const queryClient = useQueryClient();

  // Get date in Cairo timezone
  const getDateKey = (value: string | Date) => {
    const d = typeof value === "string" ? new Date(value) : value;
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Cairo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  };

  const today = getDateKey(new Date());
  const orderAssignedAt = order?.assigned_at || order?.created_at;
  const orderDate = orderAssignedAt ? getDateKey(orderAssignedAt) : today;

  // Generate dates from order assignment date to today
  const generateDateOptions = () => {
    const options: { value: string; label: string }[] = [];
    const start = new Date(orderDate);
    const end = new Date(today);

    while (start <= end) {
      const dateKey = getDateKey(start);
      const isToday = dateKey === today;
      const isOriginal = dateKey === orderDate;

      let label = new Intl.DateTimeFormat("ar-EG", {
        weekday: "short",
        day: "numeric",
        month: "short",
      }).format(start);

      if (isToday) label = `اليوم (${label})`;
      if (isOriginal) label = `${label} (التاريخ الأصلي)`;

      options.push({ value: dateKey, label });
      start.setDate(start.getDate() + 1);
    }

    // Reverse to show most recent first
    return options.reverse();
  };

  const dateOptions = generateDateOptions();

  const rescheduleMutation = useMutation({
    mutationFn: async (newDate: string) => {
      if (!order?.id) throw new Error("Order not found");
      if (!order?.delivery_agent_id) throw new Error("لا يوجد مندوب معين");

      // Create new timestamp for the selected date (keep the time, change the date)
      const originalAssigned = new Date(orderAssignedAt);
      const [year, month, day] = newDate.split("-").map(Number);
      const newAssignedAt = new Date(
        year,
        month - 1,
        day,
        originalAssigned.getHours(),
        originalAssigned.getMinutes(),
        originalAssigned.getSeconds()
      );

      // 1. Update order's assigned_at
      const { error: orderError } = await supabase
        .from("orders")
        .update({ assigned_at: newAssignedAt.toISOString() })
        .eq("id", order.id);

      if (orderError) throw orderError;

      // 2. Update all related agent_payments to the new date
      const { error: paymentsError } = await supabase
        .from("agent_payments")
        .update({ payment_date: newDate })
        .eq("order_id", order.id);

      if (paymentsError) throw paymentsError;

      // 3. If there's a return record, update its created_at to reflect the new date
      const { data: returnRecord } = await supabase
        .from("returns")
        .select("id")
        .eq("order_id", order.id)
        .maybeSingle();

      if (returnRecord?.id) {
        // We don't change created_at for returns, but the summary uses orders.assigned_at
        // which we already updated, so returns will automatically be attributed to the new date
      }

      return { newDate };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["agent-orders"] });
      queryClient.invalidateQueries({ queryKey: ["all-agent-orders"] });
      queryClient.invalidateQueries({ queryKey: ["agent_payments_full"] });
      queryClient.invalidateQueries({ queryKey: ["agent-returns"] });
      queryClient.invalidateQueries({ queryKey: ["returns"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success(`تم نقل الأوردر ليوم ${data.newDate}`);
      setOpen(false);
      setSelectedDate("");
      onSuccess?.();
    },
    onError: (error: any) => {
      console.error("Reschedule error:", error);
      toast.error(error?.message || "حدث خطأ أثناء نقل الأوردر");
    },
  });

  const handleReschedule = () => {
    if (!selectedDate) {
      toast.error("يرجى اختيار تاريخ");
      return;
    }
    if (selectedDate === orderDate) {
      toast.error("الأوردر موجود بالفعل في هذا التاريخ");
      return;
    }
    rescheduleMutation.mutate(selectedDate);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ArrowDown className="ml-2 h-4 w-4" />
          نزول
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>نقل الأوردر لتاريخ آخر</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="bg-muted p-3 rounded-lg text-sm space-y-1">
            <p>
              <strong>رقم الأوردر:</strong> #{order?.order_number || order?.id?.slice(0, 8)}
            </p>
            <p>
              <strong>التاريخ الحالي:</strong> {orderDate}
            </p>
            <p>
              <strong>الصافي:</strong>{" "}
              {(
                parseFloat(order?.total_amount || 0) +
                parseFloat(order?.shipping_cost || 0) -
                parseFloat(order?.agent_shipping_cost || 0)
              ).toFixed(2)}{" "}
              ج.م
            </p>
          </div>

          <div>
            <Label className="mb-2 block">اختر التاريخ الجديد</Label>
            <Select value={selectedDate} onValueChange={setSelectedDate}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="اختر تاريخ..." />
              </SelectTrigger>
              <SelectContent>
                {dateOptions
                  .filter((opt) => opt.value !== orderDate) // Exclude current date
                  .map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleReschedule}
              disabled={!selectedDate || rescheduleMutation.isPending}
              className="flex-1"
            >
              {rescheduleMutation.isPending ? "جاري النقل..." : "تأكيد النقل"}
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)}>
              إلغاء
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RescheduleOrderDialog;
