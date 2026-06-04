import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Printer, FileSpreadsheet, Filter, Building2, Search, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useState, useMemo, useEffect } from "react";
import * as XLSX from "xlsx";
import { useTheme } from "@/contexts/ThemeContext";
import { generateBarcodeDataUrl } from "@/lib/barcodeUtils";

type InvoiceItemRow = {
  productName: string;
  itemSize?: string;
  itemColor?: string;
  quantity: number;
  price: number;
};

type InvoiceOrder = {
  id: string;
  order_number?: string | number;
  total_amount: string | number;
  shipping_cost?: string | number | null;
  order_details?: string | null;
  order_items?: Array<{
    products?: { name?: string; name_ar?: string; name_en?: string } | null;
    size?: string | null;
    color?: string | null;
    quantity?: number | null;
    price?: string | number | null;
    product_details?: unknown;
  }>;
  created_at: string;
  tracking_code?: string | null;
  customers?: { name?: string; phone?: string; phone2?: string; governorate?: string; address?: string } | null;
  governorates?: { name?: string } | null;
  delivery_agents?: { name?: string; serial_number?: string } | null;
  notes?: string | null;
};

type OfficeOption = { id: string; name: string; watermark_name?: string | null; logo_url?: string | null };

const asText = (value: unknown) => (typeof value === "string" || typeof value === "number" ? String(value) : undefined);
const asNumber = (value: unknown) => Number(value) || undefined;


const Invoices = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { invoiceName } = useTheme();
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [selectedOfficeId, setSelectedOfficeId] = useState<string>("default");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [partialDeliveryNotes, setPartialDeliveryNotes] = useState<Record<string, string>>({});
  const [printCopies, setPrintCopies] = useState<number>(1);

  // Auto-select orders when arriving from Barcode Scanner with ?ids=...
  useEffect(() => {
    const idsParam = searchParams.get("ids");
    if (idsParam) {
      setSelectedOrders(idsParam.split(",").filter(Boolean));
    }
  }, [searchParams]);

  
  // فلاتر
  const [dateFilter, setDateFilter] = useState<string>("");
  const [governorateFilters, setGovernorateFilters] = useState<string[]>([]);
  const [agentFilters, setAgentFilters] = useState<string[]>([]);

  const { data: orders, isLoading } = useQuery({
    queryKey: ["orders-for-invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          customers (name, phone, address, governorate, phone2),
          delivery_agents (name, serial_number),
          governorates (name, shipping_cost),
          order_items (*, products (name))
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // جلب المحافظات للفلتر
  const { data: governorates } = useQuery({
    queryKey: ["governorates-filter"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("governorates")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // جلب المكاتب
  const { data: offices } = useQuery({
    queryKey: ["offices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("offices")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // جلب المناديب للفلتر
  const { data: agents } = useQuery({
    queryKey: ["agents-filter-invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_agents")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // تحويل التاريخ ليوم Cairo
  const getDateKey = (value: string | Date) => {
    const d = typeof value === "string" ? new Date(value) : value;
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Cairo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  };

  // استخراج التواريخ الفريدة من الأوردرات
  const uniqueDates = useMemo(() => {
    if (!orders?.length) return [];
    const dates = new Set<string>();
    orders.forEach(order => {
      dates.add(getDateKey(order.created_at));
    });
    return Array.from(dates).sort().reverse();
  }, [orders]);

  // فلترة الأوردرات
  const filteredOrders = useMemo(() => {
    if (!orders?.length) return [];
    
    return orders.filter(order => {
      // بحث برقم الأوردر
      if (searchQuery) {
        const orderNum = (order.order_number || "").toString();
        const orderId = order.id.slice(0, 8);
        const customerName = order.customers?.name || "";
        const q = searchQuery.trim();
        if (!orderNum.includes(q) && !orderId.includes(q) && !customerName.includes(q)) return false;
      }
      
      // فلتر التاريخ
      if (dateFilter) {
        const orderDate = getDateKey(order.created_at);
        if (orderDate !== dateFilter) return false;
      }
      
      // فلتر المحافظات (متعدد)
      if (governorateFilters.length > 0) {
        const orderGov = order.governorates?.name || order.customers?.governorate || "";
        if (!governorateFilters.includes(orderGov)) return false;
      }

      // فلتر المناديب (متعدد) — يعرض الأوردرات المعينة حالياً للمناديب المحددين
      if (agentFilters.length > 0) {
        const agentId = (order as any).delivery_agent_id;
        if (!agentId || !agentFilters.includes(agentId)) return false;
      }
      
      return true;
    });
  }, [orders, dateFilter, governorateFilters, agentFilters, searchQuery]);

  // تصدير Excel للأوردرات المفلترة/المحددة فقط
  const handleExportExcel = () => {
    // إذا كان هناك أوردرات محددة، صدّرها فقط، وإلا صدّر المفلتر
    const ordersToExport = selectedOrders.length > 0 
      ? filteredOrders.filter(o => selectedOrders.includes(o.id))
      : filteredOrders;
    
    if (!ordersToExport?.length) {
      return;
    }
    
    const exportData = ordersToExport.map(order => {
      const totalAmount = parseFloat(order.total_amount.toString());
      const customerShipping = parseFloat((order.shipping_cost || 0).toString());
      const agentShipping = parseFloat((order.agent_shipping_cost || 0).toString());
      const totalPrice = totalAmount + customerShipping;
      const netAmount = totalPrice - agentShipping;
      
      return {
        "رقم الأوردر": order.order_number || order.id.slice(0, 8),
        "اسم العميل": order.customers?.name || "-",
        "الهاتف": order.customers?.phone || "-",
        "العنوان": order.customers?.address || "-",
        "المحافظة": order.governorates?.name || order.customers?.governorate || "-",
        "المندوب": order.delivery_agents?.name || "-",
        "الحالة": order.status,
        "سعر المنتجات": totalAmount.toFixed(2),
        "شحن العميل": customerShipping.toFixed(2),
        "الإجمالي": totalPrice.toFixed(2),
        "شحن المندوب": agentShipping.toFixed(2),
        "الصافي (المطلوب من المندوب)": netAmount.toFixed(2),
        "الخصم": parseFloat((order.discount || 0).toString()).toFixed(2),
        "التاريخ": new Date(order.created_at).toLocaleDateString("ar-EG")
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "الأوردرات");
    
    const fileName = dateFilter 
      ? `orders_${dateFilter}.xlsx`
      : `orders_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const generateInvoiceCell = (order: InvoiceOrder, brandName: string, watermarkText: string, logoUrl: string | null) => {
    const totalAmount = parseFloat(order.total_amount.toString());
    const customerShipping = parseFloat((order.shipping_cost || 0).toString());
    const totalPrice = totalAmount + customerShipping;
    const normalizeInvoiceItems = (sourceOrder: InvoiceOrder): InvoiceItemRow[] => {
      const dbItems = (sourceOrder.order_items || []).map((item): InvoiceItemRow => {
        let productName = item.products?.name || item.products?.name_ar || item.products?.name_en;
        let itemSize = item.size || undefined;
        let itemColor = item.color || undefined;
        let quantity = item.quantity || undefined;
        if (item.product_details) {
          let details: Record<string, unknown> | null = null;
          if (typeof item.product_details === 'string') {
            const raw = item.product_details.trim();
            if (raw.startsWith('{') || raw.startsWith('[')) {
              try { details = JSON.parse(raw); } catch { details = null; }
            }
            if (!details && !productName && raw) productName = raw;
          } else if (typeof item.product_details === 'object') {
            details = item.product_details as Record<string, unknown>;
          }
          if (Array.isArray(details)) details = details[0] as Record<string, unknown>;
          if (details && typeof details === 'object') {
            productName = productName || asText(details.name) || asText(details.product_name) || asText(details.title) || asText(details.name_ar) || asText(details.name_en);
            itemSize = itemSize || asText(details.size) || asText(details.variant);
            itemColor = itemColor || asText(details.color);
            quantity = quantity || asNumber(details.quantity) || asNumber(details.qty) || asNumber(details.count);
          }
        }
        return { productName: productName || 'منتج', itemSize, itemColor, quantity: quantity || 1, price: parseFloat((item.price || 0).toString()) };
      });

      if (dbItems.length > 0) return dbItems;

      const rawDetails = (sourceOrder.order_details || '').toString().trim();
      if (!rawDetails) return [];

      let parsed: unknown = null;
      if (rawDetails.startsWith('{') || rawDetails.startsWith('[')) {
        try { parsed = JSON.parse(rawDetails); } catch { parsed = null; }
      }

      if (parsed) {
        const parsedRecord = parsed as Record<string, unknown>;
        const possibleItems = Array.isArray(parsed) ? parsed : (parsedRecord.items || parsedRecord.products || parsedRecord.order_items || parsedRecord.cart || []);
        if (Array.isArray(possibleItems) && possibleItems.length > 0) {
          return possibleItems.map((item): InvoiceItemRow => {
            const itemRecord = item as Record<string, unknown>;
            const quantity = asNumber(itemRecord.quantity) || asNumber(itemRecord.qty) || asNumber(itemRecord.count) || 1;
            return {
              productName: asText(itemRecord.name) || asText(itemRecord.product_name) || asText(itemRecord.title) || asText(itemRecord.name_ar) || asText(itemRecord.name_en) || 'منتج',
              itemSize: asText(itemRecord.size) || asText(itemRecord.variant),
              itemColor: asText(itemRecord.color),
              quantity,
              price: asNumber(itemRecord.price) || asNumber(itemRecord.unit_price) || asNumber(itemRecord.total) || (possibleItems.length === 1 ? totalAmount / quantity : 0)
            };
          });
        }
      }

      return rawDetails.split(/\n|،|,/).map((line: string) => line.trim()).filter(Boolean).map((line: string, index: number, list: string[]) => {
        const qtyMatch = line.match(/(?:×|x|X|\*)\s*(\d+)|(?:الكمية|qty|quantity)\s*[:：-]?\s*(\d+)/i);
        const quantity = Number(qtyMatch?.[1] || qtyMatch?.[2] || 1) || 1;
        const variantMatch = line.match(/\(([^)]+)\)/);
        const cleanName = line
          .replace(/(?:×|x|X|\*)\s*\d+/i, '')
          .replace(/(?:الكمية|qty|quantity)\s*[:：-]?\s*\d+/i, '')
          .replace(/\([^)]+\)/g, '')
          .trim();
        return {
          productName: cleanName || line,
          itemSize: undefined,
          itemColor: variantMatch?.[1],
          quantity,
          price: list.length === 1 ? totalAmount / quantity : 0
        };
      });
    };
    const invoiceItems = normalizeInvoiceItems(order);
    
    const logoHtml = logoUrl 
      ? `<img src="${logoUrl}" style="max-width:40px;max-height:40px;object-fit:contain;" />`
      : '';
    
    return `<div class="invoice-cell">
      <div style="position:relative;width:100%;height:100%;padding:5mm;box-sizing:border-box;font-family:Arial,'Cairo',sans-serif;display:flex;flex-direction:column;overflow:hidden;color:#000;background:#fff;">
        <!-- Watermark -->
        <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:64px;font-weight:900;color:rgba(0,0,0,0.06);pointer-events:none;z-index:0;white-space:nowrap;letter-spacing:4px;">${watermarkText}</div>

        <!-- Header band: brand + order # -->
        <div style="position:relative;z-index:1;display:flex;align-items:stretch;border:2.5px solid #000;">
          <div style="flex:1.3;padding:7px 10px;border-left:2.5px solid #000;display:flex;align-items:center;gap:10px;">
            ${logoHtml ? logoHtml.replace('max-width:40px;max-height:40px', 'max-width:44px;max-height:44px;filter:grayscale(100%);') : ''}
            <div>
              <div style="font-size:24px;font-weight:900;line-height:1;letter-spacing:1px;">${brandName}</div>
              <div style="font-size:11px;margin-top:3px;">📅 ${new Date(order.created_at).toLocaleDateString('ar-EG')}</div>
            </div>
          </div>
          <div style="flex:1;padding:7px 10px;text-align:center;background:#000;color:#fff;">
            <div style="font-size:10px;letter-spacing:2px;">ORDER NO.</div>
            <div style="font-size:28px;font-weight:900;line-height:1;">#${order.order_number || order.id.slice(0, 8)}</div>
          </div>
        </div>

        <!-- Barcode strip -->
        <div style="position:relative;z-index:1;border:2.5px solid #000;border-top:0;padding:5px;text-align:center;">
          <img src="${generateBarcodeDataUrl(order.tracking_code || `ORD-${order.order_number || order.id.slice(0,8)}`, { width: 2, height: 48, fontSize: 13, margin: 1 })}" style="max-height:54px;display:block;margin:0 auto;filter:grayscale(100%);" />
        </div>

        <!-- Recipient (big, full width) -->
        <div style="position:relative;z-index:1;border:2.5px solid #000;border-top:0;padding:9px 12px;">
          <div style="font-size:12px;font-weight:700;letter-spacing:2px;border-bottom:1.5px solid #000;padding-bottom:4px;margin-bottom:6px;">إلى / TO</div>
          <div style="font-size:19px;font-weight:900;line-height:1.2;">${order.customers?.name}</div>
          <div style="font-size:14px;line-height:1.7;margin-top:4px;">
            <strong>هاتف:</strong> ${order.customers?.phone}${order.customers?.phone2 ? ` · ${order.customers.phone2}` : ''}<br/>
            <strong>المحافظة:</strong> ${order.governorates?.name || order.customers?.governorate || "-"}<br/>
            <strong>العنوان:</strong> ${order.customers?.address}
          </div>
          ${order.notes ? `<div style="margin-top:5px;font-size:12px;border-top:1px dashed #000;padding-top:4px;"><strong>📝 ملاحظات:</strong> ${order.notes}</div>` : ''}
        </div>

        <!-- Items -->
        <div style="position:relative;z-index:1;border:2.5px solid #000;border-top:0;flex:1;display:flex;flex-direction:column;overflow:hidden;">
          <div style="background:#000;color:#fff;padding:5px 10px;font-size:13px;font-weight:700;display:flex;justify-content:space-between;letter-spacing:1px;">
            <span>المنتجات (${invoiceItems.length})</span>
            <span>الكمية · السعر</span>
          </div>
          <div style="flex:1;padding:3px 0;">
            ${invoiceItems.map((item, idx) => {
              const itemTotal = item.price * item.quantity;
              return `<div style="display:flex;align-items:center;gap:6px;padding:5px 10px;font-size:13px;border-bottom:1px dashed #888;">
                <span style="font-weight:900;font-size:15px;min-width:20px;">${idx + 1}.</span>
                <span style="flex:1;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${item.productName}${(item.itemSize || item.itemColor) ? ` <span style="font-weight:400;font-size:11px;">(${[item.itemSize, item.itemColor].filter(Boolean).join(' · ')})</span>` : ''}</span>
                <span style="font-weight:700;min-width:32px;text-align:center;">×${item.quantity}</span>
                <span style="font-weight:900;min-width:65px;text-align:left;">${itemTotal > 0 ? `${itemTotal.toFixed(0)} ج.م` : '—'}</span>
              </div>`;
            }).join('') || ''}
          </div>
        </div>

        <!-- Totals row -->
        <div style="position:relative;z-index:1;border:2.5px solid #000;border-top:0;display:flex;align-items:stretch;">
          <div style="flex:1;padding:4px 6px;text-align:center;font-size:11px;border-left:1.5px solid #000;">
            <div>المنتجات</div><div style="font-weight:900;font-size:14px;">${totalAmount.toFixed(0)}</div>
          </div>
          <div style="flex:1;padding:4px 6px;text-align:center;font-size:11px;border-left:1.5px solid #000;">
            <div>الشحن</div><div style="font-weight:900;font-size:14px;">${customerShipping.toFixed(0)}</div>
          </div>
          <div style="flex:1;padding:4px 6px;text-align:center;font-size:11px;border-left:1.5px solid #000;">
            <div>المندوب</div><div style="font-weight:700;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${order.delivery_agents?.name || "—"}</div>
          </div>
          <div style="flex:3;padding:10px 14px;text-align:center;background:#000;color:#fff;display:flex;flex-direction:column;justify-content:center;">
            <div style="font-size:14px;letter-spacing:3px;font-weight:700;">الإجمالي المطلوب</div>
            <div style="font-size:40px;font-weight:900;line-height:1;margin-top:3px;">${totalPrice.toFixed(0)} <span style="font-size:20px;">ج.م</span></div>
          </div>
        </div>

        ${partialDeliveryNotes[order.id] ? `<div style="position:relative;z-index:1;margin-top:3px;border:2px dashed #000;padding:4px 8px;font-size:12px;font-weight:700;">⚠ تسليم جزئي: ${partialDeliveryNotes[order.id]}</div>` : ''}

        <!-- Footer notes -->
        <div style="position:relative;z-index:1;border:1.5px solid #000;border-top:0;padding:5px 10px;font-size:11px;line-height:1.5;text-align:center;font-weight:700;">
          معاينة الطرد قبل الاستلام وعدم استخدامه · في حالة الرفض يتم دفع رسوم شحن للمندوب 65 ج
        </div>
      </div>
    </div>`;
  };

  const handlePrint = () => {
    const ordersToPrint = filteredOrders?.filter(o => selectedOrders.includes(o.id));
    if (!ordersToPrint?.length) return;

    const selectedOffice = offices?.find((o: OfficeOption) => o.id === selectedOfficeId);
    const brandName = selectedOffice ? selectedOffice.name : invoiceName;
    const watermarkText = selectedOffice ? (selectedOffice.watermark_name || selectedOffice.name) : invoiceName;
    const logoUrl = selectedOffice?.logo_url || null;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const cells: string[] = [];
    for (let c = 0; c < printCopies; c++) {
      ordersToPrint.forEach(order => {
        cells.push(generateInvoiceCell(order, brandName, watermarkText, logoUrl));
      });
    }

    let pagesHTML = '';
    for (let i = 0; i < cells.length; i += 4) {
      const pageCells = cells.slice(i, i + 4);
      while (pageCells.length < 4) {
        pageCells.push('<div class="invoice-cell"></div>');
      }
      pagesHTML += `<div class="page">${pageCells.join('')}</div>`;
    }

    printWindow.document.write(`<html dir="rtl"><head><title>طباعة الفواتير</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:Arial,sans-serif}
        .page{width:210mm;height:297mm;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:0;page-break-after:always}
        .page:last-child{page-break-after:auto}
        .invoice-cell{width:105mm;height:148.5mm;border:0.5px dashed #ccc;overflow:hidden;box-sizing:border-box}
        @page{margin:0;size:A4}
        @media print{.invoice-cell{border:0.5px dashed #bbb}}
      </style></head><body>${pagesHTML}</body></html>`);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 150);
  };

  // تحديد/إلغاء تحديد الكل
  const handleSelectAll = () => {
    if (selectedOrders.length === filteredOrders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(filteredOrders.map(o => o.id));
    }
  };

  if (isLoading) return <div className="p-8">جاري التحميل...</div>;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-accent/20 py-8">
      <div className="container mx-auto px-4">
        <Button onClick={() => navigate("/admin")} variant="ghost" className="mb-4">
          <ArrowLeft className="ml-2 h-4 w-4" />
          رجوع
        </Button>
        <Card>
          <CardHeader className="flex flex-col gap-4">
            <div className="flex flex-row items-center justify-between flex-wrap gap-4">
              <CardTitle>الفواتير</CardTitle>
              <div className="flex gap-2 flex-wrap">
                <Button onClick={handleExportExcel} disabled={filteredOrders.length === 0}>
                  <FileSpreadsheet className="ml-2 h-4 w-4" />
                  تصدير Excel {selectedOrders.length > 0 ? `(${selectedOrders.length})` : `(${filteredOrders.length})`}
                </Button>
                <Button onClick={handlePrint} disabled={selectedOrders.length === 0}>
                  <Printer className="ml-2 h-4 w-4" />
                  طباعة ({selectedOrders.length})
                </Button>
                <div className="flex items-center gap-1">
                  <Label className="text-xs whitespace-nowrap">نسخ:</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={printCopies}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setPrintCopies(1);
                        return;
                      }
                      const num = parseInt(val);
                      if (!isNaN(num)) {
                        setPrintCopies(Math.max(1, Math.min(10, num)));
                      }
                    }}
                    className="w-16 h-9 text-center"
                  />
                </div>
              </div>
            </div>
            
            {/* البحث والفلاتر */}
            <div className="flex items-end gap-4 flex-wrap p-4 bg-muted/50 rounded-lg">
              <div className="flex flex-col gap-1">
                <Label className="text-xs">بحث برقم الأوردر أو الاسم</Label>
                <div className="relative">
                  <Search className="absolute right-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ابحث..."
                    className="w-44 pr-8"
                  />
                </div>
              </div>
              
              <div className="flex flex-col gap-1">
                <Label className="text-xs">التاريخ</Label>
                <Select value={dateFilter} onValueChange={setDateFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="كل الأيام" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الأيام</SelectItem>
                    {uniqueDates.map((date) => (
                      <SelectItem key={date} value={date}>
                        {new Date(date).toLocaleDateString('ar-EG')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex flex-col gap-1">
                <Label className="text-xs">المحافظات (متعدد)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-56 justify-between font-normal">
                      <span className="truncate">
                        {governorateFilters.length === 0
                          ? "كل المحافظات"
                          : `${governorateFilters.length} محافظة`}
                      </span>
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-2 max-h-80 overflow-y-auto" align="start">
                    <div className="flex items-center justify-between mb-2 pb-2 border-b">
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline"
                        onClick={() => setGovernorateFilters(governorates?.map(g => g.name) || [])}
                      >
                        تحديد الكل
                      </button>
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:underline"
                        onClick={() => setGovernorateFilters([])}
                      >
                        مسح
                      </button>
                    </div>
                    <div className="space-y-1">
                      {governorates?.map((gov) => {
                        const checked = governorateFilters.includes(gov.name);
                        return (
                          <label
                            key={gov.id}
                            className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer text-sm"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(c) => {
                                if (c) setGovernorateFilters([...governorateFilters, gov.name]);
                                else setGovernorateFilters(governorateFilters.filter(n => n !== gov.name));
                              }}
                            />
                            <span>{gov.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
                {governorateFilters.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1 max-w-56">
                    {governorateFilters.map((g) => (
                      <Badge key={g} variant="secondary" className="text-xs cursor-pointer" onClick={() => setGovernorateFilters(governorateFilters.filter(n => n !== g))}>
                        {g} ×
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="flex flex-col gap-1">
                <Label className="text-xs">المكتب (للفاتورة)</Label>
                <Select value={selectedOfficeId} onValueChange={setSelectedOfficeId}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="المكتب الافتراضي" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">الافتراضي ({invoiceName})</SelectItem>
                    {offices?.map((office: OfficeOption) => (
                      <SelectItem key={office.id} value={office.id}>
                        {office.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  setDateFilter("");
                  setGovernorateFilters([]);
                  setSearchQuery("");
                }}
              >
                مسح الفلاتر
              </Button>
              
              <div className="mr-auto text-sm text-muted-foreground">
                عدد النتائج: {filteredOrders.length}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredOrders.length > 0 && (
              <div className="mb-4">
                <Button variant="outline" size="sm" onClick={handleSelectAll}>
                  {selectedOrders.length === filteredOrders.length ? "إلغاء تحديد الكل" : "تحديد الكل"}
                </Button>
              </div>
            )}
            <div className="space-y-2">
              {filteredOrders?.map((order) => {
                const totalAmount = parseFloat(order.total_amount.toString());
                const customerShipping = parseFloat((order.shipping_cost || 0).toString());
                const agentShipping = parseFloat((order.agent_shipping_cost || 0).toString());
                const totalPrice = totalAmount + customerShipping;
                const netAmount = totalPrice - agentShipping;
                
                return (
                  <div key={order.id} className="flex items-start gap-4 p-4 border rounded">
                    <Checkbox
                      checked={selectedOrders.includes(order.id)}
                      onCheckedChange={(checked) => {
                        setSelectedOrders(checked 
                          ? [...selectedOrders, order.id]
                          : selectedOrders.filter(id => id !== order.id)
                        );
                      }}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded">#{order.order_number || order.id.slice(0, 8)}</span>
                        <p className="font-bold">{order.customers?.name}</p>
                        <span className="text-xs px-2 py-0.5 rounded bg-muted">
                          {order.governorates?.name || order.customers?.governorate || "-"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString('ar-EG')}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        الإجمالي: {totalPrice.toFixed(2)} ج.م | الصافي المطلوب من المندوب: {netAmount.toFixed(2)} ج.م
                      </p>
                      {selectedOrders.includes(order.id) && (
                        <div className="mt-2">
                          <Label className="text-xs">تسليم جزئي (اختياري)</Label>
                          <Textarea
                            value={partialDeliveryNotes[order.id] || ""}
                            onChange={(e) => setPartialDeliveryNotes(prev => ({...prev, [order.id]: e.target.value}))}
                            placeholder="مثال: قطعة واحدة بـ 150 ج.م، قطعتين بـ 300 ج.م"
                            rows={2}
                            className="mt-1 text-sm"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              
              {filteredOrders.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  لا توجد فواتير تطابق الفلاتر المحددة
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Invoices;