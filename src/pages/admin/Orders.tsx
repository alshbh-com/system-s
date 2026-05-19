import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, UserCheck, Printer, Download, Barcode, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import * as XLSX from 'xlsx';
import { formatOrderItems, formatSizesDisplay } from "@/lib/formatOrderItems";
import { useAdminAuth } from "@/contexts/AdminAuthContext";

const Orders = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canEdit } = useAdminAuth();
  const canEditOrders = canEdit('orders');
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [bulkAgentId, setBulkAgentId] = useState<string>("");
  const [bulkShippingCost, setBulkShippingCost] = useState<number>(0);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [governorateFilter, setGovernorateFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [barcodeDialogOpen, setBarcodeDialogOpen] = useState(false);
  const [barcodeOrders, setBarcodeOrders] = useState<string[]>([""]);
  const [officeName, setOfficeName] = useState<string>("");
  const [editingNotes, setEditingNotes] = useState<{ [key: string]: string }>({});
  const [manualOrderDialogOpen, setManualOrderDialogOpen] = useState(false);
  const [manualOrder, setManualOrder] = useState({
    customerName: "",
    phone: "",
    address: "",
    productName: "",
    productPrice: "",
    productSize: "",
    productColor: "",
    productQuantity: "1",
    shippingCost: "",
    governorateId: ""
  });

  const { data: orders, isLoading } = useQuery({
    queryKey: ["orders"],
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
        .is("delivery_agent_id", null)
        .not("status", "in", '("returned","cancelled","return_no_shipping")')
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Real-time updates
  useEffect(() => {
    const channel = supabase
      .channel('orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        queryClient.invalidateQueries({ queryKey: ["orders"] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => {
        queryClient.invalidateQueries({ queryKey: ["orders"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const { data: agents } = useQuery({
    queryKey: ["delivery_agents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_agents")
        .select("*");
      
      if (error) throw error;
      return data;
    },
  });

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

  const bulkAssignMutation = useMutation({
    mutationFn: async ({ orderIds, agentId, shippingCost }: { orderIds: string[]; agentId: string; shippingCost: number }) => {
      // Get orders with their governorate to auto-set shipping if not specified
      for (const orderId of orderIds) {
        const order = orders?.find(o => o.id === orderId);
        let finalShippingCost = shippingCost;
        
        // Always use governorate shipping cost if available and user didn't specify
        if (shippingCost === 0 && order?.governorate_id) {
          const gov = governorates?.find(g => g.id === order.governorate_id);
          if (gov) {
            finalShippingCost = parseFloat(gov.shipping_cost?.toString() || "0");
          }
        }
        
        const { error } = await supabase
          .from("orders")
          .update({ 
            delivery_agent_id: agentId,
            agent_shipping_cost: finalShippingCost,
            status: 'shipped',
            assigned_at: new Date().toISOString()
          })
          .eq("id", orderId);
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["all-orders"] });
      queryClient.invalidateQueries({ queryKey: ["agent-orders"] });
      toast.success("تم تعيين المندوب لجميع الأوردرات المحددة وتغيير الحالة إلى تم الشحن");
      setSelectedOrders([]);
      setBulkAgentId("");
      setBulkShippingCost(0);
    },
  });

  const assignByBarcodeMutation = useMutation({
    mutationFn: async ({ orderNumbers, agentId, shippingCost }: { orderNumbers: string[]; agentId: string; shippingCost: number }) => {
      const orderNumbersAsInt = orderNumbers.map(n => parseInt(n, 10)).filter(n => !isNaN(n));
      
      const { data: ordersToAssign, error: fetchError } = await supabase
        .from("orders")
        .select("id, governorate_id")
        .in("order_number", orderNumbersAsInt);
      
      if (fetchError) throw fetchError;
      
      // Assign each order with its own governorate shipping cost
      for (const orderToAssign of ordersToAssign) {
        let finalShippingCost = shippingCost;
        if (shippingCost === 0 && orderToAssign.governorate_id) {
          const gov = governorates?.find(g => g.id === orderToAssign.governorate_id);
          if (gov) {
            finalShippingCost = parseFloat(gov.shipping_cost?.toString() || "0");
          }
        }
        
        const { error } = await supabase
          .from("orders")
          .update({ 
            delivery_agent_id: agentId,
            agent_shipping_cost: finalShippingCost,
            status: 'shipped',
            assigned_at: new Date().toISOString()
          })
          .eq("id", orderToAssign.id);
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["all-orders"] });
      queryClient.invalidateQueries({ queryKey: ["agent-orders"] });
      toast.success("تم تعيين الأوردرات بنجاح");
      setBarcodeDialogOpen(false);
      setBarcodeOrders([""]);
      setBulkAgentId("");
      setBulkShippingCost(0);
    },
  });

  const updateNotesMutation = useMutation({
    mutationFn: async ({ orderId, notes }: { orderId: string; notes: string }) => {
      const { error } = await supabase
        .from("orders")
        .update({ notes })
        .eq("id", orderId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("تم تحديث الملاحظات بنجاح");
      setEditingNotes({});
    },
  });

  // Use the new formatting utility
  const getFormattedItems = (orderItems: any[]) => {
    if (!orderItems || orderItems.length === 0) return null;
    return formatOrderItems(orderItems);
  };

  const deleteOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      // First delete order items
      const { error: itemsError } = await supabase
        .from("order_items")
        .delete()
        .eq("order_id", orderId);
      
      if (itemsError) throw itemsError;

      // Then delete the order
      const { error } = await supabase
        .from("orders")
        .delete()
        .eq("id", orderId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["all-orders"] });
      toast.success("تم حذف الأوردر بنجاح");
    },
  });

  const createManualOrderMutation = useMutation({
    mutationFn: async () => {
      const selectedGov = governorates?.find(g => g.id === manualOrder.governorateId);
      
      // Customer is optional - create only if name or phone provided
      let customerId = null;
      if (manualOrder.customerName || manualOrder.phone) {
        // Check if phone already exists
        if (manualOrder.phone && manualOrder.phone !== "غير متوفر") {
          const { data: existingCustomer } = await supabase
            .from("customers")
            .select("id")
            .eq("phone", manualOrder.phone)
            .single();
          
          if (existingCustomer) {
            customerId = existingCustomer.id;
            // Update existing customer info if needed
            await supabase
              .from("customers")
              .update({
                name: manualOrder.customerName || "عميل غير محدد",
                address: manualOrder.address || "غير محدد",
                governorate: selectedGov?.name || null
              })
              .eq("id", existingCustomer.id);
          }
        }
        
        // Create new customer only if not found
        if (!customerId) {
          const { data: customer, error: customerError } = await supabase
            .from("customers")
            .insert({
              name: manualOrder.customerName || "عميل غير محدد",
              phone: manualOrder.phone || "غير متوفر",
              address: manualOrder.address || "غير محدد",
              governorate: selectedGov?.name || null
            })
            .select()
            .single();
          
          if (customerError) throw customerError;
          customerId = customer.id;
        }
      }

      const productPrice = parseFloat(manualOrder.productPrice) || 0;
      const quantity = parseInt(manualOrder.productQuantity) || 1;
      const totalProductPrice = productPrice * quantity;
      const shippingCost = parseFloat(manualOrder.shippingCost) || selectedGov?.shipping_cost || 0;

      const productDetails = manualOrder.productName ? [{
        name: manualOrder.productName,
        quantity: quantity,
        price: productPrice,
        size: manualOrder.productSize || null,
        color: manualOrder.productColor || null
      }] : null;

      // Create order
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          customer_id: customerId,
          total_amount: totalProductPrice,
          shipping_cost: shippingCost,
          governorate_id: manualOrder.governorateId && manualOrder.governorateId.trim() !== "" ? manualOrder.governorateId : null,
          status: 'pending',
          order_details: productDetails ? JSON.stringify(productDetails) : null
        })
        .select()
        .single();
      
      if (orderError) throw orderError;

      // If product name provided, create order item
      if (manualOrder.productName) {
        const { error: itemError } = await supabase
          .from("order_items")
          .insert({
            order_id: order.id,
            quantity: quantity,
            price: productPrice,
            size: manualOrder.productSize || null,
            color: manualOrder.productColor || null,
            product_details: JSON.stringify({ 
              name: manualOrder.productName, 
              price: productPrice,
              size: manualOrder.productSize || null,
              color: manualOrder.productColor || null
            })
          });
        
        if (itemError) throw itemError;
      }

      return order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["all-orders"] });
      toast.success("تم إنشاء الأوردر بنجاح");
      setManualOrderDialogOpen(false);
      setManualOrder({
        customerName: "",
        phone: "",
        address: "",
        productName: "",
        productPrice: "",
        productSize: "",
        productColor: "",
        productQuantity: "1",
        shippingCost: "",
        governorateId: ""
      });
    },
    onError: (error: any) => {
      console.error("Error creating order:", error);
      toast.error(`حدث خطأ: ${error?.message || "خطأ غير معروف"}`);
    }
  });

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrders(prev =>
      prev.includes(orderId)
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedOrders.length === filteredOrders?.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(filteredOrders?.map(o => o.id) || []);
    }
  };

  const handleBulkAssign = () => {
    if (!bulkAgentId) {
      toast.error("يرجى اختيار مندوب");
      return;
    }
    if (selectedOrders.length === 0) {
      toast.error("يرجى اختيار أوردرات");
      return;
    }
    if (bulkShippingCost < 0) {
      toast.error("يرجى إدخال قيمة شحن صحيحة");
      return;
    }
    bulkAssignMutation.mutate({ orderIds: selectedOrders, agentId: bulkAgentId, shippingCost: bulkShippingCost });
  };

  const handleBarcodeAssign = () => {
    if (!bulkAgentId) {
      toast.error("يرجى اختيار مندوب");
      return;
    }
    const validOrders = barcodeOrders.filter(o => o.trim() !== "");
    if (validOrders.length === 0) {
      toast.error("يرجى إدخال أرقام الأوردرات");
      return;
    }
    assignByBarcodeMutation.mutate({ 
      orderNumbers: validOrders, 
      agentId: bulkAgentId, 
      shippingCost: bulkShippingCost 
    });
  };

  const handleExportExcel = () => {
    if (selectedOrders.length === 0) {
      toast.error("يرجى اختيار أوردرات للتصدير");
      return;
    }

    const selectedOrdersData = orders?.filter(o => selectedOrders.includes(o.id));
    
    const exportData = selectedOrdersData?.map(order => {
      const totalAmount = parseFloat(order.total_amount?.toString() || "0");
      const discount = parseFloat(order.discount?.toString() || "0");
      const shippingCost = parseFloat(order.shipping_cost?.toString() || "0");
      const finalAmount = totalAmount + shippingCost;

      return {
        "رقم الأوردر": order.order_number || order.id.slice(0, 8),
        "المحافظة": order.customers?.governorate || "-",
        "الاسم": order.customers?.name,
        "الهاتف": order.customers?.phone,
        "الهاتف الإضافي": (order.customers as any)?.phone2 || "-",
        "العنوان": order.customers?.address,
        "تفاصيل الأوردر": (() => {
          if (order.order_details) {
            try {
              const parsed = JSON.parse(order.order_details);
              if (Array.isArray(parsed)) {
                return parsed.map((item: any) => `${item.name} × ${item.quantity}`).join(", ");
              }
            } catch (e) {
              return order.order_details;
            }
          }
          const formatted = getFormattedItems(order.order_items);
          return formatted?.map((item) => `${item.name} × ${item.totalQuantity}`).join(", ") || "-";
        })(),
        "الصافي": totalAmount.toFixed(2),
        "الخصم": discount.toFixed(2),
        "الشحن": shippingCost.toFixed(2),
        "الإجمالي": finalAmount.toFixed(2),
        "الملاحظات": order.notes || "-",
        "التاريخ": new Date(order.created_at).toLocaleDateString("ar-EG")
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData || []);
    
    // Enhanced styling for Excel
    const colWidths = [
      { wch: 12 }, // رقم الأوردر
      { wch: 15 }, // المحافظة
      { wch: 20 }, // الاسم
      { wch: 15 }, // الهاتف
      { wch: 15 }, // الهاتف الإضافي
      { wch: 35 }, // العنوان
      { wch: 30 }, // تفاصيل الأوردر
      { wch: 12 }, // الصافي
      { wch: 10 }, // الخصم
      { wch: 10 }, // الشحن
      { wch: 12 }, // الإجمالي
      { wch: 25 }, // الملاحظات
      { wch: 12 }  // التاريخ
    ];
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "الأوردرات");
    XLSX.writeFile(wb, `orders_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success("تم تصدير الأوردرات بنجاح");
  };

  const handlePrintInvoices = () => {
    if (selectedOrders.length === 0) {
      toast.error("يرجى اختيار أوردرات للطباعة");
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const selectedOrdersData = orders?.filter(o => selectedOrders.includes(o.id));
    
    const invoicesHtml = selectedOrdersData?.map(order => {
      // Build items with size and color
      let orderItemsHtml = '';
      
      // Try parsing order_details for external store orders
      if (order.order_details) {
        try {
          const parsed = JSON.parse(order.order_details);
          if (Array.isArray(parsed)) {
            orderItemsHtml = parsed.map((item: any) => `
              <tr>
                <td style="border: 1px solid #000; padding: 8px; text-align: center;">${item.name || '-'}</td>
                <td style="border: 1px solid #000; padding: 8px; text-align: center;">${item.size || '-'}</td>
                <td style="border: 1px solid #000; padding: 8px; text-align: center;">${item.color || '-'}</td>
                <td style="border: 1px solid #000; padding: 8px; text-align: center;">${parseFloat(item.price?.toString() || "0").toFixed(2)} ج.م</td>
              </tr>
            `).join('');
          }
        } catch (e) {
          // Not JSON
        }
      }
      
      if (!orderItemsHtml && order.order_items) {
        const formatted = getFormattedItems(order.order_items);
        orderItemsHtml = formatted?.map((item) => `
          <tr>
            <td style="border: 1px solid #000; padding: 8px; text-align: center;">${item.name}</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: center;">${formatSizesDisplay(item.sizes)}</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: center;">${item.color || '-'}</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: center;">${item.totalPrice.toFixed(2)} ج.م</td>
          </tr>
        `).join('') || '';
      }

      const totalAmount = parseFloat(order.total_amount?.toString() || "0");
      const shippingCost = parseFloat(order.shipping_cost?.toString() || "0");
      const finalAmount = totalAmount + shippingCost;

      return `
        <div style="page-break-after: always; padding: 20px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="font-size: 32px; font-weight: bold; color: #d4af37; margin: 0;">Family Fashion</h1>
          </div>
          <h2 style="text-align: center; margin: 10px 0; font-size: 18px;">فاتورة</h2>
          <hr style="border: 1px solid #ddd;"/>
          <div style="margin: 15px 0; line-height: 1.8;">
            <p style="margin: 5px 0;"><strong>رقم الأوردر:</strong> #${order.order_number || order.id.slice(0, 8)}</p>
            <p style="margin: 5px 0;"><strong>التاريخ:</strong> ${new Date(order.created_at).toLocaleDateString('ar-EG')}</p>
            <p style="margin: 5px 0;"><strong>اسم العميل:</strong> ${order.customers?.name}</p>
            <p style="margin: 5px 0;"><strong>الهاتف:</strong> ${order.customers?.phone}</p>
            ${(order.customers as any)?.phone2 ? `<p style="margin: 5px 0;"><strong>هاتف إضافي:</strong> ${(order.customers as any).phone2}</p>` : ''}
            <p style="margin: 5px 0;"><strong>المحافظة:</strong> ${order.customers?.governorate || '-'}</p>
            <p style="margin: 5px 0;"><strong>العنوان:</strong> ${order.customers?.address}</p>
            ${order.notes ? `<p style="margin: 5px 0;"><strong>ملاحظات:</strong> ${order.notes}</p>` : ''}
          </div>
          <hr style="border: 1px solid #ddd;"/>
          <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
            <thead>
              <tr>
                <th style="border: 1px solid #000; padding: 10px; background-color: #f8f8f8;">المنتج</th>
                <th style="border: 1px solid #000; padding: 10px; background-color: #f8f8f8;">المقاس</th>
                <th style="border: 1px solid #000; padding: 10px; background-color: #f8f8f8;">اللون</th>
                <th style="border: 1px solid #000; padding: 10px; background-color: #f8f8f8;">السعر</th>
              </tr>
            </thead>
            <tbody>
              ${orderItemsHtml}
            </tbody>
          </table>
          <hr style="border: 1px solid #ddd; margin-top: 15px;"/>
          <div style="margin-top: 15px; text-align: left;">
            <p style="font-size: 18px; font-weight: bold;"><strong>الإجمالي:</strong> ${finalAmount.toFixed(2)} ج.م</p>
          </div>
        </div>
      `;
    }).join('');

    printWindow.document.write(`
      <html dir="rtl">
        <head>
          <title>الفواتير</title>
          <style>
            body { font-family: Arial, sans-serif; }
            @media print {
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          ${invoicesHtml}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-500",
      processing: "bg-blue-500",
      shipped: "bg-purple-500",
      delivered: "bg-green-500",
      cancelled: "bg-red-500",
      returned: "bg-orange-500",
      partially_returned: "bg-orange-400",
      delivered_with_modification: "bg-teal-500"
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
      partially_returned: "مرتجع جزئي",
      delivered_with_modification: "تم التوصيل مع التعديل"
    };
    return texts[status] || status;
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
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle>الأوردرات</CardTitle>
                  {!canEditOrders && (
                    <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">مشاهدة فقط</span>
                  )}
                  {canEditOrders && (
                  <Button onClick={() => setManualOrderDialogOpen(true)} size="sm" variant="outline">
                    <Plus className="ml-2 h-4 w-4" />
                    إضافة يدوي
                  </Button>
                  )}
                </div>
                {selectedOrders.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {selectedOrders.length} محدد
                    </span>
                    <Button onClick={handleExportExcel} size="sm" variant="outline">
                      <Download className="ml-2 h-4 w-4" />
                      تصدير Excel
                    </Button>
                    <Button onClick={handlePrintInvoices} size="sm" variant="outline">
                      <Printer className="ml-2 h-4 w-4" />
                      طباعة الفواتير
                    </Button>
                    {canEditOrders && (
                    <>
                    <Button onClick={() => setBarcodeDialogOpen(true)} size="sm" variant="outline">
                      <Barcode className="ml-2 h-4 w-4" />
                      تعيين بالباركود
                    </Button>
                    <Input
                      type="number"
                      value={bulkShippingCost}
                      onChange={(e) => setBulkShippingCost(Number(e.target.value) || 0)}
                      placeholder="شحن المندوب"
                      className="w-32"
                      min="0"
                    />
                    <select
                      value={bulkAgentId}
                      onChange={(e) => setBulkAgentId(e.target.value)}
                      className="h-10 w-48 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    >
                      <option value="">اختر مندوب</option>
                      {agents?.map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.name} ({agent.serial_number})
                        </option>
                      ))}
                    </select>
                    <Button onClick={handleBulkAssign} size="sm">
                      <UserCheck className="ml-2 h-4 w-4" />
                      تعيين المندوب
                    </Button>
                    </>
                    )}
                  </div>
                )}
              </div>
              
              <div className="sticky top-16 z-10 bg-card pt-2 pb-2 flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">بحث:</span>
                  <Input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="رقم الأوردر، الاسم، أو الهاتف"
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
                      <SelectItem value="partially_returned">مرتجع جزئي</SelectItem>
                      <SelectItem value="delivered_with_modification">تم التوصيل مع التعديل</SelectItem>
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
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedOrders.length === filteredOrders.length}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead>رقم الأوردر</TableHead>
                      <TableHead>المحافظة</TableHead>
                      <TableHead>الاسم</TableHead>
                      <TableHead>الهاتف</TableHead>
                      <TableHead>الهاتف الإضافي</TableHead>
                      <TableHead>العنوان</TableHead>
                      <TableHead>تفاصيل الأوردر</TableHead>
                      <TableHead>السعر النهائي</TableHead>
                      <TableHead>الملاحظات</TableHead>
                      <TableHead>التاريخ</TableHead>
                      {canEditOrders && <TableHead>إجراءات</TableHead>}
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
                          <TableCell>
                            <Checkbox
                              checked={selectedOrders.includes(order.id)}
                              onCheckedChange={() => toggleOrderSelection(order.id)}
                            />
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            #{order.order_number || order.id.slice(0, 8)}
                          </TableCell>
                          <TableCell>{order.customers?.governorate || "-"}</TableCell>
                          <TableCell className="font-medium">{order.customers?.name}</TableCell>
                          <TableCell>{order.customers?.phone}</TableCell>
                          <TableCell>{(order.customers as any)?.phone2 || "-"}</TableCell>
                          <TableCell className="max-w-xs break-words whitespace-normal">{order.customers?.address}</TableCell>
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
                          <TableCell className="max-w-xs">
                            {canEditOrders && editingNotes[order.id] !== undefined ? (
                              <div className="space-y-2">
                                <Textarea
                                  value={editingNotes[order.id]}
                                  onChange={(e) => setEditingNotes({ ...editingNotes, [order.id]: e.target.value })}
                                  rows={3}
                                  className="min-w-[200px]"
                                />
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => updateNotesMutation.mutate({ orderId: order.id, notes: editingNotes[order.id] })}
                                  >
                                    حفظ
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      const newNotes = { ...editingNotes };
                                      delete newNotes[order.id];
                                      setEditingNotes(newNotes);
                                    }}
                                  >
                                    إلغاء
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div 
                                className={`p-2 rounded break-words whitespace-normal ${canEditOrders ? 'cursor-pointer hover:bg-accent/20' : ''}`}
                                onClick={() => canEditOrders && setEditingNotes({ ...editingNotes, [order.id]: order.notes || "" })}
                              >
                                {order.notes || (canEditOrders ? "اضغط لإضافة ملاحظة" : "-")}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            {new Date(order.created_at).toLocaleDateString("ar-EG")}
                          </TableCell>
                          {canEditOrders && (
                          <TableCell>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm">
                                  حذف
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    هل أنت متأكد من حذف هذا الأوردر؟ سيتم حذف جميع البيانات المرتبطة به. هذا الإجراء لا يمكن التراجع عنه.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteOrderMutation.mutate(order.id)}>
                                    حذف
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
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

        <Dialog open={barcodeDialogOpen} onOpenChange={setBarcodeDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>تعيين أوردرات بالباركود</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>اختر المندوب</Label>
                <select
                  value={bulkAgentId}
                  onChange={(e) => setBulkAgentId(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <option value="">اختر مندوب</option>
                  {agents?.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>شحن المندوب</Label>
                <Input
                  type="number"
                  value={bulkShippingCost}
                  onChange={(e) => setBulkShippingCost(Number(e.target.value) || 0)}
                  placeholder="0"
                  min="0"
                />
              </div>
              <div className="space-y-2">
                <Label>أرقام الأوردرات</Label>
                {barcodeOrders.map((order, idx) => (
                  <Input
                    key={idx}
                    value={order}
                    onChange={(e) => {
                      const newOrders = [...barcodeOrders];
                      newOrders[idx] = e.target.value;
                      setBarcodeOrders(newOrders);
                    }}
                    placeholder={`رقم الأوردر ${idx + 1}`}
                  />
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setBarcodeOrders([...barcodeOrders, ""])}
                  className="w-full"
                >
                  إضافة أوردر آخر
                </Button>
              </div>
              <Button onClick={handleBarcodeAssign} className="w-full">
                تعيين الأوردرات
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={manualOrderDialogOpen} onOpenChange={setManualOrderDialogOpen}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>إضافة أوردر يدوي</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>الاسم (اختياري)</Label>
                <Input
                  value={manualOrder.customerName}
                  onChange={(e) => setManualOrder({ ...manualOrder, customerName: e.target.value })}
                  placeholder="اسم العميل"
                />
              </div>
              <div>
                <Label>رقم الهاتف (اختياري)</Label>
                <Input
                  value={manualOrder.phone}
                  onChange={(e) => setManualOrder({ ...manualOrder, phone: e.target.value })}
                  placeholder="رقم الهاتف"
                />
              </div>
              <div>
                <Label>العنوان (اختياري)</Label>
                <Input
                  value={manualOrder.address}
                  onChange={(e) => setManualOrder({ ...manualOrder, address: e.target.value })}
                  placeholder="العنوان"
                />
              </div>
              <div>
                <Label>المحافظة</Label>
                <Select 
                  value={manualOrder.governorateId} 
                  onValueChange={(value) => {
                    const selectedGov = governorates?.find(g => g.id === value);
                    setManualOrder({ 
                      ...manualOrder, 
                      governorateId: value,
                      shippingCost: selectedGov?.shipping_cost?.toString() || manualOrder.shippingCost
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر المحافظة" />
                  </SelectTrigger>
                  <SelectContent>
                    {governorates?.map((gov) => (
                      <SelectItem key={gov.id} value={gov.id}>
                        {gov.name} - {gov.shipping_cost} ج.م
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">تفاصيل المنتج</h4>
                <div className="space-y-3">
                  <div>
                    <Label>اسم المنتج</Label>
                    <Input
                      value={manualOrder.productName}
                      onChange={(e) => setManualOrder({ ...manualOrder, productName: e.target.value })}
                      placeholder="اسم المنتج"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>سعر القطعة *</Label>
                      <Input
                        type="number"
                        value={manualOrder.productPrice}
                        onChange={(e) => setManualOrder({ ...manualOrder, productPrice: e.target.value })}
                        placeholder="السعر"
                        min="0"
                      />
                    </div>
                    <div>
                      <Label>الكمية *</Label>
                      <Input
                        type="number"
                        value={manualOrder.productQuantity}
                        onChange={(e) => setManualOrder({ ...manualOrder, productQuantity: e.target.value })}
                        placeholder="1"
                        min="1"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>المقاس</Label>
                      <Input
                        value={manualOrder.productSize}
                        onChange={(e) => setManualOrder({ ...manualOrder, productSize: e.target.value })}
                        placeholder="مثل: L, XL, 42"
                      />
                    </div>
                    <div>
                      <Label>اللون</Label>
                      <Input
                        value={manualOrder.productColor}
                        onChange={(e) => setManualOrder({ ...manualOrder, productColor: e.target.value })}
                        placeholder="اللون"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <Label>سعر الشحن (اختياري)</Label>
                <Input
                  type="number"
                  value={manualOrder.shippingCost}
                  onChange={(e) => setManualOrder({ ...manualOrder, shippingCost: e.target.value })}
                  placeholder="سعر الشحن"
                  min="0"
                />
              </div>
              {manualOrder.productPrice && (
                <div className="bg-muted p-3 rounded-lg">
                  <p className="text-sm font-medium">
                    الإجمالي: {((parseFloat(manualOrder.productPrice) || 0) * (parseInt(manualOrder.productQuantity) || 1) + (parseFloat(manualOrder.shippingCost) || 0)).toFixed(2)} ج.م
                  </p>
                </div>
              )}
              <Button 
                onClick={() => {
                  if (!manualOrder.productPrice) {
                    toast.error("يرجى إدخال سعر المنتج");
                    return;
                  }
                  createManualOrderMutation.mutate();
                }}
                className="w-full"
                disabled={createManualOrderMutation.isPending}
              >
                {createManualOrderMutation.isPending ? "جاري الإنشاء..." : "إنشاء الأوردر"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Orders;
