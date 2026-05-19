import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Menu, Home, ShoppingCart, LayoutDashboard, Users, Truck, Package, ShoppingBag, BarChart3, FileText, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useCart } from "@/hooks/useCart";
import { useTheme } from "@/contexts/ThemeContext";

const TopNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const { currentUser } = useAdminAuth();
  const isAdmin = !!currentUser;
  const { getTotalItems } = useCart();
  const cartItems = getTotalItems();
  const { platformName } = useTheme();

  const publicMenuItems = [
    { title: "الرئيسية", icon: Home, path: "/" },
    { title: "السلة", icon: ShoppingCart, path: "/cart" },
    { title: "الإعدادات", icon: Settings, path: "/settings" },
  ];

  const adminMenuItems = [
    { title: "لوحة التحكم", icon: LayoutDashboard, path: "/admin" },
    { title: "العملاء", icon: Users, path: "/admin/customers" },
    { title: "المندوبين", icon: Truck, path: "/admin/agents" },
    { title: "الأوردرات", icon: Package, path: "/admin/orders" },
    { title: "المنتجات", icon: ShoppingBag, path: "/admin/products" },
    { title: "أوردرات المندوبين", icon: Package, path: "/admin/agent-orders" },
    { title: "الإحصائيات", icon: BarChart3, path: "/admin/statistics" },
    { title: "الفواتير", icon: FileText, path: "/admin/invoices" },
  ];

  const handleNavigate = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-b shadow-sm">
      <div className="container mx-auto px-4 py-2.5">
        <div className="flex items-center justify-between">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="القائمة">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 overflow-y-auto">
              <SheetHeader>
                <SheetTitle className="text-right text-lg font-bold">القائمة</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-1">
                {publicMenuItems.map((item) => (
                  <Button
                    key={item.path}
                    variant={isActive(item.path) ? "secondary" : "ghost"}
                    className="w-full justify-start gap-3 h-10 text-sm"
                    onClick={() => handleNavigate(item.path)}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.title}
                  </Button>
                ))}

                {isAdmin && (
                  <div className="pt-3 mt-3 border-t space-y-1">
                    <p className="text-[10px] font-semibold text-muted-foreground px-3 pb-1 uppercase tracking-wider">لوحة التحكم</p>
                    {adminMenuItems.map((item) => (
                      <Button
                        key={item.path}
                        variant={isActive(item.path) ? "secondary" : "ghost"}
                        className="w-full justify-start gap-3 h-10 text-sm"
                        onClick={() => handleNavigate(item.path)}
                      >
                        <item.icon className="h-4 w-4" />
                        {item.title}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>

          <button onClick={() => navigate("/")} className="flex items-center gap-1.5 cursor-pointer">
            <span className="text-lg font-extrabold text-primary tracking-tight">{platformName}</span>
          </button>

          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 relative"
            onClick={() => navigate("/cart")}
          >
            <ShoppingCart className="h-5 w-5" />
            {cartItems > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                {cartItems}
              </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TopNav;
