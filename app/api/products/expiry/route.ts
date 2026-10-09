import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Lists positive stock batches expiring within the requested calendar-month window. */
export async function GET(req: NextRequest) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const requestedMonths = Number(req.nextUrl.searchParams.get("months") || 3); const months = Number.isFinite(requestedMonths) ? Math.min(24, Math.max(1, requestedMonths)) : 3;
  const search = req.nextUrl.searchParams.get("search")?.trim() || "";
  const now = new Date(); const until = new Date(now); until.setMonth(until.getMonth() + months);
  const batches = await prisma.productBatch.findMany({ where: { expiryDate: { gte: now, lte: until }, quantity: { gt: 0 }, product: { tenantId: session.tenantId, isActive: true, ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}), ...(session.branchId ? { branchId: session.branchId } : {}) } }, include: { product: { include: { branch: { select: { name: true } } } } }, orderBy: { expiryDate: "asc" }, take: 3000 });
  return NextResponse.json({ data: batches });
}
