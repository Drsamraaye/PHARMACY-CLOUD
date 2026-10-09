import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Lists open supplier bills with their remaining balances. */
export async function GET(req: NextRequest) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supplierId = req.nextUrl.searchParams.get("supplierId");
  const search = req.nextUrl.searchParams.get("search")?.trim();
  const data = await prisma.purchase.findMany({ where: { tenantId: session.tenantId, status: { in: ["UNPAID", "PARTIAL"] }, ...(session.branchId ? { branchId: session.branchId } : {}), ...(supplierId ? { supplierId } : {}), ...(search ? { OR: [{ invoiceNo: { contains: search, mode: "insensitive" } }, { notes: { contains: search, mode: "insensitive" } }, { supplier: { is: { name: { contains: search, mode: "insensitive" } } } }] } : {}) }, include: { supplier: true, branch: { select: { id: true, name: true } }, items: { include: { product: true } } }, orderBy: { createdAt: "desc" }, take: 1000 });
  return NextResponse.json({ data: data.map((bill) => ({ ...bill, balance: Math.max(0, Number(bill.total) - Number(bill.paidAmount)) })) });
}
