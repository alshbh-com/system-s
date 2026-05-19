import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Plus, ArrowLeft, TrendingUp, TrendingDown, Wallet, Calendar } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAdminAuth } from "@/contexts/AdminAuthContext";

const Treasury = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canEdit, currentUser, logActivity } = useAdminAuth();
  
  const [open, setOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState<string>("");
  const [dateRangeFilter, setDateRangeFilter] = useState<"all" | "30days" | "custom">("all");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [formData, setFormData] = useState({
    type: "deposit" as "deposit" | "withdrawal",
    amount: "",
    description: "",
    category: ""
  });

  // Fetch treasury password
  const { data: treasuryPassword } = useQuery({
    queryKey: ["treasury-password"],
    queryFn: async () => {
      const { data } = await supabase
        .from("system_passwords")
        .select("password")
        .eq("id", "treasury_password")
        .single();
      return data?.password || "";
    },
  });

  // Helper to get 30 days ago date
  const get30DaysAgo = () => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  };

  const canEditTreasury = canEdit('treasury');

  const { data: transactions, isLoading } = useQuery({
    queryKey: ["treasury", dateFilter, dateRangeFilter],
    queryFn: async () => {
      let query = supabase
        .from("treasury")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (dateRangeFilter === "30days") {
        const thirtyDaysAgo = get30DaysAgo();
        query = query.gte("created_at", `${thirtyDaysAgo}T00:00:00.000Z`);
      } else if (dateRangeFilter === "custom" && dateFilter) {
        const start = new Date(`${dateFilter}T00:00:00.000Z`);
        const end = new Date(`${dateFilter}T23:59:59.999Z`);
        query = query.gte("created_at", start.toISOString()).lte("created_at", end.toISOString());
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: summary } = useQuery({
    queryKey: ["treasury-summary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treasury")
        .select("type, amount");
      
      if (error) throw error;
      
      const deposits = data?.filter(t => t.type === 'deposit').reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0) || 0;
      const withdrawals = data?.filter(t => t.type === 'withdrawal').reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0) || 0;
      
      return {
        deposits,
        withdrawals,
        balance: deposits - withdrawals
      };
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase
        .from("treasury")
        .insert({
          type: data.type,
          amount: parseFloat(data.amount),
          description: data.description || null,
          category: data.category || null,
          created_by: currentUser?.id || null
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["treasury"] });
      queryClient.invalidateQueries({ queryKey: ["treasury-summary"] });
      toast.success("تم إضافة الحركة بنجاح");
      logActivity(formData.type === 'deposit' ? 'إيداع في الخزانة' : 'سحب من الخزانة', 'treasury', { amount: formData.amount });
      setOpen(false);
      setFormData({ type: "deposit", amount: "", description: "", category: "" });
    },
    onError: () => {
      toast.error("حدث خطأ");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("treasury")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["treasury"] });
      queryClient.invalidateQueries({ queryKey: ["treasury-summary"] });
      toast.success("تم الحذف بنجاح");
      logActivity('حذف حركة من الخزانة', 'treasury');
    },
    onError: () => {
      toast.error("حدث خطأ أثناء الحذف");
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast.error("يرجى إدخال مبلغ صحيح");
      return;
    }
    createMutation.mutate(formData);
  };

  if (isLoading) {
    return <div className="p-8">جاري التحميل...</div>;
  }

  // Password gate
  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-accent/20 py-8">
        <div className="container mx-auto px-4 max-w-md">
          <Button onClick={() => navigate("/admin")} variant="ghost" className="mb-4">
            <ArrowLeft className="ml-2 h-4 w-4" />
            رجوع
          </Button>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 justify-center">
                <Wallet className="h-5 w-5" />
                الخزانة
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-center text-muted-foreground">أدخل كلمة المرور للدخول</p>
              <Input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="كلمة المرور"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (passwordInput === treasuryPassword) {
                      setIsUnlocked(true);
                      setPasswordInput("");
                    } else {
                      toast.error("كلمة المرور غير صحيحة");
                    }
                  }
                }}
              />
              <Button 
                className="w-full" 
                onClick={() => {
                  if (passwordInput === treasuryPassword) {
                    setIsUnlocked(true);
                    setPasswordInput("");
                  } else {
                    toast.error("كلمة المرور غير صحيحة");
                  }
                }}
              >
                دخول
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-accent/20 py-8">
      <div className="container mx-auto px-4">
        <Button onClick={() => navigate("/admin")} variant="ghost" className="mb-4">
          <ArrowLeft className="ml-2 h-4 w-4" />
          رجوع
        </Button>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">إجمالي الإيداعات</CardTitle>
              <TrendingUp className="h-5 w-5 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {summary?.deposits.toFixed(2)} ج.م
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">إجمالي المسحوبات</CardTitle>
              <TrendingDown className="h-5 w-5 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">
                {summary?.withdrawals.toFixed(2)} ج.م
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">الرصيد الحالي</CardTitle>
              <Wallet className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${(summary?.balance || 0) >= 0 ? 'text-primary' : 'text-red-600'}`}>
                {summary?.balance.toFixed(2)} ج.م
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              الخزانة
              {!canEditTreasury && (
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">مشاهدة فقط</span>
              )}
            </CardTitle>
            <div className="flex gap-2 items-center flex-wrap">
              <div className="flex items-center gap-2">
                <Select 
                  value={dateRangeFilter} 
                  onValueChange={(v) => {
                    setDateRangeFilter(v as "all" | "30days" | "custom");
                    if (v !== "custom") setDateFilter("");
                  }}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الأيام</SelectItem>
                    <SelectItem value="30days">آخر 30 يوم</SelectItem>
                    <SelectItem value="custom">تاريخ محدد</SelectItem>
                  </SelectContent>
                </Select>
                {dateRangeFilter === "custom" && (
                  <>
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <Input
                      type="date"
                      value={dateFilter}
                      onChange={(e) => setDateFilter(e.target.value)}
                      className="w-40"
                    />
                  </>
                )}
                {(dateRangeFilter !== "all") && (
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => {
                      setDateRangeFilter("all");
                      setDateFilter("");
                    }}
                  >
                    إلغاء
                  </Button>
                )}
              </div>
              {canEditTreasury && (
                <Dialog open={open} onOpenChange={setOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="ml-2 h-4 w-4" />
                      إضافة حركة
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>إضافة حركة جديدة</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div>
                        <Label>نوع الحركة</Label>
                        <Select 
                          value={formData.type} 
                          onValueChange={(v) => setFormData({...formData, type: v as "deposit" | "withdrawal"})}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="deposit">إيداع</SelectItem>
                            <SelectItem value="withdrawal">سحب</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="amount">المبلغ (ج.م)</Label>
                        <Input
                          id="amount"
                          type="number"
                          step="0.01"
                          value={formData.amount}
                          onChange={(e) => setFormData({...formData, amount: e.target.value})}
                          required
                          placeholder="أدخل المبلغ"
                        />
                      </div>
                      <div>
                        <Label htmlFor="category">التصنيف</Label>
                        <Input
                          id="category"
                          value={formData.category}
                          onChange={(e) => setFormData({...formData, category: e.target.value})}
                          placeholder="مثال: مصاريف شحن، إيرادات، رواتب"
                        />
                      </div>
                      <div>
                        <Label htmlFor="description">الوصف</Label>
                        <Textarea
                          id="description"
                          value={formData.description}
                          onChange={(e) => setFormData({...formData, description: e.target.value})}
                          rows={2}
                          placeholder="تفاصيل إضافية (اختياري)"
                        />
                      </div>
                      <Button type="submit" className="w-full">
                        إضافة
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!transactions || transactions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">لا توجد حركات</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>النوع</TableHead>
                      <TableHead>المبلغ</TableHead>
                      <TableHead>التصنيف</TableHead>
                      <TableHead>الوصف</TableHead>
                      <TableHead>التاريخ</TableHead>
                      {canEditTreasury && <TableHead>إجراءات</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((transaction: any) => (
                      <TableRow key={transaction.id}>
                        <TableCell>
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-sm font-medium ${
                            transaction.type === 'deposit' 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {transaction.type === 'deposit' ? (
                              <><TrendingUp className="h-3 w-3" /> إيداع</>
                            ) : (
                              <><TrendingDown className="h-3 w-3" /> سحب</>
                            )}
                          </span>
                        </TableCell>
                        <TableCell className={`font-bold ${
                          transaction.type === 'deposit' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {transaction.type === 'deposit' ? '+' : '-'}
                          {parseFloat(transaction.amount).toFixed(2)} ج.م
                        </TableCell>
                        <TableCell>{transaction.category || "-"}</TableCell>
                        <TableCell className="max-w-xs truncate">{transaction.description || "-"}</TableCell>
                        <TableCell>
                          {new Date(transaction.created_at).toLocaleDateString("ar-EG")}
                        </TableCell>
                        {canEditTreasury && (
                          <TableCell>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="icon">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    سيتم حذف هذه الحركة نهائياً
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteMutation.mutate(transaction.id)}>
                                    حذف
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Treasury;
