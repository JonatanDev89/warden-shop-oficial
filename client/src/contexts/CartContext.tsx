import React, { createContext, useContext, useEffect, useState } from "react";

export interface KitSlot {
  slot: number;
  minecraftId: string;
  name: string;
  quantity: number;
  unitPrice: string;
  configLabel?: string;
}

export interface CartItem {
  productId: number;
  name: string;
  price: number;
  imageUrl?: string;
  quantity: number;
  // Kit personalizado — slots salvos para criar o pedido depois
  kitSlots?: KitSlot[];
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">, qty?: number) => void;
  removeItem: (productId: number) => void;
  updateQty: (productId: number, qty: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const STORAGE_KEY = "warden_cart";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = (item: Omit<CartItem, "quantity">, qty = 1) => {
    setItems((prev) => {
      // Se for um kit personalizado (productId === -1), nunca agrupar
      if (item.productId === -1) {
        return [...prev, { ...item, quantity: qty }];
      }

      const existing = prev.find((i) => i.productId === item.productId);
      if (existing) {
        return prev.map((i) =>
          i.productId === item.productId
            ? { ...i, quantity: i.quantity + qty }
            : i
        );
      }
      return [...prev, { ...item, quantity: qty }];
    });
  };

  const removeItem = (productId: number, kitSlots?: KitSlot[]) =>
    setItems((prev) => {
      if (productId === -1 && kitSlots) {
        // Para kits, remove pela referência exata dos slots (ou poderia usar um ID único)
        const index = prev.findIndex(i => i.productId === -1 && JSON.stringify(i.kitSlots) === JSON.stringify(kitSlots));
        if (index !== -1) {
          const next = [...prev];
          next.splice(index, 1);
          return next;
        }
        return prev;
      }
      return prev.filter((i) => i.productId !== productId);
    });

  const updateQty = (productId: number, qty: number, kitSlots?: KitSlot[]) => {
    if (qty <= 0) { removeItem(productId, kitSlots); return; }
    setItems((prev) => {
      if (productId === -1 && kitSlots) {
        const index = prev.findIndex(i => i.productId === -1 && JSON.stringify(i.kitSlots) === JSON.stringify(kitSlots));
        if (index !== -1) {
          const next = [...prev];
          next[index] = { ...next[index], quantity: qty };
          return next;
        }
        return prev;
      }
      return prev.map((i) => (i.productId === productId ? { ...i, quantity: qty } : i));
    });
  };

  const clearCart = () => {
    setItems([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  const totalItems = items.reduce((s, i) => s + i.quantity, 0);
  const totalPrice = items.reduce((s, i) => s + i.price * i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQty, clearCart, totalItems, totalPrice }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
