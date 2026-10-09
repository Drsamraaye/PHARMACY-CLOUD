import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Returns purchase records with supplier and item detail. */
export async function GET(req: NextRequest) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supplierId = req.nextUrl.searchParams.get("supplierId"); const status = req.nextUrl.searchParams.get("status");
  const from = req.nextUrl.searchParams.get("from"); const to = req.nextUrl.searchParams.get("to");
  const data = await prisma.purchase.findMany({ where: { tenantId: session.tenantId, ...(session.branchId ? { branchId: session.branchId } : {}), ...(supplierId ? { supplierId } : {}), ...(status ? { status } : {}), ...(from || to ? { createdAt: { ...(from ? { gte: new Date(`${from}T00:00:00`) } : {}), ...(to ? { lte: new Date(`${to}T23:59:59.999`) } : {}) } } : {}) }, include: { supplier: true, items: { include: { product: true } } }, orderBy: { createdAt: "desc" }, take: 1000 });
  return NextResponse.json({ data });
}
