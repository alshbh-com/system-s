import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Trash2, Edit2, Building2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAdminAuth } from "@/contexts/AdminAuthContext";

const Offices = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canEdit } = useAdminAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", logo_url: "", watermark_name: "" });

  const { data: offices, isLoading } = useQuery({
    queryKey: ["offices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("offices")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingId) {
        const { error } = await supabase
          .from("offices")
          .update({ name: form.name, logo_url: form.logo_url || null, watermark_name: form.watermark_name || form.name })
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("offices")
          .insert({ name: form.name, logo_url: form.logo_url || null, watermark_name: form.watermark_name || form.name });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["offices"] });
      toast.success(editingId ? "تم تحديث المكتب" : "تم إضافة المكتب");
      closeDialog();
    },
    onError: () => toast.error("حدث خطأ"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("offices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["offices"] });
      toast.success("تم حذف المكتب");
    },
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setForm({ name: "", logo_url: "", watermark_name: "" });
  };

  const openEdit = (office: any) => {
    setEditingId(office.id);
    setForm({ name: office.name, logo_url: office.logo_url || "", watermark_name: office.watermark_name || "" });
    setDialogOpen(true);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fileName = `office-logos/${Date.now()}-${file.name}`;
    const { data, error } = await supabase.storage.from("products").upload(fileName, file);
    if (error) {
      toast.error("فشل رفع الصورة");
      return;
    }
    const { data: urlData } = supabase.storage.from("products").getPublicUrl(fileName);
    setForm(prev => ({ ...prev, logo_url: urlData.publicUrl }));
    toast.success("تم رفع اللوجو");
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
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              المكاتب
            </CardTitle>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="ml-2 h-4 w-4" />
              إضافة مكتب
            </Button>
          </CardHeader>
          <CardContent>
            {!offices?.length ? (
              <p className="text-center text-muted-foreground py-8">لا توجد مكاتب</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>اللوجو</TableHead>
                    <TableHead>الاسم</TableHead>
                    <TableHead>اسم العلامة المائية</TableHead>
                    <TableHead>إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {offices.map((office: any) => (
                    <TableRow key={office.id}>
                      <TableCell>
                        {office.logo_url ? (
                          <img src={office.logo_url} alt={office.name} className="w-10 h-10 object-contain rounded" />
                        ) : (
                          <div className="w-10 h-10 bg-muted rounded flex items-center justify-center">
                            <Building2 className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{office.name}</TableCell>
                      <TableCell>{office.watermark_name || office.name}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="icon" variant="outline" onClick={() => openEdit(office)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="destructive" onClick={() => deleteMutation.mutate(office.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "تعديل مكتب" : "إضافة مكتب جديد"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>اسم المكتب</Label>
                <Input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} placeholder="مثلاً: مكتب القاهرة" />
              </div>
              <div>
                <Label>اسم العلامة المائية (يظهر في الفاتورة)</Label>
                <Input value={form.watermark_name} onChange={(e) => setForm(p => ({ ...p, watermark_name: e.target.value }))} placeholder="اسم يظهر كعلامة مائية" />
              </div>
              <div>
                <Label>لوجو المكتب</Label>
                {form.logo_url && (
                  <img src={form.logo_url} alt="logo" className="w-20 h-20 object-contain rounded mb-2" />
                )}
                <Input type="file" accept="image/*" onChange={handleLogoUpload} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeDialog}>إلغاء</Button>
              <Button onClick={() => saveMutation.mutate()} disabled={!form.name}>حفظ</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Offices;
