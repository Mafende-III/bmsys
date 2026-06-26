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
  /// Optional one-time-use coupon code typed at checkout. The actual
  /// discount math runs on the server via previewCoupon / runSale —
  /// the client only stores the code so it survives navigation.
  couponCode: string | null;
};

// Bump storage version whenever cart shape changes so a tab carrying
// an old shape doesn't break on next render.
const STORAGE_KEY = "bmsys.cart.v3";

type CartContextValue = {
  cart: Cart | null;
  setChannel: (channelId: string) => void;
  addItem: (item: CartItem) => void;
  removeItem: (index: number) => void;
  setCouponCode: (code: string | null) => void;
  clear: () => void;
  subtotal: number;
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
    return { ...parsed, couponCode: parsed.couponCode ?? null };
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
      setCart({ channelId: currentChannelId, items: [], couponCode: null });
    } else if (fromStorage) {
      setCart(fromStorage);
    } else {
      setCart({ channelId: currentChannelId, items: [], couponCode: null });
    }
    setReady(true);
  }, [currentChannelId]);

  useEffect(() => {
    if (ready) saveToStorage(cart);
  }, [cart, ready]);

  const setChannel = useCallback((channelId: string) => {
    setCart((prev) => {
      if (!prev) return { channelId, items: [], couponCode: null };
      if (prev.items.length > 0 && prev.channelId !== channelId) return prev;
      return { ...prev, channelId };
    });
  }, []);

  const addItem = useCallback((item: CartItem) => {
    setCart((prev) => {
      const base = prev ?? { channelId: "", items: [], couponCode: null };
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
      // Removing items invalidates a previously-validated coupon
      return {
        ...prev,
        items: prev.items.filter((_, i) => i !== index),
        couponCode: null,
      };
    });
  }, []);

  const setCouponCode = useCallback((code: string | null) => {
    setCart((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        couponCode:
          code && code.trim() !== "" ? code.trim().toUpperCase() : null,
      };
    });
  }, []);

  const clear = useCallback(() => {
    setCart((prev) => ({
      channelId: prev?.channelId ?? "",
      items: [],
      couponCode: null,
    }));
  }, []);

  const subtotal = useMemo(() => {
    let sub = 0;
    for (const i of cart?.items ?? []) {
      sub += i.qty * i.unitPrice;
    }
    return sub;
  }, [cart]);

  const value: CartContextValue = {
    cart,
    setChannel,
    addItem,
    removeItem,
    setCouponCode,
    clear,
    subtotal,
    ready,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
