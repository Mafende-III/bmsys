import { prisma } from "@/lib/prisma";

/**
 * Accountant-facing registers: flat, line-level tables of everything
 * bought and everything sold in a date range, plus a per-product
 * summary. All amounts integer RWF. Sales cost uses the costAtSale
 * snapshot (falls back to current product cost for pre-snapshot rows,
 * same convention as analytics).
 */

export type SalesRegisterRow = {
  date: Date;
  saleId: string;
  channelName: string;
  paymentMethod: string;
  sellerName: string;
  sku: string;
  productName: string;
  saleUnit: "UNIT" | "CARTON";
  qty: number;
  /// Physical units (qty × unitsPerCarton for carton lines).
  units: number;
  unitPrice: number;
  gross: number;
  discount: number;
  net: number;
  cost: number;
  profit: number;
};

export type PurchaseRegisterRow = {
  date: Date;
  purchaseId: string;
  supplierName: string;
  sku: string;
  productName: string;
  qtyCartons: number;
  qtyLooseUnits: number;
  units: number;
  costPerCarton: number;
  lineTotal: number;
};

export type ProductSummaryRow = {
  sku: string;
  productName: string;
  purchasedUnits: number;
  purchaseCost: number;
  soldUnits: number;
  salesRevenue: number;
  salesCost: number;
  profit: number;
};

export type RegisterTotals = {
  sales: {
    lines: number;
    units: number;
    gross: number;
    discount: number;
    net: number;
    cost: number;
    profit: number;
  };
  purchases: {
    lines: number;
    units: number;
    cost: number;
  };
};

export type RegisterReport = {
  sales: SalesRegisterRow[];
  purchases: PurchaseRegisterRow[];
  products: ProductSummaryRow[];
  totals: RegisterTotals;
};

export async function getRegisterReport(
  from: Date,
  to: Date,
): Promise<RegisterReport> {
  const [saleLines, purchaseLines] = await Promise.all([
    prisma.saleLine.findMany({
      where: {
        sale: { date: { gte: from, lte: to }, status: "COMPLETE" },
      },
      include: {
        sale: {
          select: {
            id: true,
            date: true,
            paymentMethod: true,
            channel: { select: { name: true } },
            user: { select: { name: true } },
          },
        },
        product: {
          select: {
            sku: true,
            name: true,
            unitsPerCarton: true,
            costPerCarton: true,
          },
        },
      },
      orderBy: { sale: { date: "asc" } },
    }),
    prisma.purchaseLine.findMany({
      where: {
        purchase: { date: { gte: from, lte: to }, status: "RECEIVED" },
      },
      include: {
        purchase: {
          select: {
            id: true,
            date: true,
            supplier: { select: { name: true } },
          },
        },
        product: {
          select: { sku: true, name: true, unitsPerCarton: true },
        },
      },
      orderBy: { purchase: { date: "asc" } },
    }),
  ]);

  const sales: SalesRegisterRow[] = saleLines.map((l) => {
    const upc = l.product.unitsPerCarton || 1;
    const units = l.saleUnit === "CARTON" ? l.qty * upc : l.qty;
    const costPerUnit =
      l.costAtSale ?? Math.ceil(l.product.costPerCarton / upc);
    const cost = units * costPerUnit;
    const gross = l.qty * l.unitPrice;
    return {
      date: l.sale.date,
      saleId: l.sale.id,
      channelName: l.sale.channel.name,
      paymentMethod: l.sale.paymentMethod,
      sellerName: l.sale.user.name,
      sku: l.product.sku,
      productName: l.product.name,
      saleUnit: l.saleUnit,
      qty: l.qty,
      units,
      unitPrice: l.unitPrice,
      gross,
      discount: l.discountAmount,
      net: l.lineTotal,
      cost,
      profit: l.lineTotal - cost,
    };
  });

  const purchases: PurchaseRegisterRow[] = purchaseLines.map((l) => {
    const upc = l.product.unitsPerCarton || 1;
    const units = l.qtyCartons * upc + l.qtyLooseUnits;
    return {
      date: l.purchase.date,
      purchaseId: l.purchase.id,
      supplierName: l.purchase.supplier.name,
      sku: l.product.sku,
      productName: l.product.name,
      qtyCartons: l.qtyCartons,
      qtyLooseUnits: l.qtyLooseUnits,
      units,
      costPerCarton: l.unitCost,
      lineTotal: l.lineTotal,
    };
  });

  // ── Per-product aggregate across both registers ────────────────────
  const byProduct = new Map<string, ProductSummaryRow>();
  const ensure = (sku: string, name: string): ProductSummaryRow => {
    let row = byProduct.get(sku);
    if (!row) {
      row = {
        sku,
        productName: name,
        purchasedUnits: 0,
        purchaseCost: 0,
        soldUnits: 0,
        salesRevenue: 0,
        salesCost: 0,
        profit: 0,
      };
      byProduct.set(sku, row);
    }
    return row;
  };
  for (const p of purchases) {
    const row = ensure(p.sku, p.productName);
    row.purchasedUnits += p.units;
    row.purchaseCost += p.lineTotal;
  }
  for (const s of sales) {
    const row = ensure(s.sku, s.productName);
    row.soldUnits += s.units;
    row.salesRevenue += s.net;
    row.salesCost += s.cost;
    row.profit += s.profit;
  }
  const products = Array.from(byProduct.values()).sort((a, b) =>
    a.sku.localeCompare(b.sku),
  );

  const totals: RegisterTotals = {
    sales: {
      lines: sales.length,
      units: sales.reduce((a, r) => a + r.units, 0),
      gross: sales.reduce((a, r) => a + r.gross, 0),
      discount: sales.reduce((a, r) => a + r.discount, 0),
      net: sales.reduce((a, r) => a + r.net, 0),
      cost: sales.reduce((a, r) => a + r.cost, 0),
      profit: sales.reduce((a, r) => a + r.profit, 0),
    },
    purchases: {
      lines: purchases.length,
      units: purchases.reduce((a, r) => a + r.units, 0),
      cost: purchases.reduce((a, r) => a + r.lineTotal, 0),
    },
  };

  return { sales, purchases, products, totals };
}
