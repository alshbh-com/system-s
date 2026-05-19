import { useState, useEffect } from "react";
import { useCart } from "@/hooks/useCart";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Minus, Plus, Trash2, ShoppingBag, ArrowLeft, Check, ChevronsUpDown, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate, useLocation } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

const Cart = () => {
  const { items, removeItem, updateQuantity, updateItemDetails, clearCart, addItem } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [isReturnOrder, setIsReturnOrder] = useState(false);
  const [returnOrderId, setReturnOrderId] = useState<string | null>(null);
  const [returnOrderNumber, setReturnOrderNumber] = useState<number | null>(null);
  const [returnOrderDate, setReturnOrderDate] = useState<string | null>(null);
  const [originalOrderItems, setOriginalOrderItems] = useState<
    Array<{ product_id: string | null; product_name: string; quantity: number; price: number }>
  >([]);
  const [governorateOpen, setGovernorateOpen] = useState(false);
  
  const [customerInfo, setCustomerInfo] = useState({
    name: "",
    phone: "",
    phone2: "",
    address: "",
    governorate: "",
    notes: "",
    shippingCost: 0,
    discount: 0,
    orderDetails: "",
    isShippingIncluded: false // الشحن مدفوع مسبقاً
  });

  // دالة لتحويل الأرقام العربية إلى إنجليزية
  const convertArabicToEnglishNumbers = (str: string) => {
    const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    const englishNumbers = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    
    return str.split('').map(char => {
      const index = arabicNumbers.indexOf(char);
      return index !== -1 ? englishNumbers[index] : char;
    }).join('');
  };

  // Load shared cart from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedCart = params.get('shared_cart');
    if (sharedCart) {
      try {
        const decoded = JSON.parse(decodeURIComponent(escape(atob(sharedCart))));
        if (Array.isArray(decoded) && decoded.length > 0) {
          clearCart();
          decoded.forEach((item: any) => {
            addItem({
              id: item.id,
              name: item.name,
              price: item.price,
              image_url: item.image_url,
              size: item.size,
              color: item.color,
              details: item.details,
            });
            if (item.quantity > 1) {
              updateQuantity(item.id, item.quantity);
            }
          });
          toast.success('تم تحميل السلة المشتركة بنجاح');
          // Remove the query param
          window.history.replaceState({}, '', '/cart');
        }
      } catch {
        console.error('Failed to parse shared cart');
      }
    }
  }, []);

  // Load return order data if navigated from AgentOrders
  useEffect(() => {
    const state = location.state as any;
    if (state?.returnOrder && state?.isReturn) {
      const order = state.returnOrder;
      setIsReturnOrder(true);
      setReturnOrderId(order.id);
      setReturnOrderNumber(order.order_number);
      setReturnOrderDate(order.created_at);

      const snapshot = (order.order_items || []).map((item: any) => {
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

        return {
          product_id: item?.product_id ?? null,
          product_name: productName,
          quantity: parseFloat((item?.quantity ?? 0).toString()) || 0,
          price: parseFloat((item?.price ?? 0).toString()) || 0,
        };
      });
      setOriginalOrderItems(snapshot);
      
      clearCart();
      order.order_items?.forEach((item: any) => {
        addItem({
          id: item.product_id,
          name: item.products?.name || '',
          price: parseFloat(item.price?.toString() || "0"),
          image_url: item.products?.image_url,
          size: item.size,
          color: item.color,
          details: item.product_details
        });
        updateQuantity(item.product_id, item.quantity);
      });

      setCustomerInfo({
        name: order.customers?.name || "",
        phone: order.customers?.phone || "",
        phone2: order.customers?.phone2 || "",
        address: order.customers?.address || "",
        governorate: order.customers?.governorate || "",
        notes: order.notes || "",
        shippingCost: parseFloat(order.shipping_cost?.toString() || "0"),
        discount: parseFloat(order.discount?.toString() || "0"),
        orderDetails: order.order_details || "",
        isShippingIncluded: false
      });
    }
  }, [location.state]);

  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
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

  const getProductPrice = (productId: string, quantity: number) => {
    const product = products?.find(p => p.id === productId);
    const cartItem = items.find(i => i.id === productId);
    
    // If product not found in DB, use cart item price as fallback
    if (!product) {
      return cartItem?.price || 0;
    }

    // Check for quantity pricing
    if (product.quantity_pricing && Array.isArray(product.quantity_pricing) && product.quantity_pricing.length > 0) {
      const pricing = (product.quantity_pricing as Array<{ quantity: number; price: number }>)
        .filter((qp) => qp.quantity <= quantity)
        .sort((a, b) => b.quantity - a.quantity);
      
      if (pricing.length > 0) {
        return parseFloat(pricing[0].price.toString());
      }
    }

    // Check for offer price (price per piece, will be multiplied by quantity later)
    if (product.is_offer && product.offer_price) {
      return parseFloat(product.offer_price.toString());
    }

    return parseFloat(product.price.toString());
  };

  const getTotalPrice = () => {
    const itemsTotal = items.reduce((sum, item) => {
      const price = getProductPrice(item.id, item.quantity);
      return sum + (price * item.quantity);
    }, 0);
    return itemsTotal + customerInfo.shippingCost;
  };

  const handleSubmitOrder = async () => {
    if (!customerInfo.name || !customerInfo.phone || !customerInfo.address) {
      toast.error("يرجى ملء جميع الحقول المطلوبة");
      return;
    }

    if (items.length === 0) {
      toast.error("السلة فارغة");
      return;
    }

    // التحقق من المخزن قبل إنشاء الطلب
    for (const item of items) {
      const product = products?.find(p => p.id === item.id);
      if (product && product.stock < item.quantity) {
        toast.error(`الكمية المتاحة من ${item.name} هي ${product.stock} فقط`);
        return;
      }
    }

    setLoading(true);

    try {
      if (isReturnOrder && returnOrderId) {
        // جلب بيانات الأوردر الحالية قبل التعديل (علشان نحسب فرق القطع صح)
        const { data: existingOrder, error: existingOrderError } = await supabase
          .from("orders")
          .select("total_amount, shipping_cost, agent_shipping_cost, delivery_agent_id, order_number, customer_id")
          .eq("id", returnOrderId)
          .single();

        if (existingOrderError) throw existingOrderError;

        // حساب إجمالي المنتجات فقط (بدون الشحن)
        const itemsTotal = items.reduce((sum, item) => {
          const price = getProductPrice(item.id, item.quantity);
          return sum + (price * item.quantity);
        }, 0);
        const totalAfterDiscount = itemsTotal - customerInfo.discount;

        const newShippingCost = customerInfo.isShippingIncluded ? 0 : customerInfo.shippingCost;

        // فرق الصافي (الفرق في (إجمالي + شحن العميل) فقط)
        const oldTotalAmount = parseFloat(existingOrder.total_amount?.toString() || "0");
        const oldShippingCost = parseFloat(existingOrder.shipping_cost?.toString() || "0");
        const deltaTotal = (totalAfterDiscount + newShippingCost) - (oldTotalAmount + oldShippingCost);

        // لو فيه مندوب على الأوردر: تعديل مستحقات المندوب يتم تلقائياً من Trigger قاعدة البيانات
        // handle_order_amount_modification، لذلك لا نعدّل total_owed ولا نضيف agent_payments من الواجهة هنا
        // لتجنب تكرار الخصم/الإضافة (×2).


        // Update existing order
        const { error: orderError } = await supabase
          .from("orders")
          .update({
            total_amount: totalAfterDiscount,
            shipping_cost: newShippingCost,
            discount: customerInfo.discount,
            order_details: customerInfo.orderDetails || null,
            notes: customerInfo.notes,
          })
          .eq("id", returnOrderId);

        if (orderError) throw orderError;

        // Delete old order items
        const { error: deleteError } = await supabase
          .from("order_items")
          .delete()
          .eq("order_id", returnOrderId);

        if (deleteError) throw deleteError;

        // Insert new order items
        const orderItems = items.map(item => {
          const price = getProductPrice(item.id, item.quantity);

          return {
            order_id: returnOrderId,
            product_id: item.id,
            quantity: item.quantity,
            price: price,
            size: item.size || null,
            color: item.color || null,
            product_details: JSON.stringify({
              name: item.name,
              price: price,
              size: item.size || null,
              color: item.color || null,
              custom_details: item.details || null
            })
          };
        });

        const { error: itemsError } = await supabase
          .from("order_items")
          .insert(orderItems);

        if (itemsError) throw itemsError;

        // لو فيه نقص في القطع بعد التعديل => سجّل قيمة النقص والقطع في جدول returns
        const normalizeExistingReturnedItems = (raw: any): any[] => {
          let parsed: any[] = [];
          if (typeof raw === "string") {
            try {
              parsed = JSON.parse(raw);
            } catch {
              parsed = [];
            }
          } else if (Array.isArray(raw)) {
            parsed = raw;
          }

          if (!Array.isArray(parsed)) return [];

          return parsed
            .map((it: any) => {
              const product_name = it?.product_name || it?.name || "منتج غير معروف";
              const returned_quantity =
                parseFloat((it?.returned_quantity ?? it?.quantity ?? 0).toString()) || 0;
              const price = parseFloat((it?.price ?? 0).toString()) || 0;
              const product_id = it?.product_id ?? null;
              return { product_id, product_name, returned_quantity, price };
            })
            .filter((it: any) => (it.returned_quantity ?? 0) > 0);
        };

        // Baseline (before edit) — fallback to DB if state snapshot wasn't present
        let baselineItems = originalOrderItems;
        if (!baselineItems || baselineItems.length === 0) {
          const { data: oldItems, error: oldItemsError } = await supabase
            .from("order_items")
            .select("product_id, quantity, price, product_details, products(name)")
            .eq("order_id", returnOrderId);
          if (oldItemsError) throw oldItemsError;

          baselineItems = (oldItems || []).map((it: any) => {
            const productName =
              it?.products?.name ||
              (() => {
                try {
                  const d = it?.product_details ? JSON.parse(it.product_details) : null;
                  return d?.name || d?.product_name;
                } catch {
                  return null;
                }
              })() ||
              "منتج غير معروف";

            return {
              product_id: it?.product_id ?? null,
              product_name: productName,
              quantity: parseFloat((it?.quantity ?? 0).toString()) || 0,
              price: parseFloat((it?.price ?? 0).toString()) || 0,
            };
          });
        }

        const cartQtyByProductId = new Map<string, number>();
        items.forEach((it) => cartQtyByProductId.set(it.id, it.quantity));

        const returnedItemsDelta = baselineItems
          .map((oldIt) => {
            const pid = oldIt.product_id;
            if (!pid) return null;
            const newQty = cartQtyByProductId.get(pid) ?? 0;
            const oldQty = oldIt.quantity ?? 0;
            const returnedQty = Math.max(0, oldQty - newQty);
            if (returnedQty <= 0) return null;
            return {
              product_id: pid,
              product_name: oldIt.product_name,
              returned_quantity: returnedQty,
              price: oldIt.price,
            };
          })
          .filter(Boolean) as Array<{
          product_id: string;
          product_name: string;
          returned_quantity: number;
          price: number;
        }>;

        const returnAmountFromDelta = returnedItemsDelta.reduce(
          (sum, it) => sum + (it.returned_quantity || 0) * (it.price || 0),
          0
        );

        if (returnAmountFromDelta > 0) {
          const { data: existingReturnRow, error: existingReturnErr } = await supabase
            .from("returns")
            .select("id, return_amount, returned_items")
            .eq("order_id", returnOrderId)
            .maybeSingle();
          if (existingReturnErr) throw existingReturnErr;

          const mergedByKey = new Map<string, any>();
          const existingItems = normalizeExistingReturnedItems(existingReturnRow?.returned_items);
          existingItems.forEach((it: any) => {
            const key = `${it.product_id ?? ""}::${it.product_name}`;
            mergedByKey.set(key, { ...it });
          });
          returnedItemsDelta.forEach((it) => {
            const key = `${it.product_id ?? ""}::${it.product_name}`;
            const prev = mergedByKey.get(key);
            mergedByKey.set(key, {
              ...(prev || {}),
              ...it,
              returned_quantity: (prev?.returned_quantity || 0) + (it.returned_quantity || 0),
              price: it.price || prev?.price,
            });
          });

          const mergedItems = Array.from(mergedByKey.values()).filter(
            (it: any) => (it.returned_quantity ?? 0) > 0
          );

          const existingAmount =
            parseFloat((existingReturnRow?.return_amount ?? 0).toString()) || 0;
          const newReturnAmount = existingAmount + returnAmountFromDelta;

          const notes = `مرتجع من السلة - ${returnedItemsDelta
            .map((it) => `${it.product_name} × ${it.returned_quantity}`)
            .join(", ")}`;

          if (existingReturnRow?.id) {
            const { error: updErr } = await supabase
              .from("returns")
              .update({
                delivery_agent_id: existingOrder.delivery_agent_id,
                customer_id: existingOrder.customer_id,
                return_amount: newReturnAmount,
                returned_items: mergedItems as any,
                notes,
              })
              .eq("id", existingReturnRow.id);
            if (updErr) throw updErr;
          } else {
            const { error: insErr } = await supabase.from("returns").insert({
              order_id: returnOrderId,
              delivery_agent_id: existingOrder.delivery_agent_id,
              customer_id: existingOrder.customer_id,
              return_amount: newReturnAmount,
              returned_items: mergedItems as any,
              notes,
            });
            if (insErr) throw insErr;
          }
        }

        toast.success("تم تحديث الأوردر بنجاح!");
        clearCart();
        setIsReturnOrder(false);
        setReturnOrderId(null);
        navigate('/admin/agent-orders');
      } else {
        // Create new order - check if customer with same phone exists
        let customer: any;
        if (customerInfo.phone) {
          const { data: existingCustomer } = await supabase
            .from("customers")
            .select("*")
            .eq("phone", customerInfo.phone)
            .maybeSingle();
          
          if (existingCustomer) {
            // Update existing customer name/address
            const { data: updated, error: updateError } = await supabase
              .from("customers")
              .update({
                name: customerInfo.name,
                phone2: customerInfo.phone2 || null,
                address: customerInfo.address,
                governorate: customerInfo.governorate
              })
              .eq("id", existingCustomer.id)
              .select()
              .single();
            if (updateError) throw updateError;
            customer = updated;
          } else {
            const { data: newCustomer, error: customerError } = await supabase
              .from("customers")
              .insert({
                name: customerInfo.name,
                phone: customerInfo.phone,
                phone2: customerInfo.phone2 || null,
                address: customerInfo.address,
                governorate: customerInfo.governorate
              })
              .select()
              .single();
            if (customerError) throw customerError;
            customer = newCustomer;
          }
        } else {
          const { data: newCustomer, error: customerError } = await supabase
            .from("customers")
            .insert({
              name: customerInfo.name,
              phone: customerInfo.phone || "غير متوفر",
              phone2: customerInfo.phone2 || null,
              address: customerInfo.address,
              governorate: customerInfo.governorate
            })
            .select()
            .single();
          if (customerError) throw customerError;
          customer = newCustomer;
        }

        // حساب إجمالي المنتجات
        const itemsTotal = items.reduce((sum, item) => {
          const price = getProductPrice(item.id, item.quantity);
          return sum + (price * item.quantity);
        }, 0);

        const { data: order, error: orderError } = await supabase
          .from("orders")
          .insert({
            customer_id: customer.id,
            total_amount: itemsTotal,
            shipping_cost: customerInfo.shippingCost,
            discount: 0,
            order_details: customerInfo.orderDetails || null,
            notes: customerInfo.notes,
            status: "pending"
          })
          .select()
          .single();

        if (orderError) throw orderError;

        const orderItems = items.map(item => {
          const price = getProductPrice(item.id, item.quantity);
          
          return {
            order_id: order.id,
            product_id: item.id,
            quantity: item.quantity,
            price: price,
            size: item.size || null,
            color: item.color || null,
            product_details: JSON.stringify({
              name: item.name,
              price: price,
              size: item.size || null,
              color: item.color || null,
              custom_details: item.details || null
            })
          };
        });

        const { error: itemsError } = await supabase
          .from("order_items")
          .insert(orderItems);

        if (itemsError) throw itemsError;

        // خصم الكمية من المخزن
        for (const item of items) {
          const product = products?.find(p => p.id === item.id);
          if (product && product.stock !== null && product.stock !== undefined) {
            const newStock = Math.max(0, product.stock - item.quantity);
            const { error: stockError } = await supabase
              .from("products")
              .update({ stock: newStock })
              .eq("id", item.id);
            
            if (stockError) {
              console.error("Error updating stock:", stockError);
              toast.error(`فشل تحديث مخزون ${item.name}`);
            }
          }
        }

        toast.success("تم إرسال الطلب بنجاح!");
        clearCart();
        setCustomerInfo({
          name: "",
          phone: "",
          phone2: "",
          address: "",
          governorate: "",
          notes: "",
          shippingCost: 0,
          discount: 0,
          orderDetails: "",
          isShippingIncluded: false
        });
      }
      
    } catch (error: any) {
      console.error("Error submitting order:", error);
      toast.error("حدث خطأ أثناء إرسال الطلب");
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-accent/20 flex items-center justify-center">
        <div className="text-center">
          <ShoppingBag className="w-24 h-24 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">السلة فارغة</h2>
          <p className="text-muted-foreground mb-6">أضف بعض المنتجات للبدء</p>
          <Button onClick={() => navigate("/")}>تصفح المنتجات</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-accent/20 py-4 sm:py-8">
      <div className="container mx-auto px-3 sm:px-4 max-w-6xl">
        <div className="flex items-center justify-between mb-3 gap-2">
          <Button onClick={() => navigate("/")} variant="ghost" size="sm" className="text-sm sm:text-lg">
            <ArrowLeft className="ml-1 h-4 w-4" />
            الرجوع
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const cartData = items.map(item => ({
                id: item.id,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                image_url: item.image_url,
                size: item.size,
                color: item.color,
                details: item.details,
              }));
              const jsonStr = JSON.stringify(cartData);
              const encoded = btoa(unescape(encodeURIComponent(jsonStr)));
              const shareUrl = `${window.location.origin}/cart?shared_cart=${encoded}`;
              navigator.clipboard.writeText(shareUrl).then(() => {
                toast.success('تم نسخ رابط السلة المشتركة');
              }).catch(() => {
                const textArea = document.createElement('textarea');
                textArea.value = shareUrl;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                toast.success('تم نسخ رابط السلة المشتركة');
              });
            }}
          >
            <Share2 className="ml-1 h-4 w-4" />
            مشاركة
          </Button>
        </div>
        <h1 className="text-2xl sm:text-4xl font-bold mb-4 sm:mb-8 text-center">
          {isReturnOrder ? `تعديل الأوردر #${returnOrderNumber}` : 'فاتورة الطلب'}
        </h1>
        {isReturnOrder && (
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-3 rounded mb-4 text-center">
            <p className="font-bold">تعديل أوردر مرتجع</p>
            <p className="text-sm">سيتم تحديث الأوردر بنفس الرقم ({returnOrderNumber}) والتاريخ ({new Date(returnOrderDate!).toLocaleDateString('ar-EG')})</p>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-6">
            {items.map((item) => (
              <Card key={item.id} className="shadow-lg border">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex gap-3 sm:gap-6">
                    {/* Product Image */}
                    <div className="w-20 h-20 sm:w-32 sm:h-32 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                      {item.image_url ? (
                        <img 
                          src={item.image_url} 
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ShoppingBag className="w-8 h-8 sm:w-12 sm:h-12 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* Product Details */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-base sm:text-xl mb-1 truncate">{item.name}</h3>
                      <p className="text-primary font-bold text-lg sm:text-xl mb-1">
                        {getProductPrice(item.id, item.quantity).toFixed(2)} ج.م
                      </p>
                      <p className="text-sm sm:text-base font-semibold text-muted-foreground mb-2">
                        الإجمالي: {(getProductPrice(item.id, item.quantity) * item.quantity).toFixed(2)} ج.م
                      </p>

                      {/* Size and Color Selectors */}
                      {item.details && (
                        <div className="grid grid-cols-2 gap-2 mb-2">
                          <div>
                            <Label className="text-xs sm:text-sm font-semibold mb-1 block">المقاس</Label>
                            {(() => {
                              const product = products?.find(p => p.id === item.id);
                              return product?.size_options && product.size_options.length > 0 ? (
                                <Select
                                  value={item.size || ""}
                                  onValueChange={(value) => updateItemDetails(item.id, value, item.color)}
                                >
                                  <SelectTrigger className="h-9">
                                    <SelectValue placeholder="اختر" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {product.size_options.map((size) => (
                                      <SelectItem key={size} value={size}>{size}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Input
                                  value={item.size || ""}
                                  onChange={(e) => updateItemDetails(item.id, e.target.value, item.color)}
                                  placeholder="المقاس"
                                  className="h-9 text-sm"
                                />
                              );
                            })()}
                          </div>
                          <div>
                            <Label className="text-xs sm:text-sm font-semibold mb-1 block">اللون</Label>
                            {(() => {
                              const product = products?.find(p => p.id === item.id);
                              return product?.color_options && product.color_options.length > 0 ? (
                                <Select
                                  value={item.color || ""}
                                  onValueChange={(value) => updateItemDetails(item.id, item.size, value)}
                                >
                                  <SelectTrigger className="h-9">
                                    <SelectValue placeholder="اختر" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {product.color_options.map((color) => (
                                      <SelectItem key={color} value={color}>{color}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Input
                                  value={item.color || ""}
                                  onChange={(e) => updateItemDetails(item.id, item.size, e.target.value)}
                                  placeholder="اللون"
                                  className="h-9 text-sm"
                                />
                              );
                            })()}
                          </div>
                        </div>
                      )}

                      {/* Quantity Controls */}
                      <div className="flex items-center gap-2 mt-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="h-9 w-9"
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-10 text-center font-bold text-lg">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            const product = products?.find(p => p.id === item.id);
                            if (product && item.quantity >= product.stock) {
                              toast.error(`الكمية المتاحة هي ${product.stock} فقط`);
                              return;
                            }
                            updateQuantity(item.id, item.quantity + 1);
                          }}
                          className="h-9 w-9"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon"
                          onClick={() => removeItem(item.id)}
                          className="mr-auto h-9 w-9"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Order Form */}
          <div className="lg:col-span-1">
            <Card className="sticky top-4 shadow-xl border-2">
              <CardHeader className="bg-primary/5">
                <CardTitle className="text-2xl">معلومات التوصيل</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5 pt-6">
                <div>
                  <Label htmlFor="name" className="text-base font-semibold mb-2 block">الاسم *</Label>
                  <Input
                    id="name"
                    value={customerInfo.name}
                    onChange={(e) => setCustomerInfo({...customerInfo, name: e.target.value})}
                    placeholder="أدخل اسمك"
                    className="h-12 text-base"
                    autoComplete="off"
                  />
                </div>

                <div>
                  <Label htmlFor="phone" className="text-base font-semibold mb-2 block">رقم الهاتف *</Label>
                  <Input
                    id="phone"
                    value={customerInfo.phone}
                    onChange={(e) => {
                      const convertedValue = convertArabicToEnglishNumbers(e.target.value);
                      setCustomerInfo({...customerInfo, phone: convertedValue});
                    }}
                    placeholder="01XXXXXXXXX"
                    className="h-12 text-base"
                    autoComplete="off"
                  />
                </div>

                <div>
                  <Label htmlFor="phone2" className="text-base font-semibold mb-2 block">رقم هاتف إضافي (اختياري)</Label>
                  <Input
                    id="phone2"
                    value={customerInfo.phone2}
                    onChange={(e) => {
                      const convertedValue = convertArabicToEnglishNumbers(e.target.value);
                      setCustomerInfo({...customerInfo, phone2: convertedValue});
                    }}
                    placeholder="01XXXXXXXXX"
                    className="h-12 text-base"
                    autoComplete="off"
                  />
                </div>

                <div>
                  <Label htmlFor="governorate" className="text-base font-semibold mb-2 block">المحافظة *</Label>
                  <Popover open={governorateOpen} onOpenChange={setGovernorateOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={governorateOpen}
                        className="w-full h-12 justify-between"
                      >
                        {customerInfo.governorate
                          ? `${customerInfo.governorate} - ${customerInfo.shippingCost.toFixed(2)} ج.م شحن`
                          : "اختر المحافظة"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                      <Command>
                        <CommandInput placeholder="ابحث عن محافظة..." />
                        <CommandList>
                          <CommandEmpty>لم يتم العثور على محافظة.</CommandEmpty>
                          <CommandGroup>
                            {governorates?.map((gov) => (
                              <CommandItem
                                key={gov.id}
                                value={gov.name}
                                onSelect={(currentValue) => {
                                  const selectedGov = governorates.find(g => g.name.toLowerCase() === currentValue.toLowerCase());
                                  if (selectedGov) {
                                    const shippingCost = parseFloat(selectedGov.shipping_cost.toString());
                                    setCustomerInfo({
                                      ...customerInfo,
                                      governorate: selectedGov.name,
                                      shippingCost: shippingCost
                                    });
                                  }
                                  setGovernorateOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    customerInfo.governorate === gov.name ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {gov.name} - {parseFloat(gov.shipping_cost.toString()).toFixed(2)} ج.م شحن
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <Label htmlFor="address" className="text-base font-semibold mb-2 block">العنوان بالتفصيل *</Label>
                  <Textarea
                    id="address"
                    value={customerInfo.address}
                    onChange={(e) => setCustomerInfo({...customerInfo, address: e.target.value})}
                    placeholder="الشارع، المنطقة، العمارة..."
                    rows={3}
                    className="text-base"
                    autoComplete="off"
                  />
                </div>

                <div>
                  <Label htmlFor="orderDetails" className="text-base font-semibold mb-2 block">تفاصيل الأوردر (اختياري)</Label>
                  <Textarea
                    id="orderDetails"
                    value={customerInfo.orderDetails}
                    onChange={(e) => setCustomerInfo({...customerInfo, orderDetails: e.target.value})}
                    placeholder="أي تفاصيل خاصة بالأوردر..."
                    rows={2}
                    className="text-base"
                    autoComplete="off"
                  />
                </div>

                <div>
                  <Label htmlFor="notes" className="text-base font-semibold mb-2 block">ملاحظات</Label>
                  <Textarea
                    id="notes"
                    value={customerInfo.notes}
                    onChange={(e) => setCustomerInfo({...customerInfo, notes: e.target.value})}
                    placeholder="ملاحظات إضافية (اختياري)"
                    rows={2}
                    className="text-base"
                    autoComplete="off"
                  />
                </div>




                {/* Total */}
                <div className="border-t-2 pt-6 bg-primary/5 -mx-6 px-6 pb-2">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-lg">
                      <span>المنتجات:</span>
                      <span>{items.reduce((sum, item) => sum + (getProductPrice(item.id, item.quantity) * item.quantity), 0).toFixed(2)} ج.م</span>
                    </div>
                    {customerInfo.shippingCost > 0 && (
                      <div className="flex justify-between items-center text-lg">
                        <span>الشحن:</span>
                        <span>{customerInfo.shippingCost.toFixed(2)} ج.م</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-2xl font-bold border-t pt-2">
                      <span>الإجمالي:</span>
                      <span className="text-primary">{getTotalPrice().toFixed(2)} ج.م</span>
                    </div>
                  </div>
                </div>
              </CardContent>

              <CardFooter className="pt-2">
                <Button 
                  onClick={handleSubmitOrder} 
                  disabled={loading}
                  className="w-full text-lg py-6"
                  size="lg"
                >
                  {loading ? "جاري الإرسال..." : "تأكيد الطلب"}
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cart;