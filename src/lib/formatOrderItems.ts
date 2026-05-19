// Format order items to show size×quantity instead of repeating sizes
export interface FormattedItem {
  name: string;
  color?: string;
  sizes: { size: string; quantity: number }[];
  totalQuantity: number;
  pricePerItem: number;
  totalPrice: number;
}

export const formatOrderItems = (items: any[]): FormattedItem[] => {
  // Group items by product name and color
  const grouped = new Map<string, FormattedItem>();

  items.forEach((item) => {
    const productInfo = getProductInfo(item);
    const key = `${productInfo.name}_${productInfo.color || ''}`;
    
    if (!grouped.has(key)) {
      grouped.set(key, {
        name: productInfo.name,
        color: productInfo.color,
        sizes: [],
        totalQuantity: 0,
        pricePerItem: parseFloat(productInfo.price?.toString() || item.price?.toString() || "0"),
        totalPrice: 0
      });
    }
    
    const group = grouped.get(key)!;
    const size = productInfo.size || item.size || '-';
    const quantity = item.quantity || 1;
    
    // Find existing size or add new
    const existingSize = group.sizes.find(s => s.size === size);
    if (existingSize) {
      existingSize.quantity += quantity;
    } else {
      group.sizes.push({ size, quantity });
    }
    
    group.totalQuantity += quantity;
    group.totalPrice += group.pricePerItem * quantity;
  });

  return Array.from(grouped.values());
};

// Helper to get product info from different formats
const getProductInfo = (item: any) => {
  try {
    if (item.product_details) {
      const details = typeof item.product_details === 'string' 
        ? JSON.parse(item.product_details) 
        : item.product_details;
      return {
        name: details.name || details.product_name || item.products?.name || "منتج محذوف",
        price: details.price || item.price,
        size: details.size || item.size,
        color: details.color || item.color
      };
    }
  } catch (e) {
    if (typeof item.product_details === 'string' && item.product_details.trim()) {
      return {
        name: item.product_details,
        price: item.price,
        size: item.size,
        color: item.color
      };
    }
  }
  return {
    name: item.products?.name || "منتج محذوف",
    price: item.price,
    size: item.size,
    color: item.color
  };
};

// Format sizes for display: "L×2, XL×3, M×1"
export const formatSizesDisplay = (sizes: { size: string; quantity: number }[]): string => {
  return sizes.map(s => s.quantity > 1 ? `${s.size}×${s.quantity}` : s.size).join('، ');
};
