import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AdminAuthProvider } from "@/contexts/AdminAuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import ProtectedAdminRoute from "@/components/ProtectedAdminRoute";
import Home from "./pages/Home";
import Cart from "./pages/Cart";
import Settings from "./pages/Settings";
import Dashboard from "./pages/admin/Dashboard";
import Customers from "./pages/admin/Customers";
import Agents from "./pages/admin/Agents";
import Orders from "./pages/admin/Orders";
import Products from "./pages/admin/Products";
import Categories from "./pages/admin/Categories";
import AgentOrders from "./pages/admin/AgentOrders";
import Statistics from "./pages/admin/Statistics";
import Invoices from "./pages/admin/Invoices";
import Governorates from "./pages/admin/Governorates";
import AllOrders from "./pages/admin/AllOrders";
import ResetData from "./pages/admin/ResetData";
import UserManagement from "./pages/admin/UserManagement";
import ActivityLogs from "./pages/admin/ActivityLogs";
import Treasury from "./pages/admin/Treasury";
import Cashbox from "./pages/admin/Cashbox";
import Appearance from "./pages/admin/Appearance";
import Offices from "./pages/admin/Offices";
import BarcodeScanner from "./pages/admin/BarcodeScanner";
import BottomNav from "./components/BottomNav";
import TopNav from "./components/TopNav";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AdminRoute = ({ children }: { children: React.ReactNode }) => (
  <ProtectedAdminRoute>{children}</ProtectedAdminRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AdminAuthProvider>
        <ThemeProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <TopNav />
            <div className="pb-16 pt-16">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/cart" element={<Cart />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/admin" element={<AdminRoute><Dashboard /></AdminRoute>} />
                <Route path="/admin/customers" element={<AdminRoute><Customers /></AdminRoute>} />
                <Route path="/admin/agents" element={<AdminRoute><Agents /></AdminRoute>} />
                <Route path="/admin/orders" element={<AdminRoute><Orders /></AdminRoute>} />
                <Route path="/admin/products" element={<AdminRoute><Products /></AdminRoute>} />
                <Route path="/admin/categories" element={<AdminRoute><Categories /></AdminRoute>} />
                <Route path="/admin/agent-orders" element={<AdminRoute><AgentOrders /></AdminRoute>} />
                <Route path="/admin/statistics" element={<AdminRoute><Statistics /></AdminRoute>} />
                <Route path="/admin/invoices" element={<AdminRoute><Invoices /></AdminRoute>} />
                <Route path="/admin/governorates" element={<AdminRoute><Governorates /></AdminRoute>} />
                <Route path="/admin/all-orders" element={<AdminRoute><AllOrders /></AdminRoute>} />
                <Route path="/admin/reset-data" element={<AdminRoute><ResetData /></AdminRoute>} />
                <Route path="/admin/users" element={<AdminRoute><UserManagement /></AdminRoute>} />
                <Route path="/admin/activity" element={<AdminRoute><ActivityLogs /></AdminRoute>} />
                <Route path="/admin/treasury" element={<AdminRoute><Treasury /></AdminRoute>} />
                <Route path="/admin/cashbox" element={<AdminRoute><Cashbox /></AdminRoute>} />
                <Route path="/admin/appearance" element={<AdminRoute><Appearance /></AdminRoute>} />
                <Route path="/admin/offices" element={<AdminRoute><Offices /></AdminRoute>} />
                <Route path="/admin/barcode-scanner" element={<AdminRoute><BarcodeScanner /></AdminRoute>} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
              <BottomNav />
            </div>
          </BrowserRouter>
        </ThemeProvider>
      </AdminAuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
