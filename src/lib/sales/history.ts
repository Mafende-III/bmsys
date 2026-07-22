import type { PaymentMethod } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Owner-facing sales history with per-sale and per-line profit.
 * Profit uses SaleLine.costAtSale when present (exact snapshot at the
 * moment of sale) and falls back to the product's current cost for
 * legacy rows — same convention as the analytics layer.
 */

export type SaleListFilters = {
  from?: Date;
  to?: Date;
  channelId?: string;
  paymentMethod?: PaymentMethod;
};

export type SaleListRow = {
  id: string;
  date: Date;
  channelName: string;
  paymentMethod: PaymentMethod;
  sellerName: string;
  itemCount: number;
  total: number;
  discountTotal: number;
  profit: number;
  couponCode: string | null;
};

export type SaleDetailLine = {
  productId: string;
  sku: string;
  name: string;
  saleUnit: "UNIT" | "CARTON";
  qty: number;
  units: number;
  unitPrice: number;
  gross: number;
  discount: number;
  lineTotal: number;
  costPerUnit: number;
  costTotal: number;
  profit: number;
  costIsApproximate: boolean;
};

export type SaleDetail = {
  id: string;
  date: Date;
  channelName: string;
  paymentMethod: PaymentMethod;
  paymentReference: string | null;
  sellerName: string;
  couponCode: string | null;
  couponNotes: string | null;
  total: number;
  discountTotal: number;
  costTotal: number;
  profit: number;
  lines: SaleDetailLine[];
};

const lineInclude = {
  product: {
    select: {
      sku: true,
      name: true,
      costPerCarton: true,
      unitsPerCarton: true,
    },
  },
} as const;

type LineWithProduct = {
  productId: string;
  saleUnit: "UNIT" | "CARTON";
  qty: number;
  unitPrice: number;
  discountAmount: number;
  lineTotal: number;
  costAtSale: number | null;
  product: {
    sku: string;
    name: string;
    costPerCarton: number;
    unitsPerCarton: number;
  };
};

function lineProfit(l: LineWithProduct): {
  units: number;
  costPerUnit: number;
  costTotal: number;
  profit: number;
  approximate: boolean;
} {
  const upc = l.product.unitsPerCarton || 1;
  const units = l.saleUnit === "CARTON" ? l.qty * upc : l.qty;
  const approximate = l.costAtSale == null;
  const costPerUnit =
    l.costAtSale ?? Math.ceil(l.product.costPerCarton / upc);
  const costTotal = units * costPerUnit;
  return {
    units,
    costPerUnit,
    costTotal,
    profit: l.lineTotal - costTotal,
    approximate,
  };
}

export async function listSales(
  filters: SaleListFilters,
  limit = 100,
): Promise<SaleListRow[]> {
  const sales = await prisma.sale.findMany({
    where: {
      status: "COMPLETE",
      ...(filters.from || filters.to
        ? {
            date: {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.to ? { lte: filters.to } : {}),
            },
          }
        : {}),
      ...(filters.channelId ? { channelId: filters.channelId } : {}),
      ...(filters.paymentMethod
        ? { paymentMethod: filters.paymentMethod }
        : {}),
    },
    orderBy: { date: "desc" },
    take: limit,
    include: {
      channel: { select: { name: true } },
      user: { select: { name: true } },
      coupon: { select: { code: true } },
      lines: { include: lineInclude },
    },
  });

  return sales.map((s) => {
    let profit = 0;
    let discountTotal = 0;
    let itemCount = 0;
    for (const l of s.lines) {
      const p = lineProfit(l);
      profit += p.profit;
      discountTotal += l.discountAmount;
      itemCount += l.qty;
    }
    return {
      id: s.id,
      date: s.date,
      channelName: s.channel.name,
      paymentMethod: s.paymentMethod,
      sellerName: s.user.name,
      itemCount,
      total: s.total,
      discountTotal,
      profit,
      couponCode: s.coupon?.code ?? null,
    };
  });
}

export async function getSaleDetail(id: string): Promise<SaleDetail | null> {
  const s = await prisma.sale.findUnique({
    where: { id },
    include: {
      channel: { select: { name: true } },
      user: { select: { name: true } },
      coupon: { select: { code: true, notes: true } },
      lines: { include: lineInclude },
    },
  });
  if (!s || s.status !== "COMPLETE") return null;

  const lines: SaleDetailLine[] = s.lines.map((l) => {
    const p = lineProfit(l);
    return {
      productId: l.productId,
      sku: l.product.sku,
      name: l.product.name,
      saleUnit: l.saleUnit,
      qty: l.qty,
      units: p.units,
      unitPrice: l.unitPrice,
      gross: l.qty * l.unitPrice,
      discount: l.discountAmount,
      lineTotal: l.lineTotal,
      costPerUnit: p.costPerUnit,
      costTotal: p.costTotal,
      profit: p.profit,
      costIsApproximate: p.approximate,
    };
  });

  const discountTotal = lines.reduce((a, l) => a + l.discount, 0);
  const costTotal = lines.reduce((a, l) => a + l.costTotal, 0);
  const profit = lines.reduce((a, l) => a + l.profit, 0);

  return {
    id: s.id,
    date: s.date,
    channelName: s.channel.name,
    paymentMethod: s.paymentMethod,
    paymentReference: s.paymentReference,
    sellerName: s.user.name,
    couponCode: s.coupon?.code ?? null,
    couponNotes: s.coupon?.notes ?? null,
    total: s.total,
    discountTotal,
    costTotal,
    profit,
    lines,
  };
}
