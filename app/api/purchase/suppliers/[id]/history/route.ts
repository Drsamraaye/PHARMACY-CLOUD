import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
type Context = { params: Promise<{ id: string }> };

/** Lists purchase history and spend totals for one tenant supplier. */
export async function GET(req: NextRequest, { params }: Context) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params; const supplier = await prisma.supplier.findFirst({ where: { id, tenantId: session.tenantId, ...(session.branchId ? { branchId: session.branchId } : {}) } });
  if (!supplier) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
  const purchases = await prisma.purchase.findMany({ where: { tenantId: session.tenantId, supplierId: id, ...(session.branchId ? { branchId: session.branchId } : {}) }, include: { items: { include: { product: true } } }, orderBy: { createdAt: "desc" }, take: 1000 });
  return NextResponse.json({ data: { supplier, purchases, totalSpend: purchases.reduce((sum, item) => sum + Number(item.total), 0) } });
}
