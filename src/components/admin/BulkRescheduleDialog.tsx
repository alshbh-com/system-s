import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ArrowDown } from "lucide-react";
import { toast } from "sonner";

interface BulkRescheduleDialogProps {
  orders: any[];
  onSuccess?: () => void;
}

const getDateKey = (value: string | Date) => {
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
};

const BulkRescheduleDialog = ({ orders, onSuccess }: BulkRescheduleDialogProps) => {
  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const queryClient = useQueryClient();

  const today = getDateKey(new Date());

  // Build date options from earliest assigned_at to today
  const dateOptions = useMemo(() => {
    if (!orders.length) return [];
    const earliest = orders.reduce((min, o) => {
      const d = o.assigned_at || o.created_at;
      return !min || new Date(d) < new Date(min) ? d : min;
    }, null as string | null);
    if (!earliest) return [];

    const options: { value: string; label: string }[] = [];
    const start = new Date(getDateKey(earliest));
    const end = new Date(today);
    while (start <= end) {
      const dateKey = getDateKey(start);
      const isToday = dateKey === today;
      let label = new Intl.DateTimeFormat("ar-EG", {
        weekday: "short",
        day: "numeric",
        month: "short",
      }).format(start);
      if (isToday) label = `اليوم (${label})`;
      options.push({ value: dateKey, label });
      start.setDate(start.getDate() + 1);
    }
    return options.reverse();
  }, [orders, today]);

  const mutation = useMutation({
    mutationFn: async (newDate: string) => {
      const [year, month, day] = newDate.split("-").map(Number);

      for (const order of orders) {
        if (!order.delivery_agent_id) continue;
        const originalAssigned = new Date(order.assigned_at || order.created_at);
        const newAssignedAt = new Date(
          year,
          month - 1,
          day,
          originalAssigned.getHours(),
          originalAssigned.getMinutes(),
          originalAssigned.getSeconds()
        );

        const { error: orderError } = await supabase
          .from("orders")
          .update({ assigned_at: newAssignedAt.toISOString() })
          .eq("id", order.id);
        if (orderError) throw orderError;

        const { error: paymentsError } = await supabase
          .from("agent_payments")
          .update({ payment_date: newDate })
          .eq("order_id", order.id);
        if (paymentsError) throw paymentsError;
      }
      return { count: orders.length, newDate };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["agent-orders"] });
      queryClient.invalidateQueries({ queryKey: ["all-agent-orders"] });
      queryClient.invalidateQueries({ queryKey: ["agent_payments_full"] });
      queryClient.invalidateQueries({ queryKey: ["agent-returns"] });
      queryClient.invalidateQueries({ queryKey: ["returns"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success(`تم نقل ${data.count} أوردر ليوم ${data.newDate}`);
      setOpen(false);
      setSelectedDate("");
      onSuccess?.();
    },
    onError: (error: any) => {
      console.error("Bulk reschedule error:", error);
      toast.error(error?.message || "حدث خطأ أثناء النقل");
    },
  });

  const handleReschedule = () => {
    if (!selectedDate) {
      toast.error("يرجى اختيار تاريخ");
      return;
    }
    if (orders.length === 0) {
      toast.error("لم يتم اختيار أي أوردر");
      return;
    }
    mutation.mutate(selectedDate);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <ArrowDown className="ml-2 h-4 w-4" />
          نزول جماعي
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>نقل {orders.length} أوردر لتاريخ آخر</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="bg-muted p-3 rounded-lg text-sm">
            <p>سيتم نقل <strong>{orders.length}</strong> أوردر محدد إلى التاريخ الذي تختاره.</p>
          </div>

          <div>
            <Label className="mb-2 block">اختر التاريخ الجديد</Label>
            <Select value={selectedDate} onValueChange={setSelectedDate}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="اختر تاريخ..." />
              </SelectTrigger>
              <SelectContent>
                {dateOptions.map((option) => (
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
              disabled={!selectedDate || mutation.isPending}
              className="flex-1"
            >
              {mutation.isPending ? "جاري النقل..." : "تأكيد النقل"}
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

export default BulkRescheduleDialog;
