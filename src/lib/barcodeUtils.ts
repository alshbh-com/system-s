import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";

export const generateBarcodeDataUrl = (value: string, opts?: Partial<JsBarcode.Options>): string => {
  try {
    const canvas = document.createElement("canvas");
    JsBarcode(canvas, value, {
      format: "CODE128",
      width: 2,
      height: 50,
      displayValue: true,
      fontSize: 14,
      margin: 4,
      ...opts,
    });
    return canvas.toDataURL("image/png");
  } catch (e) {
    console.error("Barcode generation failed", e);
    return "";
  }
};

export const generateQrDataUrl = async (value: string, size = 120): Promise<string> => {
  try {
    return await QRCode.toDataURL(value, { width: size, margin: 1 });
  } catch (e) {
    console.error("QR generation failed", e);
    return "";
  }
};

/**
 * Find an order by tracking_code, order_number, or partial id.
 * Accepts inputs like "TRK-000123", "123", or full UUID.
 */
export const findOrderByCode = async (rawCode: string) => {
  const code = rawCode.trim();
  if (!code) return null;

  // 1. tracking_code exact match
  const { data: byTracking } = await supabase
    .from("orders")
    .select(`
      *,
      customers (name, phone, address, governorate),
      delivery_agents (id, name),
      governorates (name)
    `)
    .eq("tracking_code", code)
    .maybeSingle();
  if (byTracking) return byTracking;

  // 2. numeric → order_number
  const numeric = code.replace(/\D/g, "");
  if (numeric) {
    const { data: byNumber } = await supabase
      .from("orders")
      .select(`
        *,
        customers (name, phone, address, governorate),
        delivery_agents (id, name),
        governorates (name)
      `)
      .eq("order_number", parseInt(numeric))
      .maybeSingle();
    if (byNumber) return byNumber;
  }

  // 3. UUID id
  if (/^[0-9a-f-]{8,}$/i.test(code)) {
    const { data: byId } = await supabase
      .from("orders")
      .select(`
        *,
        customers (name, phone, address, governorate),
        delivery_agents (id, name),
        governorates (name)
      `)
      .eq("id", code)
      .maybeSingle();
    if (byId) return byId;
  }

  return null;
};

export const STATUS_LABELS: Record<string, string> = {
  pending: "قيد الانتظار",
  processing: "قيد التجهيز",
  ready: "تم التجهيز",
  picked_up: "تم الاستلام من المخزن",
  out_for_delivery: "خرج للتوصيل",
  shipped: "جاري التوصيل",
  delivered: "تم التسليم",
  returned: "مرتجع",
  return_no_shipping: "مرتجع بدون شحن",
  failed: "فشل التسليم",
  postponed: "مؤجل",
  cancelled: "ملغي",
};

export const STATUS_OPTIONS = [
  { value: "processing", label: "تم التجهيز" },
  { value: "shipped", label: "خرج للتوصيل / جاري التوصيل" },
  { value: "delivered", label: "تم التسليم" },
  { value: "returned", label: "مرتجع" },
  { value: "postponed", label: "مؤجل" },
  { value: "failed", label: "فشل التسليم" },
  { value: "pending", label: "قيد الانتظار" },
  { value: "cancelled", label: "ملغي" },
];
