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
  /// Final, post-discount RWF for the line. Equals qty × unitPrice
  /// minus discountAmount.
  lineTotal: number;
  // ── Discount-related fields carried through the cart so the
  // CheckoutForm can show floor errors live (cost + margin must travel
  // with the item, the server re-validates).
  costPerCarton: number;
  unitsPerCarton: number;
  /// Already resolved at add-time (per-product > settings default).
  effectiveMarginBps: number;
  discountAmount: number;
  discountReason: string | null;
  floorOverride: boolean;
};

export type Cart = {
  channelId: string;
  items: CartItem[];
};

// Bump storage version any time CartItem fields change so a tab with a
// stale cart shape doesn't break on next visit.
const STORAGE_KEY = "bmsys.cart.v2";

type CartContextValue = {
  cart: Cart | null;
  setChannel: (channelId: string) => void;
  addItem: (item: CartItem) => void;
  removeItem: (index: number) => void;
  setItemDiscount: (
    index: number,
    discountAmount: number,
    discountReason: string | null,
    floorOverride: boolean,
  ) => void;
  clear: () => void;
  subtotal: number;
  discountTotal: number;
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
      // collapse if same product+saleUnit+price AND neither side has a
      // discount applied (merging a discounted line with a fresh one
      // would silently spread the discount over more qty)
      const existingIdx = base.items.findIndex(
        (i) =>
          i.productId === item.productId &&
          i.saleUnit === item.saleUnit &&
          i.unitPrice === item.unitPrice &&
          i.discountAmount === 0 &&
          item.discountAmount === 0,
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

  const setItemDiscount = useCallback(
    (
      index: number,
      discountAmount: number,
      discountReason: string | null,
      floorOverride: boolean,
    ) => {
      setCart((prev) => {
        if (!prev) return prev;
        const next = [...prev.items];
        const e = next[index];
        if (!e) return prev;
        const safeDiscount = Math.max(
          0,
          Math.min(e.qty * e.unitPrice, Math.round(discountAmount)),
        );
        next[index] = {
          ...e,
          discountAmount: safeDiscount,
          discountReason: safeDiscount > 0 ? discountReason : null,
          floorOverride: safeDiscount > 0 ? floorOverride : false,
          lineTotal: e.qty * e.unitPrice - safeDiscount,
        };
        return { ...prev, items: next };
      });
    },
    [],
  );

  const clear = useCallback(() => {
    setCart((prev) => ({
      channelId: prev?.channelId ?? "",
      items: [],
    }));
  }, []);

  const { subtotal, discountTotal, total } = useMemo(() => {
    let sub = 0;
    let disc = 0;
    for (const i of cart?.items ?? []) {
      sub += i.qty * i.unitPrice;
      disc += i.discountAmount;
    }
    return { subtotal: sub, discountTotal: disc, total: sub - disc };
  }, [cart]);

  const value: CartContextValue = {
    cart,
    setChannel,
    addItem,
    removeItem,
    setItemDiscount,
    clear,
    subtotal,
    discountTotal,
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
