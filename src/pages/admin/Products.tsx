import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus, ArrowLeft, Edit, Tag, X, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAdminAuth } from "@/contexts/AdminAuthContext";

const Products = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canEdit } = useAdminAuth();
  const canEditProducts = canEdit('products');
  const [open, setOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [additionalImages, setAdditionalImages] = useState<File[]>([]);
  
  const [existingImages, setExistingImages] = useState<{id: string, image_url: string, display_order: number | null}[]>([]);
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    offer_price: "",
    stock: "",
    is_offer: false,
    category_id: "",
    size_options: [] as string[],
    color_options: [] as string[],
    details: "",
    quantity_pricing: Array.from({ length: 12 }, (_, i) => ({ quantity: i + 1, price: "" }))
  });
  const [newSize, setNewSize] = useState("");
  const [newColor, setNewColor] = useState("");

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("is_active", true)
        .order("display_order");
      
      if (error) throw error;
      return data;
    },
  });

  const { data: products, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(`
          *,
          product_images(id, image_url, display_order)
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      let imageUrl = data.image_url;
      
      // Upload main image if provided
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('products')
          .upload(fileName, imageFile);
        
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage
          .from('products')
          .getPublicUrl(fileName);
        
        imageUrl = publicUrl;
      }
      
      const quantityPricing = data.quantity_pricing
        .filter((qp: any) => qp.price && parseFloat(qp.price) > 0)
        .map((qp: any) => ({ quantity: qp.quantity, price: parseFloat(qp.price) }));

      const productData = {
        ...data,
        image_url: imageUrl,
        price: parseFloat(data.price),
        offer_price: data.offer_price ? parseFloat(data.offer_price) : null,
        stock: parseInt(data.stock),
        size_options: data.size_options?.length > 0 ? data.size_options : null,
        color_options: data.color_options?.length > 0 ? data.color_options : null,
        details: data.details || null,
        quantity_pricing: quantityPricing.length > 0 ? quantityPricing : null,
        category_id: data.category_id && data.category_id.trim() !== "" ? data.category_id : null
      };
      
      let productId: string;
      
      if (editingProduct) {
        const { error } = await supabase
          .from("products")
          .update(productData)
          .eq("id", editingProduct.id);
        
        if (error) throw error;
        productId = editingProduct.id;
      } else {
        const { data: newProduct, error } = await supabase
          .from("products")
          .insert(productData)
          .select()
          .single();
        
        if (error) throw error;
        productId = newProduct.id;
      }

      // Upload additional images to product_images table
      if (additionalImages.length > 0) {
        const imageUploads = additionalImages.map(async (file, index) => {
          const fileExt = file.name.split('.').pop();
          const fileName = `${Math.random()}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('products')
            .upload(fileName, file);
          
          if (uploadError) throw uploadError;
          
          const { data: { publicUrl } } = supabase.storage
            .from('products')
            .getPublicUrl(fileName);
          
          return {
            product_id: productId,
            image_url: publicUrl,
            display_order: index + 1
          };
        });

        const imageData = await Promise.all(imageUploads);
        
        const { error: imagesError } = await supabase
          .from('product_images')
          .insert(imageData);
        
        if (imagesError) throw imagesError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(editingProduct ? "تم تحديث المنتج بنجاح" : "تم إضافة المنتج بنجاح");
      resetForm();
    },
    onError: (error) => {
      console.error(error);
      toast.error("حدث خطأ");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Delete related records first to avoid FK constraint errors
      const { error: imgErr } = await supabase.from("product_images").delete().eq("product_id", id);
      if (imgErr) throw imgErr;
      
      const { error: varErr } = await supabase.from("product_color_variants").delete().eq("product_id", id);
      if (varErr) throw varErr;

      // Nullify references in order_items and analytics_events
      const { error: oiErr } = await supabase.from("order_items").update({ product_id: null }).eq("product_id", id);
      if (oiErr) throw oiErr;

      const { error: aeErr } = await supabase.from("analytics_events").update({ product_id: null }).eq("product_id", id);
      if (aeErr) throw aeErr;

      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("تم حذف المنتج بنجاح");
    },
    onError: () => {
      toast.error("حدث خطأ أثناء الحذف");
    }
  });

  const deleteImageMutation = useMutation({
    mutationFn: async ({ imageId, imageUrl }: { imageId: string, imageUrl: string }) => {
      // Delete from product_images table
      const { error } = await supabase.from("product_images").delete().eq("id", imageId);
      if (error) throw error;
      
      // Try to delete from storage too
      try {
        const url = new URL(imageUrl);
        const pathParts = url.pathname.split('/');
        const storagePath = pathParts.slice(pathParts.indexOf('products') + 1).join('/');
        if (storagePath) {
          await supabase.storage.from('products').remove([storagePath]);
        }
      } catch (e) {
        // Ignore storage deletion errors
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("تم حذف الصورة بنجاح");
    },
    onError: () => {
      toast.error("حدث خطأ أثناء حذف الصورة");
    }
  });

  const deleteMainImageMutation = useMutation({
    mutationFn: async (productId: string) => {
      const product = products?.find(p => p.id === productId);
      if (!product?.image_url) return;
      
      // Clear image_url from product
      const { error } = await supabase.from("products").update({ image_url: null }).eq("id", productId);
      if (error) throw error;
      
      // Try to delete from storage
      try {
        const url = new URL(product.image_url);
        const pathParts = url.pathname.split('/');
        const storagePath = pathParts.slice(pathParts.indexOf('products') + 1).join('/');
        if (storagePath) {
          await supabase.storage.from('products').remove([storagePath]);
        }
      } catch (e) {}
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("تم حذف الصورة الرئيسية");
    },
    onError: () => {
      toast.error("حدث خطأ أثناء حذف الصورة");
    }
  });

  const resetForm = () => {
    setOpen(false);
    setFormData({
      name: "",
      description: "",
      price: "",
      offer_price: "",
      stock: "",
      is_offer: false,
      category_id: "",
      size_options: [],
      color_options: [],
      details: "",
      quantity_pricing: Array.from({ length: 12 }, (_, i) => ({ quantity: i + 1, price: "" }))
    });
    setEditingProduct(null);
    setImageFile(null);
    setAdditionalImages([]);
    setExistingImages([]);
    setNewSize("");
    setNewColor("");
  };

  const handleEdit = (product: any) => {
    setEditingProduct(product);
    setExistingImages(product.product_images || []);
    
    const quantityPricingData = Array.from({ length: 12 }, (_, i) => {
      const existingPrice = product.quantity_pricing?.find((qp: any) => qp.quantity === i + 1);
      return { quantity: i + 1, price: existingPrice?.price?.toString() || "" };
    });

    setFormData({
      name: product.name,
      description: product.description || "",
      price: product.price.toString(),
      offer_price: product.offer_price?.toString() || "",
      stock: product.stock.toString(),
      is_offer: product.is_offer,
      category_id: product.category_id || "",
      size_options: product.size_options || [],
      color_options: product.color_options || [],
      details: product.details || "",
      quantity_pricing: quantityPricingData
    });
    setOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

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
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle>المنتجات</CardTitle>
              {!canEditProducts && (
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">مشاهدة فقط</span>
              )}
            </div>
            {canEditProducts && (
            <Dialog open={open} onOpenChange={(isOpen) => {
              if (!isOpen) resetForm();
              else setOpen(isOpen);
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="ml-2 h-4 w-4" />
                  إضافة منتج
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingProduct ? "تعديل منتج" : "إضافة منتج جديد"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="name">اسم المنتج</Label>
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
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label htmlFor="category_id">القسم</Label>
                    <select
                      id="category_id"
                      value={formData.category_id}
                      onChange={(e) => setFormData({...formData, category_id: e.target.value})}
                      className="w-full px-3 py-2 border border-input rounded-md bg-background"
                    >
                      <option value="">بدون قسم</option>
                      {categories?.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <Label htmlFor="price">السعر (ج.م)</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => setFormData({...formData, price: e.target.value})}
                      required
                    />
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Switch
                      id="is_offer"
                      checked={formData.is_offer}
                      onCheckedChange={(checked) => setFormData({...formData, is_offer: checked})}
                    />
                    <Label htmlFor="is_offer">عرض خاص</Label>
                  </div>
                  
                  {formData.is_offer && (
                    <div>
                      <Label htmlFor="offer_price">سعر العرض (ج.م)</Label>
                      <Input
                        id="offer_price"
                        type="number"
                        step="0.01"
                        value={formData.offer_price}
                        onChange={(e) => setFormData({...formData, offer_price: e.target.value})}
                      />
                    </div>
                  )}
                  
                  <div>
                    <Label htmlFor="stock">الكمية المتاحة</Label>
                    <Input
                      id="stock"
                      type="number"
                      value={formData.stock}
                      onChange={(e) => setFormData({...formData, stock: e.target.value})}
                      required
                    />
                  </div>
                  
                  <div>
                    <Label>المقاسات المتاحة</Label>
                    <div className="flex gap-2 mb-2">
                      <Input
                        value={newSize}
                        onChange={(e) => setNewSize(e.target.value)}
                        placeholder="أدخل مقاس جديد"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (newSize.trim() && !formData.size_options.includes(newSize.trim())) {
                              setFormData({...formData, size_options: [...formData.size_options, newSize.trim()]});
                              setNewSize("");
                            }
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          if (newSize.trim() && !formData.size_options.includes(newSize.trim())) {
                            setFormData({...formData, size_options: [...formData.size_options, newSize.trim()]});
                            setNewSize("");
                          }
                        }}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {formData.size_options.map((size, idx) => (
                        <Badge key={idx} variant="secondary" className="px-3 py-1 text-sm">
                          {size}
                          <button
                            type="button"
                            onClick={() => setFormData({...formData, size_options: formData.size_options.filter((_, i) => i !== idx)})}
                            className="mr-2 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <Label>الألوان المتاحة</Label>
                    <div className="flex gap-2 mb-2">
                      <Input
                        value={newColor}
                        onChange={(e) => setNewColor(e.target.value)}
                        placeholder="أدخل لون جديد"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (newColor.trim() && !formData.color_options.includes(newColor.trim())) {
                              setFormData({...formData, color_options: [...formData.color_options, newColor.trim()]});
                              setNewColor("");
                            }
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          if (newColor.trim() && !formData.color_options.includes(newColor.trim())) {
                            setFormData({...formData, color_options: [...formData.color_options, newColor.trim()]});
                            setNewColor("");
                          }
                        }}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {formData.color_options.map((color, idx) => (
                        <Badge key={idx} variant="outline" className="px-3 py-1 text-sm">
                          {color}
                          <button
                            type="button"
                            onClick={() => setFormData({...formData, color_options: formData.color_options.filter((_, i) => i !== idx)})}
                            className="mr-2 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="details">تفاصيل المنتج</Label>
                    <Textarea
                      id="details"
                      value={formData.details}
                      onChange={(e) => setFormData({...formData, details: e.target.value})}
                      rows={3}
                      placeholder="معلومات إضافية عن المنتج..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>التسعير حسب الكمية (اختياري)</Label>
                    <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto p-2 border rounded">
                      {formData.quantity_pricing.map((qp, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <Label className="text-xs w-20">كمية {qp.quantity}:</Label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="السعر"
                            value={qp.price}
                            onChange={(e) => {
                              const newPricing = [...formData.quantity_pricing];
                              newPricing[index].price = e.target.value;
                              setFormData({...formData, quantity_pricing: newPricing});
                            }}
                          />
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      حدد السعر لكل كمية (1-12 قطعة). اترك فارغاً لاستخدام السعر الأساسي.
                    </p>
                  </div>
                  
                  <div>
                    <Label htmlFor="image">صورة المنتج الرئيسية</Label>
                    {editingProduct?.image_url && !imageFile && (
                      <div className="relative inline-block mt-2 mb-2">
                        <img 
                          src={editingProduct.image_url} 
                          alt="الصورة الرئيسية"
                          className="w-24 h-24 object-cover rounded border"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute -top-2 -right-2 h-6 w-6"
                          onClick={() => {
                            deleteMainImageMutation.mutate(editingProduct.id);
                            setEditingProduct({...editingProduct, image_url: null});
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                    <Input
                      id="image"
                      type="file"
                      accept="image/*"
                      onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                    />
                  </div>

                  {/* Existing product images management */}
                  {editingProduct && existingImages.length > 0 && (
                    <div>
                      <Label>الصور الحالية للمنتج</Label>
                      <div className="mt-2 flex gap-2 flex-wrap">
                        {existingImages.map((img) => (
                          <div key={img.id} className="relative">
                            <img 
                              src={img.image_url} 
                              alt="صورة المنتج"
                              className="w-20 h-20 object-cover rounded border"
                            />
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon"
                              className="absolute -top-2 -right-2 h-6 w-6"
                              onClick={() => {
                                deleteImageMutation.mutate({ imageId: img.id, imageUrl: img.image_url });
                                setExistingImages(prev => prev.filter(i => i.id !== img.id));
                              }}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <Label htmlFor="additionalImages">صور إضافية للمنتج</Label>
                    <Input
                      id="additionalImages"
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        setAdditionalImages(files);
                      }}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      يمكنك رفع عدة صور. ستظهر بترتيب الإضافة في المتجر.
                    </p>
                    {additionalImages.length > 0 && (
                      <div className="mt-2 flex gap-2 flex-wrap">
                        {additionalImages.map((file, index) => (
                          <div key={index} className="relative">
                            <img 
                              src={URL.createObjectURL(file)} 
                              alt={`صورة ${index + 1}`}
                              className="w-20 h-20 object-cover rounded border"
                            />
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon"
                              className="absolute -top-2 -right-2 h-6 w-6"
                              onClick={() => {
                                setAdditionalImages(prev => prev.filter((_, i) => i !== index));
                              }}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <Button type="submit" className="w-full">
                    {editingProduct ? "تحديث" : "إضافة"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
            )}
          </CardHeader>
          <CardContent>
            {!products || products.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">لا توجد منتجات</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {products.map((product) => (
                  <Card key={product.id} className="overflow-hidden">
                    <div className="h-48 bg-muted relative">
                      {product.image_url ? (
                        <img 
                          src={product.image_url} 
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Tag className="w-12 h-12 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-bold mb-2 truncate">{product.name}</h3>
                      <p className="text-lg font-bold text-primary mb-2">
                        {parseFloat(product.price.toString()).toFixed(2)} ج.م
                      </p>
                      {product.is_offer && product.offer_price && (
                        <p className="text-sm text-destructive font-bold mb-2">
                          عرض: {parseFloat(product.offer_price.toString()).toFixed(2)} ج.م
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground mb-4">
                        الكمية: {product.stock}
                      </p>
                      {canEditProducts && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleEdit(product)}
                        >
                          <Edit className="h-4 w-4 ml-1" />
                          تعديل
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteMutation.mutate(product.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Products;
