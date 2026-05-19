import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, RefreshCw, Package, Truck, CheckCircle, XCircle, RotateCcw, DollarSign, Users, Calendar, TrendingUp, ShoppingBag, BarChart3, PieChart as PieChartIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line, AreaChart, Area } from "recharts";

const Statistics = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [compareMonth, setCompareMonth] = useState<string>("");

  const { data: statistics, isLoading } = useQuery({
    queryKey: ["statistics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("statistics")
        .select("*")
        .maybeSingle();
      
      if (error) throw error;
      return data || { total_sales: 0, total_orders: 0 };
    },
    refetchInterval: 1000,
    staleTime: 0,
  });

  // Get orders for selected month
  const { data: monthlyOrders } = useQuery({
    queryKey: ["monthly-orders", selectedMonth],
    queryFn: async () => {
      const start = new Date(`${selectedMonth}-01T00:00:00.000Z`);
      const end = new Date(start);
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
      end.setHours(23, 59, 59, 999);
      
      const { data, error } = await supabase
        .from("orders")
        .select("*, delivery_agents(name), order_items(*, products(name, price))")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString());
      
      if (error) throw error;
      return data;
    },
    refetchInterval: 1000,
    staleTime: 0,
  });

  // Get orders for comparison month
  const { data: compareOrders } = useQuery({
    queryKey: ["compare-orders", compareMonth],
    queryFn: async () => {
      if (!compareMonth) return null;
      const start = new Date(`${compareMonth}-01T00:00:00.000Z`);
      const end = new Date(start);
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
      end.setHours(23, 59, 59, 999);
      
      const { data, error } = await supabase
        .from("orders")
        .select("*, delivery_agents(name), order_items(*, products(name, price))")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString());
      
      if (error) throw error;
      return data;
    },
    enabled: !!compareMonth,
    refetchInterval: 1000,
    staleTime: 0,
  });

  // Get all orders for yearly data
  const { data: yearlyOrders } = useQuery({
    queryKey: ["yearly-orders", selectedMonth.slice(0, 4)],
    queryFn: async () => {
      const year = selectedMonth.slice(0, 4);
      const start = new Date(`${year}-01-01T00:00:00.000Z`);
      const end = new Date(`${year}-12-31T23:59:59.999Z`);
      
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*, products(name))")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString());
      
      if (error) throw error;
      return data;
    },
    refetchInterval: 1000,
    staleTime: 0,
  });

  const { data: agents } = useQuery({
    queryKey: ["agents-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.from("delivery_agents").select("*");
      if (error) throw error;
      return data;
    },
    refetchInterval: 1000,
    staleTime: 0,
  });

  const { data: customers } = useQuery({
    queryKey: ["customers-count"],
    queryFn: async () => {
      const { count, error } = await supabase.from("customers").select("*", { count: 'exact', head: true });
      if (error) throw error;
      return count || 0;
    },
    refetchInterval: 1000,
    staleTime: 0,
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("statistics")
        .update({
          total_sales: 0,
          total_orders: 0,
          last_reset: new Date().toISOString()
        })
        .not("id", "is", null);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["statistics"] });
      toast.success("تم إعادة تعيين الإحصائيات");
    },
  });

  if (isLoading) {
    return <div className="p-8">جاري التحميل...</div>;
  }

  // Calculate monthly statistics
  const orders = monthlyOrders || [];
  const totalOrders = orders.length;
  const pendingOrders = orders.filter(o => o.status === 'pending').length;
  const shippedOrders = orders.filter(o => o.status === 'shipped').length;
  const deliveredOrders = orders.filter(o => o.status === 'delivered' || o.status === 'delivered_with_modification').length;
  const cancelledOrders = orders.filter(o => o.status === 'cancelled').length;
  const returnedOrders = orders.filter(o => o.status === 'returned' || o.status === 'return_no_shipping').length;
  
  const totalSales = orders.filter(o => o.status === 'delivered' || o.status === 'delivered_with_modification').reduce((sum, o) => 
    sum + parseFloat(o.total_amount?.toString() || "0") + parseFloat(o.shipping_cost?.toString() || "0"), 0
  );

  // Comparison stats
  const compareOrdersList = compareOrders || [];
  const compareTotalOrders = compareOrdersList.length;
  const compareDelivered = compareOrdersList.filter(o => o.status === 'delivered' || o.status === 'delivered_with_modification').length;
  const compareSales = compareOrdersList.filter(o => o.status === 'delivered' || o.status === 'delivered_with_modification').reduce((sum, o) => 
    sum + parseFloat(o.total_amount?.toString() || "0") + parseFloat(o.shipping_cost?.toString() || "0"), 0
  );

  // Products sold calculation
  const productsSold: Record<string, { name: string; quantity: number; revenue: number }> = {};
  orders.forEach(order => {
    if (order.status === 'delivered' || order.status === 'delivered_with_modification') {
      order.order_items?.forEach((item: any) => {
        const productName = item.products?.name || "منتج غير معروف";
        if (!productsSold[productName]) {
          productsSold[productName] = { name: productName, quantity: 0, revenue: 0 };
        }
        productsSold[productName].quantity += item.quantity;
        productsSold[productName].revenue += parseFloat(item.price?.toString() || "0") * item.quantity;
      });
    }
  });

  const topProducts = Object.values(productsSold)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  // Status pie chart data
  const statusData = [
    { name: 'قيد الانتظار', value: pendingOrders, color: '#eab308' },
    { name: 'تم الشحن', value: shippedOrders, color: '#8b5cf6' },
    { name: 'تم التوصيل', value: deliveredOrders, color: '#22c55e' },
    { name: 'ملغي', value: cancelledOrders, color: '#ef4444' },
    { name: 'مرتجع', value: returnedOrders, color: '#f97316' },
  ].filter(d => d.value > 0);

  // Monthly data for line chart
  const monthlyData: { month: string; orders: number; sales: number }[] = [];
  const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  
  if (yearlyOrders) {
    for (let i = 0; i < 12; i++) {
      const monthOrders = yearlyOrders.filter(o => {
        const orderMonth = new Date(o.created_at).getMonth();
        return orderMonth === i;
      });
      const monthSales = monthOrders
        .filter(o => o.status === 'delivered' || o.status === 'delivered_with_modification')
        .reduce((sum, o) => sum + parseFloat(o.total_amount?.toString() || "0"), 0);
      
      monthlyData.push({
        month: months[i],
        orders: monthOrders.length,
        sales: monthSales
      });
    }
  }

  // Agent performance data for bar chart
  const agentPerformance = agents?.map(agent => ({
    name: agent.name,
    delivered: orders.filter(o => o.delivery_agent_id === agent.id && (o.status === 'delivered' || o.status === 'delivered_with_modification')).length,
    total: orders.filter(o => o.delivery_agent_id === agent.id).length
  })).filter(a => a.total > 0) || [];

  // Generate month options for last 12 months
  const monthOptions: { value: string; label: string }[] = [];
  for (let i = 0; i < 12; i++) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const value = date.toISOString().slice(0, 7);
    const label = date.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
    monthOptions.push({ value, label });
  }

  const percentChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous * 100).toFixed(1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 py-8">
      <div className="container mx-auto px-4">
        <Button onClick={() => navigate("/admin")} variant="ghost" className="mb-4 text-white hover:bg-white/10">
          <ArrowLeft className="ml-2 h-4 w-4" />
          رجوع
        </Button>

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">لوحة الإحصائيات المتقدمة</h1>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2 bg-white/10 rounded-lg px-4 py-2">
              <Calendar className="h-4 w-4 text-purple-200" />
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="bg-transparent border-0 text-white w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 bg-white/10 rounded-lg px-4 py-2">
              <BarChart3 className="h-4 w-4 text-purple-200" />
              <span className="text-purple-200 text-sm">مقارنة مع:</span>
              <Select value={compareMonth || "none"} onValueChange={(val) => setCompareMonth(val === "none" ? "" : val)}>
                <SelectTrigger className="bg-transparent border-0 text-white w-48">
                  <SelectValue placeholder="اختر شهر للمقارنة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون مقارنة</SelectItem>
                  {monthOptions.filter(m => m.value !== selectedMonth).map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Main Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 border-0 text-white relative overflow-hidden">
            <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-white/10 rounded-full" />
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium opacity-90">إجمالي المبيعات</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold">{totalSales.toFixed(0)}</div>
                <DollarSign className="h-8 w-8 opacity-50" />
              </div>
              <p className="text-xs opacity-75 mt-1">ج.م</p>
              {compareMonth && (
                <div className={`text-xs mt-2 flex items-center gap-1 ${Number(percentChange(totalSales, compareSales)) >= 0 ? 'text-green-200' : 'text-red-200'}`}>
                  <TrendingUp className="h-3 w-3" />
                  {percentChange(totalSales, compareSales)}% من الشهر السابق
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 border-0 text-white relative overflow-hidden">
            <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-white/10 rounded-full" />
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium opacity-90">إجمالي الأوردرات</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold">{totalOrders}</div>
                <Package className="h-8 w-8 opacity-50" />
              </div>
              <p className="text-xs opacity-75 mt-1">طلب</p>
              {compareMonth && (
                <div className={`text-xs mt-2 flex items-center gap-1 ${Number(percentChange(totalOrders, compareTotalOrders)) >= 0 ? 'text-green-200' : 'text-red-200'}`}>
                  <TrendingUp className="h-3 w-3" />
                  {percentChange(totalOrders, compareTotalOrders)}% من الشهر السابق
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-violet-500 to-violet-600 border-0 text-white relative overflow-hidden">
            <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-white/10 rounded-full" />
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium opacity-90">تم التوصيل</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold">{deliveredOrders}</div>
                <CheckCircle className="h-8 w-8 opacity-50" />
              </div>
              <p className="text-xs opacity-75 mt-1">طلب مسلم</p>
              {compareMonth && (
                <div className={`text-xs mt-2 flex items-center gap-1 ${Number(percentChange(deliveredOrders, compareDelivered)) >= 0 ? 'text-green-200' : 'text-red-200'}`}>
                  <TrendingUp className="h-3 w-3" />
                  {percentChange(deliveredOrders, compareDelivered)}% من الشهر السابق
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-500 to-amber-600 border-0 text-white relative overflow-hidden">
            <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-white/10 rounded-full" />
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium opacity-90">إجمالي العملاء</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold">{customers}</div>
                <Users className="h-8 w-8 opacity-50" />
              </div>
              <p className="text-xs opacity-75 mt-1">عميل</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Status Pie Chart */}
          <Card className="bg-white/10 backdrop-blur border-white/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <PieChartIcon className="h-5 w-5" />
                توزيع حالات الطلبات
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e1b4b', border: 'none', borderRadius: '8px' }}
                      labelStyle={{ color: '#fff' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-3 justify-center mt-4">
                {statusData.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-white text-sm">{item.name}: {item.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Monthly Sales Line Chart */}
          <Card className="bg-white/10 backdrop-blur border-white/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                المبيعات الشهرية ({selectedMonth.slice(0, 4)})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyData}>
                    <defs>
                      <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                    <XAxis dataKey="month" stroke="#fff" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#fff" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e1b4b', border: 'none', borderRadius: '8px' }}
                      labelStyle={{ color: '#fff' }}
                    />
                    <Area type="monotone" dataKey="sales" stroke="#22c55e" fillOpacity={1} fill="url(#colorSales)" name="المبيعات (ج.م)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Products Sold & Agent Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Top Products */}
          <Card className="bg-white/10 backdrop-blur border-white/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <ShoppingBag className="h-5 w-5" />
                أكثر المنتجات مبيعاً
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topProducts.length > 0 ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topProducts} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                      <XAxis type="number" stroke="#fff" />
                      <YAxis dataKey="name" type="category" stroke="#fff" width={100} tick={{ fontSize: 10 }} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1e1b4b', border: 'none', borderRadius: '8px' }}
                        labelStyle={{ color: '#fff' }}
                      />
                      <Bar dataKey="quantity" fill="#8b5cf6" name="الكمية المباعة" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-center text-purple-200 py-8">لا توجد مبيعات في هذا الشهر</p>
              )}
              <div className="mt-4 space-y-2 max-h-40 overflow-y-auto">
                {topProducts.map((product, idx) => (
                  <div key={idx} className="flex justify-between text-sm bg-white/5 p-2 rounded">
                    <span className="text-white">{product.name}</span>
                    <span className="text-purple-200">{product.quantity} قطعة - {product.revenue.toFixed(0)} ج.م</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Agent Performance */}
          <Card className="bg-white/10 backdrop-blur border-white/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Truck className="h-5 w-5" />
                أداء المندوبين
              </CardTitle>
            </CardHeader>
            <CardContent>
              {agentPerformance.length > 0 ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={agentPerformance}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                      <XAxis dataKey="name" stroke="#fff" tick={{ fontSize: 10 }} />
                      <YAxis stroke="#fff" />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1e1b4b', border: 'none', borderRadius: '8px' }}
                        labelStyle={{ color: '#fff' }}
                      />
                      <Legend />
                      <Bar dataKey="total" fill="#6366f1" name="إجمالي الطلبات" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="delivered" fill="#22c55e" name="تم التوصيل" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-center text-purple-200 py-8">لا توجد طلبات للمندوبين في هذا الشهر</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Order Status Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <Card className="bg-white/10 backdrop-blur border-white/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-yellow-500/20">
                  <Package className="h-5 w-5 text-yellow-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{pendingOrders}</p>
                  <p className="text-xs text-purple-200">قيد الانتظار</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur border-white/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-purple-500/20">
                  <Truck className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{shippedOrders}</p>
                  <p className="text-xs text-purple-200">تم الشحن</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur border-white/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-green-500/20">
                  <CheckCircle className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{deliveredOrders}</p>
                  <p className="text-xs text-purple-200">تم التوصيل</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur border-white/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-red-500/20">
                  <XCircle className="h-5 w-5 text-red-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{cancelledOrders}</p>
                  <p className="text-xs text-purple-200">ملغي</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur border-white/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-orange-500/20">
                  <RotateCcw className="h-5 w-5 text-orange-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{returnedOrders}</p>
                  <p className="text-xs text-purple-200">مرتجع</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <Card className="bg-white/10 backdrop-blur border-white/20">
          <CardHeader>
            <CardTitle className="text-white">إدارة الإحصائيات</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-purple-200">
              يتم حساب الإحصائيات تلقائياً من الأوردرات
            </p>
            
            <div className="flex gap-4">
              <Button 
                variant="destructive"
                onClick={() => {
                  if (confirm("هل أنت متأكد من إعادة تعيين الإحصائيات؟")) {
                    resetMutation.mutate();
                  }
                }}
              >
                <RefreshCw className="ml-2 h-4 w-4" />
                إعادة تعيين
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Statistics;