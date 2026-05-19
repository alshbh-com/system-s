import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Trash2, Plus, ArrowLeft, Edit } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAdminAuth } from "@/contexts/AdminAuthContext";

const Agents = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canEdit } = useAdminAuth();
  const canEditAgents = canEdit('agents');
  const [open, setOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<any>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [logAgent, setLogAgent] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("");
  
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    serial_number: ""
  });

  const { data: agents, isLoading } = useQuery({
    queryKey: ["delivery_agents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_agents")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (editingAgent) {
        const { error } = await supabase
          .from("delivery_agents")
          .update(data)
          .eq("id", editingAgent.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("delivery_agents")
          .insert(data);
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["delivery_agents"] });
      toast.success(editingAgent ? "تم تحديث المندوب بنجاح" : "تم إضافة المندوب بنجاح");
      setOpen(false);
      setFormData({ name: "", phone: "", serial_number: "" });
      setEditingAgent(null);
    },
    onError: () => {
      toast.error("حدث خطأ");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // تحديث الأوردرات لحالة "مندوب محذوف" وفك الارتباط
      // الأوردرات تبقى في جميع الأوردرات مع حالة agent_deleted ولا ترجع لقسم الأوردرات
      const { error: ordersErr } = await supabase
        .from("orders")
        .update({ 
          delivery_agent_id: null,
          status: 'agent_deleted' as any
        })
        .eq("delivery_agent_id", id);
      if (ordersErr) throw ordersErr;

      const { error: returnsErr } = await supabase
        .from("returns")
        .update({ delivery_agent_id: null })
        .eq("delivery_agent_id", id);
      if (returnsErr) throw returnsErr;

      const { error: paymentsErr } = await supabase
        .from("agent_payments")
        .delete()
        .eq("delivery_agent_id", id);
      if (paymentsErr) throw paymentsErr;

      // حذف التقفيلات اليومية للمندوب
      const { error: closingsErr } = await supabase
        .from("agent_daily_closings")
        .delete()
        .eq("delivery_agent_id", id);
      if (closingsErr) throw closingsErr;

      const { error } = await supabase
        .from("delivery_agents")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["delivery_agents"] });
      queryClient.invalidateQueries({ queryKey: ["all-orders"] });
      toast.success("تم حذف المندوب بنجاح");
    },
    onError: (e: any) => {
      toast.error(`حدث خطأ أثناء الحذف: ${e?.message || ''}`);
    }
  });

  const handleEdit = (agent: any) => {
    setEditingAgent(agent);
    setFormData({
      name: agent.name,
      phone: agent.phone,
      serial_number: agent.serial_number
    });
    setOpen(true);
  };

  const openLog = (agent: any) => {
    setLogAgent(agent);
    setLogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const { data: agentOrders, isLoading: ordersLoading } = useQuery({
    queryKey: ["agent_orders_log", logAgent?.id, statusFilter, dateFilter],
    enabled: !!logAgent,
    queryFn: async () => {
      if (!logAgent) return [];
      let query = supabase
        .from("orders")
        .select("id, order_number, status, total_amount, shipping_cost, created_at")
        .eq("delivery_agent_id", logAgent.id)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter as any);
      }
      if (dateFilter) {
        const start = new Date(`${dateFilter}T00:00:00.000Z`);
        const end = new Date(`${dateFilter}T23:59:59.999Z`);
        query = query.gte("created_at", start.toISOString()).lte("created_at", end.toISOString());
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: agentReturns, isLoading: returnsLoading } = useQuery({
    queryKey: ["agent_returns_log", logAgent?.id, dateFilter],
    enabled: !!logAgent,
    queryFn: async () => {
      if (!logAgent) return [];
      let query = supabase
        .from("returns")
        .select("id, return_amount, created_at, notes, order_id")
        .eq("delivery_agent_id", logAgent.id)
        .order("created_at", { ascending: false });
      if (dateFilter) {
        const start = new Date(`${dateFilter}T00:00:00.000Z`);
        const end = new Date(`${dateFilter}T23:59:59.999Z`);
        query = query.gte("created_at", start.toISOString()).lte("created_at", end.toISOString());
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: agentPayments, isLoading: payLoading } = useQuery({
    queryKey: ["agent_payments_log", logAgent?.id, dateFilter],
    enabled: !!logAgent,
    queryFn: async () => {
      if (!logAgent) return [];
      let query = supabase
        .from("agent_payments")
        .select("id, amount, payment_type, created_at, notes, order_id")
        .eq("delivery_agent_id", logAgent.id)
        .order("created_at", { ascending: false });
      if (dateFilter) {
        const start = new Date(`${dateFilter}T00:00:00.000Z`);
        const end = new Date(`${dateFilter}T23:59:59.999Z`);
        query = query.gte("created_at", start.toISOString()).lte("created_at", end.toISOString());
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return <div className="p-8">جاري التحميل...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-accent/20 py-8">
      <div className="container mx-auto px-4">
        <Button onClick={() => navigate("/admin")} variant="ghost" className="mb-4">
          <ArrowLeft className="ml-2 h-4 w-4" />
          رجوع
        </Button>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle>بيانات المندوبين</CardTitle>
              {!canEditAgents && (
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">مشاهدة فقط</span>
              )}
            </div>
            {canEditAgents && (
            <Dialog open={open} onOpenChange={(isOpen) => {
              setOpen(isOpen);
              if (!isOpen) {
                setEditingAgent(null);
                setFormData({ name: "", phone: "", serial_number: "" });
              }
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="ml-2 h-4 w-4" />
                  إضافة مندوب
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingAgent ? "تعديل مندوب" : "إضافة مندوب جديد"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="name">اسم المندوب</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">رقم الهاتف</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="serial_number">السيريال نمبر</Label>
                    <Input
                      id="serial_number"
                      value={formData.serial_number}
                      onChange={(e) => setFormData({...formData, serial_number: e.target.value})}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full">
                    {editingAgent ? "تحديث" : "إضافة"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
            )}
          </CardHeader>
          <CardContent>
            {!agents || agents.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">لا يوجد مندوبين</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الاسم</TableHead>
                      <TableHead>الهاتف</TableHead>
                      <TableHead>السيريال نمبر</TableHead>
                      <TableHead>إجمالي المستحق</TableHead>
                      <TableHead>إجمالي المدفوع</TableHead>
                      <TableHead>التاريخ</TableHead>
                      <TableHead>إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agents.map((agent) => (
                      <TableRow key={agent.id}>
                        <TableCell className="font-medium">{agent.name}</TableCell>
                        <TableCell>{agent.phone}</TableCell>
                        <TableCell>{agent.serial_number}</TableCell>
                        <TableCell>{parseFloat(agent.total_owed.toString()).toFixed(2)} ج.م</TableCell>
                        <TableCell>{parseFloat(agent.total_paid.toString()).toFixed(2)} ج.م</TableCell>
                        <TableCell>
                          {new Date(agent.created_at).toLocaleDateString("ar-EG")}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="secondary"
                              onClick={() => openLog(agent)}
                            >
                              عرض السجل
                            </Button>
                            {canEditAgents && (
                            <>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleEdit(agent)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="icon"
                              onClick={() => deleteMutation.mutate(agent.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={logOpen} onOpenChange={(o) => { setLogOpen(o); if (!o) setLogAgent(null); }}>
          <DialogContent className="max-w-5xl">
            <DialogHeader>
              <DialogTitle>
                سجل المندوب: {logAgent?.name} {logAgent?.serial_number ? `- ${logAgent?.serial_number}` : ""}
              </DialogTitle>
            </DialogHeader>
            {!logAgent ? (
              <div className="text-muted-foreground">اختر مندوبًا لعرض السجل</div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label>تاريخ</Label>
                    <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
                  </div>
                  <div className="md:col-span-2">
                    <Label>الحالة</Label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="كل الحالات" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">كل الحالات</SelectItem>
                        <SelectItem value="pending">قيد الانتظار</SelectItem>
                        <SelectItem value="shipped">تم الشحن</SelectItem>
                        <SelectItem value="delivered">تم التنفيذ</SelectItem>
                        <SelectItem value="cancelled">ملغي</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Tabs defaultValue="orders">
                  <TabsList className="grid grid-cols-3">
                    <TabsTrigger value="orders">الطلبات</TabsTrigger>
                    <TabsTrigger value="returns">المرتجعات</TabsTrigger>
                    <TabsTrigger value="payments">الحركات المالية</TabsTrigger>
                  </TabsList>

                  <TabsContent value="orders">
                    {ordersLoading ? (
                      <div>جاري التحميل...</div>
                    ) : !agentOrders || agentOrders.length === 0 ? (
                      <p className="text-muted-foreground">لا توجد طلبات</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>رقم الطلب</TableHead>
                              <TableHead>الحالة</TableHead>
                              <TableHead>سعر المنتج</TableHead>
                              <TableHead>شحن العميل</TableHead>
                              <TableHead>الإجمالي للعميل</TableHead>
                              <TableHead>شحن المندوب</TableHead>
                              <TableHead>المطلوب من المندوب</TableHead>
                              <TableHead>التاريخ</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {agentOrders?.map((o: any) => {
                              const productAmount = parseFloat(o.total_amount?.toString() || "0");
                              const customerShipping = parseFloat(o.shipping_cost?.toString() || "0");
                              const agentShipping = parseFloat(o.agent_shipping_cost?.toString() || "0");
                              const totalForCustomer = productAmount + customerShipping;
                              const amountFromAgent = totalForCustomer - agentShipping;
                              
                              return (
                                <TableRow key={o.id}>
                                  <TableCell>{o.order_number ?? "-"}</TableCell>
                                  <TableCell>{o.status}</TableCell>
                                  <TableCell>{productAmount.toFixed(2)}</TableCell>
                                  <TableCell>{customerShipping.toFixed(2)}</TableCell>
                                  <TableCell className="font-medium">{totalForCustomer.toFixed(2)}</TableCell>
                                  <TableCell>{agentShipping.toFixed(2)}</TableCell>
                                  <TableCell className="font-bold text-primary">{amountFromAgent.toFixed(2)}</TableCell>
                                  <TableCell>{new Date(o.created_at).toLocaleDateString("ar-EG")}</TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="returns">
                    {returnsLoading ? (
                      <div>جاري التحميل...</div>
                    ) : !agentReturns || agentReturns.length === 0 ? (
                      <p className="text-muted-foreground">لا توجد مرتجعات</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>المبلغ</TableHead>
                              <TableHead>الطلب</TableHead>
                              <TableHead>ملاحظات</TableHead>
                              <TableHead>التاريخ</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {agentReturns?.map((r: any) => (
                              <TableRow key={r.id}>
                                <TableCell>{Number(r.return_amount).toFixed(2)}</TableCell>
                                <TableCell className="font-mono text-xs">{r.order_id?.slice(0, 8) ?? "-"}</TableCell>
                                <TableCell>{r.notes ?? "-"}</TableCell>
                                <TableCell>{new Date(r.created_at).toLocaleDateString("ar-EG")}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="payments">
                    {payLoading ? (
                      <div>جاري التحميل...</div>
                    ) : !agentPayments || agentPayments.length === 0 ? (
                      <p className="text-muted-foreground">لا توجد حركات</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>النوع</TableHead>
                              <TableHead>المبلغ</TableHead>
                              <TableHead>الطلب</TableHead>
                              <TableHead>ملاحظات</TableHead>
                              <TableHead>التاريخ</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {agentPayments?.map((p: any) => (
                              <TableRow key={p.id}>
                                <TableCell>{p.payment_type}</TableCell>
                                <TableCell>{Number(p.amount).toFixed(2)}</TableCell>
                                <TableCell className="font-mono text-xs">{p.order_id?.slice(0, 8) ?? "-"}</TableCell>
                                <TableCell>{p.notes ?? "-"}</TableCell>
                                <TableCell>{new Date(p.created_at).toLocaleDateString("ar-EG")}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Agents;
