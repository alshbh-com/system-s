import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { STATUS_OPTIONS } from "@/lib/barcodeUtils";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { Truck, UserMinus, Printer, FileSpreadsheet, FileText, RefreshCw, Tag, DollarSign } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import { generateBarcodeDataUrl } from "@/lib/barcodeUtils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orders: any[];
  agents: any[];
  onActionDone: () => void;
}

const getCairoDateKey = (value: string | Date) => {
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
};

const BulkActionsDialog = ({ open, onOpenChange, orders, agents, onActionDone }: Props) => {
  const { currentUser } = useAdminAuth();
  const [status, setStatus] = useState<string>("");
  const [statusDate, setStatusDate] = useState<string>(getCairoDateKey(new Date()));
  const [agentId, setAgentId] = useState<string>("");
  const [shippingValue, setShippingValue] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const ids = orders.map((o) => o.id);

  const logBulk = async (action: string, newValue?: string) => {
    const rows = ids.map((id) => ({
      user_id: currentUser?.id || null,
      username: currentUser?.username || "نظام",
      order_id: id,
      action,
      new_value: newValue || null,
    }));
    if (rows.length) await supabase.from("scan_logs").insert(rows);
  };

  const applyStatus = async () => {
    if (!status) return toast.error("اختر الحالة");
    setBusy(true);
    try {
      const today = getCairoDateKey(new Date());
      const shouldShiftDate = !!statusDate && statusDate !== today;
      const [ty, tm, td] = statusDate.split("-").map(Number);

      // If admin picked a different date (e.g. the trip's outing day),
      // shift each order's assigned_at to that day (preserving the time),
      // so agent daily reports/returns land on the correct day.
      if (shouldShiftDate) {
        for (const o of orders) {
          const original = new Date(o.assigned_at || o.created_at || new Date());
          const shifted = new Date(
            ty, tm - 1, td,
            original.getHours(), original.getMinutes(), original.getSeconds()
          );
          const iso = shifted.toISOString();
          await supabase.from("orders").update({ assigned_at: iso }).eq("id", o.id);
          // Keep any non-return agent_payments on the same day
          await supabase
            .from("agent_payments")
            .update({ payment_date: statusDate })
            .eq("order_id", o.id)
            .neq("payment_type", "return");
        }
      }

      // Auto-create return records when scanning to a return status, so the
      // agent summary picks it up (mirrors AgentOrders.updateStatusMutation).
      if (status === "returned" || status === "return_no_shipping") {
        // Anchor return created_at to the chosen date at noon so it lands on
        // the outing day in reports keyed by created_at.
        const returnCreatedAt = shouldShiftDate
          ? new Date(ty, tm - 1, td, 12, 0, 0).toISOString()
          : null;

        for (const o of orders) {
          const returnItems = (o.order_items || []).map((item: any) => {
            let productName = item?.products?.name;
            if (!productName && item?.product_details) {
              try {
                const d = typeof item.product_details === "string" ? JSON.parse(item.product_details) : item.product_details;
                productName = d?.name || d?.product_name;
              } catch { /* noop */ }
            }
            const qty = parseFloat((item?.quantity ?? 0).toString()) || 0;
            const price = parseFloat((item?.price ?? 0).toString()) || 0;
            return { product_id: item?.product_id ?? null, product_name: productName || "منتج غير معروف", quantity: qty, price };
          });
          const returnAmount = returnItems.reduce((s: number, it: any) => s + it.quantity * it.price, 0);
          const shippingDeduction = parseFloat((o.agent_shipping_cost ?? 0).toString()) || 0;

          const { data: existing } = await supabase.from("returns").select("id").eq("order_id", o.id).maybeSingle();
          if (existing?.id) {
            const updatePayload: any = {
              customer_id: o.customer_id,
              delivery_agent_id: o.delivery_agent_id,
              return_amount: returnAmount,
              shipping_deduction: shippingDeduction,
              returned_items: returnItems as any,
            };
            if (returnCreatedAt) updatePayload.created_at = returnCreatedAt;
            await supabase.from("returns").update(updatePayload).eq("id", existing.id);
          } else {
            const insertPayload: any = {
              order_id: o.id,
              customer_id: o.customer_id,
              delivery_agent_id: o.delivery_agent_id,
              return_amount: returnAmount,
              shipping_deduction: shippingDeduction,
              returned_items: returnItems as any,
              notes: "مرتجع عبر الباركود سكانر",
            };
            if (returnCreatedAt) insertPayload.created_at = returnCreatedAt;
            await supabase.from("returns").insert(insertPayload);
          }
        }
      }

      const { error } = await supabase.from("orders").update({ status: status as any }).in("id", ids);
      if (error) throw error;
      await logBulk("status_change", status);
      toast.success(
        shouldShiftDate
          ? `تم تحديث ${ids.length} أوردر وتسجيلها بتاريخ ${statusDate}`
          : `تم تغيير حالة ${ids.length} أوردر`
      );
      onActionDone();
    } catch (e: any) {
      toast.error("خطأ: " + (e?.message || e));
    } finally {
      setBusy(false);
    }
  };


  const assignAgent = async () => {
    if (!agentId) return toast.error("اختر المندوب");
    setBusy(true);
    // Set assigned_at = now so agent reports (which key off assigned_at) pick these up immediately
    const { error } = await supabase
      .from("orders")
      .update({ delivery_agent_id: agentId, assigned_at: new Date().toISOString() })
      .in("id", ids);
    setBusy(false);
    if (error) return toast.error("خطأ: " + error.message);
    await logBulk("assign_agent", agentId);
    toast.success(`تم تعيين المندوب لـ ${ids.length} أوردر`);
    onActionDone();
  };

  const unassignAgent = async () => {
    setBusy(true);
    const { error } = await supabase.from("orders").update({ delivery_agent_id: null, status: "pending" as any }).in("id", ids);
    setBusy(false);
    if (error) return toast.error("خطأ: " + error.message);
    await logBulk("unassign_agent");
    toast.success("تم إلغاء التعيين");
    onActionDone();
  };

  const applyShipping = async () => {
    const val = parseFloat(shippingValue);
    if (isNaN(val) || val < 0) return toast.error("أدخل قيمة شحن صحيحة");
    setBusy(true);
    const { error } = await supabase.from("orders").update({ agent_shipping_cost: val }).in("id", ids);
    setBusy(false);
    if (error) return toast.error("خطأ: " + error.message);
    await logBulk("shipping_update", String(val));
    toast.success(`تم تعديل شحن المندوب لـ ${ids.length} أوردر`);
    onActionDone();
  };

  const exportExcel = () => {
    const data = orders.map((o) => ({
      "رقم الأوردر": o.order_number || o.id.slice(0, 8),
      "كود التتبع": o.tracking_code || "",
      "العميل": o.customers?.name || "",
      "الهاتف": o.customers?.phone || "",
      "المحافظة": o.governorates?.name || o.customers?.governorate || "",
      "العنوان": o.customers?.address || "",
      "المندوب": o.delivery_agents?.name || "",
      "الحالة": o.status,
      "الإجمالي": parseFloat(o.total_amount || 0) + parseFloat(o.shipping_cost || 0),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "scanned");
    XLSX.writeFile(wb, `scan_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const exportPdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Scanned Orders Report", 14, 20);
    doc.setFontSize(10);
    let y = 32;
    orders.forEach((o, i) => {
      const total = parseFloat(o.total_amount || 0) + parseFloat(o.shipping_cost || 0);
      doc.text(
        `${i + 1}. #${o.order_number || ""} | ${o.tracking_code || ""} | ${o.customers?.name || ""} | ${total.toFixed(0)} EGP`,
        14, y
      );
      y += 7;
      if (y > 280) { doc.addPage(); y = 20; }
    });
    doc.save(`scan_${new Date().toISOString().split("T")[0]}.pdf`);
  };

  const printBarcodes = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    const cells = orders.map((o) => {
      const code = o.tracking_code || `ORD-${o.order_number}`;
      const url = generateBarcodeDataUrl(code, { width: 2, height: 60, fontSize: 14 });
      return `<div class="lbl">
        <div style="font-weight:bold;font-size:13px;margin-bottom:2px">#${o.order_number || ""}</div>
        <img src="${url}" style="max-width:100%"/>
        <div style="font-size:10px;margin-top:2px">${o.customers?.name || ""}</div>
      </div>`;
    }).join("");
    w.document.write(`<html dir="rtl"><head><title>Barcodes</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box;font-family:Arial}
        body{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;padding:8px}
        .lbl{border:1px dashed #999;padding:8px;text-align:center;page-break-inside:avoid}
        @page{margin:8mm}
      </style></head><body>${cells}</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 200);
  };

  const printInvoices = () => {
    // Open invoices page with selection — fallback: encode ids into URL hash
    const idsParam = ids.join(",");
    window.open(`/admin/invoices?ids=${encodeURIComponent(idsParam)}`, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>الأوامر الجماعية ({orders.length} أوردر)</DialogTitle>
          <DialogDescription>طبّق إجراءً واحداً على كل الأوردرات التي تم اسكانها.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* تغيير الحالة */}
          <div className="border rounded-lg p-4 space-y-3">
            <Label className="flex items-center gap-2 font-bold"><RefreshCw className="h-4 w-4" /> تغيير الحالة</Label>
            <div className="flex gap-2">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue placeholder="اختر الحالة الجديدة" /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={applyStatus} disabled={busy || !status}>تطبيق</Button>
            </div>
            <div>
              <Label className="text-xs mb-1 block">
                تاريخ تسجيل الحركة (اختر يوم النزول الأصلي للمرتجعات)
              </Label>
              <Input
                type="date"
                value={statusDate}
                max={getCairoDateKey(new Date())}
                onChange={(e) => setStatusDate(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                لو التاريخ مختلف عن اليوم، هيتم نقل الأوردرات وتسجيل المرتجع بتاريخ الرحلة الأصلية.
              </p>
            </div>
          </div>


          {/* تعيين مندوب */}
          <div className="border rounded-lg p-4 space-y-3">
            <Label className="flex items-center gap-2 font-bold"><Truck className="h-4 w-4" /> تعيين مندوب</Label>
            <div className="flex gap-2">
              <Select value={agentId} onValueChange={setAgentId}>
                <SelectTrigger><SelectValue placeholder="اختر المندوب" /></SelectTrigger>
                <SelectContent>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={assignAgent} disabled={busy || !agentId}>تعيين</Button>
              <Button onClick={unassignAgent} disabled={busy} variant="outline">
                <UserMinus className="h-4 w-4 ml-1" /> إزالة
              </Button>
            </div>
          </div>

          {/* تعديل شحن المندوب */}
          <div className="border rounded-lg p-4 space-y-3">
            <Label className="flex items-center gap-2 font-bold"><DollarSign className="h-4 w-4" /> تعديل شحن المندوب</Label>
            <p className="text-xs text-muted-foreground">يتم تطبيق نفس القيمة على كل الأوردرات الممسوحة</p>
            <div className="flex gap-2">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={shippingValue}
                onChange={(e) => setShippingValue(e.target.value)}
                placeholder="قيمة الشحن (ج.م)"
              />
              <Button onClick={applyShipping} disabled={busy || !shippingValue}>تطبيق</Button>
            </div>
          </div>


          {/* الطباعة والتصدير */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Button variant="outline" onClick={printInvoices}><Printer className="h-4 w-4 ml-1" /> فواتير</Button>
            <Button variant="outline" onClick={printBarcodes}><Tag className="h-4 w-4 ml-1" /> باركود</Button>
            <Button variant="outline" onClick={exportExcel}><FileSpreadsheet className="h-4 w-4 ml-1" /> Excel</Button>
            <Button variant="outline" onClick={exportPdf}><FileText className="h-4 w-4 ml-1" /> PDF</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BulkActionsDialog;
