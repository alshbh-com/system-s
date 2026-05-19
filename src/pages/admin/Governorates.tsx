import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ArrowLeft, Save, Plus, Trash2, Pencil } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAdminAuth } from "@/contexts/AdminAuthContext";

const Governorates = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canEdit } = useAdminAuth();
  const canEditGovernorates = canEdit('governorates');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [shippingCosts, setShippingCosts] = useState<Record<string, number>>({});
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingGovernorate, setEditingGovernorate] = useState<any>(null);
  const [newGovernorate, setNewGovernorate] = useState({ name: "", shipping_cost: "" });

  const { data: governorates, isLoading } = useQuery({
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

  const addGovernorateMutation = useMutation({
    mutationFn: async ({ name, shippingCost }: { name: string; shippingCost: number }) => {
      const { error } = await supabase
        .from("governorates")
        .insert({ name, shipping_cost: shippingCost });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["governorates"] });
      toast.success("تم إضافة المحافظة بنجاح");
      setAddDialogOpen(false);
      setNewGovernorate({ name: "", shipping_cost: "" });
    },
    onError: () => {
      toast.error("حدث خطأ أثناء الإضافة");
    }
  });

  const updateGovernorateMutation = useMutation({
    mutationFn: async ({ id, name, shippingCost }: { id: string; name: string; shippingCost: number }) => {
      const { error } = await supabase
        .from("governorates")
        .update({ name, shipping_cost: shippingCost })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["governorates"] });
      toast.success("تم تحديث المحافظة بنجاح");
      setEditDialogOpen(false);
      setEditingGovernorate(null);
    },
    onError: () => {
      toast.error("حدث خطأ أثناء التحديث");
    }
  });

  const deleteGovernorateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("governorates")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["governorates"] });
      toast.success("تم حذف المحافظة بنجاح");
    },
    onError: () => {
      toast.error("حدث خطأ أثناء الحذف");
    }
  });

  const updateShippingCostMutation = useMutation({
    mutationFn: async ({ id, shippingCost }: { id: string; shippingCost: number }) => {
      const { error } = await supabase
        .from("governorates")
        .update({ shipping_cost: shippingCost })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["governorates"] });
      toast.success("تم تحديث سعر الشحن");
      setEditingId(null);
    },
  });

  const handleSave = (id: string) => {
    const cost = shippingCosts[id];
    if (cost !== undefined && cost >= 0) {
      updateShippingCostMutation.mutate({ id, shippingCost: cost });
    }
  };

  const handleAddGovernorate = () => {
    if (!newGovernorate.name.trim()) {
      toast.error("يرجى إدخال اسم المحافظة");
      return;
    }
    addGovernorateMutation.mutate({
      name: newGovernorate.name.trim(),
      shippingCost: parseFloat(newGovernorate.shipping_cost) || 0
    });
  };

  const handleEditGovernorate = () => {
    if (!editingGovernorate?.name?.trim()) {
      toast.error("يرجى إدخال اسم المحافظة");
      return;
    }
    updateGovernorateMutation.mutate({
      id: editingGovernorate.id,
      name: editingGovernorate.name.trim(),
      shippingCost: parseFloat(editingGovernorate.shipping_cost) || 0
    });
  };

  const openEditDialog = (gov: any) => {
    setEditingGovernorate({ ...gov });
    setEditDialogOpen(true);
  };

  if (isLoading) {
    return <div className="p-8">جاري التحميل...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-accent/20 py-8">
      <div className="container mx-auto px-4">
        <Button onClick={() => navigate("/admin")} variant="ghost" className="mb-4">
          <ArrowLeft className="ml-2 h-4 w-4" />
          الرجوع إلى الصفحة الرئيسية
        </Button>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle>المحافظات وأسعار الشحن</CardTitle>
              {!canEditGovernorates && (
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">مشاهدة فقط</span>
              )}
            </div>
            {canEditGovernorates && (
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="ml-2 h-4 w-4" />
                  إضافة محافظة
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>إضافة محافظة جديدة</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <Label>اسم المحافظة</Label>
                    <Input
                      value={newGovernorate.name}
                      onChange={(e) => setNewGovernorate({ ...newGovernorate, name: e.target.value })}
                      placeholder="أدخل اسم المحافظة"
                    />
                  </div>
                  <div>
                    <Label>سعر الشحن (ج.م)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={newGovernorate.shipping_cost}
                      onChange={(e) => setNewGovernorate({ ...newGovernorate, shipping_cost: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setAddDialogOpen(false)}>إلغاء</Button>
                  <Button onClick={handleAddGovernorate} disabled={addGovernorateMutation.isPending}>
                    {addGovernorateMutation.isPending ? "جاري الإضافة..." : "إضافة"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            )}
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>المحافظة</TableHead>
                    <TableHead>سعر الشحن (ج.م)</TableHead>
                    {canEditGovernorates && <TableHead>إجراءات</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {governorates?.map((gov) => (
                    <TableRow key={gov.id}>
                      <TableCell className="font-medium">{gov.name}</TableCell>
                      <TableCell>
                        {canEditGovernorates ? (
                        <Input
                          type="number"
                          min="0"
                          value={editingId === gov.id ? (shippingCosts[gov.id] ?? gov.shipping_cost) : gov.shipping_cost}
                          onChange={(e) => {
                            setEditingId(gov.id);
                            setShippingCosts({
                              ...shippingCosts,
                              [gov.id]: Number(e.target.value) || 0
                            });
                          }}
                          className="w-32"
                        />
                        ) : (
                          <span>{gov.shipping_cost} ج.م</span>
                        )}
                      </TableCell>
                      {canEditGovernorates && (
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {editingId === gov.id && (
                            <Button
                              size="sm"
                              onClick={() => handleSave(gov.id)}
                              disabled={updateShippingCostMutation.isPending}
                            >
                              <Save className="ml-2 h-4 w-4" />
                              حفظ
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditDialog(gov)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                                <AlertDialogDescription>
                                  هل أنت متأكد من حذف محافظة "{gov.name}"؟
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteGovernorateMutation.mutate(gov.id)}
                                  className="bg-destructive text-destructive-foreground"
                                >
                                  حذف
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Edit Governorate Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>تعديل المحافظة</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>اسم المحافظة</Label>
                <Input
                  value={editingGovernorate?.name || ""}
                  onChange={(e) => setEditingGovernorate({ ...editingGovernorate, name: e.target.value })}
                  placeholder="أدخل اسم المحافظة"
                />
              </div>
              <div>
                <Label>سعر الشحن (ج.م)</Label>
                <Input
                  type="number"
                  min="0"
                  value={editingGovernorate?.shipping_cost || ""}
                  onChange={(e) => setEditingGovernorate({ ...editingGovernorate, shipping_cost: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setEditDialogOpen(false)}>إلغاء</Button>
              <Button onClick={handleEditGovernorate} disabled={updateGovernorateMutation.isPending}>
                {updateGovernorateMutation.isPending ? "جاري الحفظ..." : "حفظ"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Governorates;
