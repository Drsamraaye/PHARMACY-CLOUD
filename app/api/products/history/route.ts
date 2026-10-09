import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Lists recent product creation and catalog change events for the current tenant. */
export async function GET(req: NextRequest) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const productId = req.nextUrl.searchParams.get("productId") || undefined;
  const data = await prisma.productHistory.findMany({ where: { tenantId: session.tenantId, ...(productId ? { productId } : {}), ...(session.branchId ? { product: { branchId: session.branchId } } : {}) }, include: { product: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" }, take: 500 });
  return NextResponse.json({ data });
}
