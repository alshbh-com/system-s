import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, PackageX, Printer, Download, AlertTriangle, Trash2, MessageCircle, ArrowDown, Plus, Edit2, ChevronDown, ChevronUp, Calendar, Package, Check, Lock } from "lucide-react";
import RescheduleOrderDialog from "@/components/admin/RescheduleOrderDialog";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import * as XLSX from 'xlsx';
import { useActivityLogger } from "@/hooks/useActivityLogger";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useDailyCashbox, getDailyCashboxName } from "@/hooks/useDailyCashbox";

const statusLabels: Record<string, string> = {
  shipped: "تم الشحن",
  delivered: "تم التوصيل",
  returned: "مرتجع",
  return_no_shipping: "مرتجع دون شحن"
};

const statusColors: Record<string, string> = {
  shipped: "bg-purple-500",
  delivered: "bg-green-500",
  returned: "bg-orange-600",
  return_no_shipping: "bg-red-500"
};

const AgentOrders = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { logAction } = useActivityLogger();
  const { currentUser, canEdit } = useAdminAuth();
  const canEditAgentOrders = canEdit('agent_orders');
  const summaryRef = useRef<HTMLDivElement>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [singleDateFilter, setSingleDateFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [confirmReturnDialogOpen, setConfirmReturnDialogOpen] = useState(false);
  const [pendingReturnOrder, setPendingReturnOrder] = useState<any>(null);
  const [bulkStatusDialogOpen, setBulkStatusDialogOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<string>("");
  const [selectedOrderForReturn, setSelectedOrderForReturn] = useState<any>(null);
  const [returnData, setReturnData] = useState({
    returned_items: [] as any[],
    notes: "",
    removeShipping: false
  });
  const [editingShipping, setEditingShipping] = useState<string | null>(null);
  const [newShipping, setNewShipping] = useState<string>("");
  
  // Summary states - default to today's date (Cairo time)
  const getDateKey = (value: string | Date) => {
    const d = typeof value === "string" ? new Date(value) : value;
    // en-CA => YYYY-MM-DD
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Cairo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  };

  const today = getDateKey(new Date());
  const [summaryDateFilter, setSummaryDateFilter] = useState<string>(today);

  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>(today); // تاريخ الدفعة
  const [selectedCashboxId, setSelectedCashboxId] = useState<string>(""); // الخزنة المختارة
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "transfer">("cash"); // طريقة الدفع

  // إدارة/تعديل/حذف الدفعات لأي يوم
  const [paymentsManagerOpen, setPaymentsManagerOpen] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [editPaymentAmount, setEditPaymentAmount] = useState<string>("");
  const [editPaymentDate, setEditPaymentDate] = useState<string>(today);

  const [editingField, setEditingField] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>("");

  // Generate last 10 days for payment date selection
  const generatePaymentDateOptions = () => {
    const options: { value: string; label: string }[] = [];
    for (let i = 0; i < 10; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateKey = getDateKey(date);
      const label = i === 0 ? "اليوم" : i === 1 ? "أمس" : new Intl.DateTimeFormat("ar-EG", {
        weekday: "short",
        day: "numeric",
        month: "short"
      }).format(date);
      options.push({ value: dateKey, label: `${label} (${dateKey})` });
    }
    return options;
  };
  const paymentDateOptions = generatePaymentDateOptions();

  const scrollToSummary = () => {
    summaryRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const { data: agents } = useQuery({
    queryKey: ["delivery_agents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_agents")
        .select("*")
        .order("name");
      
      if (error) throw error;
      return data;
    },
  });

  const { data: orders, isLoading, refetch: refetchOrders } = useQuery({
    queryKey: ["agent-orders", selectedAgentId],
    queryFn: async () => {
      if (!selectedAgentId) return [];
      
      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          customers (name, phone, address, governorate),
          delivery_agents (name, serial_number),
          order_items (
            *,
            products (name, price)
          )
        `)
        .eq("delivery_agent_id", selectedAgentId)
        .not("status", "in", '("delivered","returned","cancelled")')
        .order("assigned_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedAgentId,
    refetchInterval: selectedAgentId ? 2000 : false,
    refetchOnWindowFocus: true,
  });

  // Real-time updates for orders, payments, returns and agents
  useEffect(() => {
    if (!selectedAgentId) return;

    const invalidateAll = () => {
      queryClient.invalidateQueries({ queryKey: ["agent-orders", selectedAgentId] });
      queryClient.invalidateQueries({ queryKey: ["all-agent-orders", selectedAgentId] });
      queryClient.invalidateQueries({ queryKey: ["agent_payments", selectedAgentId] });
      queryClient.invalidateQueries({ queryKey: ["agent_payments_full", selectedAgentId] });
      queryClient.invalidateQueries({ queryKey: ["agent-returns", selectedAgentId] });
      queryClient.invalidateQueries({ queryKey: ["delivery_agents"] });
    };

    const ordersChannel = supabase
      .channel('agent-orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, invalidateAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_payments' }, invalidateAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'returns' }, invalidateAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_agents' }, invalidateAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, invalidateAll)
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
    };
  }, [selectedAgentId, queryClient]);

  const { data: agentPayments } = useQuery({
    queryKey: ["agent_payments", selectedAgentId],
    queryFn: async () => {
      if (!selectedAgentId) return null;
      
      const { data: agent, error } = await supabase
        .from("delivery_agents")
        .select("total_owed, total_paid")
        .eq("id", selectedAgentId)
        .single();
      
      if (error) throw error;
      return agent;
    },
    enabled: !!selectedAgentId,
    refetchInterval: selectedAgentId ? 2000 : false,
    refetchOnWindowFocus: true,
  });

  // Query for all orders for this agent (for summary) - includes order_items for product quantities
  const { data: allAgentOrders } = useQuery({
    queryKey: ["all-agent-orders", selectedAgentId],
    queryFn: async () => {
      if (!selectedAgentId) return [];
      
      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          customers (name, phone, address, governorate),
          order_items (
            quantity,
            product_id,
            products (name)
          )
        `)
        .eq("delivery_agent_id", selectedAgentId)
        .order("assigned_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedAgentId,
    refetchInterval: selectedAgentId ? 2000 : false,
    refetchOnWindowFocus: true,
  });

  // Query for agent payments data (for summary calculations)
  const { data: agentPaymentsData } = useQuery({
    queryKey: ["agent_payments_full", selectedAgentId],
    queryFn: async () => {
      if (!selectedAgentId) return [];
      
      const { data, error } = await supabase
        .from("agent_payments")
        .select("*")
        .eq("delivery_agent_id", selectedAgentId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedAgentId,
    refetchInterval: selectedAgentId ? 2000 : false,
    refetchOnWindowFocus: true,
  });

  // Returns table (for accurate returns summary even if orders.delivery_agent_id becomes NULL)
  const { data: agentReturns } = useQuery({
    queryKey: ["agent-returns", selectedAgentId],
    queryFn: async () => {
      if (!selectedAgentId) return [];

      const { data, error } = await supabase
        .from("returns")
        .select("id, order_id, return_amount, returned_items, created_at, orders(assigned_at)")
        .eq("delivery_agent_id", selectedAgentId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedAgentId,
    refetchInterval: selectedAgentId ? 2000 : false,
    refetchOnWindowFocus: true,
  });
  // Query for daily closings
  const { data: dailyClosings, refetch: refetchClosings } = useQuery({
    queryKey: ["agent_daily_closings", selectedAgentId],
    queryFn: async () => {
      if (!selectedAgentId) return [];
      
      const { data, error } = await supabase
        .from("agent_daily_closings")
        .select("*")
        .eq("delivery_agent_id", selectedAgentId)
        .order("closing_date", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedAgentId
  });

  // Check if a day is closed
  const isDayClosed = (date: string) => {
    return dailyClosings?.some((c: any) => c.closing_date === date);
  };

  // Query for governorates
  const { data: governorates } = useQuery({
    queryKey: ["governorates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("governorates")
        .select("*");
      
      if (error) throw error;
      return data;
    },
  });

  // Use daily cashbox hook (auto-creates today's cashbox)
  const { todayCashbox, today: todayCashboxDate, cashboxes } = useDailyCashbox();

  // State for admin password when selecting non-today cashbox
  const [cashboxPasswordDialogOpen, setCashboxPasswordDialogOpen] = useState(false);
  const [cashboxPasswordInput, setCashboxPasswordInput] = useState("");
  const [nonTodayCashboxUnlocked, setNonTodayCashboxUnlocked] = useState(false);

  // Fetch admin_delete password from system_passwords
  const { data: adminDeletePassword } = useQuery({
    queryKey: ["system_password_admin_delete"],
    queryFn: async () => {
      const { data } = await supabase
        .from("system_passwords")
        .select("password")
        .eq("id", "admin_delete")
        .single();
      return data?.password || "";
    },
  });

  const verifyCashboxPassword = (input: string) => {
    if (input === adminDeletePassword) {
      setNonTodayCashboxUnlocked(true);
      setCashboxPasswordDialogOpen(false);
      setCashboxPasswordInput("");
      toast.success("تم فتح القفل - يمكنك اختيار أي خزنة");
    } else {
      toast.error("كلمة المرور غير صحيحة");
    }
  };

  // Auto-select today's cashbox when it becomes available
  useEffect(() => {
    if (todayCashbox && !selectedCashboxId) {
      setSelectedCashboxId(todayCashbox.id);
    }
  }, [todayCashbox]);

  // Calculate summary data
  const calculateSummary = (dateFilter?: string) => {
    if (!agentPaymentsData || !allAgentOrders) return null;

    // Map order_id -> assigned_at day (stable)
    const orderAssignedDateById = new Map<string, string>();
    allAgentOrders.forEach((o: any) => {
      if ((o as any).assigned_at) {
        orderAssignedDateById.set(o.id, getDateKey((o as any).assigned_at));
      }
    });

    const getPaymentAccountingDate = (p: any) => {
      // Manual payments are the ONLY ones that should follow payment_date as entered.
      if (p.payment_type === "payment") {
        return (p as any).payment_date || getDateKey(p.created_at || "");
      }

      // Order-related movements should follow assignment day only
      if (p.order_id) {
        return orderAssignedDateById.get(p.order_id) || null;
      }

      return (p as any).payment_date || getDateKey(p.created_at || "");
    };

    let paymentsToUse = agentPaymentsData;
    let ordersToUse = allAgentOrders;

    if (dateFilter) {
      paymentsToUse = agentPaymentsData.filter((p) => getPaymentAccountingDate(p) === dateFilter);

      ordersToUse = allAgentOrders.filter((o: any) => {
        const assignedAt = (o as any).assigned_at;
        if (!assignedAt) return false;
        const assignDate = getDateKey(assignedAt);
        return assignDate === dateFilter;
      });
    }

    const owedPayments = paymentsToUse.filter((p) => p.payment_type === "owed");
    const manualPayments = paymentsToUse.filter((p) => p.payment_type === "payment");
    const deliveredPayments = paymentsToUse.filter((p) => p.payment_type === "delivered");
    const returnPayments = paymentsToUse.filter((p) => p.payment_type === "return");
    const modificationPayments = paymentsToUse.filter((p) => p.payment_type === "modification");

    const sumAmount = (arr: any[]) =>
      arr.reduce((sum, p) => sum + parseFloat((p.amount ?? 0).toString()), 0);

    const totalOwed = sumAmount(owedPayments);
    const totalPaid = sumAmount(manualPayments);
    const totalDelivered = sumAmount(deliveredPayments);

    // إشارات موجبة/سالبة كما هي في جدول agent_payments
    const totalReturnsSigned = sumAmount(returnPayments); // غالباً سالبة
    const totalModificationsSigned = sumAmount(modificationPayments);

    // للعرض فقط
    const totalReturns = Math.abs(totalReturnsSigned);
    const totalModifications = Math.abs(totalModificationsSigned);

    // صافي المطلوب (حركة اليوم) = المطلوب + التعديلات + المرتجعات(سالبة)
    const netRequired = totalOwed + totalModificationsSigned + totalReturnsSigned;

    // الصافي على المندوب = صافي المطلوب - المسلم - الدفعات المقدمة
    const agentReceivables = netRequired - totalDelivered - totalPaid;

    // الإجمالي للتقفيل سيتم حسابه بعد حساب deliveredTotal من الأوردرات
    let closingTotal = 0; // placeholder

    // حساب إحصائيات الأوردرات
    const shippedOrders = ordersToUse.filter((o) => o.status === "shipped");
    const deliveredOrders = ordersToUse.filter((o) => o.status === "delivered" || o.status === "delivered_with_modification");

    // Returns should be derived from `returns` table (orders may be unassigned from agent on status changes)
    const returnsToUse = (agentReturns || []).filter((r: any) => {
      if (!dateFilter) return true;
      const assignedAt = r?.orders?.assigned_at;
      if (!assignedAt) return false;
      return getDateKey(assignedAt) === dateFilter;
    });

    const returnedOrderIds = new Set(
      returnsToUse.map((r: any) => r.order_id).filter(Boolean)
    );
    const returnedCount = returnedOrderIds.size;

    // إجمالي قيمة جميع الأوردرات المعروضة في اليوم (شامل شحن العميل)
    const allOrdersTotal = ordersToUse.reduce((sum, o) => {
      const total = parseFloat(o.total_amount?.toString() || "0");
      const shipping = parseFloat(o.shipping_cost?.toString() || "0");
      return sum + total + shipping;
    }, 0);

    // إجمالي شحن المندوب
    const allAgentShipping = ordersToUse.reduce((sum, o) => {
      return sum + parseFloat(o.agent_shipping_cost?.toString() || "0");
    }, 0);

    // الصافي = الإجمالي - شحن المندوب (هذا هو فلوس صاحب المتجر)
    const allOrdersNet = allOrdersTotal - allAgentShipping;

    const shippedTotal = shippedOrders.reduce((sum, o) => {
      const total = parseFloat(o.total_amount?.toString() || "0");
      const shipping = parseFloat(o.shipping_cost?.toString() || "0");
      return sum + total + shipping;
    }, 0);

    const shippedAgentShipping = shippedOrders.reduce((sum, o) => {
      return sum + parseFloat(o.agent_shipping_cost?.toString() || "0");
    }, 0);

    const shippedNet = shippedTotal - shippedAgentShipping;

    const deliveredTotal = deliveredOrders.reduce((sum, o) => {
      const total = parseFloat(o.total_amount?.toString() || "0");
      const shipping = parseFloat(o.shipping_cost?.toString() || "0");
      return sum + total + shipping;
    }, 0);

    const deliveredAgentShipping = deliveredOrders.reduce((sum, o) => {
      return sum + parseFloat(o.agent_shipping_cost?.toString() || "0");
    }, 0);

    const deliveredNet = deliveredTotal - deliveredAgentShipping;

    // الإجمالي للتقفيل = صافي الأوردرات المسلمة - الدفعة المقدمة
    closingTotal = deliveredNet - totalPaid;

    const returnedTotal = returnsToUse.reduce((sum: number, r: any) => {
      const amt = parseFloat((r?.return_amount ?? 0).toString());
      return sum + (Number.isFinite(amt) ? amt : 0);
    }, 0);

    // حساب عدد القطع لكل منتج (من جميع أوردرات اليوم)
    const productQuantities: Record<string, number> = {};
    ordersToUse.forEach((order: any) => {
      const orderItems = order.order_items || [];
      orderItems.forEach((item: any) => {
        const productName = item.products?.name || "منتج غير معروف";
        const qty = item.quantity || 0;
        productQuantities[productName] = (productQuantities[productName] || 0) + qty;
      });
    });

    // تحويل لمصفوفة ثم ترتيب بالكمية تنازلياً
    const productQuantitiesArray = Object.entries(productQuantities)
      .map(([name, quantity]) => ({ name, quantity }))
      .sort((a, b) => b.quantity - a.quantity);

    const totalProductQuantity = productQuantitiesArray.reduce((sum, p) => sum + p.quantity, 0);

    // حساب عدد القطع المرتجعة لكل منتج (من جدول returns مباشرة)
    const returnedProductQuantities: Record<string, number> = {};
    let totalReturnedItems = 0;
    (returnsToUse || []).forEach((ret: any) => {
      // Parse returned_items if it's a string (JSON)
      let items: any[] = [];
      if (typeof ret?.returned_items === 'string') {
        try {
          items = JSON.parse(ret.returned_items);
        } catch {
          items = [];
        }
      } else if (Array.isArray(ret?.returned_items)) {
        items = ret.returned_items;
      }
      
      items.forEach((it: any) => {
        // The data is stored as { product_name, quantity, ... }
        const name = it?.product_name || it?.name || "منتج غير معروف";
        const qtyRaw = it?.quantity ?? it?.returned_quantity ?? 0;
        const qty = parseFloat(qtyRaw.toString()) || 0;
        if (qty > 0) {
          returnedProductQuantities[name] = (returnedProductQuantities[name] || 0) + qty;
          totalReturnedItems += qty;
        }
      });
    });

    const returnedProductQuantitiesArray = Object.entries(returnedProductQuantities)
      .map(([name, quantity]) => ({ name, quantity }))
      .sort((a, b) => b.quantity - a.quantity);

    return {
      totalOwed,
      totalPaid,
      totalDelivered,
      totalReturns,
      totalModifications,
      totalReturnsSigned,
      totalModificationsSigned,
      netRequired,
      agentReceivables,
      closingTotal,
      allOrdersTotal,
      allOrdersNet,
      allAgentShipping,
      allOrdersCount: ordersToUse.length,
      shippedCount: shippedOrders.length,
      deliveredCount: deliveredOrders.length,
      returnedCount,
      shippedTotal,
      shippedNet,
      shippedAgentShipping,
      deliveredTotal,
      deliveredNet,
      deliveredAgentShipping,
      returnedTotal,
      productQuantitiesArray,
      totalProductQuantity,
      returnedProductQuantitiesArray,
      totalReturnedItems,
    };
  };

  const summaryData = calculateSummary(summaryDateFilter);

  // Get unique dates from orders for daily filter
  const getLocalDateForOrder = (dateStr: string) => getDateKey(dateStr);

  // Get agent creation date for date range
  const selectedAgent = agents?.find(a => a.id === selectedAgentId);
  const agentCreatedAt = selectedAgent?.created_at ? getLocalDateForOrder(selectedAgent.created_at) : today;
  
  // Generate all dates from agent creation to today
  const generateDateRange = (startDate: string, endDate: string) => {
    const dates: string[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    while (start <= end) {
      const year = start.getFullYear();
      const month = String(start.getMonth() + 1).padStart(2, '0');
      const day = String(start.getDate()).padStart(2, '0');
      dates.push(`${year}-${month}-${day}`);
      start.setDate(start.getDate() + 1);
    }
    return dates;
  };
  
  const uniqueDates = generateDateRange(agentCreatedAt, today).reverse();

  const recalcAgentTotalPaid = async (agentId: string) => {
    const { data, error } = await supabase
      .from("agent_payments")
      .select("amount")
      .eq("delivery_agent_id", agentId)
      .eq("payment_type", "payment");

    if (error) throw error;

    const totalPaid = (data || []).reduce(
      (sum, r: any) => sum + parseFloat((r.amount ?? 0).toString()),
      0
    );

    const { error: updateError } = await supabase
      .from("delivery_agents")
      .update({ total_paid: totalPaid })
      .eq("id", agentId);

    if (updateError) throw updateError;
  };

  // Add payment mutation
  const addPaymentMutation = useMutation({
    mutationFn: async ({
      amount,
      selectedDate,
      cashboxId,
      paymentMethod: method,
    }: {
      amount: number;
      selectedDate: string;
      cashboxId: string;
      paymentMethod: "cash" | "transfer";
    }) => {
      if (!selectedAgentId) throw new Error("لم يتم اختيار مندوب");
      if (!cashboxId) throw new Error("يرجى اختيار خزنة");

      const selectedAgent = agents?.find(a => a.id === selectedAgentId);
      const agentName = selectedAgent?.name || "مندوب";

      let insertedPaymentId: string | null = null;
      try {
        // 1) Create the advance payment record (agent ledger)
        const { data: paymentRow, error: paymentError } = await supabase
          .from("agent_payments")
          .insert({
            delivery_agent_id: selectedAgentId,
            amount,
            payment_type: "payment",
            payment_date: selectedDate,
            notes: `دفعة مقدمة - ${amount.toFixed(2)} ج.م (${selectedDate})`,
          })
          .select("id")
          .single();

        if (paymentError) throw paymentError;
        insertedPaymentId = paymentRow?.id || null;

        // 2) Create the cashbox deposit (income)
        const methodLabel = method === 'cash' ? 'كاش' : 'نقدي';
        const { error: cashboxError } = await supabase
          .from("cashbox_transactions")
          .insert({
            cashbox_id: cashboxId,
            amount,
            type: "income",
            reason: "manual",
            description: `إيداع (دفعة مقدمة) من ${agentName} - ${amount.toFixed(2)} ج.م (${methodLabel}) • بواسطة ${currentUser?.username || "غير معروف"}`,
            user_id: currentUser?.id || null,
            username: currentUser?.username || "غير معروف",
            payment_method: method,
          });

        if (cashboxError) throw cashboxError;

        // Keep delivery_agents.total_paid consistent (supports edit/delete later)
        await recalcAgentTotalPaid(selectedAgentId);
      } catch (e) {
        // Best-effort rollback: if cashbox insert fails, remove the agent payment
        if (insertedPaymentId) {
          await supabase.from("agent_payments").delete().eq("id", insertedPaymentId);
        }
        throw e;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent_payments_full"] });
      queryClient.invalidateQueries({ queryKey: ["delivery_agents"] });
      queryClient.invalidateQueries({ queryKey: ["cashbox-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["cashbox-balance"] });
      queryClient.invalidateQueries({ queryKey: ["cashboxes-active"] });
      toast.success("تم إضافة الدفعة بنجاح");
      setPaymentDialogOpen(false);
      setPaymentAmount("");
      setPaymentDate(today);
      setSelectedCashboxId(todayCashbox?.id || "");
      setNonTodayCashboxUnlocked(false);
      setPaymentMethod("cash");
      setNonTodayCashboxUnlocked(false);
    },
    onError: (error: any) => {
      console.error("Add payment error:", error);
      const msg = error?.message ? `حدث خطأ أثناء إضافة الدفعة: ${error.message}` : "حدث خطأ أثناء إضافة الدفعة";
      toast.error(msg);
    },
  });

  // Edit summary field mutation
  const editSummaryMutation = useMutation({
    mutationFn: async ({ field, newValue, currentValue }: { field: string; newValue: number; currentValue: number }) => {
      if (!selectedAgentId) throw new Error("لم يتم اختيار مندوب");

      const difference = newValue - currentValue;
      if (difference === 0) return;

      let paymentType: string;
      let amount: number;

      if (field === 'payment') {
        paymentType = 'payment';
        amount = difference;
      } else if (field === 'delivered') {
        paymentType = 'delivered';
        amount = difference;
      } else {
        throw new Error('نوع غير معروف');
      }

      const { error } = await supabase
        .from("agent_payments")
        .insert({
          delivery_agent_id: selectedAgentId,
          amount: amount,
          payment_type: paymentType,
          payment_date: summaryDateFilter, // استخدم التاريخ المحدد في الملخص
          notes: `تعديل يدوي - ${difference > 0 ? 'إضافة' : 'خصم'} ${Math.abs(difference).toFixed(2)} ج.م`
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent_payments_full"] });
      queryClient.invalidateQueries({ queryKey: ["delivery_agents"] });
      toast.success("تم التعديل بنجاح");
      setEditingField(null);
      setEditingValue("");
    },
    onError: () => {
      toast.error("حدث خطأ أثناء التعديل");
    }
  });

  const updatePaymentMutation = useMutation({
    mutationFn: async ({ id, amount, payment_date, oldAmount, oldDate }: { id: string; amount: number; payment_date: string; oldAmount: number; oldDate: string }) => {
      if (!selectedAgentId) throw new Error("لم يتم اختيار مندوب");

      const agentName = agents?.find(a => a.id === selectedAgentId)?.name || "مندوب";

      const { error } = await supabase
        .from("agent_payments")
        .update({
          amount,
          payment_date,
          notes: `دفعة معدلة - ${amount.toFixed(2)} ج.م (${payment_date})`,
        })
        .eq("id", id)
        .eq("delivery_agent_id", selectedAgentId)
        .eq("payment_type", "payment");

      if (error) throw error;

      await recalcAgentTotalPaid(selectedAgentId);

      // Log the activity
      await logAction("تعديل دفعة مندوب", "agent_payments", {
        agent_name: agentName,
        payment_id: id,
        old_amount: oldAmount,
        new_amount: amount,
        old_date: oldDate,
        new_date: payment_date,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent_payments_full"] });
      queryClient.invalidateQueries({ queryKey: ["delivery_agents"] });
      toast.success("تم تعديل الدفعة");
      setEditingPaymentId(null);
    },
    onError: () => toast.error("حدث خطأ أثناء تعديل الدفعة"),
  });

  const deletePaymentMutation = useMutation({
    mutationFn: async ({ id, deletedAmount, deletedDate }: { id: string; deletedAmount: number; deletedDate: string }) => {
      if (!selectedAgentId) throw new Error("لم يتم اختيار مندوب");

      const agentName = agents?.find(a => a.id === selectedAgentId)?.name || "مندوب";

      const { error } = await supabase
        .from("agent_payments")
        .delete()
        .eq("id", id)
        .eq("delivery_agent_id", selectedAgentId)
        .eq("payment_type", "payment");

      if (error) throw error;

      await recalcAgentTotalPaid(selectedAgentId);

      // Log the activity
      await logAction("حذف دفعة مندوب", "agent_payments", {
        agent_name: agentName,
        payment_id: id,
        deleted_amount: deletedAmount,
        deleted_date: deletedDate,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent_payments_full"] });
      queryClient.invalidateQueries({ queryKey: ["delivery_agents"] });
      toast.success("تم حذف الدفعة");
      setEditingPaymentId(null);
    },
    onError: () => toast.error("حدث خطأ أثناء حذف الدفعة"),
  });

  // Close day mutation
  const closeDayMutation = useMutation({
    mutationFn: async ({ date, netAmount }: { date: string; netAmount: number }) => {
      if (!selectedAgentId) throw new Error("لم يتم اختيار مندوب");

      const agentName = agents?.find(a => a.id === selectedAgentId)?.name || "مندوب";
      
      // Get current user info from localStorage
      const userDataStr = localStorage.getItem("adminUser");
      const userData = userDataStr ? JSON.parse(userDataStr) : null;

      const { error } = await supabase
        .from("agent_daily_closings")
        .insert({
          delivery_agent_id: selectedAgentId,
          closing_date: date,
          net_amount: netAmount,
          closed_by: userData?.id || null,
          closed_by_username: userData?.username || "غير معروف",
          notes: `تم التقفيل - صافي المستحق: ${netAmount.toFixed(2)} ج.م`,
        });

      if (error) throw error;

      // Log the activity
      await logAction("تقفيل يومية مندوب", "agent_daily_closings", {
        agent_name: agentName,
        closing_date: date,
        net_amount: netAmount,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent_daily_closings"] });
      toast.success("تم تقفيل اليومية بنجاح");
    },
    onError: (error: any) => {
      if (error?.message?.includes("duplicate")) {
        toast.error("تم تقفيل هذا اليوم بالفعل");
      } else {
        toast.error("حدث خطأ أثناء التقفيل");
      }
    },
  });

  const handleAddPayment = () => {
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("يرجى إدخال مبلغ صحيح");
      return;
    }
    if (!selectedCashboxId) {
      toast.error("يرجى اختيار خزنة لإضافة الدفعة");
      return;
    }
    addPaymentMutation.mutate({ 
      amount, 
      selectedDate: paymentDate, 
      cashboxId: selectedCashboxId,
      paymentMethod
    });
  };

  const handleEditSummary = () => {
    if (!editingField) return;
    const newValue = parseFloat(editingValue);
    if (isNaN(newValue)) {
      toast.error("قيمة غير صحيحة");
      return;
    }

    let currentValue = 0;
    if (editingField === 'payment') {
      currentValue = summaryData?.totalPaid || 0;
    } else if (editingField === 'delivered') {
      currentValue = summaryData?.totalDelivered || 0;
    }

    editSummaryMutation.mutate({ field: editingField, newValue, currentValue });
  };

  const filteredOrders = orders?.filter(order => {
    if (statusFilter !== "all" && order.status !== statusFilter) return false;
    
    // Single date filter (priority) - assignment date only
    const assignedAt = (order as any).assigned_at;
    const orderDate = assignedAt ? getDateKey(assignedAt) : "";
    if (singleDateFilter) {
      if (!orderDate || orderDate !== singleDateFilter) return false;
    } else if (startDate || endDate) {
      if (!orderDate) return false;
      if (startDate && orderDate < startDate) return false;
      if (endDate && orderDate > endDate) return false;
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const orderNumber = order.order_number?.toString() || "";
      const customerName = order.customers?.name?.toLowerCase() || "";
      const customerPhone = order.customers?.phone || "";
      
      if (!orderNumber.includes(query) && 
          !customerName.includes(query) && 
          !customerPhone.includes(query)) {
        return false;
      }
    }
    return true;
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, removeShipping, skipAutoReturnUpsert }: { id: string; status: string; removeShipping?: boolean; skipAutoReturnUpsert?: boolean }) => {
      const order = orders?.find(o => o.id === id);
      if (!order) throw new Error("Order not found");

      let updates: any = { status: status as any };
      
      const totalAmount = parseFloat(order.total_amount?.toString() || "0");
      const customerShipping = parseFloat(order.shipping_cost?.toString() || "0");
      const agentShipping = parseFloat(order.agent_shipping_cost?.toString() || "0");
      const orderTotal = totalAmount + customerShipping;
      
      // ملاحظة: لا نفك تعيين المندوب عند المرتجع حتى يظل اسم المندوب ظاهر تاريخياً في "جميع الأوردرات".
      // (الأوردر يختفي من صفحة المندوب تلقائياً لأن الاستعلام يستبعد حالات المرتجع)

      // إذا تم تغيير الحالة إلى مرتجع مباشرة (بدون فتح نافذة تسجيل المرتجع)
      // أنشئ/حدّث سجل في جدول returns حتى يظهر في ملخص المرتجعات.
      if (!skipAutoReturnUpsert && (status === "returned" || status === "return_no_shipping")) {
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

        // Upsert by order_id
        const { data: existingReturn, error: existingErr } = await supabase
          .from("returns")
          .select("id")
          .eq("order_id", id)
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
            })
            .eq("id", existingReturn.id);
          if (updErr) throw updErr;
        } else {
          const { error: insErr } = await supabase.from("returns").insert({
            order_id: id,
            customer_id: order.customer_id,
            delivery_agent_id: order.delivery_agent_id,
            return_amount: returnAmount,
            returned_items: returnItems as any,
            notes: "مرتجع كامل",
          });
          if (insErr) throw insErr;
        }
      }

      const { error } = await supabase
        .from("orders")
        .update(updates)
        .eq("id", id);
      
      if (error) throw error;

    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-orders"] });
      queryClient.invalidateQueries({ queryKey: ["agent_payments"] });
      queryClient.invalidateQueries({ queryKey: ["agent_payments_summary"] });
      queryClient.invalidateQueries({ queryKey: ["returns"] });
      queryClient.invalidateQueries({ queryKey: ["agent-returns"] });
      queryClient.invalidateQueries({ queryKey: ["delivery_agents"] });
      queryClient.invalidateQueries({ queryKey: ["all-orders"] });
      toast.success("تم تحديث الحالة");
    },
  });

  const updateShippingMutation = useMutation({
    mutationFn: async ({ orderId, newShipping, oldShipping, agentId, assignedAt }: { orderId: string; newShipping: number; oldShipping: number; agentId: string; assignedAt?: string }) => {
      // Update order agent shipping cost (the cost the agent pays, which reduces what they owe)
      const { error: orderError } = await supabase
        .from("orders")
        .update({ agent_shipping_cost: newShipping })
        .eq("id", orderId);
      
      if (orderError) throw orderError;

      // Calculate the difference (negative because agent_shipping reduces what agent owes)
      const difference = -(newShipping - oldShipping);

      // Update agent total_owed
      const { data: agent, error: fetchError } = await supabase
        .from("delivery_agents")
        .select("total_owed")
        .eq("id", agentId)
        .single();
      
      if (fetchError) throw fetchError;

      const newTotalOwed = parseFloat(agent.total_owed.toString()) + difference;
      
      const { error: updateError } = await supabase
        .from("delivery_agents")
        .update({ total_owed: newTotalOwed })
        .eq("id", agentId);
      
      if (updateError) throw updateError;

      // Add a payment record for the adjustment
      if (difference !== 0) {
        // استخدم تاريخ التعيين للأوردر
        const paymentDate = assignedAt 
          ? new Date(assignedAt).toISOString().split('T')[0]
          : today;
        
        const { error: paymentError } = await supabase
          .from("agent_payments")
          .insert({
            delivery_agent_id: agentId,
            order_id: orderId,
            amount: difference,
            payment_type: 'owed',
            payment_date: paymentDate,
            notes: `تعديل شحن المندوب - فرق ${difference > 0 ? '+' : ''}${difference.toFixed(2)} ج.م`
          });
        
        if (paymentError) throw paymentError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-orders"] });
      queryClient.invalidateQueries({ queryKey: ["delivery_agents"] });
      queryClient.invalidateQueries({ queryKey: ["agent_payments"] });
      toast.success("تم تحديث سعر الشحن");
    },
  });

  const deleteOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      // First, get the order details to check agent assignment
      const { data: order, error: orderFetchError } = await supabase
        .from("orders")
        .select("delivery_agent_id, total_amount, shipping_cost, agent_shipping_cost")
        .eq("id", orderId)
        .maybeSingle();
      
      if (orderFetchError) throw orderFetchError;

      // Delete agent_payments related to this order
      await supabase
        .from("agent_payments")
        .delete()
        .eq("order_id", orderId);

      // Delete returns related to this order
      await supabase
        .from("returns")
        .delete()
        .eq("order_id", orderId);

      // Delete order items
      const { error: itemsError } = await supabase
        .from("order_items")
        .delete()
        .eq("order_id", orderId);
      
      if (itemsError) throw itemsError;

      // Update agent's total_owed if agent was assigned
      if (order && order.delivery_agent_id) {
        const owedAmount = parseFloat(order.total_amount?.toString() || "0") + 
                          parseFloat(order.shipping_cost?.toString() || "0") - 
                          parseFloat(order.agent_shipping_cost?.toString() || "0");
        
        // Get current total_owed
        const { data: agentData, error: fetchError } = await supabase
          .from("delivery_agents")
          .select("total_owed")
          .eq("id", order.delivery_agent_id)
          .maybeSingle();
        
        if (!fetchError && agentData) {
          const currentOwed = parseFloat(agentData.total_owed?.toString() || "0");
          const newOwed = currentOwed - owedAmount;
          
          await supabase
            .from("delivery_agents")
            .update({ total_owed: newOwed })
            .eq("id", order.delivery_agent_id);
        }
      }

      // Delete the order
      const { error } = await supabase
        .from("orders")
        .delete()
        .eq("id", orderId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-orders"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["all-orders"] });
      queryClient.invalidateQueries({ queryKey: ["delivery_agents"] });
      queryClient.invalidateQueries({ queryKey: ["agent_payments"] });
      toast.success("تم حذف الأوردر");
    },
    onError: (error) => {
      console.error("Error deleting order:", error);
      toast.error("حدث خطأ أثناء حذف الأوردر");
    },
  });

  const unassignAgentMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase
        .from("orders")
        .update({ 
          delivery_agent_id: null,
          status: 'pending'
        })
        .eq("id", orderId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-orders"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["all-orders"] });
      queryClient.invalidateQueries({ queryKey: ["delivery_agents"] });
      queryClient.invalidateQueries({ queryKey: ["agent_payments"] });
      toast.success("تم إلغاء تعيين المندوب");
    },
  });

  const createReturnMutation = useMutation({
    mutationFn: async (data: any) => {
      // Upsert by order_id to avoid duplicates affecting summary totals
      const { data: existingReturn, error: existingErr } = await supabase
        .from("returns")
        .select("id")
        .eq("order_id", data.order_id)
        .maybeSingle();
      if (existingErr) throw existingErr;

      if (existingReturn?.id) {
        const { error } = await supabase
          .from("returns")
          .update({
            customer_id: data.customer_id,
            delivery_agent_id: data.delivery_agent_id,
            return_amount: data.return_amount,
            returned_items: data.returned_items,
            notes: data.notes,
          })
          .eq("id", existingReturn.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("returns")
          .insert({
            order_id: data.order_id,
            customer_id: data.customer_id,
            delivery_agent_id: data.delivery_agent_id,
            return_amount: data.return_amount,
            returned_items: data.returned_items,
            notes: data.notes,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["returns"] });
      queryClient.invalidateQueries({ queryKey: ["agent-returns", selectedAgentId] });
      queryClient.invalidateQueries({ queryKey: ["agent_payments_full", selectedAgentId] });
      queryClient.invalidateQueries({ queryKey: ["delivery_agents"] });
      toast.success("تم تسجيل المرتجع بنجاح");
      setReturnDialogOpen(false);
      setSelectedOrderForReturn(null);
      setReturnData({ returned_items: [], notes: "", removeShipping: false });
    },
  });

  const handleOpenReturnDialog = (order: any) => {
    setSelectedOrderForReturn(order);
    const items = order.order_items.map((item: any) => ({
      product_id: item.product_id,
      product_name: item.products.name,
      total_quantity: item.quantity,
      returned_quantity: 0,
      price: parseFloat(item.price.toString())
    }));
    setReturnData({ returned_items: items, notes: "", removeShipping: false });
    setReturnDialogOpen(true);
  };

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

  const handleExportExcel = () => {
    if (selectedOrders.length === 0) {
      toast.error("يرجى اختيار أوردرات للتصدير");
      return;
    }

    const selectedOrdersData = orders?.filter(o => selectedOrders.includes(o.id));
    
    const exportData = selectedOrdersData?.map(order => {
      const customerShipping = parseFloat(order.shipping_cost?.toString() || "0");
      const agentShipping = parseFloat(order.agent_shipping_cost?.toString() || "0");
      const totalAmount = parseFloat(order.total_amount.toString());
      const totalPrice = totalAmount + customerShipping;
      const netAmount = totalPrice - agentShipping;

      return {
        "رقم الأوردر": order.order_number || order.id.slice(0, 8),
        "الاسم": order.customers?.name,
        "الهاتف": order.customers?.phone,
        "العنوان": order.customers?.address,
        "المحافظة": order.customers?.governorate || "-",
        "الإجمالي": totalPrice.toFixed(2),
        "شحن المندوب": agentShipping.toFixed(2),
        "الصافي": netAmount.toFixed(2),
        "الحالة": statusLabels[order.status] || order.status,
        "التاريخ": (order as any).assigned_at ? new Date((order as any).assigned_at).toLocaleDateString("ar-EG") : "-"
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData || []);
    
    // Enhanced styling for Excel
    const colWidths = [
      { wch: 12 }, // رقم الأوردر
      { wch: 20 }, // الاسم
      { wch: 15 }, // الهاتف
      { wch: 35 }, // العنوان
      { wch: 15 }, // المحافظة
      { wch: 12 }, // الإجمالي
      { wch: 12 }, // شحن المندوب
      { wch: 12 }, // الصافي
      { wch: 12 }, // الحالة
      { wch: 12 }  // التاريخ
    ];
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "أوردرات المندوب");
    XLSX.writeFile(wb, `agent_orders_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success("تم تصدير الأوردرات بنجاح");
  };

  const handleShareWhatsApp = () => {
    if (selectedOrders.length === 0) {
      toast.error("يرجى اختيار أوردرات للمشاركة");
      return;
    }

    const selectedOrdersData = orders?.filter(o => selectedOrders.includes(o.id));
    const agentName = selectedAgent?.name || "المندوب";
    
    let message = `📋 أوردرات ${agentName}\n`;
    message += `📅 ${new Date().toLocaleDateString('ar-EG')}\n`;
    message += `━━━━━━━━━━━━━━\n`;
    
    selectedOrdersData?.forEach((order, i) => {
      const customerShipping = parseFloat(order.shipping_cost?.toString() || "0");
      const agentShipping = parseFloat(order.agent_shipping_cost?.toString() || "0");
      const totalAmount = parseFloat(order.total_amount.toString());
      const totalPrice = totalAmount + customerShipping;
      const netAmount = totalPrice - agentShipping;
      
      message += `\n${i + 1}. #${order.order_number || order.id.slice(0, 8)}\n`;
      message += `👤 ${order.customers?.name}\n`;
      message += `📱 ${order.customers?.phone}\n`;
      message += `📍 ${order.customers?.address}\n`;
      message += `💰 الإجمالي: ${totalPrice.toFixed(2)} ج.م\n`;
      message += `🚚 شحن المندوب: ${agentShipping.toFixed(2)} ج.م\n`;
      message += `✅ الصافي: ${netAmount.toFixed(2)} ج.م\n`;
    });
    
    message += `\n━━━━━━━━━━━━━━\n`;
    message += `📦 عدد الأوردرات: ${selectedOrdersData?.length}\n`;
    
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const handlePrintOrders = () => {
    if (selectedOrders.length === 0) {
      toast.error("يرجى اختيار أوردرات للطباعة");
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const selectedOrdersData = orders?.filter(o => selectedOrders.includes(o.id));
    
    const invoicesHtml = selectedOrdersData?.map(order => {
      const orderItems = order.order_items?.map((item: any) => `
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px;">${item.products?.name}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${item.quantity}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${parseFloat(item.price.toString()).toFixed(2)} ج.م</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${(parseFloat(item.price.toString()) * item.quantity).toFixed(2)} ج.م</td>
        </tr>
      `).join('');

      const customerShipping = parseFloat(order.shipping_cost?.toString() || "0");
      const agentShipping = parseFloat(order.agent_shipping_cost?.toString() || "0");
      const totalAmount = parseFloat(order.total_amount.toString());
      const discount = parseFloat(order.discount?.toString() || "0");
      const totalPrice = totalAmount + customerShipping;
      const netAmount = totalPrice - agentShipping;

      return `
        <div style="page-break-after: always; padding: 20px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <img src="/images/magou-logo.jpg" alt="Magou Fashion Logo" style="max-width: 150px; height: auto;" />
          </div>
          <h1 style="text-align: center; margin: 10px 0;">فاتورة</h1>
          <hr style="border: 1px solid #ddd; margin: 20px 0;"/>
          <div style="margin: 20px 0; line-height: 1.8;">
            <p><strong>رقم الأوردر:</strong> #${order.order_number || order.id.slice(0, 8)}</p>
            <p><strong>التاريخ:</strong> ${(order as any).assigned_at ? new Date((order as any).assigned_at).toLocaleDateString('ar-EG') : '-'}</p>
            <p><strong>اسم العميل:</strong> ${order.customers?.name}</p>
            <p><strong>الهاتف:</strong> ${order.customers?.phone}</p>
            <p><strong>الهاتف 2:</strong> ${(order.customers as any)?.phone2 || '-'}</p>
            <p><strong>المحافظة:</strong> ${order.customers?.governorate || '-'}</p>
            <p><strong>العنوان بالتفصيل:</strong> ${order.customers?.address}</p>
            ${order.notes ? `<p><strong>ملاحظات:</strong> ${order.notes}</p>` : ''}
          </div>
          <hr style="border: 1px solid #ddd; margin: 20px 0;"/>
          <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
            <thead>
              <tr>
                <th style="border: 1px solid #ddd; padding: 12px; background-color: #f2f2f2;">المنتج</th>
                <th style="border: 1px solid #ddd; padding: 12px; background-color: #f2f2f2;">الكمية</th>
                <th style="border: 1px solid #ddd; padding: 12px; background-color: #f2f2f2;">السعر</th>
                <th style="border: 1px solid #ddd; padding: 12px; background-color: #f2f2f2;">الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              ${orderItems}
            </tbody>
          </table>
          <hr style="border: 1px solid #ddd; margin: 20px 0;"/>
          <div style="margin-top: 20px; line-height: 2;">
            <p><strong>سعر المنتجات:</strong> ${totalAmount.toFixed(2)} ج.م</p>
            <p><strong>شحن العميل:</strong> ${customerShipping.toFixed(2)} ج.م</p>
            ${discount > 0 ? `<p><strong>خصم:</strong> ${discount.toFixed(2)} ج.م</p>` : ''}
            <p style="font-size: 18px;"><strong>الإجمالي:</strong> ${totalPrice.toFixed(2)} ج.م</p>
            <p><strong>شحن المندوب:</strong> ${agentShipping.toFixed(2)} ج.م</p>
            <p style="font-size: 20px; font-weight: bold; color: green;">المطلوب من المندوب: ${netAmount.toFixed(2)} ج.م</p>
          </div>
        </div>
      `;
    }).join('');

    printWindow.document.write(`
      <html dir="rtl">
        <head>
          <title>أوردرات المندوب</title>
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

  const handleBulkStatusUpdate = async () => {
    if (selectedOrders.length === 0 || !bulkStatus) {
      toast.error("الرجاء تحديد أوردرات وحالة");
      return;
    }

    try {
      for (const orderId of selectedOrders) {
        await updateStatusMutation.mutateAsync({
          id: orderId,
          status: bulkStatus,
        });
      }
      setSelectedOrders([]);
      setBulkStatusDialogOpen(false);
      setBulkStatus("");
      toast.success("تم تحديث حالة الأوردرات بنجاح");
    } catch (error) {
      console.error("Error updating bulk status:", error);
      toast.error("حدث خطأ أثناء تحديث الحالات");
    }
  };

  const handleReturnQuantityChange = (index: number, value: number) => {
    const newItems = [...returnData.returned_items];
    newItems[index].returned_quantity = Math.min(value, newItems[index].total_quantity);
    setReturnData({ ...returnData, returned_items: newItems });
  };

  const handleSubmitReturn = async () => {
    const returnedItems = returnData.returned_items.filter(item => item.returned_quantity > 0);
    
    if (returnedItems.length === 0) {
      toast.error("يرجى تحديد كمية المرتجع");
      return;
    }

    const returnAmount = returnedItems.reduce((sum, item) => 
      sum + (item.price * item.returned_quantity), 0
    );

    const allReturned = returnData.returned_items.every(item => 
      item.returned_quantity === item.total_quantity
    );

    // تحديد الحالة
    let newStatus = allReturned ? "returned" : "partially_returned";
    if (returnData.removeShipping) {
      newStatus = "return_no_shipping";
    }

    // Update order status
    await updateStatusMutation.mutateAsync({
      id: selectedOrderForReturn.id,
      status: newStatus,
      removeShipping: returnData.removeShipping,
      skipAutoReturnUpsert: true,
    });

    // Create return record
    await createReturnMutation.mutateAsync({
      order_id: selectedOrderForReturn.id,
      customer_id: selectedOrderForReturn.customer_id,
      delivery_agent_id: selectedOrderForReturn.delivery_agent_id,
      return_amount: returnAmount,
      returned_items: returnedItems.map(item => ({
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.returned_quantity,
        price: item.price
      })),
      notes: returnData.notes
    });
  };

  const handlePrintOrder = (order: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const orderItems = order.order_items?.map((item: any) => `
      <tr>
        <td style="border: 1px solid #ddd; padding: 8px;">${item.products?.name}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${item.quantity}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${parseFloat(item.price.toString()).toFixed(2)} ج.م</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${(parseFloat(item.price.toString()) * item.quantity).toFixed(2)} ج.م</td>
      </tr>
    `).join('');

    const customerShipping = parseFloat(order.shipping_cost?.toString() || "0");
    const agentShipping = parseFloat(order.agent_shipping_cost?.toString() || "0");
    const totalAmount = parseFloat(order.total_amount.toString());
    const discount = parseFloat(order.discount?.toString() || "0");
    const totalPrice = totalAmount + customerShipping;
    const netAmount = totalPrice - agentShipping;

    printWindow.document.write(`
      <html dir="rtl">
        <head>
          <title>فاتورة - ${order.order_number || order.id.slice(0, 8)}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .logo { text-align: center; margin-bottom: 20px; }
            .logo img { max-width: 150px; height: auto; }
            h1 { text-align: center; margin: 10px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 12px; text-align: right; }
            th { background-color: #f2f2f2; }
            .info { margin: 20px 0; line-height: 1.8; }
            .total { font-size: 16px; margin-top: 20px; line-height: 2; }
            .final-total { font-size: 20px; font-weight: bold; color: green; }
            hr { border: 1px solid #ddd; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="logo">
            <img src="/images/magou-logo.jpg" alt="Magou Fashion Logo" />
          </div>
          <h1>فاتورة</h1>
          <hr/>
          <div class="info">
            <p><strong>رقم الأوردر:</strong> #${order.order_number || order.id.slice(0, 8)}</p>
            <p><strong>التاريخ:</strong> ${(order as any).assigned_at ? new Date((order as any).assigned_at).toLocaleDateString('ar-EG') : '-'}</p>
            <p><strong>اسم العميل:</strong> ${order.customers?.name}</p>
            <p><strong>الهاتف:</strong> ${order.customers?.phone}</p>
            <p><strong>الهاتف 2:</strong> ${(order.customers as any)?.phone2 || '-'}</p>
            <p><strong>المحافظة:</strong> ${order.customers?.governorate || '-'}</p>
            <p><strong>العنوان بالتفصيل:</strong> ${order.customers?.address}</p>
            ${order.notes ? `<p><strong>ملاحظات:</strong> ${order.notes}</p>` : ''}
          </div>
          <hr/>
          <table>
            <thead>
              <tr>
                <th>المنتج</th>
                <th>الكمية</th>
                <th>السعر</th>
                <th>الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              ${orderItems}
            </tbody>
          </table>
          <hr/>
          <div class="total">
            <p><strong>سعر المنتجات:</strong> ${totalAmount.toFixed(2)} ج.م</p>
            <p><strong>شحن العميل:</strong> ${customerShipping.toFixed(2)} ج.م</p>
            ${discount > 0 ? `<p><strong>خصم:</strong> ${discount.toFixed(2)} ج.م</p>` : ''}
            <p style="font-size: 18px;"><strong>الإجمالي:</strong> ${totalPrice.toFixed(2)} ج.م</p>
            <p><strong>شحن المندوب:</strong> ${agentShipping.toFixed(2)} ج.م</p>
            <p class="final-total">المطلوب من المندوب: ${netAmount.toFixed(2)} ج.م</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  // Print summary function
  const handlePrintSummary = () => {
    if (!summaryData || !selectedAgentId) {
      toast.error("لا توجد بيانات للطباعة");
      return;
    }

    const agent = agents?.find(a => a.id === selectedAgentId);
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html dir="rtl">
        <head>
          <title>ملخص مستحقات المندوب</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .logo { text-align: center; margin-bottom: 20px; }
            .logo img { max-width: 150px; height: auto; }
            h1 { text-align: center; margin: 10px 0; }
            .info { margin: 20px 0; line-height: 2; }
            .summary-item { 
              display: flex; 
              justify-content: space-between; 
              padding: 10px; 
              border-bottom: 1px solid #ddd; 
            }
            .summary-item.total { 
              font-weight: bold; 
              font-size: 18px; 
              background-color: #f5f5f5; 
            }
            .label { color: #666; }
            .value { font-weight: bold; }
            .positive { color: green; }
            .negative { color: red; }
            hr { border: 1px solid #ddd; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="logo">
            <img src="/images/magou-logo.jpg" alt="Magou Fashion Logo" />
          </div>
          <h1>ملخص مستحقات المندوب</h1>
          <hr/>
          <div class="info">
            <p><strong>المندوب:</strong> ${agent?.name || 'غير محدد'} (${agent?.serial_number || '-'})</p>
            <p><strong>التاريخ:</strong> ${new Date(summaryDateFilter).toLocaleDateString('ar-EG')}</p>
            <p><strong>تاريخ الطباعة:</strong> ${new Date().toLocaleString('ar-EG')}</p>
          </div>
          <hr/>
          <div class="summary">
            <div class="summary-item total ${summaryData.agentReceivables >= 0 ? 'negative' : 'positive'}">
              <span class="label">مستحقات على المندوب</span>
              <span class="value">${summaryData.agentReceivables.toFixed(2)} ج.م</span>
            </div>
            <div class="summary-item">
              <span class="label">الأوردرات المسلمة (صافي)</span>
              <span class="value">${summaryData.deliveredNet.toFixed(2)} ج.م (${summaryData.deliveredCount} أوردر)</span>
            </div>
            <div class="summary-item">
              <span class="label">شحن المندوب</span>
              <span class="value">${summaryData.deliveredAgentShipping.toFixed(2)} ج.م</span>
            </div>
            <div class="summary-item">
              <span class="label">أوردرات في الطريق</span>
              <span class="value">${summaryData.shippedCount} أوردر (صافي ${summaryData.shippedNet.toFixed(2)} ج.م)</span>
            </div>
          </div>
          <hr/>
          <p style="text-align: center; font-size: 12px; color: #999;">
            تم إنشاء هذا التقرير تلقائياً
          </p>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-accent/20 py-8">
      <div className="container mx-auto px-4">
        <Button onClick={() => navigate("/admin")} variant="ghost" className="mb-4">
          <ArrowLeft className="ml-2 h-4 w-4" />
          الرجوع إلى الصفحة الرئيسية
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <CardTitle>أوردرات المندوب</CardTitle>
              {selectedAgentId && (
                <Button onClick={scrollToSummary} variant="outline" size="sm">
                  <ArrowDown className="ml-2 h-4 w-4" />
                  الذهاب للملخص
                </Button>
              )}
            </div>
            <div className="mt-4 space-y-4">
              <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="اختر مندوب" />
                </SelectTrigger>
                <SelectContent>
                  {agents?.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name} - {agent.serial_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedAgentId && (
                <>
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">بحث:</span>
                      <Input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="رقم الطلب، اسم العميل، أو رقم الهاتف"
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
                          {Object.entries(statusLabels).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">تاريخ محدد:</span>
                      <Input
                        type="date"
                        value={singleDateFilter}
                        onChange={(e) => {
                          setSingleDateFilter(e.target.value);
                          if (e.target.value) {
                            setStartDate("");
                            setEndDate("");
                          }
                        }}
                        className="w-40"
                      />
                      {singleDateFilter && (
                        <Button size="sm" variant="ghost" onClick={() => setSingleDateFilter("")}>
                          إلغاء
                        </Button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">من تاريخ:</span>
                      <Input
                        type="date"
                        value={startDate}
                        onChange={(e) => {
                          setStartDate(e.target.value);
                          setSingleDateFilter("");
                        }}
                        className="w-40"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">إلى تاريخ:</span>
                      <Input
                        type="date"
                        value={endDate}
                        onChange={(e) => {
                          setEndDate(e.target.value);
                          setSingleDateFilter("");
                        }}
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
                      <Button onClick={handleShareWhatsApp} size="sm" variant="outline" className="text-green-600 border-green-600 hover:bg-green-50">
                        <MessageCircle className="ml-2 h-4 w-4" />
                        واتساب
                      </Button>
                      <Button onClick={handlePrintOrders} size="sm" variant="outline">
                        <Printer className="ml-2 h-4 w-4" />
                        طباعة
                      </Button>
                      {canEditAgentOrders && (
                      <Button 
                        onClick={() => setBulkStatusDialogOpen(true)} 
                        size="sm" 
                        variant="default"
                      >
                        تغيير الحالة للمحدد
                      </Button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!selectedAgentId ? (
              <p className="text-center text-muted-foreground py-8">اختر مندوب لعرض أوردراته</p>
            ) : isLoading ? (
              <p className="text-center py-8">جاري التحميل...</p>
            ) : !filteredOrders || filteredOrders.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">لا توجد أوردرات لهذا المندوب</p>
            ) : (
              <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          <Checkbox
                            checked={selectedOrders.length === filteredOrders?.length}
                            onCheckedChange={toggleSelectAll}
                          />
                        </TableHead>
                        <TableHead>رقم الأوردر</TableHead>
                        <TableHead>العميل</TableHead>
                        <TableHead>الهاتف</TableHead>
                        <TableHead>العنوان</TableHead>
                        <TableHead>المنتجات</TableHead>
                        <TableHead>الإجمالي</TableHead>
                        <TableHead>شحن المندوب</TableHead>
                        <TableHead>الصافي</TableHead>
                        <TableHead>الحالة</TableHead>
                        <TableHead>تاريخ التعيين</TableHead>
                        <TableHead>إجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrders.map((order) => {
                        const customerShipping = parseFloat(order.shipping_cost?.toString() || "0");
                        const agentShipping = parseFloat(order.agent_shipping_cost?.toString() || "0");
                        const totalAmount = parseFloat(order.total_amount.toString());
                        const totalPrice = totalAmount + customerShipping; // الإجمالي (ثابت)
                        const netAmount = totalPrice - agentShipping; // الصافي (المستحقات)
                        
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
                            <TableCell className="font-medium">
                              {order.customers?.name}
                            </TableCell>
                            <TableCell>{order.customers?.phone}</TableCell>
                            <TableCell className="max-w-xs whitespace-normal break-words">
                              {order.customers?.address}
                            </TableCell>
                            <TableCell className="max-w-[200px]">
                              <div className="space-y-1">
                                {(order.order_items || []).map((item: any, idx: number) => (
                                  <div key={idx} className="flex items-center justify-between text-sm gap-2">
                                    <span className="truncate flex-1">{item.products?.name || "منتج محذوف"}</span>
                                    <Badge variant="outline" className="shrink-0">
                                      {item.quantity}
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell className="font-bold text-blue-600">
                              {totalPrice.toFixed(2)} ج.م
                            </TableCell>
                            <TableCell>
                              {editingShipping === order.id ? (
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={newShipping}
                                    onChange={(e) => setNewShipping(e.target.value)}
                                    className="w-20"
                                  />
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      updateShippingMutation.mutate({
                                        orderId: order.id,
                                        newShipping: parseFloat(newShipping),
                                        oldShipping: agentShipping,
                                        agentId: order.delivery_agent_id!,
                                        assignedAt: (order as any).assigned_at || order.updated_at || order.created_at
                                      });
                                      setEditingShipping(null);
                                    }}
                                  >
                                    حفظ
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setEditingShipping(null)}
                                  >
                                    ✕
                                  </Button>
                                </div>
                              ) : (
                                <div
                                  className="text-orange-600 font-semibold cursor-pointer hover:bg-accent p-2 rounded"
                                  onClick={() => {
                                    setEditingShipping(order.id);
                                    setNewShipping(agentShipping.toString());
                                  }}
                                >
                                  {agentShipping.toFixed(2)} ج.م
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="font-bold text-green-600">
                              {netAmount.toFixed(2)} ج.م
                            </TableCell>
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
                                  defaultValue={order.status}
                                  onValueChange={(value) => {
                                    updateStatusMutation.mutate({ id: order.id, status: value });
                                  }}
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Object.entries(statusLabels).map(([value, label]) => (
                                      <SelectItem key={value} value={value}>
                                        <div className="flex items-center gap-2">
                                          <div className={`w-2 h-2 rounded-full ${statusColors[value]}`} />
                                          {label}
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <AlertDialogFooter>
                                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                         </TableCell>
                         <TableCell className="text-sm text-muted-foreground">
                           {(() => {
                             const assignedAt = (order as any).assigned_at || order.updated_at || order.created_at;
                             return new Date(assignedAt).toLocaleDateString('ar-EG', {
                               year: 'numeric',
                               month: 'short',
                               day: 'numeric',
                               hour: '2-digit',
                               minute: '2-digit'
                             });
                           })()}
                         </TableCell>
                         <TableCell>
                           <div className="flex gap-2 flex-wrap">
                             <Button
                               variant="ghost"
                               size="icon"
                               onClick={() => {
                                 const phone = order.customers?.phone || "";
                                 const formattedPhone = phone.startsWith("0") ? `+2${phone.substring(1)}` : phone;
                                 const message = `مرحباً ${order.customers?.name}، تم شحن طلبك رقم #${order.order_number}. سيصلك قريباً مع مندوب التوصيل.`;
                                 window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`, '_blank');
                               }}
                               title="تأكيد عبر واتساب"
                               className="bg-green-500 hover:bg-green-600 text-white"
                             >
                               <MessageCircle className="h-4 w-4" />
                             </Button>
                             <Button
                               variant="ghost"
                               size="icon"
                               onClick={() => handlePrintOrder(order)}
                               title="طباعة الفاتورة"
                             >
                               <Printer className="h-4 w-4" />
                             </Button>
                             <Button
                               variant="ghost"
                               size="icon"
                               onClick={() => {
                                 const phone = order.customers?.phone || "";
                                 const formattedPhone = phone.startsWith("0") ? `+2${phone.substring(1)}` : phone;
                                 const message = `مرحباً ${order.customers?.name}، تم شحن طلبك رقم #${order.order_number}. سيصلك قريباً مع مندوب التوصيل.`;
                                 window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`, '_blank');
                               }}
                               title="تأكيد عبر واتساب"
                               className="bg-green-500 hover:bg-green-600 text-white"
                             >
                               <MessageCircle className="h-4 w-4" />
                             </Button>
                             <Button
                               variant="ghost"
                               size="icon"
                               onClick={() => handlePrintOrder(order)}
                               title="طباعة الفاتورة"
                             >
                               <Printer className="h-4 w-4" />
                             </Button>
                             {canEditAgentOrders && (<>
                             <AlertDialog>
                               <AlertDialogTrigger asChild>
                                 <Button
                                   variant="outline"
                                   size="sm"
                                 >
                                   <PackageX className="ml-2 h-4 w-4" />
                                   مرتجع
                                 </Button>
                               </AlertDialogTrigger>
                               <AlertDialogContent>
                                 <AlertDialogHeader>
                                   <AlertDialogTitle>تأكيد المرتجع</AlertDialogTitle>
                                   <AlertDialogDescription>
                                     هل أنت متأكد من تسجيل هذا الأوردر كمرتجع؟
                                   </AlertDialogDescription>
                                 </AlertDialogHeader>
                                 <AlertDialogFooter>
                                   <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                   <AlertDialogAction onClick={() => {
                                     setPendingReturnOrder(order);
                                     setConfirmReturnDialogOpen(true);
                                   }}>
                                     تأكيد
                                   </AlertDialogAction>
                                 </AlertDialogFooter>
                               </AlertDialogContent>
                             </AlertDialog>
                             <AlertDialog>
                               <AlertDialogTrigger asChild>
                                 <Button
                                   variant="destructive"
                                   size="sm"
                                 >
                                   <Trash2 className="h-4 w-4" />
                                 </Button>
                               </AlertDialogTrigger>
                               <AlertDialogContent>
                                 <AlertDialogHeader>
                                   <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                                   <AlertDialogDescription>
                                     هل أنت متأكد من حذف الأوردر؟ سيتم حذف جميع البيانات المرتبطة به.
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
                             <RescheduleOrderDialog order={order} />
                             <AlertDialog>
                               <AlertDialogTrigger asChild>
                                 <Button
                                   variant="outline"
                                   size="sm"
                                 >
                                   إلغاء التعيين
                                 </Button>
                               </AlertDialogTrigger>
                               <AlertDialogContent>
                                 <AlertDialogHeader>
                                   <AlertDialogTitle>تأكيد إلغاء التعيين</AlertDialogTitle>
                                   <AlertDialogDescription>
                                     هل أنت متأكد من إلغاء تعيين المندوب؟ سيتم إرجاع الأوردر إلى قائمة الأوردرات.
                                   </AlertDialogDescription>
                                 </AlertDialogHeader>
                                 <AlertDialogFooter>
                                   <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                   <AlertDialogAction onClick={() => unassignAgentMutation.mutate(order.id)}>
                                     إلغاء التعيين
                                   </AlertDialogAction>
                                 </AlertDialogFooter>
                               </AlertDialogContent>
                             </AlertDialog>
                           </>)}
                            </div>
                         </TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                
                {/* Orders Summary - visible only when there are orders in the filter */}
                <div className="mt-6 p-4 bg-accent rounded-lg space-y-2">
                  <h3 className="font-bold mb-2">ملخص الأوردرات المعروضة</h3>
                  <p>عدد الأوردرات: {filteredOrders.length}</p>
                  <p className="font-bold text-lg text-purple-600">
                    إجمالي الأوردرات: {filteredOrders.reduce((sum, order) => {
                      const total = parseFloat(order.total_amount.toString());
                      const customerShipping = parseFloat(order.shipping_cost?.toString() || "0");
                      return sum + (total + customerShipping);
                    }, 0).toFixed(2)} ج.م
                  </p>
                  <p className="font-bold text-lg text-orange-600">
                    شحن المندوب (خصم): {filteredOrders.reduce((sum, order) => sum + parseFloat(order.agent_shipping_cost?.toString() || "0"), 0).toFixed(2)} ج.م
                  </p>
                  <p className="font-bold text-xl text-green-600">
                    الصافي المطلوب من المندوب (من الأوردرات المعروضة): {filteredOrders.reduce((sum, order) => {
                      const total = parseFloat(order.total_amount.toString());
                      const customerShipping = parseFloat(order.shipping_cost?.toString() || "0");
                      const agentShipping = parseFloat(order.agent_shipping_cost?.toString() || "0");
                      return sum + (total + customerShipping - agentShipping);
                    }, 0).toFixed(2)} ج.م
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Agent Summary Card - Always visible when agent is selected */}
        {selectedAgentId && (
          <Card ref={summaryRef} className="mt-6">
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <CardTitle>ملخص مستحقات المندوب</CardTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handlePrintSummary()}
                  >
                    <Printer className="ml-2 h-4 w-4" />
                    طباعة الملخص
                  </Button>

                  {canEditAgentOrders && (<>
                  <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="ml-2 h-4 w-4" />
                        إضافة دفعة
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>إضافة دفعة مقدمة</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div>
                          <Label>المبلغ (ج.م)</Label>
                          <Input
                            type="number"
                            value={paymentAmount}
                            onChange={(e) => setPaymentAmount(e.target.value)}
                            placeholder="أدخل المبلغ"
                          />
                        </div>
                        <div>
                          <Label>طريقة الدفع</Label>
                          <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as "cash" | "transfer")}>
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="cash">💵 كاش</SelectItem>
                              <SelectItem value="transfer">💳 نقدي (تحويل)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>إضافة الدفعة ليوم</Label>
                          <Select value={paymentDate} onValueChange={setPaymentDate}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="اختر التاريخ" />
                            </SelectTrigger>
                            <SelectContent>
                              {paymentDateOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>الخزنة (إجباري)</Label>
                          <Select 
                            value={selectedCashboxId} 
                            onValueChange={(val) => {
                              // Check if selected cashbox is today's
                              const selectedBox = cashboxes?.find((c: any) => c.id === val);
                              const isTodayBox = selectedBox?.name === getDailyCashboxName(todayCashboxDate);
                              
                              if (!isTodayBox && !nonTodayCashboxUnlocked) {
                                // Require admin password
                                setCashboxPasswordDialogOpen(true);
                                return;
                              }
                              setSelectedCashboxId(val);
                            }}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="اختر الخزنة" />
                            </SelectTrigger>
                            <SelectContent>
                              {cashboxes?.map((cashbox: any) => {
                                const isTodayBox = cashbox.name === getDailyCashboxName(todayCashboxDate);
                                return (
                                  <SelectItem key={cashbox.id} value={cashbox.id}>
                                    {cashbox.name} {isTodayBox ? "✅" : "🔒"}
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground mt-1">
                            {nonTodayCashboxUnlocked 
                              ? "✅ تم فتح القفل - يمكنك اختيار أي خزنة"
                              : "خزنة اليوم مختارة تلقائياً. اختيار خزنة أخرى يتطلب كلمة المرور الإدارية 🔒"
                            }
                          </p>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          سيتم إضافة هذه الدفعة ليوم {paymentDate === today ? "اليوم" : paymentDate}
                        </p>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setPaymentDialogOpen(false);
                            setPaymentDate(today);
                            setSelectedCashboxId(todayCashbox?.id || "");
                            setNonTodayCashboxUnlocked(false);
                            setPaymentMethod("cash");
                          }}
                        >
                          إلغاء
                        </Button>
                        <Button onClick={handleAddPayment}>إضافة الدفعة</Button>
                      </div>

                      {/* Admin Password Dialog for non-today cashbox */}
                      <Dialog open={cashboxPasswordDialogOpen} onOpenChange={setCashboxPasswordDialogOpen}>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                              <Lock className="h-5 w-5" />
                              كلمة المرور الإدارية مطلوبة
                            </DialogTitle>
                          </DialogHeader>
                          <p className="text-sm text-muted-foreground">
                            اختيار خزنة غير خزنة اليوم يتطلب كلمة المرور الإدارية
                          </p>
                          <Input
                            type="password"
                            value={cashboxPasswordInput}
                            onChange={(e) => setCashboxPasswordInput(e.target.value)}
                            placeholder="أدخل كلمة المرور الإدارية"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                verifyCashboxPassword(cashboxPasswordInput);
                              }
                            }}
                          />
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" onClick={() => {
                              setCashboxPasswordDialogOpen(false);
                              setCashboxPasswordInput("");
                            }}>
                              إلغاء
                            </Button>
                            <Button onClick={() => verifyCashboxPassword(cashboxPasswordInput)}>
                              تأكيد
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </DialogContent>
                  </Dialog>

                  <Dialog open={paymentsManagerOpen} onOpenChange={setPaymentsManagerOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline">
                        <Calendar className="ml-2 h-4 w-4" />
                        تعديل/حذف الدفعات
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl">
                      <DialogHeader>
                        <DialogTitle>دفعات يوم {summaryDateFilter}</DialogTitle>
                      </DialogHeader>

                      {(() => {
                        const dayPayments = (agentPaymentsData || [])
                          .filter((p: any) => {
                            const pDate = (p as any).payment_date || getDateKey(p.created_at || "");
                            return p.payment_type === "payment" && pDate === summaryDateFilter;
                          })
                          .sort((a: any, b: any) =>
                            new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
                          );

                        if (dayPayments.length === 0) {
                          return (
                            <p className="text-sm text-muted-foreground py-4">
                              لا توجد دفعات مسجلة لهذا اليوم.
                            </p>
                          );
                        }

                        return (
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>المبلغ</TableHead>
                                  <TableHead>اليوم</TableHead>
                                  <TableHead>ملاحظات</TableHead>
                                  <TableHead className="text-left">إجراء</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {dayPayments.map((p: any) => {
                                  const currentDate = (p as any).payment_date || getDateKey(p.created_at || "");
                                  const isEditing = editingPaymentId === p.id;
                                  return (
                                    <TableRow key={p.id}>
                                      <TableCell>
                                        {isEditing ? (
                                          <Input
                                            type="number"
                                            value={editPaymentAmount}
                                            onChange={(e) => setEditPaymentAmount(e.target.value)}
                                          />
                                        ) : (
                                          `${parseFloat((p.amount ?? 0).toString()).toFixed(2)} ج.م`
                                        )}
                                      </TableCell>
                                      <TableCell>
                                        {isEditing ? (
                                          <Input
                                            type="date"
                                            value={editPaymentDate}
                                            onChange={(e) => setEditPaymentDate(e.target.value)}
                                          />
                                        ) : (
                                          currentDate
                                        )}
                                      </TableCell>
                                      <TableCell className="max-w-[320px] truncate">
                                        {p.notes || "-"}
                                      </TableCell>
                                      <TableCell>
                                        <div className="flex items-center gap-2 justify-end">
                                          {isEditing ? (
                                            <>
                                              <Button
                                                size="sm"
                                                onClick={() => {
                                                  const amt = parseFloat(editPaymentAmount);
                                                  if (isNaN(amt) || amt <= 0) return toast.error("مبلغ غير صحيح");
                                                  const oldAmt = parseFloat((p.amount ?? 0).toString());
                                                  updatePaymentMutation.mutate({
                                                    id: p.id,
                                                    amount: amt,
                                                    payment_date: editPaymentDate,
                                                    oldAmount: oldAmt,
                                                    oldDate: currentDate,
                                                  });
                                                }}
                                              >
                                                حفظ
                                              </Button>
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => setEditingPaymentId(null)}
                                              >
                                                إلغاء
                                              </Button>
                                            </>
                                          ) : (
                                            <>
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => {
                                                  setEditingPaymentId(p.id);
                                                  setEditPaymentAmount(
                                                    parseFloat((p.amount ?? 0).toString()).toFixed(2)
                                                  );
                                                  setEditPaymentDate(currentDate);
                                                }}
                                              >
                                                <Edit2 className="h-4 w-4" />
                                              </Button>

                                              <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                  <Button size="sm" variant="destructive">
                                                    <Trash2 className="h-4 w-4" />
                                                  </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                  <AlertDialogHeader>
                                                    <AlertDialogTitle>حذف الدفعة</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                      هل أنت متأكد من حذف هذه الدفعة؟
                                                    </AlertDialogDescription>
                                                  </AlertDialogHeader>
                                                  <AlertDialogFooter>
                                                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                                    <AlertDialogAction
                                                      onClick={() => {
                                                        const delAmt = parseFloat((p.amount ?? 0).toString());
                                                        deletePaymentMutation.mutate({ 
                                                          id: p.id, 
                                                          deletedAmount: delAmt, 
                                                          deletedDate: currentDate 
                                                        });
                                                      }}
                                                    >
                                                      حذف
                                                    </AlertDialogAction>
                                                  </AlertDialogFooter>
                                                </AlertDialogContent>
                                              </AlertDialog>
                                            </>
                                          )}
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        );
                      })()}

                      <div className="flex justify-end">
                        <Button variant="outline" onClick={() => setPaymentsManagerOpen(false)}>
                          إغلاق
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                  </>)}
                </div>
              </div>
              <div className="mt-4 flex items-center gap-4 flex-wrap">
                <div>
                  <Label>اختر التاريخ:</Label>
                  <Select value={summaryDateFilter} onValueChange={setSummaryDateFilter}>
                    <SelectTrigger className="w-48 mt-1">
                      <SelectValue placeholder="اليوم" />
                    </SelectTrigger>
                    <SelectContent>
                      {uniqueDates.map((date) => (
                        <SelectItem key={date} value={date}>
                          <div className="flex items-center gap-2">
                            {isDayClosed(date) && <Lock className="h-3 w-3 text-green-600" />}
                            {new Date(date).toLocaleDateString('ar-EG')}
                            {isDayClosed(date) && <span className="text-xs text-green-600">(مقفل)</span>}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* زر التقفيل */}
                {summaryData && !isDayClosed(summaryDateFilter) && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        size="sm" 
                        variant="default"
                        className="mt-5 bg-green-600 hover:bg-green-700"
                      >
                        <Check className="ml-2 h-4 w-4" />
                        تم التقفيل
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-yellow-500" />
                          تأكيد التقفيل
                        </AlertDialogTitle>
                        <AlertDialogDescription className="space-y-2">
                          <p>هل أنت متأكد من تقفيل يومية {new Date(summaryDateFilter).toLocaleDateString('ar-EG')}؟</p>
                          <p className="font-bold">
                            الصافي المستحق على المندوب: {summaryData.agentReceivables.toFixed(2)} ج.م
                          </p>
                          <p className="text-yellow-600 font-semibold">
                            ⚠️ تنبيه: لا يمكن التراجع عن التقفيل بعد التأكيد
                          </p>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => {
                            closeDayMutation.mutate({
                              date: summaryDateFilter,
                              netAmount: summaryData.agentReceivables,
                            });
                          }}
                        >
                          تأكيد التقفيل
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
                
                {/* علامة أن اليوم مقفل */}
                {isDayClosed(summaryDateFilter) && (
                  <div className="mt-5 flex items-center gap-2 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg border border-green-300 dark:border-green-700">
                    <Lock className="h-4 w-4" />
                    <span className="font-medium">تم التقفيل</span>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {summaryData ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* إجمالي قيمة الأوردرات اليوم */}
                    <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm text-muted-foreground">إجمالي قيمة الأوردرات (اليوم)</p>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 text-xs">
                              شرح التفاصيل
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>شرح ملخص المندوب</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-3 text-sm">
                              <div className="p-3 bg-accent rounded-lg">
                                <p className="font-bold mb-1">إجمالي قيمة الأوردرات:</p>
                                <p>= مجموع أسعار جميع الأوردرات (سعر المنتجات + شحن العميل)</p>
                                <p className="mt-1">القيمة الحالية: <span className="font-bold text-red-600">{summaryData.allOrdersTotal.toFixed(2)} ج.م</span> ({summaryData.allOrdersCount} أوردر)</p>
                              </div>
                              <div className="p-3 bg-accent rounded-lg">
                                <p className="font-bold mb-1">شحن المندوب:</p>
                                <p>= إجمالي شحن المندوب المخصوم من الإجمالي</p>
                                <p className="mt-1">القيمة الحالية: <span className="font-bold text-amber-600">{summaryData.allAgentShipping.toFixed(2)} ج.م</span></p>
                              </div>
                              <div className="p-3 bg-accent rounded-lg">
                                <p className="font-bold mb-1">الصافي (فلوسك):</p>
                                <p>= الإجمالي - شحن المندوب</p>
                                <p className="mt-1">القيمة الحالية: <span className="font-bold text-primary">{summaryData.allOrdersNet.toFixed(2)} ج.م</span></p>
                              </div>
                              <div className="p-3 bg-accent rounded-lg">
                                <p className="font-bold mb-1">المسلم (delivered):</p>
                                <p>= صافي الأوردرات التي حالتها "تم التوصيل" (بعد خصم شحن المندوب)</p>
                                <p className="mt-1">القيمة الحالية: <span className="font-bold text-green-600">{summaryData.deliveredNet.toFixed(2)} ج.م</span></p>
                              </div>
                              <div className="p-3 bg-accent rounded-lg">
                                <p className="font-bold mb-1">الدفعة المقدمة:</p>
                                <p>= المبالغ المسلمة مقدماً من المندوب</p>
                                <p className="mt-1">القيمة الحالية: <span className="font-bold text-blue-600">{summaryData.totalPaid.toFixed(2)} ج.م</span></p>
                              </div>
                              <div className="p-3 bg-accent rounded-lg">
                                <p className="font-bold mb-1">المرتجعات:</p>
                                <p>= قيمة الأوردرات المرتجعة</p>
                                <p className="mt-1">القيمة الحالية: <span className="font-bold text-orange-600">{summaryData.returnedTotal.toFixed(2)} ج.م</span></p>
                              </div>
                              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/20 rounded-lg border border-indigo-200">
                                <p className="font-bold mb-1">الإجمالي للتقفيل:</p>
                                <p>= صافي الأوردرات المسلمة - الدفعة المقدمة</p>
                                <p>هذا هو المبلغ النهائي الذي يجب أن يسلمه المندوب عند التقفيل</p>
                                <p className="mt-1">القيمة الحالية: <span className="font-bold text-indigo-600">{summaryData.closingTotal.toFixed(2)} ج.م</span></p>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                      <p className="text-lg font-bold text-muted-foreground line-through">
                        {summaryData.allOrdersTotal.toFixed(2)} ج.م
                      </p>
                      <p className="text-xs text-muted-foreground">شحن المندوب: {summaryData.allAgentShipping.toFixed(2)} ج.م</p>
                      <p className="text-2xl font-bold text-red-600">
                        {summaryData.allOrdersNet.toFixed(2)} ج.م
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        الصافي ({summaryData.allOrdersCount} أوردر)
                      </p>
                    </div>

                    {/* الأوردرات المسلمة */}
                    <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm text-muted-foreground">الأوردرات المسلمة</p>
                        {summaryDateFilter === today && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => {
                              setEditingField('delivered');
                              setEditingValue(summaryData.deliveredNet.toFixed(2));
                            }}
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      {editingField === 'delivered' ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            className="h-8"
                          />
                          <Button size="sm" onClick={handleEditSummary}>حفظ</Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingField(null)}>إلغاء</Button>
                        </div>
                      ) : (
                        <>
                          <p className="text-2xl font-bold text-green-600">
                            {summaryData.deliveredNet.toFixed(2)} ج.م
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            عدد: {summaryData.deliveredCount} أوردر (شحن مندوب: {summaryData.deliveredAgentShipping.toFixed(2)})
                          </p>
                        </>
                      )}
                    </div>

                    {/* الدفعة المقدمة */}
                    <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm text-muted-foreground">الدفعة المقدمة</p>
                        {summaryDateFilter === today && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => {
                              setEditingField('payment');
                              setEditingValue(summaryData.totalPaid.toFixed(2));
                            }}
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      {editingField === 'payment' ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            className="h-8"
                          />
                          <Button size="sm" onClick={handleEditSummary}>حفظ</Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingField(null)}>إلغاء</Button>
                        </div>
                      ) : (
                        <p className="text-2xl font-bold text-blue-600">
                          {summaryData.totalPaid.toFixed(2)} ج.م
                        </p>
                      )}
                    </div>


                    {/* المرتجعات */}
                    <div className="p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
                      <p className="text-sm text-muted-foreground mb-1">المرتجعات</p>
                      <p className="text-2xl font-bold text-orange-600">
                        {summaryData.returnedCount} أوردر
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        بقيمة: {summaryData.returnedTotal.toFixed(2)} ج.م
                      </p>
                      <p className="text-xs text-orange-500 mt-1">
                        ({summaryData.totalReturnedItems} قطعة مرتجعة)
                      </p>
                    </div>

                    {/* أوردرات في الطريق */}
                    <div className="p-4 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                      <p className="text-sm text-muted-foreground mb-1">أوردرات في الطريق</p>
                      <p className="text-2xl font-bold text-yellow-600">
                        {summaryData.shippedCount} أوردر
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        بقيمة: {summaryData.shippedNet.toFixed(2)} ج.م (شحن مندوب: {summaryData.shippedAgentShipping.toFixed(2)})
                      </p>
                    </div>

                    {/* الإجمالي للتقفيل */}
                    <div className="p-4 bg-indigo-50 dark:bg-indigo-950/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
                      <p className="text-sm text-muted-foreground mb-1">الإجمالي للتقفيل</p>
                      <p className={`text-2xl font-bold ${summaryData.closingTotal >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>
                        {summaryData.closingTotal.toFixed(2)} ج.م
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        = المسلم ({summaryData.deliveredTotal.toFixed(2)}) - الدفعة المقدمة ({summaryData.totalPaid.toFixed(2)})
                      </p>
                    </div>
                  </div>

                  {/* قسم عدد القطع لكل منتج */}
                  {summaryData.productQuantitiesArray && summaryData.productQuantitiesArray.length > 0 && (
                    <div className="mt-6 p-4 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
                      <div className="flex items-center gap-2 mb-3">
                        <Package className="h-5 w-5 text-purple-600" />
                        <h3 className="text-lg font-semibold text-purple-700 dark:text-purple-300">
                          إجمالي القطع في يوم {summaryDateFilter}
                        </h3>
                        <Badge variant="secondary" className="bg-purple-200 text-purple-800">
                          {summaryData.totalProductQuantity} قطعة
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {summaryData.productQuantitiesArray.map((product, idx) => (
                          <div 
                            key={idx} 
                            className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded border border-purple-100 dark:border-purple-700"
                          >
                            <span className="text-sm font-medium truncate flex-1 ml-2">
                              {product.name}
                            </span>
                            <Badge className="bg-purple-600 text-white">
                              {product.quantity}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* قسم تفاصيل المرتجعات */}
                  {summaryData.returnedProductQuantitiesArray && summaryData.returnedProductQuantitiesArray.length > 0 && (
                    <div className="mt-6 p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
                      <div className="flex items-center gap-2 mb-3">
                        <PackageX className="h-5 w-5 text-orange-600" />
                        <h3 className="text-lg font-semibold text-orange-700 dark:text-orange-300">
                          تفاصيل المرتجعات في يوم {summaryDateFilter}
                        </h3>
                        <Badge variant="secondary" className="bg-orange-200 text-orange-800">
                          {summaryData.totalReturnedItems} قطعة
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {summaryData.returnedProductQuantitiesArray.map((product, idx) => (
                          <div 
                            key={idx} 
                            className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded border border-orange-100 dark:border-orange-700"
                          >
                            <span className="text-sm font-medium truncate flex-1 ml-2">
                              {product.name}
                            </span>
                            <Badge className="bg-orange-600 text-white">
                              {product.quantity}
                            </Badge>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 pt-3 border-t border-orange-200 dark:border-orange-700">
                        <p className="text-sm text-orange-700 dark:text-orange-300">
                          إجمالي قيمة المرتجعات: <span className="font-bold">{summaryData.returnedTotal.toFixed(2)} ج.م</span>
                        </p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-center text-muted-foreground py-4">لا توجد بيانات</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Confirm Return Dialog */}
        <AlertDialog open={confirmReturnDialogOpen} onOpenChange={setConfirmReturnDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                تأكيد المرتجع
              </AlertDialogTitle>
              <AlertDialogDescription>
                هل تريد إرسال هذا الأوردر إلى السلة لتعديله؟ سيتم نقله إلى صفحة السلة حيث يمكنك تقليل أو زيادة الكميات ثم تأكيد الأوردر بنفس الرقم والتاريخ.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction onClick={() => {
                if (pendingReturnOrder) {
                  // Navigate to cart with order data
                  navigate('/cart', { 
                    state: { 
                      returnOrder: pendingReturnOrder,
                      isReturn: true 
                    } 
                  });
                }
                setConfirmReturnDialogOpen(false);
                setPendingReturnOrder(null);
              }}>
                تأكيد ونقل للسلة
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Bulk Status Update Dialog */}
        <Dialog open={bulkStatusDialogOpen} onOpenChange={setBulkStatusDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>تحديث حالة الأوردرات المحددة</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                تم تحديد {selectedOrders.length} أوردر. اختر الحالة الجديدة:
              </p>
              <Select value={bulkStatus} onValueChange={setBulkStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر الحالة" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setBulkStatusDialogOpen(false)}>
                إلغاء
              </Button>
              <Button onClick={handleBulkStatusUpdate} disabled={!bulkStatus}>
                تحديث
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Return Dialog */}
        <Dialog open={returnDialogOpen} onOpenChange={setReturnDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>تسجيل مرتجع</DialogTitle>
            </DialogHeader>
            {selectedOrderForReturn && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-bold mb-2">الأوردر: {selectedOrderForReturn.id.slice(0, 8)}...</h3>
                  <p>العميل: {selectedOrderForReturn.customers?.name}</p>
                </div>

                <div>
                  <h3 className="font-bold mb-2">المنتجات المرتجعة</h3>
                  {returnData.returned_items.map((item, index) => (
                    <div key={index} className="flex items-center gap-4 mb-3 p-3 bg-accent rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium">{item.product_name}</p>
                        <p className="text-sm text-muted-foreground">
                          الكمية الكلية: {item.total_quantity} | السعر: {item.price.toFixed(2)} ج.م
                        </p>
                      </div>
                      <div className="w-32">
                        <Label htmlFor={`return-qty-${index}`} className="text-xs">
                          الكمية المرتجعة
                        </Label>
                        <Input
                          id={`return-qty-${index}`}
                          type="number"
                          min="0"
                          max={item.total_quantity}
                          value={item.returned_quantity}
                          onChange={(e) => handleReturnQuantityChange(index, parseInt(e.target.value) || 0)}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div>
                  <Label htmlFor="return-notes">ملاحظات</Label>
                  <Textarea
                    id="return-notes"
                    value={returnData.notes}
                    onChange={(e) => setReturnData({ ...returnData, notes: e.target.value })}
                    placeholder="سبب المرتجع..."
                    rows={3}
                  />
                </div>

                <div className="flex items-center space-x-2 space-x-reverse">
                  <Checkbox
                    id="remove-shipping"
                    checked={returnData.removeShipping}
                    onCheckedChange={(checked) => 
                      setReturnData({ ...returnData, removeShipping: checked as boolean })
                    }
                  />
                  <Label htmlFor="remove-shipping" className="cursor-pointer">
                    مرتجع دون شحن (خصم الشحن من المستحقات)
                  </Label>
                </div>

                <div className="p-4 bg-accent rounded-lg">
                  <p className="font-bold text-lg text-destructive">
                    قيمة المرتجع: {returnData.returned_items
                      .reduce((sum, item) => sum + (item.price * item.returned_quantity), 0)
                      .toFixed(2)} ج.م
                  </p>
                  {returnData.removeShipping && selectedOrderForReturn && (
                    <p className="font-bold text-sm text-orange-600 mt-2">
                      سيتم خصم الشحن: {parseFloat(selectedOrderForReturn.shipping_cost?.toString() || "0").toFixed(2)} ج.م
                    </p>
                  )}
                </div>

                <Button onClick={handleSubmitReturn} className="w-full">
                  تأكيد المرتجع
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default AgentOrders;