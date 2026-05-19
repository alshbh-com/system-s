import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Search, X, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const SearchBar = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<{
    orders: any[];
    customers: any[];
  }>({ orders: [], customers: [] });

  // Live search with debounce
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (searchQuery.trim().length >= 3) {
        handleSearch();
      } else if (searchQuery.trim().length === 0) {
        setResults({ orders: [], customers: [] });
        setShowResults(false);
      }
    }, 500);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  const handleSearch = async () => {
    if (!searchQuery.trim() || searchQuery.trim().length < 3) {
      return;
    }

    setIsSearching(true);
    try {
      const searchTerm = searchQuery.trim();

      // البحث في العملاء برقم الهاتف
      const { data: customers, error: customersError } = await supabase
        .from("customers")
        .select("*")
        .ilike("phone", `%${searchTerm}%`);

      if (customersError) {
        console.error("خطأ في البحث عن العملاء:", customersError);
      }

      // البحث في الأوردرات برقم الأوردر
      const { data: ordersByIdOnly, error: ordersIdError } = await supabase
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
        .ilike("id", `%${searchTerm}%`);

      if (ordersIdError) {
        console.error("خطأ في البحث عن الأوردرات:", ordersIdError);
      }

      // البحث في الأوردرات بناءً على معرفات العملاء المطابقة
      const customerIds = customers?.map(c => c.id) || [];
      let ordersByCustomer: any[] = [];
      
      if (customerIds.length > 0) {
        const { data: custOrders, error: custOrdersError } = await supabase
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
          .in("customer_id", customerIds);

        if (!custOrdersError && custOrders) {
          ordersByCustomer = custOrders;
        }
      }

      // دمج النتائج
      const allOrders = [...(ordersByIdOnly || []), ...ordersByCustomer];
      const uniqueOrders = allOrders.filter((order, index, self) =>
        index === self.findIndex((o) => o.id === order.id)
      );

      setResults({
        orders: uniqueOrders,
        customers: customers || []
      });

      setShowResults(true);
    } catch (error) {
      console.error("خطأ في البحث:", error);
      toast.error("حدث خطأ أثناء البحث");
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    setResults({ orders: [], customers: [] });
    setShowResults(false);
  };

  const statusLabels: Record<string, string> = {
    pending: "قيد الانتظار",
    processing: "قيد التنفيذ",
    shipped: "تم الشحن",
    delivered: "تم التوصيل",
    cancelled: "ملغي"
  };

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-500",
    processing: "bg-blue-500",
    shipped: "bg-purple-500",
    delivered: "bg-green-500",
    cancelled: "bg-red-500"
  };

  return (
    <>
      <div className="relative mb-6">
        <div className="relative">
          <Input
            placeholder="ابحث برقم الهاتف أو رقم الأوردر (3 أحرف على الأقل)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            className="pl-10 pr-10"
          />
          {isSearching ? (
            <Loader2 className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
          ) : (
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          )}
          {searchQuery && (
            <button
              className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground hover:text-foreground"
              onClick={clearSearch}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {showResults && (results.customers.length > 0 || results.orders.length > 0) && (
        <Card className="mb-6 max-h-[500px] overflow-y-auto">
          <CardContent className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold">نتائج البحث</h3>
              <button
                onClick={() => setShowResults(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              {results.customers.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">العملاء ({results.customers.length})</h4>
                  <div className="space-y-2">
                    {results.customers.map((customer) => (
                      <div
                        key={customer.id}
                        className="p-3 border rounded-lg cursor-pointer hover:bg-accent transition-colors"
                        onClick={() => {
                          navigate("/admin/customers");
                          setShowResults(false);
                          setSearchQuery("");
                        }}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-bold">{customer.name}</p>
                            <p className="text-sm text-muted-foreground">{customer.phone}</p>
                            <p className="text-sm">{customer.address}</p>
                          </div>
                          <Badge variant="outline">{customer.governorate || "-"}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {results.orders.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">الأوردرات ({results.orders.length})</h4>
                  <div className="space-y-2">
                    {results.orders.map((order) => (
                      <div
                        key={order.id}
                        className="p-3 border rounded-lg cursor-pointer hover:bg-accent transition-colors"
                        onClick={() => {
                          navigate("/admin/orders");
                          setShowResults(false);
                          setSearchQuery("");
                        }}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-mono text-xs text-muted-foreground mb-1">
                              {order.id.slice(0, 8)}...
                            </p>
                            <p className="font-bold">{order.customers?.name}</p>
                            <p className="text-sm text-muted-foreground">{order.customers?.phone}</p>
                          </div>
                          <div className="text-left">
                            <p className="font-bold text-lg">
                              {parseFloat(order.total_amount.toString()).toFixed(2)} ج.م
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <div className={`w-2 h-2 rounded-full ${statusColors[order.status]}`} />
                              <span className="text-sm">{statusLabels[order.status]}</span>
                            </div>
                          </div>
                        </div>
                        {order.delivery_agents && (
                          <Badge variant="outline" className="mt-2">
                            المندوب: {order.delivery_agents.name}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
};

export default SearchBar;
