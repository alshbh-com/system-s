import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

interface Props {
  order: any;
  onSuccess?: () => void;
}

interface ItemRow {
  id?: string; // existing order_items.id
  product_id?: string | null;
  name: string;
  size: string;
  color: string;
  quantity: number;
  price: number;
}

const EditOrderDialog = ({ order, onSuccess }: Props) => {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [governorateId, setGovernorateId] = useState<string>("");
  const [shippingCost, setShippingCost] = useState<number>(0);
  const [agentShippingCost, setAgentShippingCost] = useState<number>(0);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ItemRow[]>([]);

  const { data: governorates } = useQuery({
    queryKey: ["governorates-edit"],
    queryFn: async () => {
      const { data } = await supabase.from("governorates").select("id, name, shipping_cost, agent_shipping_cost").order("name");
      return data || [];
    },
    enabled: open,
  });

  // Load order details when opening
  useEffect(() => {
    if (!open || !order?.id) return;
    setCustomerName(order.customers?.name || "");
    setCustomerPhone(order.customers?.phone || "");
    setCustomerAddress(order.customers?.address || "");
    setGovernorateId(order.governorate_id || "");
    setShippingCost(parseFloat(order.shipping_cost ?? 0) || 0);
    setAgentShippingCost(parseFloat(order.agent_shipping_cost ?? 0) || 0);
    setNotes(order.notes || "");

    // Hydrate items from order_items (preferred) else order_details JSON
    (async () => {
      const { data: oi } = await supabase
        .from("order_items")
        .select("id, product_id, quantity, price, size, color, product_details, products(name)")
        .eq("order_id", order.id);
      if (oi && oi.length > 0) {
        setItems(
          oi.map((it: any) => {
            let name = it.products?.name || "";
            if (!name && it.product_details) {
              try {
                const d = typeof it.product_details === "string" ? JSON.parse(it.product_details) : it.product_details;
                name = d?.name || d?.product_name || "منتج";
              } catch { name = "منتج"; }
            }
            return {
              id: it.id,
              product_id: it.product_id ?? null,
              name: name || "منتج",
              size: it.size || "",
              color: it.color || "",
              quantity: parseInt(it.quantity ?? 1) || 1,
              price: parseFloat(it.price ?? 0) || 0,
            };
          })
        );
      } else if (order.order_details) {
        try {
          const parsed = typeof order.order_details === "string" ? JSON.parse(order.order_details) : order.order_details;
          if (Array.isArray(parsed)) {
            setItems(parsed.map((p: any) => ({
              name: p.name || "منتج",
              size: p.size || "",
              color: p.color || "",
              quantity: parseInt(p.quantity ?? 1) || 1,
              price: parseFloat(p.price ?? 0) || 0,
            })));
          } else {
            setItems([]);
          }
        } catch { setItems([]); }
      } else {
        setItems([]);
      }
    })();
  }, [open, order?.id]);

  const addItem = () => setItems((p) => [...p, { name: "", size: "", color: "", quantity: 1, price: 0 }]);
  const removeItem = (idx: number) => setItems((p) => p.filter((_, i) => i !== idx));
  const updateItem = (idx: number, patch: Partial<ItemRow>) =>
    setItems((p) => p.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const totalAmount = items.reduce((s, it) => s + (it.price || 0) * (it.quantity || 0), 0);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!order?.id) throw new Error("Order not found");
      if (!customerPhone.trim()) throw new Error("رقم الهاتف مطلوب");
      if (items.length === 0) throw new Error("يجب وجود منتج واحد على الأقل");

      const selectedGov = governorates?.find((g: any) => g.id === governorateId);

      // Update customer (phone is unique identifier)
      if (order.customer_id) {
        await supabase
          .from("customers")
          .update({
            name: customerName || "عميل",
            phone: customerPhone,
            address: customerAddress || "غير محدد",
            governorate: selectedGov?.name || null,
          })
          .eq("id", order.customer_id);
      }

      // Update order
      await supabase
        .from("orders")
        .update({
          total_amount: totalAmount,
          shipping_cost: shippingCost,
          agent_shipping_cost: agentShippingCost,
          governorate_id: governorateId || null,
          notes: notes || null,
          order_details: JSON.stringify(
            items.map((it) => ({
              name: it.name, quantity: it.quantity, price: it.price,
              size: it.size || null, color: it.color || null,
            }))
          ),
        })
        .eq("id", order.id);

      // Sync order_items: delete all then re-insert (simpler & reliable)
      await supabase.from("order_items").delete().eq("order_id", order.id);
      const newRows = items.map((it) => ({
        order_id: order.id,
        product_id: it.product_id ?? null,
        quantity: it.quantity,
        price: it.price,
        size: it.size || null,
        color: it.color || null,
        product_details: JSON.stringify({
          name: it.name, price: it.price,
          size: it.size || null, color: it.color || null,
        }),
      }));
      if (newRows.length) {
        const { error } = await supabase.from("order_items").insert(newRows as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["all-orders"] });
      qc.invalidateQueries({ queryKey: ["agent-orders"] });
      qc.invalidateQueries({ queryKey: ["all-agent-orders"] });
      toast.success("تم تعديل الأوردر");
      setOpen(false);
      onSuccess?.();
    },
    onError: (e: any) => toast.error(e?.message || "خطأ في التعديل"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="h-4 w-4 ml-1" /> تعديل
      </Button>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>تعديل الأوردر #{order?.order_number || order?.id?.slice(0, 8)}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Customer */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 border rounded p-3">
            <div>
              <Label>اسم العميل</Label>
              <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            </div>
            <div>
              <Label>الهاتف</Label>
              <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
            </div>
            <div>
              <Label>العنوان</Label>
              <Input value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} />
            </div>
          </div>

          {/* Governorate + shipping */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 border rounded p-3">
            <div>
              <Label>المحافظة</Label>
              <Select
                value={governorateId}
                onValueChange={(v) => {
                  setGovernorateId(v);
                  const g = governorates?.find((x: any) => x.id === v);
                  if (g) {
                    setShippingCost(parseFloat(g.shipping_cost ?? 0) || 0);
                    if (order?.delivery_agent_id) {
                      setAgentShippingCost(parseFloat(g.agent_shipping_cost ?? 0) || 0);
                    }
                  }
                }}
              >
                <SelectTrigger><SelectValue placeholder="اختر المحافظة" /></SelectTrigger>
                <SelectContent>
                  {governorates?.map((g: any) => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>شحن العميل</Label>
              <Input type="number" value={shippingCost} onChange={(e) => setShippingCost(parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <Label>شحن المندوب</Label>
              <Input type="number" value={agentShippingCost} onChange={(e) => setAgentShippingCost(parseFloat(e.target.value) || 0)} />
            </div>
          </div>

          {/* Items */}
          <div className="border rounded p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="font-bold">المنتجات</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4 ml-1" /> إضافة منتج
              </Button>
            </div>
            {items.map((it, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-end border-b pb-2">
                <div className="col-span-12 md:col-span-4">
                  <Label className="text-xs">اسم المنتج</Label>
                  <Input value={it.name} onChange={(e) => updateItem(idx, { name: e.target.value })} />
                </div>
                <div className="col-span-4 md:col-span-2">
                  <Label className="text-xs">المقاس</Label>
                  <Input value={it.size} onChange={(e) => updateItem(idx, { size: e.target.value })} />
                </div>
                <div className="col-span-4 md:col-span-2">
                  <Label className="text-xs">اللون</Label>
                  <Input value={it.color} onChange={(e) => updateItem(idx, { color: e.target.value })} />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <Label className="text-xs">الكمية</Label>
                  <Input type="number" min={1} value={it.quantity} onChange={(e) => updateItem(idx, { quantity: parseInt(e.target.value) || 1 })} />
                </div>
                <div className="col-span-2 md:col-span-2">
                  <Label className="text-xs">السعر</Label>
                  <Input type="number" value={it.price} onChange={(e) => updateItem(idx, { price: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="col-span-12 md:col-span-1">
                  <Button type="button" variant="destructive" size="sm" onClick={() => removeItem(idx)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {items.length === 0 && <p className="text-sm text-muted-foreground">لا توجد منتجات. اضغط إضافة منتج.</p>}
          </div>

          {/* Totals + notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="border rounded p-3 space-y-2">
              <div className="flex justify-between"><span>إجمالي المنتجات:</span><strong>{totalAmount.toFixed(2)} ج.م</strong></div>
              <div className="flex justify-between"><span>+ شحن العميل:</span><strong>{shippingCost.toFixed(2)} ج.م</strong></div>
              <div className="flex justify-between border-t pt-2"><span>الإجمالي النهائي:</span><strong>{(totalAmount + shippingCost).toFixed(2)} ج.م</strong></div>
            </div>
            <div>
              <Label>الملاحظات</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="flex-1">
              {saveMutation.isPending ? "جاري الحفظ..." : "حفظ التعديلات"}
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditOrderDialog;
