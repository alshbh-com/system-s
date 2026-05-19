import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Tag, Sparkles } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { toast } from "sonner";
import ProductImageCarousel from "@/components/ProductImageCarousel";
import { useTheme } from "@/contexts/ThemeContext";

const Home = () => {
  const { addItem } = useCart();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const { platformName, currentTemplate } = useTheme();
  
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
    queryKey: ["products", selectedCategory],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select(`*, categories(name), product_images(id, image_url, display_order)`)
        .order("created_at", { ascending: false });
      if (selectedCategory !== "all") {
        query = query.eq("category_id", selectedCategory);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const handleAddToCart = (product: any) => {
    if (product.stock <= 0) {
      toast.error("نفذت الكمية من المخزن");
      return;
    }
    const price = product.is_offer && product.offer_price 
      ? parseFloat(product.offer_price.toString())
      : parseFloat(product.price.toString());
    addItem({ id: product.id, name: product.name, price, image_url: product.image_url, details: product.details });
    toast.success("تم إضافة المنتج إلى السلة");
  };

  // Get grid classes based on template layout
  const getGridClasses = () => {
    const layout = currentTemplate?.layout || 'grid-4';
    switch (layout) {
      case 'grid-2': return 'grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6';
      case 'grid-3': return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6';
      case 'grid-4': return 'grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5';
      case 'grid-6': return 'grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3';
      case 'list': return 'flex flex-col gap-4';
      case 'cards-large': return 'grid grid-cols-1 sm:grid-cols-2 gap-6';
      case 'carousel': return 'flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory';
      case 'catalog': return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6';
      case 'mosaic': return 'columns-2 sm:columns-3 lg:columns-4 gap-3 space-y-3';
      case 'masonry': return 'columns-2 sm:columns-3 gap-4 space-y-4';
      default: return 'grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5';
    }
  };

  const getImageHeight = () => {
    const layout = currentTemplate?.layout || 'grid-4';
    switch (layout) {
      case 'grid-2': return 'h-64 sm:h-80';
      case 'grid-3': return 'h-52 sm:h-72';
      case 'grid-6': return 'h-32 sm:h-40';
      case 'list': return 'h-40 sm:h-48 w-40 sm:w-48 flex-shrink-0';
      case 'cards-large': return 'h-64 sm:h-96';
      case 'carousel': return 'h-52 sm:h-64';
      case 'catalog': return 'h-56 sm:h-72';
      case 'mosaic': return 'h-auto aspect-square';
      case 'masonry': return 'h-auto aspect-[3/4]';
      default: return 'h-44 sm:h-64';
    }
  };

  const isListLayout = currentTemplate?.layout === 'list';
  const isCarousel = currentTemplate?.layout === 'carousel';

  if (isLoading) {
    return (
      <div className="container mx-auto px-3 py-6">
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5">
          {[...Array(8)].map((_, i) => (
            <Card key={i} className="animate-pulse border-0 shadow-md">
              <div className="h-48 sm:h-64 bg-muted rounded-t-lg" />
              <CardContent className="p-3">
                <div className="h-4 bg-muted rounded mb-2" />
                <div className="h-3 bg-muted rounded w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground py-8 sm:py-10 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-primary-foreground/20 -translate-y-1/2 translate-x-1/4" />
          <div className="absolute bottom-0 left-0 w-56 h-56 rounded-full bg-primary-foreground/10 translate-y-1/2 -translate-x-1/4" />
        </div>
        <div className="container mx-auto px-4 relative">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Sparkles className="h-5 w-5 sm:h-6 sm:w-6" />
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
              {platformName}
            </h1>
            <Sparkles className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <p className="text-center text-sm sm:text-base text-primary-foreground/80 font-medium">
            أفضل الأزياء العصرية بأسعار مميزة
          </p>
        </div>
      </header>

      <div className="container mx-auto px-3 sm:px-4 py-5 sm:py-8">
        {categories && categories.length > 0 && (
          <div className="mb-5 sm:mb-8 flex gap-2 flex-wrap justify-center">
            <Button
              variant={selectedCategory === "all" ? "default" : "outline"}
              onClick={() => setSelectedCategory("all")}
              size="sm"
              className="rounded-full text-xs sm:text-sm px-4"
            >
              الكل
            </Button>
            {categories.map((category) => (
              <Button
                key={category.id}
                variant={selectedCategory === category.id ? "default" : "outline"}
                onClick={() => setSelectedCategory(category.id)}
                size="sm"
                className="rounded-full text-xs sm:text-sm px-4"
              >
                {category.name}
              </Button>
            ))}
          </div>
        )}

        {!products || products.length === 0 ? (
          <div className="text-center py-20">
            <Tag className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
            <p className="text-lg text-muted-foreground font-medium">
              لا توجد منتجات متاحة حالياً
            </p>
          </div>
        ) : (
          <div className={getGridClasses()}>
            {products.map((product) => {
              const hasOffer = product.is_offer && product.offer_price;
              const displayPrice = hasOffer ? product.offer_price : product.price;
              
              const images: string[] = [];
              if (product.image_url) images.push(product.image_url);
              if (product.product_images && Array.isArray(product.product_images)) {
                const sortedImages = [...product.product_images]
                  .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
                  .map(img => img.image_url);
                images.push(...sortedImages);
              }
              
              return (
                <Card 
                  key={product.id} 
                  className={`group border-0 shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden ${
                    isListLayout ? 'flex flex-row' : ''
                  } ${isCarousel ? 'min-w-[200px] sm:min-w-[260px] snap-start flex-shrink-0' : ''}`}
                >
                  <div className={`relative bg-muted overflow-hidden ${getImageHeight()}`}>
                    {images.length > 0 ? (
                      <ProductImageCarousel images={images} productName={product.name} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-accent">
                        <Tag className="w-10 h-10 sm:w-14 sm:h-14 text-muted-foreground" />
                      </div>
                    )}
                    {hasOffer && (
                      <Badge className="absolute top-2 right-2 bg-destructive text-destructive-foreground text-[10px] sm:text-xs shadow-lg">
                        عرض خاص
                      </Badge>
                    )}
                    {product.stock === 0 && (
                      <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                        <Badge variant="secondary" className="text-xs font-bold">نفذت الكمية</Badge>
                      </div>
                    )}
                  </div>

                  <div className={isListLayout ? 'flex flex-col justify-between flex-1' : ''}>
                    <CardContent className="p-2.5 sm:p-4">
                      <h3 className="font-bold text-xs sm:text-sm mb-1 line-clamp-2 leading-relaxed">
                        {product.name}
                      </h3>
                      {product.description && (
                        <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-1 mb-1.5 sm:mb-2">
                          {product.description}
                        </p>
                      )}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm sm:text-lg font-extrabold text-primary">
                          {parseFloat(displayPrice.toString()).toFixed(0)} ج.م
                        </span>
                        {hasOffer && (
                          <span className="text-[10px] sm:text-xs text-muted-foreground line-through">
                            {parseFloat(product.price.toString()).toFixed(0)} ج.م
                          </span>
                        )}
                      </div>
                    </CardContent>
                    <CardFooter className="p-2.5 sm:p-4 pt-0">
                      <Button 
                        onClick={() => handleAddToCart(product)}
                        disabled={product.stock === 0}
                        className="w-full text-[10px] sm:text-xs h-8 sm:h-9"
                        size="sm"
                      >
                        <ShoppingCart className="ml-1 h-3 w-3 sm:h-4 sm:w-4" />
                        إضافة للسلة
                      </Button>
                    </CardFooter>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;
