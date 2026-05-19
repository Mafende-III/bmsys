"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type CartItem = {
  productId: string;
  productSku: string;
  productName: string;
  saleUnit: "UNIT" | "CARTON";
  qty: number;
  unitPrice: number;
  lineTotal: number;
};

export type Cart = {
  channelId: string;
  items: CartItem[];
};

const STORAGE_KEY = "bmsys.cart.v1";

type CartContextValue = {
  cart: Cart | null;
  setChannel: (channelId: string) => void;
  addItem: (item: CartItem) => void;
  removeItem: (index: number) => void;
  clear: () => void;
  total: number;
  ready: boolean;
};

const CartContext = createContext<CartContextValue | null>(null);

function loadFromStorage(): Cart | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Cart;
    if (!parsed.channelId || !Array.isArray(parsed.items)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveToStorage(cart: Cart | null) {
  if (typeof window === "undefined") return;
  if (cart === null) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
}

export function CartProvider({
  currentChannelId,
  children,
}: {
  currentChannelId: string;
  children: React.ReactNode;
}) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const fromStorage = loadFromStorage();
    if (fromStorage && fromStorage.channelId === currentChannelId) {
      setCart(fromStorage);
    } else if (fromStorage && fromStorage.items.length === 0) {
      // empty cart, just update channel silently
      setCart({ channelId: currentChannelId, items: [] });
    } else if (fromStorage) {
      // channel mismatch with items — keep old cart so user is asked
      // to either checkout or clear before switching
      setCart(fromStorage);
    } else {
      setCart({ channelId: currentChannelId, items: [] });
    }
    setReady(true);
  }, [currentChannelId]);

  useEffect(() => {
    if (ready) saveToStorage(cart);
  }, [cart, ready]);

  const setChannel = useCallback((channelId: string) => {
    setCart((prev) => {
      if (!prev) return { channelId, items: [] };
      if (prev.items.length > 0 && prev.channelId !== channelId) {
        // ignore — UI prevents this
        return prev;
      }
      return { ...prev, channelId };
    });
  }, []);

  const addItem = useCallback((item: CartItem) => {
    setCart((prev) => {
      const base = prev ?? { channelId: "", items: [] };
      // collapse if same product+saleUnit+price
      const existingIdx = base.items.findIndex(
        (i) =>
          i.productId === item.productId &&
          i.saleUnit === item.saleUnit &&
          i.unitPrice === item.unitPrice,
      );
      if (existingIdx >= 0) {
        const next = [...base.items];
        const e = next[existingIdx];
        if (!e) return base;
        const newQty = e.qty + item.qty;
        next[existingIdx] = {
          ...e,
          qty: newQty,
          lineTotal: newQty * e.unitPrice,
        };
        return { ...base, items: next };
      }
      return { ...base, items: [...base.items, item] };
    });
  }, []);

  const removeItem = useCallback((index: number) => {
    setCart((prev) => {
      if (!prev) return prev;
      return { ...prev, items: prev.items.filter((_, i) => i !== index) };
    });
  }, []);

  const clear = useCallback(() => {
    setCart((prev) => ({
      channelId: prev?.channelId ?? "",
      items: [],
    }));
  }, []);

  const total = useMemo(
    () => (cart?.items ?? []).reduce((s, i) => s + i.lineTotal, 0),
    [cart],
  );

  const value: CartContextValue = {
    cart,
    setChannel,
    addItem,
    removeItem,
    clear,
    total,
    ready,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
