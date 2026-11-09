import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Lists in-stock batches by expiry date, constrained to the current tenant and branch. */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const requestedMonths = Number(req.nextUrl.searchParams.get("months") || 3);
  const months = Number.isFinite(requestedMonths) ? Math.min(24, Math.max(1, requestedMonths)) : 3;
  const search = req.nextUrl.searchParams.get("search")?.trim() || "";
  const month = req.nextUrl.searchParams.get("month");
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const until = new Date(now); until.setMonth(until.getMonth() + months);
  const monthStart = month && /^\d{4}-\d{2}$/.test(month) ? new Date(`${month}-01T00:00:00`) : undefined;
  const monthEnd = monthStart ? new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1) : undefined;
  const batches = await prisma.productBatch.findMany({
    where: {
      quantity: { gt: 0 },
      expiryDate: { not: null, ...(monthStart && monthEnd ? { gte: monthStart, lt: monthEnd } : { lte: until }) },
      product: { tenantId: session.tenantId, isActive: true, ...(search ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { genericName: { contains: search, mode: "insensitive" } }, { barcode: { contains: search, mode: "insensitive" } }] } : {}), ...(session.branchId ? { branchId: session.branchId } : {}) },
    },
    include: { product: { include: { branch: { select: { name: true } } } }, supplier: { select: { id: true, name: true } } },
    orderBy: { expiryDate: "asc" }, take: 3000,
  });
  const data = batches.map((batch) => {
    const daysUntilExpiry = Math.ceil((batch.expiryDate!.getTime() - now.getTime()) / 86_400_000);
    const classification = daysUntilExpiry < 0 ? "EXPIRED" : daysUntilExpiry <= 30 ? "WITHIN_30_DAYS" : daysUntilExpiry <= 60 ? "WITHIN_60_DAYS" : daysUntilExpiry <= 90 ? "WITHIN_90_DAYS" : "VALID";
    return { ...batch, daysUntilExpiry, classification };
  });
  return NextResponse.json({ data });
}
