import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trash2, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import SearchBar from "@/components/admin/SearchBar";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

const Customers = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canEdit } = useAdminAuth();
  const canEditCustomers = canEdit('customers');
  const [governorateFilter, setGovernorateFilter] = useState<string>("all");

  const egyptGovernorates = [
    "القاهرة", "الجيزة", "الإسكندرية", "الدقهلية", "الشرقية", "المنوفية", "القليوبية",
    "البحيرة", "الغربية", "بني سويف", "الفيوم", "المنيا", "أسيوط", "سوهاج", "قنا",
    "الأقصر", "أسوان", "البحر الأحمر", "الوادي الجديد", "مطروح", "شمال سيناء",
    "جنوب سيناء", "بورسعيد", "دمياط", "الإسماعيلية", "السويس", "كفر الشيخ", "الأقصر"
  ];

  const { data: customers, isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("customers")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("تم حذف العميل بنجاح");
    },
    onError: () => {
      toast.error("حدث خطأ أثناء الحذف");
    }
  });

  const filteredCustomers = customers?.filter(customer => {
    if (governorateFilter !== "all" && customer.governorate !== governorateFilter) {
      return false;
    }
    return true;
  });

  if (isLoading) {
    return <div className="p-8">جاري التحميل...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-accent/20 py-8">
      <div className="container mx-auto px-4">
        <Button onClick={() => navigate("/admin")} variant="ghost" className="mb-4">
          <ArrowLeft className="ml-2 h-4 w-4" />
          رجوع
        </Button>

        <Card>
          <CardHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <CardTitle>العملاء</CardTitle>
                {!canEditCustomers && (
                  <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">مشاهدة فقط</span>
                )}
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium">فلتر حسب المحافظة:</span>
                <Select value={governorateFilter} onValueChange={setGovernorateFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="جميع المحافظات" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع المحافظات</SelectItem>
                    {egyptGovernorates.map((gov) => (
                      <SelectItem key={gov} value={gov}>
                        {gov}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <SearchBar />
            {!filteredCustomers || filteredCustomers.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">لا يوجد عملاء</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الاسم</TableHead>
                      <TableHead>الهاتف</TableHead>
                      <TableHead>المحافظة</TableHead>
                      <TableHead>العنوان</TableHead>
                      <TableHead>التاريخ</TableHead>
                      {canEditCustomers && <TableHead>إجراءات</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCustomers.map((customer) => (
                      <TableRow key={customer.id}>
                        <TableCell className="font-medium">{customer.name}</TableCell>
                        <TableCell>{customer.phone}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {customer.governorate || "-"}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{customer.address}</TableCell>
                        <TableCell>
                          {new Date(customer.created_at).toLocaleDateString("ar-EG")}
                        </TableCell>
                        {canEditCustomers && (
                        <TableCell>
                          <Button
                            variant="destructive"
                            size="icon"
                            onClick={() => deleteMutation.mutate(customer.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Customers;
