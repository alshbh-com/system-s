// Shared invoice template — used by Invoices, Orders, AllOrders, AgentOrders
// to ensure ONE unified invoice/print design across the system.
import { generateBarcodeDataUrl } from "@/lib/barcodeUtils";

export type InvoiceItemRow = {
  productName: string;
  itemSize?: string;
  itemColor?: string;
  quantity: number;
  price: number;
};

export type InvoiceOrder = {
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

const asText = (value: unknown) => (typeof value === "string" || typeof value === "number" ? String(value) : undefined);
const asNumber = (value: unknown) => Number(value) || undefined;

export const normalizeInvoiceItems = (order: InvoiceOrder): InvoiceItemRow[] => {
  const totalAmount = parseFloat(order.total_amount.toString());
  const dbItems = (order.order_items || []).map((item): InvoiceItemRow => {
    let productName = item.products?.name || item.products?.name_ar || item.products?.name_en;
    let itemSize = item.size || undefined;
    let itemColor = item.color || undefined;
    let quantity = item.quantity || undefined;
    if (item.product_details) {
      let details: Record<string, unknown> | null = null;
      if (typeof item.product_details === "string") {
        const raw = item.product_details.trim();
        if (raw.startsWith("{") || raw.startsWith("[")) {
          try { details = JSON.parse(raw); } catch { details = null; }
        }
        if (!details && !productName && raw) productName = raw;
      } else if (typeof item.product_details === "object") {
        details = item.product_details as Record<string, unknown>;
      }
      if (Array.isArray(details)) details = details[0] as Record<string, unknown>;
      if (details && typeof details === "object") {
        productName = productName || asText(details.name) || asText(details.product_name) || asText(details.title) || asText(details.name_ar) || asText(details.name_en);
        itemSize = itemSize || asText(details.size) || asText(details.variant);
        itemColor = itemColor || asText(details.color);
        quantity = quantity || asNumber(details.quantity) || asNumber(details.qty) || asNumber(details.count);
      }
    }
    return { productName: productName || "منتج", itemSize, itemColor, quantity: quantity || 1, price: parseFloat((item.price || 0).toString()) };
  });

  if (dbItems.length > 0) return dbItems;

  const rawDetails = (order.order_details || "").toString().trim();
  if (!rawDetails) return [];

  let parsed: unknown = null;
  if (rawDetails.startsWith("{") || rawDetails.startsWith("[")) {
    try { parsed = JSON.parse(rawDetails); } catch { parsed = null; }
  }

  if (parsed) {
    const parsedRecord = parsed as Record<string, unknown>;
    const possibleItems = Array.isArray(parsed) ? parsed : (parsedRecord.items || parsedRecord.products || parsedRecord.order_items || parsedRecord.cart || []);
    if (Array.isArray(possibleItems) && possibleItems.length > 0) {
      return possibleItems.map((item): InvoiceItemRow => {
        const r = item as Record<string, unknown>;
        const quantity = asNumber(r.quantity) || asNumber(r.qty) || asNumber(r.count) || 1;
        return {
          productName: asText(r.name) || asText(r.product_name) || asText(r.title) || asText(r.name_ar) || asText(r.name_en) || "منتج",
          itemSize: asText(r.size) || asText(r.variant),
          itemColor: asText(r.color),
          quantity,
          price: asNumber(r.price) || asNumber(r.unit_price) || asNumber(r.total) || (possibleItems.length === 1 ? totalAmount / quantity : 0),
        };
      });
    }
  }

  return rawDetails.split(/\n|،|,/).map(l => l.trim()).filter(Boolean).map((line, _idx, list) => {
    const qtyMatch = line.match(/(?:×|x|X|\*)\s*(\d+)|(?:الكمية|qty|quantity)\s*[:：-]?\s*(\d+)/i);
    const quantity = Number(qtyMatch?.[1] || qtyMatch?.[2] || 1) || 1;
    const variantMatch = line.match(/\(([^)]+)\)/);
    const cleanName = line.replace(/(?:×|x|X|\*)\s*\d+/i, "").replace(/(?:الكمية|qty|quantity)\s*[:：-]?\s*\d+/i, "").replace(/\([^)]+\)/g, "").trim();
    return { productName: cleanName || line, itemSize: undefined, itemColor: variantMatch?.[1], quantity, price: list.length === 1 ? totalAmount / quantity : 0 };
  });
};

export interface InvoiceCellOptions {
  brandName: string;
  watermarkText: string;
  logoUrl?: string | null;
  partialNote?: string;
}

export const generateInvoiceCell = (order: InvoiceOrder, opts: InvoiceCellOptions): string => {
  const { brandName, watermarkText, logoUrl, partialNote } = opts;
  const totalAmount = parseFloat(order.total_amount.toString());
  const customerShipping = parseFloat((order.shipping_cost || 0).toString());
  const totalPrice = totalAmount + customerShipping;
  const invoiceItems = normalizeInvoiceItems(order);

  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" style="max-width:44px;max-height:44px;object-fit:contain;filter:grayscale(100%);" />`
    : "";

  return `<div class="invoice-cell">
    <div style="position:relative;width:100%;height:100%;padding:5mm;box-sizing:border-box;font-family:Arial,'Cairo',sans-serif;display:flex;flex-direction:column;overflow:hidden;color:#000;background:#fff;">
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:64px;font-weight:900;color:rgba(0,0,0,0.06);pointer-events:none;z-index:0;white-space:nowrap;letter-spacing:4px;">${watermarkText}</div>
      <div style="position:relative;z-index:1;display:flex;align-items:stretch;border:2.5px solid #000;">
        <div style="flex:1.3;padding:7px 10px;border-left:2.5px solid #000;display:flex;align-items:center;gap:10px;">
          ${logoHtml}
          <div>
            <div style="font-size:24px;font-weight:900;line-height:1;letter-spacing:1px;">${brandName}</div>
            <div style="font-size:11px;margin-top:3px;">📅 ${new Date(order.created_at).toLocaleDateString("ar-EG")}</div>
          </div>
        </div>
        <div style="flex:1;padding:7px 10px;text-align:center;background:#000;color:#fff;">
          <div style="font-size:10px;letter-spacing:2px;">ORDER NO.</div>
          <div style="font-size:28px;font-weight:900;line-height:1;">#${order.order_number || order.id.slice(0, 8)}</div>
        </div>
      </div>
      <div style="position:relative;z-index:1;border:2.5px solid #000;border-top:0;padding:5px;text-align:center;">
        <img src="${generateBarcodeDataUrl(order.tracking_code || `ORD-${order.order_number || order.id.slice(0,8)}`, { width: 2, height: 48, fontSize: 13, margin: 1 })}" style="max-height:54px;display:block;margin:0 auto;filter:grayscale(100%);" />
      </div>
      <div style="position:relative;z-index:1;border:2.5px solid #000;border-top:0;padding:9px 12px;">
        <div style="font-size:12px;font-weight:700;letter-spacing:2px;border-bottom:1.5px solid #000;padding-bottom:4px;margin-bottom:6px;">إلى / TO</div>
        <div style="font-size:19px;font-weight:900;line-height:1.2;">${order.customers?.name || ""}</div>
        <div style="font-size:14px;line-height:1.7;margin-top:4px;">
          <strong>هاتف:</strong> ${order.customers?.phone || ""}${order.customers?.phone2 ? ` · ${order.customers.phone2}` : ""}<br/>
          <strong>المحافظة:</strong> ${order.governorates?.name || order.customers?.governorate || "-"}<br/>
          <strong>العنوان:</strong> ${order.customers?.address || ""}
        </div>
        ${order.notes ? `<div style="margin-top:5px;font-size:12px;border-top:1px dashed #000;padding-top:4px;"><strong>📝 ملاحظات:</strong> ${order.notes}</div>` : ""}
      </div>
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
              <span style="flex:1;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${item.productName}${(item.itemSize || item.itemColor) ? ` <span style="font-weight:400;font-size:11px;">(${[item.itemSize, item.itemColor].filter(Boolean).join(" · ")})</span>` : ""}</span>
              <span style="font-weight:700;min-width:32px;text-align:center;">×${item.quantity}</span>
              <span style="font-weight:900;min-width:65px;text-align:left;">${itemTotal > 0 ? `${itemTotal.toFixed(0)} ج.م` : "—"}</span>
            </div>`;
          }).join("") || ""}
        </div>
      </div>
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
      ${partialNote ? `<div style="position:relative;z-index:1;margin-top:3px;border:2px dashed #000;padding:4px 8px;font-size:12px;font-weight:700;">⚠ تسليم جزئي: ${partialNote}</div>` : ""}
      <div style="position:relative;z-index:1;border:1.5px solid #000;border-top:0;padding:5px 10px;font-size:11px;line-height:1.5;text-align:center;font-weight:700;">
        معاينة الطرد قبل الاستلام وعدم استخدامه · في حالة الرفض يتم دفع رسوم شحن للمندوب 65 ج
      </div>
    </div>
  </div>`;
};

export interface PrintInvoicesOptions extends InvoiceCellOptions {
  copies?: number;
  partialNotes?: Record<string, string>;
}

// Opens a print window with the standard 2x2 A4 grid invoices layout.
export const printInvoices = (orders: InvoiceOrder[], opts: PrintInvoicesOptions): void => {
  if (!orders?.length) return;
  const { copies = 1, partialNotes = {}, brandName, watermarkText, logoUrl } = opts;
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  const cells: string[] = [];
  for (let c = 0; c < copies; c++) {
    orders.forEach(o => {
      cells.push(generateInvoiceCell(o, { brandName, watermarkText, logoUrl, partialNote: partialNotes[o.id] }));
    });
  }

  let pagesHTML = "";
  for (let i = 0; i < cells.length; i += 4) {
    const pageCells = cells.slice(i, i + 4);
    while (pageCells.length < 4) pageCells.push('<div class="invoice-cell"></div>');
    pagesHTML += `<div class="page">${pageCells.join("")}</div>`;
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
