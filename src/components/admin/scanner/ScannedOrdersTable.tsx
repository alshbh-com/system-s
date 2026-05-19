import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { STATUS_LABELS } from "@/lib/barcodeUtils";

interface Props {
  orders: any[];
  onRemove: (id: string) => void;
}

const ScannedOrdersTable = ({ orders, onRemove }: Props) => {
  if (orders.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
        لم يتم اسكان أي أوردر بعد. ابدأ المسح من جهاز الباركود.
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="text-right">#</TableHead>
            <TableHead className="text-right">رقم الأوردر</TableHead>
            <TableHead className="text-right">كود التتبع</TableHead>
            <TableHead className="text-right">العميل</TableHead>
            <TableHead className="text-right">المحافظة</TableHead>
            <TableHead className="text-right">المندوب</TableHead>
            <TableHead className="text-right">الحالة</TableHead>
            <TableHead className="text-right">المبلغ</TableHead>
            <TableHead className="text-right"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((o, i) => {
            const total = parseFloat(o.total_amount || 0) + parseFloat(o.shipping_cost || 0);
            return (
              <TableRow key={o.id} className="animate-in fade-in slide-in-from-top-2">
                <TableCell className="font-bold">{i + 1}</TableCell>
                <TableCell className="font-bold">#{o.order_number || o.id.slice(0, 6)}</TableCell>
                <TableCell className="font-mono text-xs">{o.tracking_code || "-"}</TableCell>
                <TableCell>{o.customers?.name || "-"}</TableCell>
                <TableCell>{o.governorates?.name || o.customers?.governorate || "-"}</TableCell>
                <TableCell>{o.delivery_agents?.name || <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell>
                  <Badge variant="outline">{STATUS_LABELS[o.status] || o.status}</Badge>
                </TableCell>
                <TableCell className="font-bold">{total.toFixed(0)} ج.م</TableCell>
                <TableCell>
                  <Button size="icon" variant="ghost" onClick={() => onRemove(o.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

export default ScannedOrdersTable;
