import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Returns branch and tenant scoped metrics used by the pharmacy home screen. */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startTrend = new Date(startToday);
  startTrend.setDate(startTrend.getDate() - 6);
  const endToday = new Date(startToday);
  endToday.setDate(endToday.getDate() + 1);
  const branchFilter = session.branchId ? { branchId: session.branchId } : {};
  const saleScope = { tenantId: session.tenantId, ...branchFilter };
  const productScope = { tenantId: session.tenantId, isActive: true, ...branchFilter };

  const [todaySales, monthSales, products, batches, lowStockProducts, expiring, topItems, recentSales, trendSales] = await Promise.all([
    prisma.sale.aggregate({ where: { ...saleScope, createdAt: { gte: startToday, lt: endToday } }, _sum: { total: true }, _count: { _all: true } }),
    prisma.sale.aggregate({ where: { ...saleScope, createdAt: { gte: startMonth, lt: endToday } }, _sum: { total: true }, _count: { _all: true } }),
    prisma.product.findMany({ where: productScope, select: { id: true, name: true, reorderPoint: true } }),
    prisma.productBatch.findMany({ where: { product: productScope }, select: { quantity: true } }),
    prisma.product.findMany({ where: productScope, include: { batches: { select: { quantity: true } } }, orderBy: { name: "asc" } }),
    prisma.productBatch.findMany({ where: { expiryDate: { gte: startToday, lte: new Date(startToday.getTime() + 60 * 24 * 60 * 60 * 1000) }, quantity: { gt: 0 }, product: productScope }, include: { product: { select: { name: true } } }, orderBy: { expiryDate: "asc" }, take: 100 }),
    prisma.saleItem.groupBy({ by: ["productId"], where: { sale: { ...saleScope, createdAt: { gte: startMonth, lt: endToday } } }, _sum: { quantity: true }, orderBy: { _sum: { quantity: "desc" } }, take: 5 }),
    prisma.sale.findMany({ where: saleScope, select: { id: true, total: true, createdAt: true, type: true }, orderBy: { createdAt: "desc" }, take: 6 }),
    prisma.sale.findMany({ where: { ...saleScope, createdAt: { gte: startTrend, lt: endToday } }, select: { total: true, createdAt: true } }),
  ]);
  const stockByProduct = new Map(lowStockProducts.map((product) => [product.id, product.batches.reduce((sum, batch) => sum + batch.quantity, 0)]));
  const lowStock = lowStockProducts.filter((product) => (stockByProduct.get(product.id) ?? 0) <= product.reorderPoint).map((product) => ({ id: product.id, name: product.name, quantity: stockByProduct.get(product.id) ?? 0, reorderPoint: product.reorderPoint })).slice(0, 20);
  const topProducts = topItems.length ? await prisma.product.findMany({ where: { tenantId: session.tenantId, id: { in: topItems.map((item) => item.productId) } }, select: { id: true, name: true } }) : [];
  const productById = new Map(topProducts.map((product) => [product.id, product.name]));
  const trend = Array.from({ length: 7 }, (_, index) => { const date = new Date(startTrend); date.setDate(date.getDate() + index); const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; const sales = trendSales.filter((sale) => sale.createdAt.getFullYear() === date.getFullYear() && sale.createdAt.getMonth() === date.getMonth() && sale.createdAt.getDate() === date.getDate()).reduce((sum, sale) => sum + Number(sale.total), 0); return { date: key, sales }; });

  return NextResponse.json({ data: {
    today: { sales: Number(todaySales._sum.total ?? 0), transactions: todaySales._count._all },
    month: { sales: Number(monthSales._sum.total ?? 0), transactions: monthSales._count._all },
    products: products.length,
    stockUnits: batches.reduce((sum, batch) => sum + batch.quantity, 0),
    lowStock,
    expiring,
    topProducts: topItems.map((item) => ({ productId: item.productId, name: productById.get(item.productId) ?? "Alaab la tirtiray", quantity: item._sum.quantity ?? 0 })),
    recentSales: recentSales.map((sale) => ({ ...sale, total: Number(sale.total) })),
    trend,
  } });
}
