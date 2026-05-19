import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Users, 
  Truck, 
  ShoppingCart, 
  Package, 
  FileText, 
  BarChart, 
  Settings,
  Trash2,
  AlertTriangle,
  UserCog,
  Activity,
  Wallet,
  LogOut,
  Palette,
  Building2,
  ScanBarcode
} from "lucide-react";
import { Link } from "react-router-dom";
import SearchBar from "@/components/admin/SearchBar";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import UserLogin from "@/components/admin/UserLogin";

const adminSections = [
  { title: "العملاء", description: "إدارة بيانات العملاء", icon: Users, path: "/admin/customers", color: "text-blue-500", permission: "customers" },
  { title: "بيانات المندوبين", description: "إدارة المندوبين", icon: Truck, path: "/admin/agents", color: "text-green-500", permission: "agents" },
  { title: "الأوردرات", description: "إدارة الطلبات", icon: ShoppingCart, path: "/admin/orders", color: "text-orange-500", permission: "orders" },
  { title: "أوردرات المندوب", description: "طلبات ومستحقات كل مندوب", icon: Package, path: "/admin/agent-orders", color: "text-purple-500", permission: "agent_orders" },
  { title: "الخزنة", description: "نظام الخزنة الآمن - لا حذف/تعديل", icon: Wallet, path: "/admin/cashbox", color: "text-emerald-500", permission: "cashbox" },
  { title: "المنتجات", description: "إدارة المنتجات والعروض", icon: Settings, path: "/admin/products", color: "text-red-500", permission: "products" },
  { title: "الأقسام", description: "إدارة أقسام المنتجات", icon: Settings, path: "/admin/categories", color: "text-indigo-500", permission: "categories" },
  { title: "الإحصائيات", description: "إحصائيات المبيعات", icon: BarChart, path: "/admin/statistics", color: "text-cyan-500", permission: "statistics" },
  { title: "الفواتير", description: "طباعة الفواتير", icon: FileText, path: "/admin/invoices", color: "text-pink-500", permission: "invoices" },
  { title: "المحافظات", description: "إدارة المحافظات وأسعار الشحن", icon: Settings, path: "/admin/governorates", color: "text-teal-500", permission: "governorates" },
  { title: "جميع الأوردرات", description: "عرض جميع الأوردرات", icon: ShoppingCart, path: "/admin/all-orders", color: "text-violet-500", permission: "all_orders" },
  { title: "إعادة تعيين البيانات", description: "مسح جميع البيانات والبدء من جديد", icon: Trash2, path: "/admin/reset-data", color: "text-red-600", permission: "reset_data" },
  { title: "إدارة المستخدمين", description: "إنشاء وإدارة المستخدمين والصلاحيات", icon: UserCog, path: "/admin/users", color: "text-amber-500", permission: "user_management" },
  { title: "سجل النشاط", description: "عرض سجل جميع العمليات", icon: Activity, path: "/admin/activity", color: "text-slate-500", permission: "user_management" },
  { title: "المظهر", description: "الألوان والقوالب واسم المنصة", icon: Palette, path: "/admin/appearance", color: "text-fuchsia-500", permission: "user_management" },
  { title: "المكاتب", description: "إدارة المكاتب والفروع", icon: Building2, path: "/admin/offices", color: "text-sky-500", permission: "user_management" },
  { title: "قراءة الباركود", description: "اسكان الأوردرات بالمسدس وإجراءات جماعية", icon: ScanBarcode, path: "/admin/barcode-scanner", color: "text-rose-500", permission: "barcode_scanner" },
];

const LOW_STOCK_THRESHOLD = 10;

const Dashboard = () => {
  const navigate = useNavigate();
  const { currentUser, canView, logout, logActivity } = useAdminAuth();

  useEffect(() => {
    if (currentUser) {
      logActivity('دخول لوحة التحكم', 'dashboard');
    }
  }, [currentUser]);

  const { data: lowStockProducts, isLoading: isLoadingLowStock } = useQuery({
    queryKey: ["lowStockProducts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .lte("stock", LOW_STOCK_THRESHOLD)
        .order("stock", { ascending: true });
      
      if (error) throw error;
      return data;
    },
    enabled: !!currentUser
  });

  // Show login screen if no user
  if (!currentUser) {
    return <UserLogin />;
  }

  // Filter sections based on view permission
  const visibleSections = adminSections.filter(section => canView(section.permission));

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-accent/20 py-8">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-4xl font-bold">لوحة التحكم</h1>
            <p className="text-muted-foreground">إدارة متجر Family Fashion</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              مرحباً، {currentUser.username}
            </span>
            <Button variant="outline" size="sm" onClick={logout}>
              <LogOut className="ml-2 h-4 w-4" />
              تسجيل خروج
            </Button>
          </div>
        </div>

        <div className="mb-8">
          <SearchBar />
        </div>

        {!isLoadingLowStock && lowStockProducts && lowStockProducts.length > 0 && canView('products') && (
          <Card className="mb-8 border-destructive/50 bg-destructive/5">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-destructive" />
                </div>
                <div>
                  <CardTitle className="text-destructive">تنبيه: نفاذ المخزون</CardTitle>
                  <CardDescription>
                    يوجد {lowStockProducts.length} منتج مخزونه {LOW_STOCK_THRESHOLD} قطع أو أقل
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {lowStockProducts.map((product) => (
                  <Card key={product.id} className="border-destructive/30">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        {product.image_url && (
                          <img 
                            src={product.image_url} 
                            alt={product.name}
                            className="w-16 h-16 object-cover rounded"
                          />
                        )}
                        <div className="flex-1">
                          <h4 className="font-semibold text-sm mb-1">{product.name}</h4>
                          <div className="flex items-center gap-2">
                            <Badge variant={product.stock === 0 ? "destructive" : "secondary"}>
                              {product.stock === 0 ? "نفذت الكمية" : `${product.stock} قطعة متبقية`}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {visibleSections.map((section) => (
            <Link key={section.path} to={section.path}>
              <Card className="hover:shadow-xl transition-all duration-300 cursor-pointer group">
                <CardHeader>
                  <div className={`w-12 h-12 rounded-lg bg-accent flex items-center justify-center mb-4 group-hover:scale-110 transition-transform ${section.color}`}>
                    <section.icon className="w-6 h-6" />
                  </div>
                  <CardTitle>{section.title}</CardTitle>
                  <CardDescription>{section.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
