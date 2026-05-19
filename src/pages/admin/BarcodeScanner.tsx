import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Play, CheckCircle2, ScanBarcode, Activity } from "lucide-react";
import { toast } from "sonner";
import ScanInput from "@/components/admin/scanner/ScanInput";
import ScannedOrdersTable from "@/components/admin/scanner/ScannedOrdersTable";
import BulkActionsDialog from "@/components/admin/scanner/BulkActionsDialog";
import { findOrderByCode } from "@/lib/barcodeUtils";
import { playSuccessSound, playErrorSound } from "@/lib/scanSounds";
import { useScanSession } from "@/hooks/useScanSession";
import { useOrdersRealtime } from "@/hooks/useOrdersRealtime";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const BarcodeScanner = () => {
  const navigate = useNavigate();
  const [scanning, setScanning] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const { sessionId, startSession, addOrderToSession, endSession } = useScanSession();

  const { data: agents = [] } = useQuery({
    queryKey: ["agents-for-scanner"],
    queryFn: async () => {
      const { data } = await supabase.from("delivery_agents").select("id, name").order("name");
      return data || [];
    },
  });

  // Realtime: update existing orders in the list when DB changes
  useOrdersRealtime(scanning, useCallback((newRow: any) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === newRow.id ? { ...o, ...newRow } : o))
    );
  }, []));

  const handleStart = async () => {
    try {
      await startSession();
      setScanning(true);
      setOrders([]);
      toast.success("بدأت جلسة الاسكان — وجّه المسدس وامسح");
    } catch (e: any) {
      toast.error("تعذّر بدء الجلسة: " + e.message);
    }
  };

  const handleScan = useCallback(async (code: string) => {
    if (!sessionId) return;
    // dedupe
    if (orders.some((o) => o.tracking_code === code || (o.order_number || "").toString() === code.replace(/\D/g, ""))) {
      playErrorSound();
      toast.warning(`الأوردر مسكَّن مسبقاً: ${code}`);
      return;
    }
    const order = await findOrderByCode(code);
    if (!order) {
      playErrorSound();
      toast.error(`لم يتم العثور على أوردر بكود: ${code}`);
      return;
    }
    if (order.status === "cancelled") {
      playErrorSound();
      toast.error(`الأوردر #${order.order_number} ملغي`);
      return;
    }
    if (orders.some((o) => o.id === order.id)) {
      playErrorSound();
      toast.warning(`الأوردر #${order.order_number} مسكَّن مسبقاً`);
      return;
    }
    setOrders((prev) => [order, ...prev]);
    await addOrderToSession(order.id);
    playSuccessSound();
    toast.success(`✓ #${order.order_number} — ${order.customers?.name || ""}`);
  }, [orders, sessionId, addOrderToSession]);

  const handleFinish = async () => {
    if (orders.length === 0) {
      toast.warning("لم يتم اسكان أي أوردر");
      return;
    }
    setBulkOpen(true);
  };

  const handleStopSession = async () => {
    await endSession(orders.length);
    setScanning(false);
    setOrders([]);
    setBulkOpen(false);
    toast.success("تم إنهاء الجلسة");
  };

  const handleRemove = (id: string) => {
    setOrders((prev) => prev.filter((o) => o.id !== id));
  };

  // Refresh order data after bulk action
  const handleBulkDone = async () => {
    if (orders.length === 0) return;
    const ids = orders.map((o) => o.id);
    const { data } = await supabase
      .from("orders")
      .select(`*, customers(name,phone,address,governorate), delivery_agents(id,name), governorates(name)`)
      .in("id", ids);
    if (data) setOrders(data);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-accent/20 py-6">
      <div className="container mx-auto px-4">
        <Button onClick={() => navigate("/admin")} variant="ghost" className="mb-4">
          <ArrowLeft className="ml-2 h-4 w-4" /> رجوع
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <ScanBarcode className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-2xl">قراءة الباركود</CardTitle>
                  <p className="text-sm text-muted-foreground">امسح أكواد الأوردرات بالمسدس وطبّق الإجراءات الجماعية</p>
                </div>
              </div>
              {scanning && (
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="text-base px-3 py-1">
                    <Activity className="h-4 w-4 ml-1 animate-pulse text-green-500" />
                    {orders.length} أوردر
                  </Badge>
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {!scanning ? (
              <div className="flex flex-col items-center justify-center py-16 gap-6">
                <div className="w-32 h-32 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
                  <ScanBarcode className="w-16 h-16 text-primary" />
                </div>
                <h2 className="text-xl font-bold text-center">جاهز لبدء الاسكان</h2>
                <p className="text-muted-foreground text-center max-w-md">
                  وصّل جهاز الباركود (Handheld Scanner) — يعمل كأنه لوحة مفاتيح. اضغط الزر بالأسفل لبدء جلسة جديدة.
                </p>
                <Button size="lg" onClick={handleStart} className="h-14 px-10 text-lg">
                  <Play className="ml-2 h-5 w-5" /> ابدأ الاسكان
                </Button>
              </div>
            ) : (
              <>
                <ScanInput onScan={handleScan} />

                <div className="flex gap-2 flex-wrap">
                  <Button onClick={handleFinish} size="lg" className="bg-green-600 hover:bg-green-700">
                    <CheckCircle2 className="ml-2 h-5 w-5" /> انتهيت ({orders.length})
                  </Button>
                  <Button onClick={handleStopSession} variant="outline">إنهاء بدون إجراءات</Button>
                </div>

                <ScannedOrdersTable orders={orders} onRemove={handleRemove} />
              </>
            )}
          </CardContent>
        </Card>

        <BulkActionsDialog
          open={bulkOpen}
          onOpenChange={setBulkOpen}
          orders={orders}
          agents={agents}
          onActionDone={handleBulkDone}
        />
      </div>
    </div>
  );
};

export default BarcodeScanner;
