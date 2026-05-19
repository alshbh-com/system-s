import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, PackageX } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { formatOrderItems, formatSizesDisplay } from "@/lib/formatOrderItems";
import { useAdminAuth } from "@/contexts/AdminAuthContext";

interface ReturnItem {
  product_id: string | null;
  product_name: string;
  total_quantity: number;
  returned_quantity: number;
  price: number;
}

const AllOrders = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canEdit } = useAdminAuth();
  const canEditAllOrders = canEdit('all_orders');
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [governorateFilter, setGovernorateFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [editingStatus, setEditingStatus] = useState<{orderId: string, currentStatus: string} | null>(null);
  
  // Partial return state
  const [partialReturnDialogOpen, setPartialReturnDialogOpen] = useState(false);
  const [selectedOrderForReturn, setSelectedOrderForReturn] = useState<any>(null);
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [returnNotes, setReturnNotes] = useState("");

  const { data: orders, isLoading } = useQuery({
    queryKey: ["all-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          customers (name, phone, phone2, address, governorate),
          delivery_agents (name, serial_number),
          order_items (
            *,
            products (name, price)
          )
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Real-time updates
  useEffect(() => {
    const channel = supabase
      .channel('all-orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        queryClient.invalidateQueries({ queryKey: ["all-orders"] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => {
        queryClient.invalidateQueries({ queryKey: ["all-orders"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const { data: governorates } = useQuery({
    queryKey: ["governorates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("governorates")
        .select("*")
        .order("name", { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });

  // Use the new formatting utility
  const getFormattedItems = (orderItems: any[]) => {
    if (!orderItems || orderItems.length === 0) return null;
    return formatOrderItems(orderItems);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-500",
      processing: "bg-blue-500",
      shipped: "bg-purple-500",
      delivered: "bg-green-500",
      cancelled: "bg-red-500",
      returned: "bg-orange-500",
      delivered_with_modification: "bg-teal-500",
      return_no_shipping: "bg-orange-400",
      agent_deleted: "bg-gray-600"
    };
    return colors[status] || "bg-gray-500";
  };

  const getStatusText = (status: string) => {
    const texts: Record<string, string> = {
      pending: "قيد الانتظار",
      processing: "قيد التنفيذ",
      shipped: "تم الشحن",
      delivered: "تم التوصيل",
      cancelled: "ملغي",
      returned: "مرتجع",
      delivered_with_modification: "تم التوصيل مع التعديل",
      return_no_shipping: "مرتجع دون شحن",
      agent_deleted: "مندوب محذوف"
    };
    return texts[status] || status;
  };

  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, newStatus }: { 
      orderId: string; 
      newStatus: string; 
    }) => {
      // Get the order first
      const order = orders?.find(o => o.id === orderId);

      // Helper: ensure a returns row exists when we mark an order as returned
      const upsertReturnsForFullReturn = async () => {
        if (!order) return;

        const returnItems = (order.order_items || []).map((item: any) => {
          const productName =
            item?.products?.name ||
            (() => {
              try {
                const d = item?.product_details ? JSON.parse(item.product_details) : null;
                return d?.name || d?.product_name;
              } catch {
                return null;
              }
            })() ||
            "منتج غير معروف";

          const qty = parseFloat((item?.quantity ?? 0).toString()) || 0;
          const price = parseFloat((item?.price ?? 0).toString()) || 0;
          return {
            product_id: item?.product_id ?? null,
            product_name: productName,
            quantity: qty,
            price,
          };
        });

        const returnAmount = returnItems.reduce(
          (sum: number, it: any) => sum + (parseFloat((it.quantity ?? 0).toString()) || 0) * (parseFloat((it.price ?? 0).toString()) || 0),
          0
        );

        const { data: existingReturn, error: existingErr } = await supabase
          .from("returns")
          .select("id")
          .eq("order_id", orderId)
          .maybeSingle();
        if (existingErr) throw existingErr;

        if (existingReturn?.id) {
          const { error: updErr } = await supabase
            .from("returns")
            .update({
              customer_id: order.customer_id,
              delivery_agent_id: order.delivery_agent_id,
              return_amount: returnAmount,
              returned_items: returnItems as any,
              notes: "مرتجع كامل",
            })
            .eq("id", existingReturn.id);
          if (updErr) throw updErr;
        } else {
          const { error: insErr } = await supabase.from("returns").insert({
            order_id: orderId,
            customer_id: order.customer_id,
            delivery_agent_id: order.delivery_agent_id,
            return_amount: returnAmount,
            returned_items: returnItems as any,
            notes: "مرتجع كامل",
          });
          if (insErr) throw insErr;
        }
      };
      
      // NOTE: agent_payments are handled automatically by DB triggers (handle_order_status_change)
      // We only need to upsert the returns record so the trigger handle_return_creation fires.
      if (newStatus === "returned" && order) {
        await upsertReturnsForFullReturn();
      }
      
      // If changing to pending or processing, unassign from agent so it goes back to Orders
      const updateData: any = { status: newStatus as any };
      if (newStatus === "pending" || newStatus === "processing") {
        updateData.delivery_agent_id = null;
        updateData.agent_shipping_cost = 0;
      }
      
      const { error } = await supabase
        .from("orders")
        .update(updateData)
        .eq("id", orderId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-orders"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["agent-orders"] });
      queryClient.invalidateQueries({ queryKey: ["all-agent-orders"] });
      queryClient.invalidateQueries({ queryKey: ["delivery_agents"] });
      queryClient.invalidateQueries({ queryKey: ["agent_payments"] });
      queryClient.invalidateQueries({ queryKey: ["agent_payments_full"] });
      queryClient.invalidateQueries({ queryKey: ["agent_payments_summary"] });
      queryClient.invalidateQueries({ queryKey: ["returns"] });
      queryClient.invalidateQueries({ queryKey: ["agent-returns"] });
      toast.success("تم تحديث حالة الأوردر بنجاح");
      setEditingStatus(null);
    },
    onError: (error) => {
      console.error("Error updating status:", error);
      toast.error("حدث خطأ أثناء تحديث الحالة");
    },
  });

  // Open partial return dialog
  const openPartialReturnDialog = (order: any) => {
    setSelectedOrderForReturn(order);
    const items: ReturnItem[] = order.order_items?.map((item: any) => ({
      product_id: item.product_id,
      product_name: item.products?.name || item.product_details ? JSON.parse(item.product_details)?.name : "منتج",
      total_quantity: item.quantity,
      returned_quantity: 0,
      price: parseFloat(item.price?.toString() || "0")
    })) || [];
    setReturnItems(items);
    setReturnNotes("");
    setPartialReturnDialogOpen(true);
    setEditingStatus(null);
  };

  // Handle partial return submission
  const partialReturnMutation = useMutation({
    mutationFn: async () => {
      if (!selectedOrderForReturn) throw new Error("No order selected");
      
      const returnedItems = returnItems.filter(item => item.returned_quantity > 0);
      if (returnedItems.length === 0) {
        throw new Error("يجب تحديد عناصر للإرجاع");
      }
      
      // Calculate return amount
      const returnAmount = returnedItems.reduce((sum, item) => {
        return sum + (item.returned_quantity * item.price);
      }, 0);
      
      // Check if it's a full return (all items returned)
      const totalItems = returnItems.reduce((sum, item) => sum + item.total_quantity, 0);
      const totalReturnedItems = returnItems.reduce((sum, item) => sum + item.returned_quantity, 0);
      const isFullReturn = totalItems === totalReturnedItems;
      
      // If there's an agent assigned, deduct from their owed amount and add to returns FIRST
      // (before updating order status which might trigger other logic)
      if (selectedOrderForReturn.delivery_agent_id) {
        // Get agent's current total_owed
        const { data: agent, error: agentFetchError } = await supabase
          .from("delivery_agents")
          .select("total_owed")
          .eq("id", selectedOrderForReturn.delivery_agent_id)
          .single();
        
        if (agentFetchError) throw agentFetchError;
        
        const currentOwed = parseFloat(agent?.total_owed?.toString() || "0");
        const newOwed = currentOwed - returnAmount;
        
        // Update agent's total_owed
        const { error: agentUpdateError } = await supabase
          .from("delivery_agents")
          .update({ total_owed: newOwed })
          .eq("id", selectedOrderForReturn.delivery_agent_id);
        
        if (agentUpdateError) throw agentUpdateError;
        
        // Create payment record for the return (negative amount to show in "باقي من المرتجع")
        // استخدم تاريخ تعيين الأوردر كـ payment_date
        const assignedDate = (selectedOrderForReturn as any).assigned_at 
          ? new Date((selectedOrderForReturn as any).assigned_at).toISOString().split('T')[0]
          : new Date(selectedOrderForReturn.created_at).toISOString().split('T')[0];
        
        const { error: paymentError } = await supabase
          .from("agent_payments")
          .insert({
            delivery_agent_id: selectedOrderForReturn.delivery_agent_id,
            order_id: selectedOrderForReturn.id,
            amount: -returnAmount,
            payment_type: 'return',
            payment_date: assignedDate,
            notes: `مرتجع جزئي - ${returnedItems.map(i => `${i.product_name} × ${i.returned_quantity} (${i.returned_quantity * i.price} ج.م)`).join(", ")}`
          });
        
        if (paymentError) throw paymentError;
      }
      
      // Create return record
      const { error: returnError } = await supabase
        .from("returns")
        .insert([{
          order_id: selectedOrderForReturn.id,
          customer_id: selectedOrderForReturn.customer_id,
          delivery_agent_id: selectedOrderForReturn.delivery_agent_id,
          return_amount: returnAmount,
          returned_items: returnedItems as any,
          notes: returnNotes
        }]);
      
      if (returnError) throw returnError;
      
      // Update order - use 'partially_returned' for partial returns
      const newTotalAmount = parseFloat(selectedOrderForReturn.total_amount?.toString() || "0") - returnAmount;
      const { error: orderError } = await supabase
        .from("orders")
        .update({ 
          status: isFullReturn ? 'returned' as any : 'delivered_with_modification' as any,
          total_amount: newTotalAmount,
          modified_amount: returnAmount
        })
        .eq("id", selectedOrderForReturn.id);
      
      if (orderError) throw orderError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-orders"] });
      queryClient.invalidateQueries({ queryKey: ["agent-orders"] });
      queryClient.invalidateQueries({ queryKey: ["delivery_agents"] });
      queryClient.invalidateQueries({ queryKey: ["agent_payments"] });
      queryClient.invalidateQueries({ queryKey: ["agent_payments_summary"] });
      queryClient.invalidateQueries({ queryKey: ["returns"] });
      toast.success("تم تسجيل المرتجع بنجاح");
      setPartialReturnDialogOpen(false);
      setSelectedOrderForReturn(null);
      setReturnItems([]);
      setReturnNotes("");
    },
    onError: (error: any) => {
      toast.error(error.message || "حدث خطأ أثناء تسجيل المرتجع");
    }
  });

  const updateReturnQuantity = (index: number, quantity: number) => {
    const maxQty = returnItems[index].total_quantity;
    const newQty = Math.min(Math.max(0, quantity), maxQty);
    setReturnItems(prev => prev.map((item, i) => 
      i === index ? { ...item, returned_quantity: newQty } : item
    ));
  };

  const calculateTotalReturn = () => {
    return returnItems.reduce((sum, item) => sum + (item.returned_quantity * item.price), 0);
  };

  const filteredOrders = orders?.filter(order => {
    if (statusFilter !== "all" && order.status !== statusFilter) return false;
    if (startDate || endDate) {
      const orderDate = new Date(order.created_at).toISOString().split('T')[0];
      if (startDate && orderDate < startDate) return false;
      if (endDate && orderDate > endDate) return false;
    }
    if (governorateFilter !== "all" && order.customers?.governorate !== governorateFilter) {
      return false;
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const orderNumber = order.order_number?.toString() || "";
      const customerName = order.customers?.name?.toLowerCase() || "";
      const customerPhone = order.customers?.phone || "";
      const customerPhone2 = (order.customers as any)?.phone2 || "";
      
      if (!orderNumber.includes(query) && 
          !customerName.includes(query) && 
          !customerPhone.includes(query) &&
          !customerPhone2.includes(query)) {
        return false;
      }
    }
    return true;
  });

  if (isLoading) {
    return <div className="p-8">جاري التحميل...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-accent/20 py-8">
      <div className="container mx-auto px-4">
        <Button onClick={() => navigate("/admin")} variant="ghost" className="mb-4">
          <ArrowLeft className="ml-2 h-4 w-4" />
          الرجوع إلى الصفحة الرئيسية
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>جميع الأوردرات</CardTitle>
            <div className="sticky top-16 z-10 bg-card pt-4 pb-2 flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">بحث:</span>
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="رقم الأوردر / الاسم / الهاتف"
                  className="w-64"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">فلتر حسب الحالة:</span>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="جميع الحالات" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الحالات</SelectItem>
                    <SelectItem value="pending">قيد الانتظار</SelectItem>
                    <SelectItem value="processing">قيد التنفيذ</SelectItem>
                    <SelectItem value="shipped">تم الشحن</SelectItem>
                    <SelectItem value="delivered">تم التوصيل</SelectItem>
                    <SelectItem value="cancelled">ملغي</SelectItem>
                    <SelectItem value="returned">مرتجع</SelectItem>
                    <SelectItem value="delivered_with_modification">تم التوصيل مع التعديل</SelectItem>
                    <SelectItem value="agent_deleted">مندوب محذوف</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">من تاريخ:</span>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-40"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">إلى تاريخ:</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-40"
                />
              </div>
              {(startDate || endDate) && (
                <Button size="sm" variant="ghost" onClick={() => {
                  setStartDate("");
                  setEndDate("");
                }}>
                  إلغاء
                </Button>
              )}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">فلتر حسب المحافظة:</span>
                <Select value={governorateFilter} onValueChange={setGovernorateFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="جميع المحافظات" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع المحافظات</SelectItem>
                    {governorates?.map((gov) => (
                      <SelectItem key={gov.id} value={gov.name}>
                        {gov.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {!filteredOrders || filteredOrders.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">لا توجد أوردرات</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>رقم الأوردر</TableHead>
                      <TableHead>المحافظة</TableHead>
                      <TableHead>الاسم</TableHead>
                      <TableHead>الهاتف</TableHead>
                      <TableHead>الهاتف الإضافي</TableHead>
                      <TableHead>العنوان</TableHead>
                      <TableHead>تفاصيل الأوردر</TableHead>
                      <TableHead>السعر النهائي</TableHead>
                      <TableHead>المندوب</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>الملاحظات</TableHead>
                      <TableHead>التاريخ</TableHead>
                      <TableHead>إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => {
                      const totalAmount = parseFloat(order.total_amount?.toString() || "0");
                      const discount = parseFloat(order.discount?.toString() || "0");
                      const shippingCost = parseFloat(order.shipping_cost?.toString() || "0");
                      const finalAmount = totalAmount + shippingCost;

                      return (
                        <TableRow key={order.id}>
                          <TableCell className="font-mono text-xs">
                            #{order.order_number || order.id.slice(0, 8)}
                          </TableCell>
                          <TableCell>{order.customers?.governorate || "-"}</TableCell>
                          <TableCell className="font-medium">{order.customers?.name}</TableCell>
                          <TableCell>{order.customers?.phone}</TableCell>
                          <TableCell>{(order.customers as any)?.phone2 || "-"}</TableCell>
                          <TableCell className="max-w-xs truncate">{order.customers?.address}</TableCell>
                          <TableCell className="max-w-xs">
                            {(() => {
                              const formattedItems = getFormattedItems(order.order_items);
                              if (formattedItems && formattedItems.length > 0) {
                                return (
                                  <div className="text-xs space-y-2">
                                    {formattedItems.map((item, idx) => (
                                      <div key={idx} className="bg-muted/50 p-2 rounded">
                                        <div className="font-medium">{item.name} × {item.totalQuantity}</div>
                                        <div className="text-muted-foreground mt-1 flex flex-wrap gap-2">
                                          <span className="bg-primary/10 px-2 py-0.5 rounded text-primary">
                                            {formatSizesDisplay(item.sizes)}
                                          </span>
                                          {item.color && (
                                            <span className="bg-secondary/50 px-2 py-0.5 rounded">
                                              لون: {item.color}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                );
                              }
                              // Fallback to order_details if no order_items
                              if (order.order_details) {
                                try {
                                  const parsed = JSON.parse(order.order_details);
                                  if (Array.isArray(parsed)) {
                                    return (
                                      <div className="text-xs space-y-1">
                                        {parsed.map((item: any, idx: number) => (
                                          <div key={idx} className="bg-muted/50 p-2 rounded">
                                            <div className="font-medium">{item.name} × {item.quantity}</div>
                                            {(item.size || item.color) && (
                                              <div className="text-muted-foreground mt-1 flex flex-wrap gap-2">
                                                {item.size && <span className="bg-primary/10 px-2 py-0.5 rounded text-primary">مقاس: {item.size}</span>}
                                                {item.color && <span className="bg-secondary/50 px-2 py-0.5 rounded">لون: {item.color}</span>}
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    );
                                  }
                                } catch (e) {
                                  return order.order_details;
                                }
                              }
                              return "-";
                            })()}
                          </TableCell>
                          <TableCell className="font-bold">
                            {finalAmount.toFixed(2)} ج.م
                          </TableCell>
                          <TableCell>
                            {order.delivery_agents ? (
                              <div>
                                <div className="font-medium">{order.delivery_agents.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  #{order.delivery_agents.serial_number}
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">غير معين</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {editingStatus?.orderId === order.id ? (
                              <Select
                                value={editingStatus.currentStatus}
                                onValueChange={(value) => setEditingStatus({ orderId: order.id, currentStatus: value })}
                              >
                                <SelectTrigger className="w-48">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pending">قيد الانتظار</SelectItem>
                                  <SelectItem value="processing">قيد التنفيذ</SelectItem>
                                  <SelectItem value="shipped">تم الشحن</SelectItem>
                                  <SelectItem value="delivered">تم التوصيل</SelectItem>
                                  <SelectItem value="cancelled">ملغي</SelectItem>
                                  <SelectItem value="returned">مرتجع</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge className={getStatusColor(order.status)}>
                                {getStatusText(order.status)}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="max-w-xs truncate">{order.notes || "-"}</TableCell>
                          <TableCell className="text-xs">
                            {new Date(order.created_at).toLocaleDateString("ar-EG")}
                          </TableCell>
                          {canEditAllOrders ? (
                          <TableCell>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                >
                                  تعديل الحالة
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>تعديل حالة الأوردر</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    اختر الحالة الجديدة للأوردر #{order.order_number || order.id.slice(0, 8)}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <div className="py-4">
                                  <Select
                                    value={editingStatus?.orderId === order.id ? editingStatus.currentStatus : order.status}
                                    onValueChange={(value) => setEditingStatus({ orderId: order.id, currentStatus: value })}
                                  >
                                    <SelectTrigger className="w-full">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="pending">قيد الانتظار</SelectItem>
                                      <SelectItem value="processing">قيد التنفيذ</SelectItem>
                                      <SelectItem value="shipped">تم الشحن</SelectItem>
                                      <SelectItem value="delivered">تم التوصيل</SelectItem>
                                      <SelectItem value="delivered_with_modification">تم التوصيل مع التعديل</SelectItem>
                                      <SelectItem value="cancelled">ملغي</SelectItem>
                                      <SelectItem value="returned">مرتجع</SelectItem>
                                      <SelectItem value="return_no_shipping">مرتجع دون شحن</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <AlertDialogFooter>
                                  <AlertDialogCancel onClick={() => setEditingStatus(null)}>إلغاء</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => {
                                    if (editingStatus) {
                                      updateStatusMutation.mutate({
                                        orderId: order.id,
                                        newStatus: editingStatus.currentStatus
                                      });
                                    }
                                  }}>
                                    حفظ
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                          ) : (
                          <TableCell>
                            <span className="text-xs text-muted-foreground">مشاهدة فقط</span>
                          </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Partial Return Dialog */}
        <Dialog open={partialReturnDialogOpen} onOpenChange={setPartialReturnDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <PackageX className="h-5 w-5 text-orange-500" />
                مرتجع جزئي - أوردر #{selectedOrderForReturn?.order_number || selectedOrderForReturn?.id?.slice(0, 8)}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="bg-muted/50 p-3 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  حدد عدد القطع المرتجعة لكل منتج. سيتم خصم قيمتها من المندوب تلقائياً.
                </p>
              </div>

              <div className="space-y-3 max-h-64 overflow-y-auto">
                {returnItems.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{item.product_name}</p>
                      <p className="text-xs text-muted-foreground">
                        الكمية الأصلية: {item.total_quantity} | السعر: {item.price.toFixed(2)} ج.م
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs">المرتجع:</Label>
                      <Input
                        type="number"
                        min={0}
                        max={item.total_quantity}
                        value={item.returned_quantity}
                        onChange={(e) => updateReturnQuantity(index, parseInt(e.target.value) || 0)}
                        className="w-20 text-center"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between items-center mb-3">
                  <span className="font-bold">إجمالي المرتجع:</span>
                  <span className="text-lg font-bold text-orange-600">
                    {calculateTotalReturn().toFixed(2)} ج.م
                  </span>
                </div>
                
                {selectedOrderForReturn?.delivery_agent_id && (
                  <p className="text-sm text-muted-foreground mb-3">
                    سيتم خصم هذا المبلغ من مستحقات المندوب: {selectedOrderForReturn?.delivery_agents?.name}
                  </p>
                )}
                
                <div>
                  <Label>ملاحظات (اختياري)</Label>
                  <Textarea
                    value={returnNotes}
                    onChange={(e) => setReturnNotes(e.target.value)}
                    placeholder="سبب الإرجاع أو ملاحظات إضافية"
                    rows={2}
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => setPartialReturnDialogOpen(false)}>
                إلغاء
              </Button>
              <Button 
                onClick={() => partialReturnMutation.mutate()}
                disabled={calculateTotalReturn() === 0 || partialReturnMutation.isPending}
                className="bg-orange-500 hover:bg-orange-600"
              >
                {partialReturnMutation.isPending ? "جاري التسجيل..." : "تأكيد المرتجع"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default AllOrders;
