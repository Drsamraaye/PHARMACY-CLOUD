import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
/** Lists the signed-in tenant's active laboratory products and their aggregate stock. */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const data = await prisma.product.findMany({
    where: { tenantId: session.tenantId, ...(session.branchId ? { branchId: session.branchId } : {}), type: "LAB", isActive: true },
    include: { batches: true }, orderBy: { name: "asc" }, take: 500,
  });
  return NextResponse.json({ data: data.map(({ batches, ...product }) => ({ ...product, quantity: batches.reduce((sum, batch) => sum + batch.quantity, 0) })) });
}
