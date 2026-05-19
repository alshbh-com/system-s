import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image_url?: string;
  size?: string;
  color?: string;
  details?: string;
}

interface CartStore {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'>, maxStock?: number) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  updateItemDetails: (id: string, size?: string, color?: string) => void;
  clearCart: () => void;
  getTotalPrice: () => number;
  getTotalItems: () => number;
}

export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      
      addItem: (item, maxStock?: number) => set((state) => {
        const existingItem = state.items.find(i => i.id === item.id);
        if (existingItem) {
          // التحقق من الكمية المتاحة عند الزيادة
          if (maxStock !== undefined && existingItem.quantity >= maxStock) {
            return state; // لا تزيد الكمية إذا وصلت للحد الأقصى
          }
          // Update price to latest offer/price and increment quantity
          return {
            items: state.items.map(i =>
              i.id === item.id ? { ...i, quantity: i.quantity + 1, price: item.price || i.price } : i
            )
          };
        }
        // Add new item with quantity 1 and ensure price is set
        return { items: [...state.items, { ...item, quantity: 1, price: item.price || 0 }] };
      }),
      
      removeItem: (id) => set((state) => ({
        items: state.items.filter(item => item.id !== id)
      })),
      
      updateQuantity: (id, quantity) => set((state) => ({
        items: quantity <= 0 
          ? state.items.filter(item => item.id !== id)
          : state.items.map(item =>
              item.id === id ? { ...item, quantity } : item
            )
      })),
      
      updateItemDetails: (id, size, color) => set((state) => ({
        items: state.items.map(item =>
          item.id === id ? { ...item, size, color } : item
        )
      })),
      
      clearCart: () => set({ items: [] }),
      
      getTotalPrice: () => {
        const items = get().items;
        return items.reduce((total, item) => total + (item.price * item.quantity), 0);
      },
      
      getTotalItems: () => {
        const items = get().items;
        return items.reduce((total, item) => total + item.quantity, 0);
      }
    }),
    {
      name: 'cart-storage'
    }
  )
);
