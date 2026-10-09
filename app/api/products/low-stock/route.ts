import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Lists active products whose combined batch stock is at or below the reorder point. */
export async function GET(req: NextRequest) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const products = await prisma.product.findMany({ where: { tenantId: session.tenantId, isActive: true, ...(session.branchId ? { branchId: session.branchId } : {}) }, include: { batches: true }, orderBy: { name: "asc" } });
  const data = products.map(({ batches, ...product }) => ({ ...product, quantity: batches.reduce((sum, batch) => sum + batch.quantity, 0) })).filter((product) => product.quantity <= product.reorderPoint);
  return NextResponse.json({ data });
}
