import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus, ArrowLeft, Pencil } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAdminAuth } from "@/contexts/AdminAuthContext";

const Categories = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canEdit } = useAdminAuth();
  const canEditCategories = canEdit('categories');
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    image_url: "",
    display_order: 0,
    is_active: true
  });
  
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const { data: categories, isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("display_order");
      
      if (error) throw error;
      return data;
    },
  });

  const handleImageUpload = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `categories/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('products')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from('products')
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      let finalImageUrl = data.image_url;
      
      if (imageFile) {
        setUploadingImage(true);
        try {
          finalImageUrl = await handleImageUpload(imageFile);
        } finally {
          setUploadingImage(false);
        }
      }
      
      const { error } = await supabase
        .from("categories")
        .insert({ ...data, image_url: finalImageUrl });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("تم إضافة القسم بنجاح");
      setOpen(false);
      setFormData({
        name: "",
        description: "",
        image_url: "",
        display_order: 0,
        is_active: true
      });
      setImageFile(null);
    },
    onError: () => {
      toast.error("حدث خطأ أثناء الإضافة");
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: typeof formData }) => {
      let finalImageUrl = data.image_url;
      
      if (imageFile) {
        setUploadingImage(true);
        try {
          finalImageUrl = await handleImageUpload(imageFile);
        } finally {
          setUploadingImage(false);
        }
      }
      
      const { error } = await supabase
        .from("categories")
        .update({ ...data, image_url: finalImageUrl })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("تم التعديل بنجاح");
      setEditOpen(false);
      setEditingCategory(null);
      setImageFile(null);
    },
    onError: () => {
      toast.error("حدث خطأ أثناء التعديل");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("categories")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("تم الحذف بنجاح");
    },
    onError: () => {
      toast.error("حدث خطأ أثناء الحذف");
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      toast.error("يرجى إدخال اسم القسم");
      return;
    }
    createMutation.mutate(formData);
  };

  const handleEdit = (category: any) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || "",
      image_url: category.image_url || "",
      display_order: category.display_order || 0,
      is_active: category.is_active
    });
    setEditOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !editingCategory) {
      toast.error("يرجى إدخال اسم القسم");
      return;
    }
    updateMutation.mutate({ id: editingCategory.id, data: formData });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-accent/20 py-8">
      <div className="container mx-auto px-4">
        <Button onClick={() => navigate("/admin")} variant="ghost" className="mb-4">
          <ArrowLeft className="ml-2 h-4 w-4" />
          رجوع
        </Button>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle>الأقسام</CardTitle>
              {!canEditCategories && (
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">مشاهدة فقط</span>
              )}
            </div>
            {canEditCategories && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="ml-2 h-4 w-4" />
                  إضافة قسم
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>إضافة قسم جديد</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="name">اسم القسم</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="description">الوصف</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      rows={2}
                    />
                  </div>

                  <div>
                    <Label htmlFor="image_file">صورة القسم</Label>
                    <div className="flex gap-2 items-center">
                      <Input
                        id="image_file"
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setImageFile(file);
                            setFormData({...formData, image_url: ""});
                          }
                        }}
                        className="flex-1"
                      />
                      {imageFile && (
                        <span className="text-sm text-green-600">تم اختيار: {imageFile.name}</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">أو</p>
                    <Input
                      id="image_url"
                      value={formData.image_url}
                      onChange={(e) => {
                        setFormData({...formData, image_url: e.target.value});
                        setImageFile(null);
                      }}
                      placeholder="رابط الصورة (https://...)"
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label htmlFor="display_order">ترتيب العرض</Label>
                    <Input
                      id="display_order"
                      type="number"
                      value={formData.display_order}
                      onChange={(e) => setFormData({...formData, display_order: parseInt(e.target.value)})}
                    />
                  </div>

                  <div className="flex items-center space-x-2 space-x-reverse">
                    <Switch
                      id="is_active"
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setFormData({...formData, is_active: checked})}
                    />
                    <Label htmlFor="is_active">نشط</Label>
                  </div>
                  
                  <Button type="submit" className="w-full" disabled={uploadingImage}>
                    {uploadingImage ? "جاري رفع الصورة..." : "حفظ"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
            )}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-center py-8">جاري التحميل...</p>
            ) : !categories || categories.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">لا توجد أقسام</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الاسم</TableHead>
                      <TableHead>الوصف</TableHead>
                      <TableHead>الترتيب</TableHead>
                      <TableHead>الحالة</TableHead>
                      {canEditCategories && <TableHead>إجراءات</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories.map((category) => (
                      <TableRow key={category.id}>
                        <TableCell className="font-bold">{category.name}</TableCell>
                        <TableCell>{category.description || "-"}</TableCell>
                        <TableCell>{category.display_order}</TableCell>
                        <TableCell>
                          <span className={category.is_active ? "text-green-600" : "text-red-600"}>
                            {category.is_active ? "نشط" : "غير نشط"}
                          </span>
                        </TableCell>
                        {canEditCategories && (
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleEdit(category)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="icon">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    هل أنت متأكد من حذف هذا القسم؟
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteMutation.mutate(category.id)}>
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
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>تعديل القسم</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <Label htmlFor="edit_name">اسم القسم</Label>
                <Input
                  id="edit_name"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="edit_description">الوصف</Label>
                <Textarea
                  id="edit_description"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  rows={2}
                />
              </div>

              <div>
                <Label htmlFor="edit_image_file">صورة القسم</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    id="edit_image_file"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setImageFile(file);
                        setFormData({...formData, image_url: ""});
                      }
                    }}
                    className="flex-1"
                  />
                  {imageFile && (
                    <span className="text-sm text-green-600">تم اختيار: {imageFile.name}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">أو</p>
                <Input
                  id="edit_image_url"
                  value={formData.image_url}
                  onChange={(e) => {
                    setFormData({...formData, image_url: e.target.value});
                    setImageFile(null);
                  }}
                  placeholder="رابط الصورة (https://...)"
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="edit_display_order">ترتيب العرض</Label>
                <Input
                  id="edit_display_order"
                  type="number"
                  value={formData.display_order}
                  onChange={(e) => setFormData({...formData, display_order: parseInt(e.target.value)})}
                />
              </div>

              <div className="flex items-center space-x-2 space-x-reverse">
                <Switch
                  id="edit_is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({...formData, is_active: checked})}
                />
                <Label htmlFor="edit_is_active">نشط</Label>
              </div>
              
              <Button type="submit" className="w-full" disabled={uploadingImage}>
                {uploadingImage ? "جاري رفع الصورة..." : "حفظ التعديلات"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Categories;
