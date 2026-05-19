import { Home, ShoppingCart, Settings } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useCart } from "@/hooks/useCart";

const BottomNav = () => {
  const location = useLocation();
  const { getTotalItems } = useCart();
  const cartItems = getTotalItems();

  if (location.pathname.startsWith("/admin")) {
    return null;
  }

  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    { path: "/", icon: Home, label: "الرئيسية" },
    { path: "/cart", icon: ShoppingCart, label: "السلة", badge: cartItems },
    { path: "/settings", icon: Settings, label: "الإعدادات" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t shadow-lg z-50">
      <div className="container mx-auto px-4">
        <div className="flex justify-around items-center h-14">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center w-16 h-full transition-all ${
                isActive(item.path)
                  ? "text-primary scale-105"
                  : "text-muted-foreground"
              }`}
            >
              <div className="relative">
                <item.icon className="h-5 w-5 mb-0.5" />
                {item.badge && item.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-semibold">{item.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
};

export default BottomNav;
