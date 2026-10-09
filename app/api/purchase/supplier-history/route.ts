import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Returns supplier purchase history and per-product totals for the history report. */
export async function GET(req: NextRequest) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supplierId = req.nextUrl.searchParams.get("supplierId"); const productId = req.nextUrl.searchParams.get("productId");
  if (!supplierId) return NextResponse.json({ error: "Choose a supplier" }, { status: 400 });
  const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, tenantId: session.tenantId, ...(session.branchId ? { branchId: session.branchId } : {}) }, select: { id: true, name: true } });
  if (!supplier) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
  const purchases = await prisma.purchase.findMany({ where: { tenantId: session.tenantId, supplierId, ...(session.branchId ? { branchId: session.branchId } : {}) }, include: { items: { include: { product: { select: { id: true, name: true } } } } }, orderBy: { createdAt: "desc" }, take: 2000 });
  const productOptions = [...new Map(purchases.flatMap((purchase) => purchase.items.map((item) => [item.productId, { id: item.productId, name: item.product.name }]))).values()].sort((a, b) => a.name.localeCompare(b.name));
  const entries = purchases.flatMap((purchase) => purchase.items.filter((item) => !productId || item.productId === productId).map((item) => ({ id: item.id, date: purchase.createdAt, user: "—", productId: item.productId, product: item.product.name, quantity: item.quantity, price: Number(item.costPrice), total: item.quantity * Number(item.costPrice) })));
  return NextResponse.json({ data: { supplier, products: productOptions, entries, summary: { timesPurchased: entries.length, totalQuantity: entries.reduce((sum, item) => sum + item.quantity, 0), totalCost: entries.reduce((sum, item) => sum + item.total, 0) } } });
}
